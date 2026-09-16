#!/usr/bin/env python3
"""Audit: nom produit en base vs vrai titre d'article du PDF, par pages PDF."""
import importlib.util
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict

PDF_PATH = "/Users/gael/Downloads/cata_pro_2026_idf_368_enrich.pdf"
CODE_INDEX = "/Users/gael/Documents/htdocs/AfeconCatalogue/.cursor/code_page_index.json"
DB = "postgresql://gael@localhost:5432/afecon_catalogue"

# Pages déjà corrigées / validées — exclues du comptage
SKIP_PAGES = set(range(169, 174)) | {757, 758} | set(range(959, 965))


def psql(sql):
    out = subprocess.check_output(["psql", DB, "-At", "-F", "\t", "-c", sql], text=True)
    return [line.split("\t") for line in out.splitlines() if line.strip()]


def load_mod():
    os.environ["EXTRACT_TEXT_ONLY"] = "1"
    spec = importlib.util.spec_from_file_location(
        "extract_catalog_hq",
        "/Users/gael/Documents/htdocs/AfeconCatalogue/scripts/extract_catalog_hq.py",
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def norm(s):
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


def main():
    n_pages = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    start = int(sys.argv[2]) if len(sys.argv) > 2 else 1

    # Plomberie uniquement (family_id = 1) — pas d'Électricité / Legrand
    db_rows = psql("""
        SELECT r.code, p.id, p.name, COALESCE(p.image_path,'')
        FROM references_sku r
        JOIN products p ON p.id = r.product_id
        JOIN categories c ON c.id = p.category_id
        WHERE c.family_id = 1 AND r.code ~ '^[0-9]{7}$'
    """)
    db = {c: (int(pid), name, img) for c, pid, name, img in db_rows}

    with open(CODE_INDEX) as fh:
        code_idx = json.load(fh)

    page_codes = defaultdict(list)
    for code, pages in code_idx.items():
        if code in db:
            for p in pages:
                page_codes[p].append(code)

    candidates = sorted(p for p in page_codes if p >= start and p not in SKIP_PAGES)
    target_pages = candidates[:n_pages]
    if not target_pages:
        print("aucune page a auditer")
        return

    mod = load_mod()
    import fitz
    doc = fitz.open(PDF_PATH)

    results = []
    for page_no in target_pages:
        carry = None
        category = ""
        arts = []
        for pn in (page_no - 1, page_no):
            if pn < 1:
                continue
            fp = doc[pn - 1]
            category = mod.detect_category(fp.get_text() or "", category) or category
            arts, category, carry = mod.collect_page_articles(
                fp, fp.rect.width, fp.rect.height, category, carry, pn
            )
        fp = doc[page_no - 1]
        for code in sorted(page_codes[page_no]):
            cy, cx = mod.find_text_pos_fitz(fp, code)
            if cy is None:
                continue
            art = mod.find_article_for_code(arts, cy, cx, fp.rect.width)
            title = (art or {}).get("title") or ""
            expected = mod.clean_product_title(title) if title else ""
            pid, db_name, img = db[code]
            results.append({
                "code": code, "page": page_no, "db_name": db_name,
                "pdf_title": expected, "img": img,
                "match": bool(expected) and norm(db_name) == norm(expected),
            })

    doc.close()

    matched = [r for r in results if r["match"]]
    mismatched = [r for r in results if not r["match"]]
    by_pair = Counter((r["db_name"], r["pdf_title"]) for r in mismatched)
    by_page = Counter(r["page"] for r in mismatched)

    print(f"pages PDF auditees : {target_pages}")
    print(f"codes verifies : {len(results)}")
    print(f"  nom OK   : {len(matched)}")
    print(f"  nom FAUX : {len(mismatched)}  ({100*len(mismatched)/max(1,len(results)):.1f}%)")
    print(f"\npages avec erreurs : {dict(by_page)}")
    print("\nprincipaux ecarts (base | PDF) :")
    for (a, b), n in by_pair.most_common(25):
        print(f"  {n:4}x  {a[:42]:42} | {b[:46]}")


if __name__ == "__main__":
    main()
