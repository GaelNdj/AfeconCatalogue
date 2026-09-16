"""Compare l'Excel avant / apres le passage a la detection typographique.

Usage : python3 .cursor/compare_desc.py
"""
import openpyxl

AVANT = "/Users/gael/Desktop/catalogue/catalogue_pro_2026_plomberie.AVANT_DESC.xlsx"
APRES = "/Users/gael/Desktop/catalogue/catalogue_pro_2026_plomberie.xlsx"


def load(path):
    ws = openpyxl.load_workbook(path, read_only=True).active
    rows = ws.iter_rows(values_only=True)
    headers = [h for h in next(rows)]
    col = {h: i for i, h in enumerate(headers) if h}
    out = {}
    for r in rows:
        code = r[col["Code"]] if "Code" in col else None
        if code is None:
            continue
        code = str(code).strip().replace(".0", "")
        out[code] = {
            "nom": (r[col["Désignation"]] or "") if "Désignation" in col else "",
            "desc": (r[col.get("Description", -1)] or "") if "Description" in col else "",
            "cat": (r[col["Catégorie"]] or "") if "Catégorie" in col else "",
            "img": (r[col["Image"]] or "") if "Image" in col else "",
        }
    return out


def main():
    a, b = load(AVANT), load(APRES)
    communs = sorted(set(a) & set(b))
    print(f"avant {len(a)} lignes / apres {len(b)} lignes / {len(communs)} codes communs")
    print(f"nouveaux codes : {len(set(b) - set(a))}   codes perdus : {len(set(a) - set(b))}")

    noms = [c for c in communs if a[c]["nom"] != b[c]["nom"]]
    cats = [c for c in communs if a[c]["cat"] != b[c]["cat"]]
    imgs = [c for c in communs if a[c]["img"] != b[c]["img"]]
    desc_gagnes = [c for c in communs if not a[c]["desc"] and b[c]["desc"]]
    desc_perdus = [c for c in communs if a[c]["desc"] and not b[c]["desc"]]

    print(f"\nnoms changes    : {len(noms)}")
    print(f"categories chgs : {len(cats)}")
    print(f"images changees : {len(imgs)}")
    print(f"desc gagnees    : {len(desc_gagnes)}")
    print(f"desc perdues    : {len(desc_perdus)}")

    apres_avec_desc = sum(1 for c in b if b[c]["desc"])
    avant_avec_desc = sum(1 for c in a if a[c]["desc"])
    print(f"\ncouverture description : {avant_avec_desc}/{len(a)} -> {apres_avec_desc}/{len(b)}")

    print("\n--- 25 noms changes ---")
    for c in noms[:25]:
        print(f"  {c}\n    avant : {a[c]['nom'][:78]}\n    apres : {b[c]['nom'][:78]}")

    print("\n--- 15 descriptions perdues ---")
    for c in desc_perdus[:15]:
        print(f"  {c} ({b[c]['nom'][:40]})\n    avant : {a[c]['desc'][:90]}")

    print("\n--- 10 descriptions gagnees ---")
    for c in desc_gagnes[:10]:
        print(f"  {c} ({b[c]['nom'][:40]})\n    apres : {b[c]['desc'][:100]}")

    # titre recopie en tete de description : ce qu'on voulait supprimer
    residus = [c for c in b if " — " in (b[c]["desc"] or "")]
    print(f"\ndescriptions contenant encore ' — ' : {len(residus)}")
    for c in residus[:8]:
        print(f"  {c} : {b[c]['desc'][:95]}")


if __name__ == "__main__":
    main()
