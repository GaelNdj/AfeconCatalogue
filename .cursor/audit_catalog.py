#!/usr/bin/env python3
"""Audit désignation / photo des N premières pages du catalogue public."""
import json
import os
import re
import subprocess
import sys

PDF_PATH = "/Users/gael/Downloads/cata_pro_2026_idf_368_enrich.pdf"
CODE_INDEX = "/Users/gael/Documents/htdocs/AfeconCatalogue/.cursor/code_page_index.json"
DB = "postgresql://gael@localhost:5432/afecon_catalogue"

PER_PAGE = 24


def psql(sql):
    out = subprocess.check_output(["psql", DB, "-At", "-F", "\t", "-c", sql], text=True)
    return [line.split("\t") for line in out.splitlines() if line.strip()]


def build_code_index():
    """code catalogue -> pages PDF où il apparaît."""
    if os.path.isfile(CODE_INDEX):
        with open(CODE_INDEX) as fh:
            return json.load(fh)
    import fitz
    pdf = fitz.open(PDF_PATH)
    idx = {}
    code_re = re.compile(r"\b(\d{7})\b")
    for i, page in enumerate(pdf):
        for code in set(code_re.findall(page.get_text() or "")):
            idx.setdefault(code, []).append(i + 1)
    pdf.close()
    with open(CODE_INDEX, "w") as fh:
        json.dump(idx, fh)
    return idx


# --- Heuristiques "ce nom n'est pas un titre d'article" -----------------
SUPPLIER_REF_RE = re.compile(r"^[A-Z0-9][A-Z0-9._/-]*$")
TABLE_WORDS = {
    "UNI", "BICOLORE", "VERSION DROITE", "VERSION GAUCHE", "PLAN VASQUE",
    "NOUVEAU", "LAVE-MAINS", "ACCESSOIRES", "MEUBLE", "CONSOLE",
}


def classify_name(name, ref_fours, ref_pros):
    n = (name or "").strip()
    if not n:
        return "vide"
    up = n.upper()
    if up in {(r or "").strip().upper() for r in ref_fours if r}:
        return "ref_fournisseur"
    if up in {(r or "").strip().upper() for r in ref_pros if r}:
        return "ref_pro"
    if " " not in n and SUPPLIER_REF_RE.match(up) and re.search(r"\d", n) and re.search(r"[A-Z]", up):
        return "code_alphanum"
    if re.fullmatch(r"[\d\s.,x×/-]+", n):
        return "numerique"
    if up in TABLE_WORDS:
        return "rubrique_tableau"
    if n[:1].islower():
        return "minuscule"
    letters = [c for c in n if c.isalpha()]
    if letters and sum(c.isupper() for c in letters) / len(letters) < 0.4:
        return "minuscule"
    return "ok"


def main():
    pages = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    offset = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    limit = pages * PER_PAGE

    rows = psql(f"""
        SELECT p.id, p.name, COALESCE(p.image_path,''),
               COALESCE(string_agg(DISTINCT r.code, '|'), ''),
               COALESCE(string_agg(DISTINCT COALESCE(r.ref_four,''), '|'), ''),
               COALESCE(string_agg(DISTINCT COALESCE(r.ref_pro,''), '|'), '')
        FROM products p
        JOIN references_sku r ON r.product_id = p.id
        GROUP BY p.id, p.name, p.image_path
        ORDER BY p.name ASC
        LIMIT {limit} OFFSET {offset * PER_PAGE}
    """)

    code_idx = build_code_index()

    from collections import Counter
    verdicts = Counter()
    bad = []
    photo_page_mismatch = []

    for pid, name, image_path, codes, ref_fours, ref_pros in rows:
        code_list = [c for c in codes.split("|") if c]
        verdict = classify_name(name, ref_fours.split("|"), ref_pros.split("|"))
        verdicts[verdict] += 1

        pdf_pages = sorted({p for c in code_list for p in code_idx.get(c, [])})
        img_page = None
        m = re.search(r"p(\d{4})_\d+\.", image_path or "")
        if m:
            img_page = int(m.group(1))
        page_ok = (img_page in pdf_pages) if (img_page and pdf_pages) else None

        rec = {
            "id": int(pid), "name": name, "verdict": verdict,
            "codes": code_list[:4], "pdf_pages": pdf_pages[:4],
            "img": image_path, "img_page": img_page, "page_ok": page_ok,
        }
        if verdict != "ok":
            bad.append(rec)
        if page_ok is False:
            photo_page_mismatch.append(rec)

    total = len(rows)
    n_bad = len(bad)
    print(f"produits analyses : {total} (pages site {offset + 1}..{offset + pages})")
    print(f"designations suspectes : {n_bad} ({100 * n_bad / max(1, total):.1f}%)")
    for k, v in verdicts.most_common():
        print(f"  {k:20} {v}")
    print(f"photos page PDF != page code : {len(photo_page_mismatch)}")
    print("\nexemples :")
    for r in bad[:20]:
        print(f"  [{r['verdict']:16}] {r['name'][:38]:38} codes={r['codes']} pdf={r['pdf_pages']} img={r['img_page']}")


if __name__ == "__main__":
    main()
