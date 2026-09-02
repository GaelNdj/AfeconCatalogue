#!/usr/bin/env python3
"""
Extraction catalogue CEDEO — images pièces, netteté native (sans zoom).

- Pixels natifs du PDF (pas de rendu ×3 qui agrandissait ~44 %)
- PNG sans recompression JPEG
- Ignore les photos de personnes / lifestyle
- Marge blanche pour éviter un recadrage trop serré

Usage:
  python3 scripts/extract_catalog_hq.py
"""

import hashlib
import json
import math
import os
import re
import sys
from collections import Counter

import openpyxl
import pypdfium2 as pdfium
from openpyxl.styles import Alignment, Font, PatternFill
from PIL import Image

PDF_PATH = "/Users/gael/Downloads/cata_pro_2026_idf_368_enrich.pdf"
OUTPUT_PATH = "/Users/gael/Desktop/catalogue_pro_2026_hq.xlsx"
IMAGE_DIR = "/Users/gael/Desktop/catalogue_pro_2026_images_hq"
IMAGE_REL = "catalogue_pro_2026_images_hq"
# Native pixels only — no page render upsample (that zoomed photos ~1.44x).
PAD_FRAC = 0.12
IMAGE_EXT = "png"
DEBUG_LOG = "/Users/gael/Documents/htdocs/AfeconCatalogue/.cursor/debug-913862.log"

COLUMNS = [
    "Réf.Pro",
    "Réf.Four",
    "Diamètre",
    "Vendu par",
    "Marque",
    "Désignation",
    "Code",
    "Famille",
    "Catégorie",
    "Prix HT",
    "Note",
    "Image",
]

SKIP_LINE = (
    "COMMANDEZ EN LIGNE",
    "DISPONIBLE",
    "SOUS 24H",
    "SOUS 3 JOURS",
    "SUR COMMANDE",
    "ECO-CONTRIBUTION",
    "PRIX INDICATIF",
    "RÉVISABLE",
    "ARTICLE TOP PRIX",
    "BAISSE",
    "NOSPRIX",
    "CEDEO.FR",
    "RETOUVEZ TOUTE",
    "UNE QUESTION",
)

BRANDS = [
    "JACOB DELAFON", "IDEAL STANDARD", "HANSGROHE", "SAUNIER DUVAL",
    "DE DIETRICH", "ELM LEBLANC", "SYNTHÈSE MINÉRAL", "CONEX",
    "ALTECH", "WIELAND", "TALOS", "STARFIX", "SANCO", "CUPROLIFE",
    "WICU", "REHAU", "MICROFLEX", "GROHE", "PORCHER", "GEBERIT",
    "DURAVIT", "VILLEROY", "ROCA", "ACQUABELLA", "KINEDO", "SANITRIT",
    "SFA", "ATLANTIC", "THERMOR", "CHAPPEE", "VIESSMANN", "BOSCH",
    "DAIKIN", "MITSUBISHI", "HITACHI", "TOSHIBA", "PANASONIC",
    "AIRWELL", "FRISQUET", "NOVELLINI", "WIRQUIN", "VALENTIN",
    "PRESTO", "DELABIE", "SCHELL", "WATTS", "HONEYWELL", "DANFOSS",
    "CALEFFI", "GIACOMINI", "COMAP", "SOMATHERM", "NICOLL", "GEBO",
    "NOVIPRO", "KALDEWEI", "SIAMP", "SYNTHÈSE",
]

FAMILLE_RULES = [
    (["OUTILLAGE", "EPI", "NOVIPRO", "FRIGORISTE"], "Outillage"),
    (["CARRELAGE", "REVÊTEMENT", "REVETEMENT"], "Revêtements"),
    (
        [
            "CHAUDI", "P.A.C", "PAC ", "AIR/EAU", "AIR/AIR", "RADIATEUR",
            "CLIM", "VENTIL", "CHAUFFE", "FUMIST", "CHAUFF", "GÉNIE CLIM",
            "GENIE CLIM", "PLANCHE", "THERMOSTAT", "POMPE À CHALEUR",
            "POMPES À CHALEUR",
        ],
        "Génie climatique",
    ),
    (
        [
            "RACCORD", "TUBE", "CUIVRE", "LAITON", "PER", "MULTICOUCHE",
            "PVC", "FONTE", "ACIER", "INOX", "PLOMBERIE", "SERTIR",
            "ELECTROZINGU",
        ],
        "Plomberie",
    ),
    (
        [
            "RECEVEUR", "PAROI", "DOUCHE", "BAIN", "WC", "LAVABO",
            "SANITAIRE", "ROBINET", "MITIGEUR", "ABATTANT", "MEUBLE",
            "VIDAGE", "SIPHON", "BONDE",
        ],
        "Sanitaire",
    ),
]

