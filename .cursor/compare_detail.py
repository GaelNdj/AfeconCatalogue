#!/usr/bin/env python3
"""Détail des zones d'ombre du comparatif : non-couverts, photos, regressions."""
import hashlib
import json
import os
import re
import subprocess
from collections import Counter

import openpyxl

XLSX = "/Users/gael/Desktop/catalogue/catalogue_pro_2026_plomberie.xlsx"
NEW_IMG = "/Users/gael/Desktop/catalogue/images_hq"
OLD_IMG = "/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads"
CODE_INDEX = "/Users/gael/Documents/htdocs/AfeconCatalogue/.cursor/code_page_index.json"
DB = "postgresql://gael@localhost:5432/afecon_catalogue"


def psql(sql):
    out = subprocess.check_output(["psql", DB, "-At", "-F", "\t", "-c", sql], text=True)
    return [l.split("\t") for l in out.splitlines() if l.strip()]


wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
ws = wb.active
head = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]
ix = {h: i for i, h in enumerate(head)}
xl = {}
for row in ws.iter_rows(min_row=2, values_only=True):
    code = str(row[ix["Code"]] or "").strip()
    if code:
        xl[code] = {
            "name": str(row[ix["Désignation"]] or "").strip(),
            "image": str(row[ix["Image"]] or "").strip(),
            "cat": str(row[ix["Catégorie"]] or "").strip(),
        }
wb.close()

rows = psql("""
    SELECT r.code, p.name, COALESCE(p.image_path,''), c.name
    FROM references_sku r
    JOIN products p ON p.id = r.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE c.family_id = 1
""")
db = {c: {"name": n, "image": img, "cat": cat} for c, n, img, cat in rows}

only_db = sorted(set(db) - set(xl))
common = sorted(set(db) & set(xl))

with open(CODE_INDEX) as fh:
    code_idx = json.load(fh)

print("=" * 74)
print(f"1108 NON COUVERTS  ({len(only_db)} codes) : d'ou viennent-ils ?")
in_pdf = [c for c in only_db if code_idx.get(c)]
not_in_pdf = [c for c in only_db if not code_idx.get(c)]
print(f"  presents dans le PDF mais filtres : {len(in_pdf)}")
print(f"  absents du PDF (autre source)     : {len(not_in_pdf)}")
print("\n  categories en base des codes filtres (top 15) :")
for cat, n in Counter(db[c]["cat"] for c in in_pdf).most_common(15):
    print(f"    {n:5}  {cat[:56]}")
if not_in_pdf:
    print("\n  categories des codes absents du PDF (top 8) :")
    for cat, n in Counter(db[c]["cat"] for c in not_in_pdf).most_common(8):
        print(f"    {n:5}  {cat[:56]}")


def sha(path):
    try:
        with open(path, "rb") as fh:
            return hashlib.md5(fh.read()).hexdigest()
    except OSError:
        return None


print()
print("=" * 74)
print("PHOTOS : les 964 fichiers differents sont-ils un vrai changement d'image ?")
stats = Counter()
real_change = []
for c in common:
    new_f = xl[c]["image"].replace("\\", "/").split("/")[-1]
    old_f = db[c]["image"].split("/")[-1]
    if not new_f or not old_f or new_f == old_f:
        continue
    h_new = sha(os.path.join(NEW_IMG, new_f))
    h_old = sha(os.path.join(OLD_IMG, old_f))
    if h_new is None or h_old is None:
        stats["fichier_absent"] += 1
    elif h_new == h_old:
        stats["meme_image_renommee"] += 1
    else:
        stats["image_reellement_differente"] += 1
        real_change.append((c, db[c]["name"], xl[c]["name"], old_f, new_f))
for k, v in stats.most_common():
    print(f"    {k:30} {v}")
print("\n  echantillon d'images reellement changees :")
for c, dn, xn, o, n in real_change[:12]:
    print(f"    {c}  {dn[:26]:26} -> {xn[:26]:26}  {o} -> {n}")

print()
print("=" * 74)
print("REGRESSIONS : contexte PDF des 5 codes")
for c in ("1035813", "1035821", "1277031", "1327449", "7854748"):
    if c in db:
        print(f"    {c}  page(s) PDF {code_idx.get(c)}  base='{db[c]['name']}'  ->  excel='{xl.get(c,{}).get('name','')}'")
