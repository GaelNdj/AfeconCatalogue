#!/usr/bin/env python3
"""Compare PDF article blocks vs site: same title, several photos, one product."""
import collections
import json
import re
import subprocess
import sys

import fitz

PDF = "/Users/gael/Downloads/cata_pro_2026_idf_368_enrich.pdf"
TITLE_FONT, TITLE_SIZE = "Montserrat-SemiBold", 8.11
CODE_RE = re.compile(r"\b(\d{7})\b")
SKIP_TITLES = {
    "ACCESSOIRES",
    "CODE",
    "RÉGULATION",
    "REGULATION",
    "CARACTÉRISTIQUES",
    "CARACTERISTIQUES",
}


def line_role(spans):
    for span in spans:
        if not (span.get("text") or "").strip():
            continue
        font = span.get("font") or ""
        size = float(span.get("size") or 0)
        if font == TITLE_FONT and abs(size - TITLE_SIZE) < 0.15:
            return "title"
        return ""
    return ""


def page_items(page):
    pw = page.rect.width
    rows = []
    for block in page.get_text("dict").get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            text = "".join(s.get("text", "") for s in line.get("spans", [])).strip()
            if not text:
                continue
            x0, y0, x1, _y1 = line["bbox"]
            if x0 >= pw * 0.90:
                continue
            col = 0 if (x0 + x1) / 2 < pw / 2 else 1
            rows.append((float(y0), col, text, line_role(line.get("spans", []))))
    rows.sort(key=lambda r: (r[1], r[0]))
    return rows, pw


def blocks_on_page(page, page_no):
    rows, _pw = page_items(page)
    by_col = {0: [], 1: []}
    for y, col, text, role in rows:
        by_col[col].append((y, text, role))
    out = []
    for col, items in by_col.items():
        titles = [(i, y, text) for i, (y, text, role) in enumerate(items) if role == "title"]
        for n, (idx, y, title) in enumerate(titles):
            end = titles[n + 1][0] if n + 1 < len(titles) else len(items)
            chunk = items[idx:end]
            codes = []
            seen = set()
            for _y, text, _role in chunk:
                for code in CODE_RE.findall(text):
                    if code not in seen:
                        seen.add(code)
                        codes.append(code)
            if codes:
                out.append(
                    {
                        "page": page_no,
                        "col": col,
                        "y": round(y, 1),
                        "title": re.sub(r"\s+", " ", title).strip(),
                        "codes": codes,
                    }
                )
    return out


def main():
    doc = fitz.open(PDF)
    all_blocks = []
    by_title = collections.defaultdict(list)
    for i in range(len(doc)):
        page_no = i + 1
        try:
            blocks = blocks_on_page(doc[i], page_no)
        except Exception as exc:
            print(f"page {page_no} err {exc}", file=sys.stderr)
            continue
        all_blocks.extend(blocks)
        for b in blocks:
            key = b["title"].upper()
            by_title[key].append(b)
        if page_no % 200 == 0:
            print(f"... page {page_no}/{len(doc)}", flush=True)
    doc.close()

    multi = {
        t: blks
        for t, blks in by_title.items()
        if len(blks) >= 2 and t not in SKIP_TITLES and len(t) >= 8
    }
    print(f"Titres d'article répétés (blocs PDF >= 2): {len(multi)}")

    codes = []
    for blks in multi.values():
        for b in blks:
            codes.extend(b["codes"])
    codes = sorted(set(codes))
    print(f"Codes concernés: {len(codes)}")
    if not codes:
        return

    # psql via stdin COPY-like query
    inlist = ",".join("'" + c + "'" for c in codes)
    sql = f"""
    COPY (
      SELECT r.code, r.product_id, p.name, COALESCE(p.brand,'') AS brand,
             COALESCE(p.image_path,'') AS product_image,
             COALESCE(r.image_path,'') AS sku_image,
             COALESCE(f.name,'') AS family
      FROM references_sku r
      JOIN products p ON p.id = r.product_id
      LEFT JOIN families f ON f.id = p.family_id
      WHERE r.code IN ({inlist})
    ) TO STDOUT WITH CSV HEADER
    """
    proc = subprocess.run(
        ["psql", "postgresql://gael@localhost:5432/afecon_catalogue", "-c", sql],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(proc.stderr)
        sys.exit(1)
    lines = [ln for ln in proc.stdout.splitlines() if ln.strip()]
    header, *rows = lines
    cols = header.split(",")
    db = {}
    for row in rows:
        # CSV may contain commas in names — use a safer parse
        pass

    import csv
    import io

    reader = csv.DictReader(io.StringIO(proc.stdout))
    db = {row["code"]: row for row in reader}

    merged = []
    for title, blks in sorted(multi.items(), key=lambda kv: -len(kv[1])):
        product_ids = set()
        families = set()
        present = 0
        block_pids = []
        for b in blks:
            pids = set()
            for code in b["codes"]:
                row = db.get(code)
                if not row:
                    continue
                present += 1
                pids.add(row["product_id"])
                product_ids.add(row["product_id"])
                families.add(row["family"])
            block_pids.append(pids)
        if present < 4:
            continue
        # Fusion site = plusieurs blocs PDF, un seul product_id
        if len(product_ids) == 1 and len(blks) >= 2:
            merged.append(
                {
                    "title": title,
                    "n_blocks": len(blks),
                    "product_id": next(iter(product_ids)),
                    "pages": sorted({b["page"] for b in blks}),
                    "families": sorted(families),
                    "n_codes": sum(len(b["codes"]) for b in blks),
                    "blocks": [
                        {
                            "page": b["page"],
                            "col": b["col"],
                            "y": b["y"],
                            "n": len(b["codes"]),
                            "codes": b["codes"][:6],
                        }
                        for b in blks
                    ],
                }
            )

    print(f"\nFusions site (1 produit pour N blocs catalogue): {len(merged)}")
    plumbing = [m for m in merged if any("Plomberie" in f for f in m["families"]) or not m["families"]]
    print(f"dont famille Plomberie / vide: {len(plumbing)}")
    for m in plumbing[:40]:
        print(
            f"- [{m['product_id']}] {m['title'][:50]:50s}  "
            f"{m['n_blocks']} blocs, {m['n_codes']} codes, pages {m['pages'][:8]}"
        )

    out = "/tmp/merged_blocks.json"
    with open(out, "w") as f:
        json.dump({"merged": plumbing, "all_merged": merged}, f, ensure_ascii=False, indent=2)
    print(f"\nJSON → {out}")


if __name__ == "__main__":
    main()