CODE_RE = re.compile(r"\b(\d{7})\b")
PRICE_RE = re.compile(r"(\d{1,5}[.,]\d{2})\s*$")
PRICE_COURS_RE = re.compile(r"prix\s*[àa]?\s*cours", re.I)
DIAM_RE = re.compile(
    r"^(\d{1,2}(?:[-/]\d{1,2})?(?:[xX×]\d{1,2}){0,2}(?:-\d{1,2})?)$"
)
SIZE_RE = re.compile(
    r"(\d{2,4}\s*[xX×]\s*\d{2,4}(?:\s*[xX×]\s*\d{2,4})?\s*(?:cm|mm)?|\d{2,4}\s*cm)\b",
    re.I,
)
BULLET_NOTE_RE = re.compile(r"^[●•▪]\s*(.+)$")
HEADER_ROW_RE = re.compile(
    r"(RéfPro|Réf\.?\s*Four|Prix HT|Vendu par|Désignation|Poids)",
    re.I,
)
ILLEGAL_XLSX = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
WRAP_END_RE = re.compile(r"\d+\s*[xX×]\s*\d*\s*$")


def clean_spaces(s):
    return re.sub(r"\s+", " ", (s or "").replace("\xa0", " ")).strip()


def sanitize_cell(val):
    if val is None:
        return ""
    s = ILLEGAL_XLSX.sub(" ", str(val))
    return clean_spaces(s)


def is_skip_line(line):
    up = line.upper()
    return any(k in up for k in SKIP_LINE)


def normalize_price(raw):
    if not raw:
        return ""
    if PRICE_COURS_RE.search(raw):
        return "Prix à cours"
    raw = raw.replace(" ", "").replace(".", ",")
    m = re.match(r"^(\d+),(\d{2})$", raw)
    if not m:
        return ""
    val = float(f"{m.group(1)}.{m.group(2)}")
    if val == 0.01 or val <= 0 or val > 20000:
        return ""
    return f"{m.group(1)},{m.group(2)}"


def detect_brand(text):
    up = text.upper()
    for b in BRANDS:
        if b in up:
            if b in ("SYNTHÈSE", "SYNTHÈSE MINÉRAL"):
                return "SYNTHÈSE MINÉRAL"
            if b == "ALTECH":
                return "Altech"
            return b.title() if b != b.upper() else b
    return ""


def infer_famille(category, title):
    blob = f"{category} {title}".upper()
    for keys, famille in FAMILLE_RULES:
        if any(k in blob for k in keys):
            return famille
    return "Autres"


def looks_like_product_title(line):
    line = clean_spaces(line)
    line = re.sub(r"^\d{1,4}(?=[A-ZÀ-Ÿ])", "", line).strip()
    if not (6 <= len(line) <= 90):
        return False
    if CODE_RE.search(line) or PRICE_RE.search(line):
        return False
    if HEADER_ROW_RE.search(line) or is_skip_line(line):
        return False
    up = line.upper()
    if any(k in up for k in ("PRODUITS DISPONIBLES", "6 000", "6000 PRODUITS", "EN AGENCE")):
        return False
    letters = [c for c in line if c.isalpha()]
    if not letters:
        return False
    return sum(c.isupper() for c in letters) / len(letters) >= 0.45


def detect_category(page_text, pending=""):
    lines = [clean_spaces(x) for x in page_text.splitlines() if clean_spaces(x)]
    candidates = []
    for line in lines[:12]:
        if is_skip_line(line) or CODE_RE.search(line):
            continue
        line2 = re.sub(r"^\d{1,4}(?=[A-ZÀ-Ÿ ])", "", line).strip()
        up = line2.upper()
        if any(
            k in up
            for k in (
                "RECEVEUR", "RACCORD", "TUBE", "ROBINET", "CHAUFFE", "RADIATEUR",
                "PAROI", "WC", "LAVABO", "DOUCHE", "MITIGEUR", "POMPE", "CLIM",
                "VENTIL", "CARRELAGE", "OUTILLAGE", "LAITON", "CUIVRE",
                "MULTICOUCHE", "ABATTANT",
            )
        ) and 8 <= len(line2) <= 80:
            candidates.append(line2)
    if candidates:
        return max(candidates, key=lambda s: (s.isupper(), len(s) < 45, -len(s)))
    return pending


