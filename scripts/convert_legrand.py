#!/usr/bin/env python3
"""
Convertit un export Legrand (.numbers ou .xlsx) vers le format d'import AfeconCatalogue.

Usage:
  python scripts/convert_legrand.py ~/Downloads/fichier-elect-test.numbers
  python scripts/convert_legrand.py export.xlsx -o ~/Desktop/catalogue/electricite_legrand.xlsx
  python scripts/convert_legrand.py export.xlsx --download-images -o out.xlsx
  python scripts/convert_legrand.py export.xlsx --download-images --playwright --workers 4

Colonnes Legrand reconnues (ligne d'en-tête) :
  Marque, Référence, GENCOD, Désignation, Tarif unitaire HT, Libellé Famille Remise,
  Conditionnement de base, Lien vers fiche produit legrand.fr, …
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import openpyxl
from openpyxl import Workbook

OUTPUT_COLUMNS = [
    "Réf.Pro",
    "Réf.Four",
    "Diamètre",
    "Vendu par",
    "Marque",
    "Désignation",
    "Variante",
    "Ordre",
    "Code",
    "Code interne",
    "Famille",
    "Catégorie",
    "Prix HT",
    "Note",
    "Image",
]

# En-têtes Legrand → clé interne
HEADER_MAP = {
    "marque": "brand",
    "référence": "reference",
    "reference": "reference",
    "gencod": "gencod",
    "désignation": "designation",
    "designation": "designation",
    "tarif unitaire ht": "price_ht",
    "tarif nous consulter": "price_quote",
    "libellé famille remise": "category",
    "libelle famille remise": "category",
    "famille remise": "family_code",
    "conditionnement de base": "vendu_par",
    "lien vers fiche produit legrand.fr": "product_url",
    "nature eco-contribution": "eco_nature",
    "code eco-contribution": "eco_code",
}


def norm_header(h) -> str:
    return re.sub(r"\s+", " ", str(h or "").strip().lower())


def read_rows(path: Path) -> list[dict]:
    suffix = path.suffix.lower()
    if suffix == ".numbers":
        try:
            from numbers_parser import Document
        except ImportError:
            print(
                "Installez numbers-parser : pip install numbers-parser",
                file=sys.stderr,
            )
            sys.exit(1)
        doc = Document(str(path))
        table = doc.sheets[0].tables[0]
        raw = []
        for r in range(table.num_rows):
            raw.append([table.cell(r, c).value for c in range(table.num_cols)])
    elif suffix in (".xlsx", ".xls"):
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = None
        for name in ("TPR", "Tarif", "Données", "Data"):
            if name in wb.sheetnames:
                ws = wb[name]
                break
        if ws is None:
            for name in wb.sheetnames:
                candidate = wb[name]
                first = next(candidate.iter_rows(max_row=3, values_only=True), None)
                if first and any(
                    HEADER_MAP.get(norm_header(c)) == "reference" for c in first if c
                ):
                    ws = candidate
                    break
        if ws is None:
            ws = wb.active
        raw = [list(row) for row in ws.iter_rows(values_only=True)]
        wb.close()
    else:
        raise SystemExit(f"Format non supporté : {suffix} (.numbers ou .xlsx)")

    header_row_idx = None
    col_map: dict[int, str] = {}
    for i, row in enumerate(raw):
        for j, cell in enumerate(row):
            key = HEADER_MAP.get(norm_header(cell))
            if key:
                col_map[j] = key
        if col_map:
            header_row_idx = i
            break

    if header_row_idx is None:
        raise SystemExit("En-têtes Legrand introuvables (Référence, Désignation, …)")

    rows = []
    for row in raw[header_row_idx + 1 :]:
        item = {}
        for j, key in col_map.items():
            if j < len(row):
                v = row[j]
                if v is not None and str(v).strip() != "":
                    item[key] = v
        ref = clean_ref(item.get("reference"))
        if not ref:
            continue
        rows.append(item)
    return rows


def clean_ref(v) -> str | None:
    if v is None:
        return None
    s = str(v).strip().replace(" ", "").replace(".0", "")
    return s or None


def clean_price(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return round(float(v), 4)
    s = str(v).replace(" ", "").replace(",", ".").replace("€", "")
    try:
        return round(float(s), 4)
    except ValueError:
        return None


UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

ECAT_PATTERNS = [
    "https://www.legrand.fr/sites/default/files/ecat/th_LG-{ref}-WEB-PR.jpg",
    "https://www.legrand.fr/sites/default/files/ecat/th_LG-{ref}-WEB-R.jpg",
    "https://www.legrand.fr/sites/default/files/ecat/th_LG-{ref}-WEB-L.jpg",
    "https://www.legrand.fr/sites/default/files/ecat/th_{ref}-LEGRAND-1000.jpg",
    "https://www.legrand.fr/sites/default/files/ecat/th_{ref}_a.jpg",
    "https://www.legrand.fr/sites/default/files/ecat/th_LG-{ref}-WEB-PF.jpg",
    "https://www.legrand.fr/sites/default/files/ecat/th_LG-{ref}-WEB-DECO.jpg",
]


def existing_image(dest_dir: Path, ref: str) -> str | None:
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        p = dest_dir / f"legrand_{ref}{ext}"
        if p.exists() and p.stat().st_size > 500:
            return p.name
    return None


def save_image_bytes(dest_dir: Path, ref: str, data: bytes, content_type: str, url: str) -> str | None:
    if not data or len(data) < 500:
        return None
    ct = (content_type or "").lower()
    if "png" in ct or url.lower().endswith(".png"):
        ext = ".png"
    elif "webp" in ct or ".webp" in url.lower():
        ext = ".webp"
    else:
        ext = ".jpg"
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"legrand_{ref}{ext}"
    (dest_dir / filename).write_bytes(data)
    return filename


def fetch_url_bytes(url: str, timeout: int = 15):
    import ssl
    import urllib.error
    import urllib.request

    ctx = ssl.create_default_context()
    req = urllib.request.Request(
        url,
        headers={"User-Agent": UA, "Accept": "image/*,*/*;q=0.8", "Accept-Language": "fr-FR,fr;q=0.9"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return resp.read(), resp.headers.get("Content-Type", "")
    except (urllib.error.URLError, OSError, ValueError, TimeoutError):
        return None, None


def prefer_jpeg_url(url: str) -> str:
    """og:image Legrand est souvent un .jpg.webp — on préfère le JPEG source."""
    u = url.strip()
    if u.endswith(".jpg.webp"):
        return u[: -len(".webp")]
    if u.endswith(".png.webp"):
        return u[: -len(".webp")]
    return u


def try_direct_ecat(ref: str, dest_dir: Path) -> str | None:
    """Télécharge via les motifs CDN ecat (rapide, ~80 % des refs)."""
    found = existing_image(dest_dir, ref)
    if found:
        return found
    for pattern in ECAT_PATTERNS:
        url = pattern.format(ref=ref)
        data, ctype = fetch_url_bytes(url)
        if data and ctype and "image" in ctype.lower():
            return save_image_bytes(dest_dir, ref, data, ctype, url)
    return None


def extract_product_image_url_from_page(page) -> str | None:
    og = page.locator('meta[property="og:image"]').get_attribute("content")
    if og and "/ecat/" in og:
        return prefer_jpeg_url(og)
    srcs = page.eval_on_selector_all(
        "img",
        """els => els
            .map(e => e.currentSrc || e.src)
            .filter(s => s && s.includes('/ecat/') && !s.toLowerCase().includes('picto'))""",
    )
    if srcs:
        return prefer_jpeg_url(srcs[0])
    return None


def try_playwright_image(page, ref: str, product_url: str | None, dest_dir: Path) -> str | None:
    found = existing_image(dest_dir, ref)
    if found:
        return found
    url = product_url or f"https://www.legrand.fr/reference/{ref}"
    if not str(url).startswith("http"):
        url = f"https://www.legrand.fr/reference/{ref}"
    page.goto(url, wait_until="domcontentloaded", timeout=25000)
    page.wait_for_timeout(1800)
    img_url = extract_product_image_url_from_page(page)
    if not img_url:
        return None
    data, ctype = fetch_url_bytes(img_url)
    if data and ctype and "image" in ctype.lower():
        return save_image_bytes(dest_dir, ref, data, ctype, img_url)
    return None


def download_images_playwright(
    items: list[dict], dest_dir: Path, workers: int = 3
) -> dict[str, str]:
    """Ouvre les fiches legrand.fr (Cloudflare) et extrait og:image / photo produit."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "Playwright manquant : pip install playwright && python3 -m playwright install chromium",
            file=sys.stderr,
        )
        return {}

    from concurrent.futures import ThreadPoolExecutor, as_completed

    dest_dir.mkdir(parents=True, exist_ok=True)
    results: dict[str, str] = {}
    total = len(items)
    if total == 0:
        return results

    print(f"  Playwright : {total} fiches restantes ({workers} navigateurs)…", flush=True)

    def worker(chunk: list[dict], worker_id: int):
        local = {}
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent=UA, locale="fr-FR")
            page = context.new_page()
            done = 0
            for item in chunk:
                ref = clean_ref(item.get("reference"))
                if not ref:
                    continue
                try:
                    name = try_playwright_image(
                        page, ref, item.get("product_url"), dest_dir
                    )
                    if name:
                        local[ref] = name
                except Exception:
                    pass
                done += 1
                if done % 25 == 0 or done == len(chunk):
                    print(
                        f"    nav {worker_id}: {done}/{len(chunk)} — {len(local)} OK",
                        flush=True,
                    )
            browser.close()
        return local

    chunks: list[list[dict]] = [[] for _ in range(max(1, workers))]
    for i, item in enumerate(items):
        chunks[i % len(chunks)].append(item)
    chunks = [c for c in chunks if c]

    with ThreadPoolExecutor(max_workers=len(chunks)) as pool:
        futs = [pool.submit(worker, chunk, i + 1) for i, chunk in enumerate(chunks)]
        for fut in as_completed(futs):
            results.update(fut.result())
    return results