def merge_wrapped_lines(lines):
    out = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if not CODE_RE.search(line) and i + 1 < n:
            nxt = lines[i + 1]
            join = False
            if WRAP_END_RE.search(line):
                join = True
            elif re.match(r"^(cm|mm)\b", nxt, re.I) and re.search(r"\d", line):
                join = True
            if join:
                combined = clean_spaces(line + " " + nxt)
                i += 1
                if not CODE_RE.search(combined) and i + 1 < n and CODE_RE.search(lines[i + 1]):
                    combined = clean_spaces(combined + " " + lines[i + 1])
                    i += 1
                out.append(combined)
                i += 1
                continue
        out.append(line)
        i += 1
    return out


def is_supplier_ref(tok):
    if not re.fullmatch(r"[A-Z0-9._-]{6,}", tok, re.I):
        return False
    if not re.search(r"[A-Za-z]", tok):
        return False
    if re.fullmatch(r"\d{1,2}(?:[-/]\d{1,2})?(?:[xX×]\d{1,2}){1,2}(?:-\d{1,2})?", tok):
        return False
    return True


def parse_product_row(line, current_vendu=""):
    line = clean_spaces(line)
    if HEADER_ROW_RE.search(line) and not CODE_RE.search(line):
        return None
    codes = CODE_RE.findall(line)
    if not codes:
        return None
    code = codes[-1]
    if len(set(code)) == 1:
        return None

    before, after = line.rsplit(code, 1)
    before = before.strip(" -•●")
    after = after.strip()

    price = ""
    if PRICE_COURS_RE.search(after) or PRICE_COURS_RE.search(line):
        price = "Prix à cours"
    else:
        pm = PRICE_RE.search(after) or PRICE_RE.search(line)
        if pm:
            price = normalize_price(pm.group(1))

    tokens = before.split()
    if tokens and re.fullmatch(r"[abcABC●•]", tokens[0]):
        tokens = tokens[1:]

    reference = ""
    ref_four = ""
    vendu = current_vendu
    diametre = ""
    designation_extra = ""

    if tokens:
        idx = len(tokens) - 1
        while idx >= 0:
            tok = tokens[idx]
            if re.fullmatch(r"\d{3,5}", tok):
                reference = tok
                tokens = tokens[:idx]
                break
            if is_supplier_ref(tok):
                ref_four = tok
                tokens = tokens[:idx]
                idx -= 1
                continue
            break

        while tokens and is_supplier_ref(tokens[-1]):
            ref_four = tokens[-1]
            tokens = tokens[:-1]
        if tokens and re.fullmatch(r"\d{1,3},\d{1,2}", tokens[-1]):
            tokens = tokens[:-1]
        if tokens and re.fullmatch(r"(1|2|5|10|20|25|50)", tokens[-1]):
            vendu = tokens[-1]
            tokens = tokens[:-1]

        rest = " ".join(tokens).strip()
        if rest:
            compact = rest.replace(" ", "")
            if DIAM_RE.match(compact) or DIAM_RE.match(rest):
                diametre = compact.replace("×", "X").replace("x", "X")
            else:
                designation_extra = rest
                sm = SIZE_RE.search(rest)
                if sm:
                    diametre = clean_spaces(sm.group(1))
                    diametre = re.sub(r"\s*[xX×]\s*", " x ", diametre)

    if not price and not designation_extra and not diametre and not reference:
        return None

    return {
        "Réf.Pro": reference,
        "Réf.Four": ref_four,
        "Diamètre": diametre,
        "Vendu par": vendu,
        "extra": designation_extra,
        "Code": code,
        "Prix HT": price,
    }


def build_designation(category, title, extra):
    cat = clean_spaces(category)
    tit = clean_spaces(title)
    ext = clean_spaces(extra)
    if cat and tit and tit.upper().startswith(cat.upper()):
        base = tit
    elif cat and tit and any(k in cat.upper() for k in ("RACCORD", "TUBE")):
        base = f"{cat} {tit}"
    else:
        base = tit or cat
    if ext and ext.upper() not in base.upper():
        if ext.lower() not in base.lower():
            base = f"{base} {ext}".strip()
    return clean_spaces(base)


def extract_page_text(page):
    tp = page.get_textpage()
    return tp.get_text_bounded() if tp else ""


def debug_log(hypothesis_id, location, message, data):
    # #region agent log
    try:
        payload = {
            "sessionId": "913862",
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(__import__("time").time() * 1000),
        }
        with open(DEBUG_LOG, "a") as f:
            f.write(json.dumps(payload) + "\n")
    except Exception:
        pass
    # #endregion


def pad_white(pil, frac=PAD_FRAC):
    """Marge blanche pour éviter un recadrage trop serré (effet zoom)."""
    w, h = pil.size
    mx = max(8, int(w * frac))
    my = max(8, int(h * frac))
    canvas = Image.new("RGB", (w + 2 * mx, h + 2 * my), (255, 255, 255))
    canvas.paste(pil, (mx, my))
    return canvas