def download_images_batch(
    items: list[dict], dest_dir: Path, workers: int = 8, use_playwright: bool = True
) -> dict[str, str]:
    """Direct CDN d'abord, Playwright pour les refs sans motif connu."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    dest_dir.mkdir(parents=True, exist_ok=True)
    results: dict[str, str] = {}
    pending: list[dict] = []
    total = len(items)
    done = 0
    ok = 0

    def job(item):
        ref = clean_ref(item.get("reference"))
        if not ref:
            return ref, None
        return ref, try_direct_ecat(ref, dest_dir)

    print(f"  CDN ecat ({total} refs, {workers} workers)…", flush=True)
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = {pool.submit(job, item): item for item in items}
        for fut in as_completed(futures):
            item = futures[fut]
            done += 1
            ref, name = fut.result()
            if ref and name:
                results[ref] = name
                ok += 1
            elif ref:
                pending.append(item)
            if done % 400 == 0 or done == total:
                print(f"    CDN : {done}/{total} — {ok} OK, {len(pending)} à scrap", flush=True)

    if use_playwright and pending:
        pw_workers = min(4, max(1, workers // 2 or 1))
        scraped = download_images_playwright(pending, dest_dir, pw_workers)
        results.update(scraped)
        print(f"  Playwright : {len(scraped)}/{len(pending)} OK", flush=True)
    elif pending:
        print(f"  {len(pending)} refs sans image (Playwright désactivé)", flush=True)

    return results


def convert_row(item: dict, family: str, order: int, image_name: str | None) -> dict:
    ref = clean_ref(item.get("reference"))
    designation = str(item.get("designation") or "").strip()
    category = str(item.get("category") or "Divers").strip()
    brand = str(item.get("brand") or "Legrand").strip()
    vendu = item.get("vendu_par")
    vendu_str = str(int(vendu)) if isinstance(vendu, (int, float)) else str(vendu or "1").strip()

    note_parts = []
    if item.get("eco_nature"):
        note_parts.append(str(item["eco_nature"]))
    if item.get("eco_code"):
        note_parts.append(f"éco {item['eco_code']}")
    if item.get("product_url"):
        note_parts.append(str(item["product_url"]))

    price = clean_price(item.get("price_ht"))
    if price is None and item.get("price_quote"):
        price_note = "Tarif nous consulter"
        note_parts.insert(0, price_note)

    return {
        "Réf.Pro": ref,
        "Réf.Four": str(item.get("gencod") or "").strip() or None,
        "Diamètre": None,
        "Vendu par": vendu_str,
        "Marque": brand,
        "Désignation": designation,
        "Variante": category if category != designation else None,
        "Ordre": order,
        "Code": ref,
        "Code interne": None,
        "Famille": family,
        "Catégorie": category,
        "Prix HT": price,
        "Note": " · ".join(note_parts) if note_parts else None,
        "Image": image_name or item.get("product_url"),
    }


def write_xlsx(rows: list[dict], out_path: Path) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Catalogue"
    ws.append(OUTPUT_COLUMNS)
    for row in rows:
        ws.append([row.get(c) for c in OUTPUT_COLUMNS])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out_path)


def main():
    parser = argparse.ArgumentParser(description="Convertir export Legrand → Excel import Afecon")
    parser.add_argument("input", type=Path, help="Fichier .numbers ou .xlsx Legrand")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path.home() / "Desktop" / "catalogue" / "electricite_legrand.xlsx",
    )
    parser.add_argument("--famille", default="Électricité", help="Famille catalogue (défaut: Électricité)")
    parser.add_argument(
        "--download-images",
        action="store_true",
        help="Télécharge les photos (CDN ecat + Playwright sur legrand.fr)",
    )
    parser.add_argument(
        "--no-playwright",
        action="store_true",
        help="Ne pas ouvrir legrand.fr : CDN uniquement (plus rapide, moins d'images)",
    )
    parser.add_argument(
        "--images-dir",
        type=Path,
        default=None,
        help="Dossier images (défaut: ~/Desktop/catalogue/images_hq)",
    )
    parser.add_argument("--workers", type=int, default=6, help="Parallélisme téléchargement images")
    parser.add_argument("--limit", type=int, default=0, help="Limiter à N lignes (test)")
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(f"Fichier introuvable : {args.input}")

    source_rows = read_rows(args.input)
    if args.limit and args.limit > 0:
        source_rows = source_rows[: args.limit]

    images_dir = args.images_dir or (Path.home() / "Desktop" / "catalogue" / "images_hq")
    image_map: dict[str, str] = {}

    if args.download_images:
        print(f"Téléchargement images ({len(source_rows)} refs)…")
        image_map = download_images_batch(
            source_rows,
            images_dir,
            workers=args.workers,
            use_playwright=not args.no_playwright,
        )

    out_rows = []
    for i, item in enumerate(source_rows, start=1):
        ref = clean_ref(item.get("reference"))
        image_name = image_map.get(ref) if ref else None
        out_rows.append(convert_row(item, args.famille, i, image_name))

    write_xlsx(out_rows, args.output)
    print(f"✓ {len(out_rows)} lignes → {args.output}")
    if args.download_images:
        print(f"  Images téléchargées : {len(image_map)} / {len(out_rows)}")
        print(f"  Dossier images : {images_dir}")
        if len(image_map) < len(out_rows) * 0.1:
            print(
                "  ⚠ Peu d'images récupérées — vérifiez Playwright :\n"
                "    pip install playwright && python3 -m playwright install chromium"
            )


if __name__ == "__main__":
    main()