def person_photo_features(pil):
    thumb = pil.resize((64, 64))
    pix = list(thumb.getdata())
    n = len(pix)
    white = skin = 0
    bins = Counter()
    for r, g, b in pix:
        if r > 230 and g > 230 and b > 230:
            white += 1
            continue
        if r > 95 and g > 40 and b > 20 and r > g > b and (r - g) > 15 and (r - b) > 20 and r < 230:
            skin += 1
        bins[(r // 32, g // 32, b // 32)] += 1
    white_r = white / n
    skin_r = skin / n
    total = sum(bins.values()) or 1
    entropy = 0.0
    for c in bins.values():
        p = c / total
        entropy -= p * math.log2(p)
    return white_r, skin_r, entropy


def looks_like_person(pil):
    """Photos de personnes / lifestyle — pas les pièces (laiton ≠ visage)."""
    w, h = pil.size
    white, skin, entropy = person_photo_features(pil)
    # Visages : peau modérée + couleurs variées. Les pièces laiton ont skin > 0.5.
    if 0.035 <= skin <= 0.42 and entropy >= 5.0 and white < 0.50:
        return True, {"white": round(white, 3), "skin": round(skin, 3), "entropy": round(entropy, 2)}
    # Portraits / scènes large (équipe, showroom)
    if w >= 300 and h >= 220 and 0.04 <= skin <= 0.40 and entropy >= 4.5 and white < 0.50:
        return True, {"white": round(white, 3), "skin": round(skin, 3), "entropy": round(entropy, 2), "large": True}
    return False, {"white": round(white, 3), "skin": round(skin, 3), "entropy": round(entropy, 2)}


def save_hq_image(pil, dest):
    """PNG lossless à résolution native — pas d'agrandissement."""
    pil.save(dest, "PNG", optimize=True)


def extract_product_photos(page, page_idx, image_dir, hash_to_name, skip_stats):
    """Extrait les photos natives des pièces (pas de rendu ×3, pas de personnes)."""
    pw, ph = page.get_size()
    photos = []
    img_i = 0

    for obj in page.get_objects():
        if type(obj).__name__ != "PdfImage":
            continue
        try:
            px_w, px_h = obj.get_px_size()
        except Exception:
            continue
        if min(px_w, px_h) < 70:
            continue
        if max(px_w, px_h) / max(1, min(px_w, px_h)) > 3.2:
            continue
        try:
            bounds = obj.get_bounds()
        except Exception:
            continue
        x0, y0, x1, y1 = bounds
        y_top = ph - max(y0, y1)
        if y_top < ph * 0.04 or y_top > ph * 0.92:
            continue

        try:
            pil = obj.get_bitmap().to_pil().convert("RGB")
        except Exception:
            continue
        if pil.width < 70 or pil.height < 70:
            continue

        display_w = abs(x1 - x0)
        native_w = pil.width
        # #region agent log
        if skip_stats["logged"] < 8:
            debug_log(
                "A",
                "extract_catalog_hq.py:extract_product_photos",
                "native vs display size",
                {
                    "page": page_idx + 1,
                    "native": [pil.width, pil.height],
                    "display_pt": [round(display_w, 1), round(abs(y1 - y0), 1)],
                    "upsample_if_scale3": round(display_w * 3 / max(1, native_w), 2),
                },
            )
            skip_stats["logged"] += 1
        # #endregion

        is_person, feats = looks_like_person(pil)
        if is_person:
            skip_stats["people"] += 1
            # #region agent log
            if skip_stats["people"] <= 12:
                debug_log(
                    "C",
                    "extract_catalog_hq.py:looks_like_person",
                    "skipped person/lifestyle photo",
                    {"page": page_idx + 1, **feats, "size": [pil.width, pil.height]},
                )
            # #endregion
            continue

        pil = pad_white(pil)

        raw = pil.tobytes()
        digest = hashlib.md5(raw).hexdigest()
        if digest in hash_to_name:
            fname = hash_to_name[digest]
        else:
            fname = f"p{page_idx + 1:04d}_{img_i:02d}.{IMAGE_EXT}"
            dest = os.path.join(image_dir, fname)
            save_hq_image(pil, dest)
            hash_to_name[digest] = fname
            img_i += 1
            skip_stats["kept"] += 1

        photos.append({"x": (x0 + x1) / 2, "y": y_top, "file": fname})

    photos.sort(key=lambda p: (p["x"] > pw / 2, p["y"]))
    return photos


def find_title_y(tp, title, page_h):
    if not title or not tp:
        return None
    needle = title[:24]
    try:
        text = tp.get_text_range().replace("\r", " ").replace("\n", " ")
    except Exception:
        return None
    pos = text.find(needle)
    if pos < 0:
        pos = text.upper().find(needle.upper())
    if pos < 0:
        return None
    try:
        box = tp.get_charbox(pos)
        return page_h - box[3]
    except Exception:
        return None


def nearest_photo(photos, title_y, title_x_hint, page_w):
    if not photos:
        return ""
    col_left = title_x_hint is None or title_x_hint < page_w / 2
    same = [p for p in photos if (p["x"] < page_w / 2) == col_left]
    pool = same or photos
    if title_y is None:
        return pool[0]["file"]
    best = min(
        pool,
        key=lambda p: abs(p["y"] - title_y) + abs(p["x"] - (title_x_hint or p["x"])) * 0.15,
    )
    return best["file"]


def process_pdf():
    if not os.path.isfile(PDF_PATH):
        print(f"PDF introuvable: {PDF_PATH}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(IMAGE_DIR, exist_ok=True)
    pdf = pdfium.PdfDocument(PDF_PATH)
    products = []
    seen = set()
    hash_to_name = {}
    skip_stats = {"people": 0, "kept": 0, "logged": 0}
    pending = {"category": "", "title": "", "brand": "", "note": "", "vendu": "", "image": ""}

    for idx in range(len(pdf)):
        page = pdf[idx]
        text = extract_page_text(page)
        if not text.strip():
            continue
        pw, ph = page.get_size()
        tp = page.get_textpage()

        cat = detect_category(text, pending["category"])
        if cat:
            pending["category"] = cat
        page_brand = detect_brand(text)
        if page_brand:
            pending["brand"] = page_brand

        photos = extract_product_photos(page, idx, IMAGE_DIR, hash_to_name, skip_stats)

        raw_lines = [clean_spaces(x) for x in text.splitlines() if clean_spaces(x)]
        lines = merge_wrapped_lines(raw_lines)

        for line in lines:
            if is_skip_line(line):
                continue
            bm = BULLET_NOTE_RE.match(line)
            if bm:
                note = clean_spaces(bm.group(1))
                if note and not CODE_RE.search(note):
                    pending["note"] = note.upper()
                continue

            if looks_like_product_title(line) and not (len(line) > 70 and line.count(" ") > 8):
                title = re.sub(r"^\d{1,4}(?=[A-ZÀ-Ÿ])", "", line).strip()
                pending["title"] = title
                pending["note"] = ""
                pending["vendu"] = ""
                b = detect_brand(line)
                if b:
                    pending["brand"] = b
                ty = find_title_y(tp, title, ph)
                pending["image"] = nearest_photo(photos, ty, None, pw)
                continue

            parsed = parse_product_row(line, pending["vendu"])
            if not parsed:
                continue
            code = parsed["Code"]
            if code in seen:
                continue
            seen.add(code)

            title = pending["title"]
            category = pending["category"]
            extra = parsed.get("extra") or ""
            designation = build_designation(category, title, extra)
            brand = pending["brand"]
            if not brand and any(
                k in (title or "").upper()
                for k in ("COUDE", "COURBE", "RACCORD", "MANCHON", "MAMELON", "TÉ")
            ):
                brand = "Altech"
            if any(k in (category or "").upper() for k in ("RACCORDS CUIVRE", "RACCORDS LAITON")):
                if brand.upper() in ("CUPROLIFE", "STARFIX", "WICU", "SANCO", "WIELAND", "ALTECH"):
                    if not any(
                        k in (title or "").upper()
                        for k in ("STARFIX", "CUPROLIFE", "WICU", "SANCO")
                    ):
                        brand = "Altech"

            img = pending["image"]
            img_path = f"{IMAGE_REL}/{img}" if img else ""

            products.append(
                {
                    "Réf.Pro": parsed["Réf.Pro"],
                    "Réf.Four": parsed["Réf.Four"],
                    "Diamètre": parsed["Diamètre"],
                    "Vendu par": parsed["Vendu par"],
                    "Marque": brand,
                    "Désignation": designation,
                    "Code": code,
                    "Famille": infer_famille(category, title),
                    "Catégorie": category,
                    "Prix HT": parsed["Prix HT"],
                    "Note": pending["note"],
                    "Image": img_path,
                }
            )

        if (idx + 1) % 25 == 0:
            print(
                f"Page {idx + 1}/{len(pdf)} -> {len(products)} produits, "
                f"{len(hash_to_name)} images (natif PNG, personnes exclues={skip_stats['people']})",
                flush=True,
            )

    print(
        f"Terminé {len(pdf)} pages -> {len(products)} produits, "
        f"{len(hash_to_name)} images pièces, {skip_stats['people']} photos personnes ignorées",
        flush=True,
    )
    # #region agent log
    debug_log(
        "A,C",
        "extract_catalog_hq.py:process_pdf",
        "extraction complete",
        {
            "products": len(products),
            "images_kept": len(hash_to_name),
            "people_skipped": skip_stats["people"],
            "native_png": True,
            "pad_frac": PAD_FRAC,
        },
    )
    # #endregion
    return products


def write_excel(products):
    products.sort(
        key=lambda p: (
            p.get("Famille") or "",
            p.get("Catégorie") or "",
            p.get("Désignation") or "",
            p.get("Note") or "",
            p.get("Code") or "",
        )
    )
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Produits"
    fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
    font = Font(color="FFFFFF", bold=True)
    align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for c, name in enumerate(COLUMNS, 1):
        cell = ws.cell(1, c, name)
        cell.fill = fill
        cell.font = font
        cell.alignment = align
    for r, p in enumerate(products, 2):
        for c, name in enumerate(COLUMNS, 1):
            cell = ws.cell(r, c, sanitize_cell(p.get(name, "")))
            cell.alignment = Alignment(
                vertical="center", wrap_text=name in ("Désignation", "Note")
            )
    widths = {
        "A": 12, "B": 16, "C": 16, "D": 12, "E": 18, "F": 50,
        "G": 12, "H": 20, "I": 28, "J": 12, "K": 26, "L": 40,
    }
    for col, width in widths.items():
        ws.column_dimensions[col].width = width
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:L{max(1, len(products) + 1)}"
    wb.save(OUTPUT_PATH)


def main():
    print(f"PDF: {PDF_PATH}")
    print(f"Images pièces (natif, sans zoom ×3) -> {IMAGE_DIR}")
    print(f"Excel -> {OUTPUT_PATH}")
    products = process_pdf()
    write_excel(products)
    priced = sum(1 for p in products if p.get("Prix HT"))
    imaged = sum(1 for p in products if p.get("Image"))
    print(f"\nExporté {len(products)} produits -> {OUTPUT_PATH}")
    print(f"Dossier images -> {IMAGE_DIR}")
    print(f"Avec prix: {priced}/{len(products)} ({100 * priced / max(1, len(products)):.1f}%)")
    print(f"Avec image: {imaged}/{len(products)} ({100 * imaged / max(1, len(products)):.1f}%)")
    print("Familles:", Counter(p.get("Famille") or "?" for p in products).most_common())


if __name__ == "__main__":
    main()
