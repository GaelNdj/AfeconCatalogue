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
import math
import os
import re
import sys
from collections import Counter

import fitz
import openpyxl
import pypdfium2 as pdfium
from openpyxl.styles import Alignment, Font, PatternFill
from PIL import Image

PDF_PATH = "/Users/gael/Downloads/cata_pro_2026_idf_368_enrich.pdf"
CATALOGUE_DIR = "/Users/gael/Desktop/catalogue"
OUTPUT_PATH = os.path.join(CATALOGUE_DIR, "catalogue_pro_2026_plomberie.xlsx")
IMAGE_DIR = os.path.join(CATALOGUE_DIR, "images_hq")
IMAGE_REL = "images_hq"
FILTER_FAMILLE = "Plomberie"
MAX_NAME_LEN = 90
# Native pixels only — no page render upsample (that zoomed photos ~1.44x).
PAD_FRAC = 0.08
MAX_IMAGE_PX = 280
IMAGE_EXT = "png"
LETTER_PREFIX_RE = re.compile(r"^([A-Da-d])\s+")
SECTION_PHOTO_RE = re.compile(r"^●\s*(DROITE|COUDÉE|COUDEE)", re.I)

COLUMNS = [
    "Réf.Pro",
    "Réf.Four",
    "Diamètre",
    "Vendu par",
    "Marque",
    "Désignation",
    "Variante",
    "Ordre",
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
    "VOS OFFRES",
    "PROMOS CEDEO",
    "- GARANTIE",
    "◗ BICOLORE",
    "BICOLORE",
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
    "CALEFFI", "GIACOMINI", "COMAP", "SOMATHERM",     "NICOLL", "GEBO",
    "NOVIPRO", "KALDEWEI", "SIAMP", "SYNTHÈSE", "TECHNO",
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


def is_category_header(line, current_category=""):
    """Rubriques catalogue (PLOMBERIE, RACCORDS CUIVRE…) ≠ fiches produit."""
    s = clean_spaces(line)
    up = s.upper().rstrip(".")
    if current_category and up == clean_spaces(current_category).upper():
        return True
    headers = {
        "PLOMBERIE", "SANITAIRE", "OUTILLAGE", "GÉNIE CLIMATIQUE", "GENIE CLIMATIQUE",
        "RACCORDS CUIVRE", "RACCORDS LAITON", "TUBES CUIVRE", "TUBES ET RACCORDS CUIVRE ET LAITON",
        "TUBES ET RACCORDS FONTE", "GAINÉS ISOLÉS", "SÈCHE-SERVIETTES", "COLLECTEURS",
        "TUBES ET RACCORDS", "RACCORDS", "TUBES", "PIÈCES", "PIECES", "ACCESSOIRES",
    }
    if up in headers:
        return True
    if up.startswith("TUBES ET RACCORDS") and "Ø" not in up and "°" not in up:
        return True
    if re.fullmatch(r"(RACCORDS|TUBES|ROBINETS|COLLECTEURS|VANNES)\s+[A-ZÀ-Ÿ]+$", up):
        return True
    return False


def is_warranty_or_meta_line(line):
    """GARANTIE / promos = méta, jamais titre de fiche produit."""
    s = clean_spaces(line)
    up = s.upper()
    if re.fullmatch(r"GARANTIE\.?", up):
        return True
    if up.startswith("GARANTIE :") or up.startswith("- GARANTIE"):
        return True
    if "VOS OFFRES" in up or "PROMOS CEDEO" in up:
        return True
    return False


def line_column(tp, line, page_w, page_h):
    """Colonne L/R d'une ligne (titre ou ligne code) via position dans le PDF."""
    if CODE_RE.search(line):
        code = CODE_RE.findall(line)[-1]
        y, x = find_title_y(tp, code, page_h)
        if x is not None:
            return "L" if x < page_w / 2 else "R"
    for needle in (line[:32], line[:20], line[:12]):
        if len(needle) < 4:
            continue
        y, x = find_title_y(tp, needle, page_h)
        if x is not None:
            return "L" if x < page_w / 2 else "R"
    return "L"


def extract_column_lines(fitz_page, page_w):
    """Lit le texte colonne par colonne (gauche puis droite), ordre vertical."""
    by_col = {"L": [], "R": []}
    for block in fitz_page.get_text("dict").get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            text = clean_spaces("".join(span.get("text", "") for span in line.get("spans", [])))
            if not text:
                continue
            bbox = line.get("bbox", (0, 0, 0, 0))
            cx = (bbox[0] + bbox[2]) / 2
            col = "L" if cx < page_w / 2 else "R"
            by_col[col].append((bbox[1], text))
    return {
        col: merge_wrapped_lines([t for _, t in sorted(by_col[col], key=lambda x: x[0])])
        for col in ("L", "R")
    }


def new_pending(category="", brand=""):
    return {
        "category": category,
        "title": "",
        "brand": brand,
        "note": "",
        "vendu": "",
        "image": "",
        "_section_letter": "",
        "_pending_letter": "",
    }


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
    if line.startswith("-") or line.startswith("–") or line.startswith("—"):
        return False
    if not (6 <= len(line) <= 120):
        return False
    if CODE_RE.search(line) or PRICE_RE.search(line):
        return False
    if HEADER_ROW_RE.search(line) or is_skip_line(line):
        return False
    if is_warranty_or_meta_line(line):
        return False
    if is_category_header(line):
        return False
    if is_junk_title(line):
        return False
    up = line.upper()
    if any(k in up for k in ("PRODUITS DISPONIBLES", "6 000", "6000 PRODUITS", "EN AGENCE")):
        return False
    letters = [c for c in line if c.isalpha()]
    if not letters:
        return False
    ok = sum(c.isupper() for c in letters) / len(letters) >= 0.45
    return ok


def detect_category(page_text, pending=""):
    lines = [clean_spaces(x) for x in page_text.splitlines() if clean_spaces(x)]
    for line in lines[:6]:
        if is_skip_line(line) or CODE_RE.search(line):
            continue
        line2 = re.sub(r"^\d{1,4}(?=[A-ZÀ-Ÿ ])", "", line).strip()
        if 4 <= len(line2) <= 28 and line2.isupper() and "Ø" not in line2:
            if any(
                k in line2
                for k in ("TUBE", "RACCORD", "ROBINET", "COLLECTEUR", "PLOMBERIE", "VANNE")
            ):
                return line2
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
        scored = []
        for s in candidates:
            has_diam = "Ø" in s or bool(re.search(r"\d+\s*MM", s, re.I))
            scored.append((s.isupper(), not has_diam, len(s) < 55, -len(s), s))
        return max(scored)[-1]
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
    if re.fullmatch(r"\d{6,}", tok):
        return True
    if not re.fullmatch(r"[A-Z0-9._-]{6,}", tok, re.I):
        return False
    if not re.search(r"[A-Za-z]", tok):
        return False
    if not re.search(r"\d", tok):
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
    variant_letter = ""
    if tokens and re.fullmatch(r"[abcABC●•]", tokens[0]):
        variant_letter = tokens[0].upper().replace("●", "").replace("•", "")
        if variant_letter in "ABCD":
            tokens = tokens[1:]
        else:
            variant_letter = ""

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
        while tokens and re.fullmatch(r"\d+(?:\.\d+){1,4}", tokens[-1]):
            ref_four = tokens[-1]
            tokens = tokens[:-1]
        if tokens and re.fullmatch(r"\d{1,3},\d{1,2}", tokens[-1]):
            tokens = tokens[:-1]
        if (
            len(tokens) >= 2
            and re.fullmatch(r"(1|2|5|10|20|25|50)", tokens[-1])
            and re.search(r"[A-Za-zÀ-Ÿ]", " ".join(tokens[:-1]))
        ):
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
        "letter": variant_letter,
    }


TITLE_CONTINUE_RE = re.compile(
    r'^[\-–—•●"]|^(AVEC|GARDE|SORTIE|POUR|ANTI)\b',
    re.I,
)
DIM_LINE_RE = re.compile(
    r"^Ø?\s*\d+[.,]?\d*\s*(mm)?(\s*[–\-xX×]\s*)?(L\.\s*\d+\s*m)?$",
    re.I,
)


def is_title_continuation(line):
    s = clean_spaces(line)
    if not s or CODE_RE.search(s) or PRICE_RE.search(s):
        return False
    if len(s) > 48:
        return False
    letters = [c for c in s if c.isalpha()]
    if letters and sum(c.islower() for c in letters) / len(letters) > 0.3:
        return False
    if DIM_LINE_RE.match(s.replace(" ", "")) or re.match(r"^Ø\s*\d", s, re.I):
        return False
    if is_junk_title(s.lstrip("-–—•●\" ")):
        return False
    return bool(TITLE_CONTINUE_RE.match(s))


JUNK_TITLE_RE = re.compile(
    r"^(pression|temp[eé]rature|service\s*:|classe\s+\d|pd\s*=|d[eé]signation|"
    r"eco-contribution|le \+|bao$|article top|barri[eè]re anti)",
    re.I,
)


def is_junk_title(line):
    """Specs / fins de phrase (ex. ': 95°C') ≠ titre de fiche."""
    s = clean_spaces(line)
    if not s:
        return True
    if s.startswith(":") or s.startswith("–") or s.startswith("—"):
        return True
    if re.match(r"^[●•▪]", s):
        return True
    if JUNK_TITLE_RE.match(s):
        return True
    if re.search(r"accidentelle|max de service|pression maximale|temp[eé]rature max", s, re.I):
        return True
    if re.search(r"diamètre\s+de\s+raccord|des\s+circuits\s+eurokonus", s, re.I):
        return True
    if re.search(r"\b(plancher chauffant|rafraîchissant|eurokonus|entraxe)\b", s, re.I):
        return True
    if re.search(r"\d+\s+circuits\s+\d+,\d{2}\s+\d{6,}", s, re.I):
        return True
    if re.match(r"^\d+\s+circuits\b", s, re.I):
        return True
    if re.fullmatch(r"GARANTIE\.?", s, re.I):
        return True
    letters = [c for c in s if c.isalpha()]
    if len(letters) < 5:
        return True
    return False


def peel_technical(title):
    """Garde le début de phrase ; coupe seulement une queue trop longue."""
    t = clean_spaces(title).strip(" -–—:")
    t = t.replace('"', "").strip()
    diameter = ""
    notes = []

    dm = re.search(
        r"(Ø\s*\d+[.,]?\d*\s*(?:MM|CM)?(?:\s*[–\-xX×]\s*\d+[.,]?\d*\s*(?:MM|CM)?)?)",
        t,
        re.I,
    )
    lm = re.search(r"(L\.\s*\d+\s*m)", t, re.I)
    if dm:
        diameter = clean_spaces(dm.group(1))
    if lm:
        diameter = clean_spaces(f"{diameter} {lm.group(1)}".strip())

    if len(t) > MAX_NAME_LEN:
        cut = t[:MAX_NAME_LEN].rsplit(" ", 1)[0]
        tail = clean_spaces(t[len(cut) :])
        if tail:
            notes.append(tail)
        t = cut

    note = " · ".join(n.strip(" -–") for n in notes if n and n.strip(" -–"))
    return t, diameter, note


def clean_product_title(title):
    """Titre de fiche produit (partagé par toutes les variantes)."""
    t = clean_spaces(title or "")
    t = re.sub(r"\s+[Bb]\d{4,6}\s*$", "", t)
    t = re.sub(r"\s*\(paire\)\s*$", "", t, flags=re.I)
    name, _diam, _note = peel_technical(t)
    return name or t


def build_designation(category, title, extra):
    """Nom clair : début de phrase uniquement. extra (Ø, L., réf) ne va pas dans le nom."""
    tit = clean_spaces(title)
    cat = clean_spaces(category)
    base = tit or cat
    name, _diam, _note = peel_technical(base)
    return name or base


def looks_like_dimension_line(line):
    s = clean_spaces(line)
    if re.match(r"^Ø\s*\d", s, re.I):
        return True
    if re.search(r"L\.\s*\d+\s*m", s, re.I) and len(s) < 40 and not re.search(r"[A-Za-zÀ-Ÿ]{5,}", s.replace("mm", "")):
        return True
    return False


def extract_page_text(page):
    tp = page.get_textpage()
    return tp.get_text_bounded() if tp else ""


def debug_log(hypothesis_id, location, message, data, run_id="extract"):
    # #region agent log
    try:
        import json
        import time

        payload = {
            "sessionId": "913862",
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
            "runId": run_id,
        }
        with open(DEBUG_LOG, "a") as f:
            f.write(json.dumps(payload) + "\n")
    except Exception:
        pass
    # #endregion


def find_variant_letter(fitz_page, code, page_h):
    """Repère le marqueur A/B/C à gauche d'une ligne de code dans le PDF."""
    code_bbox = None
    for b in fitz_page.get_text("dict")["blocks"]:
        if b.get("type") != 0:
            continue
        for line in b["lines"]:
            txt = "".join(s["text"] for s in line["spans"]).strip()
            if code in txt:
                code_bbox = line["bbox"]
                break
        if code_bbox:
            break
    if not code_bbox:
        return ""
    code_y_mid = (code_bbox[1] + code_bbox[3]) / 2
    code_x = code_bbox[0]
    best = ""
    best_dist = 999.0
    for b in fitz_page.get_text("dict")["blocks"]:
        if b.get("type") != 0:
            continue
        for line in b["lines"]:
            for span in line["spans"]:
                t = span["text"].strip()
                if not re.fullmatch(r"[A-Da-d]", t):
                    continue
                sb = span["bbox"]
                sy = (sb[1] + sb[3]) / 2
                if abs(sy - code_y_mid) > 10 or sb[2] > code_x:
                    continue
                dist = code_x - sb[2]
                if dist < best_dist:
                    best_dist = dist
                    best = t.upper()
    return best


def collect_block_photo_row(photos, y0, y1, col_left, page_w, sku_y_min):
    """Photos côte à côte cohérentes dans le bloc article (au-dessus des lignes SKU)."""
    if not photos or y0 is None:
        return []
    col_photos = [
        p
        for p in photos
        if (p["x"] < page_w / 2) == col_left and (y0 - 12) <= p["y"] < (y1 - 6)
    ]
    if not col_photos:
        col_photos = [p for p in photos if (p["x"] < page_w / 2) == col_left]
    if sku_y_min is not None:
        above = [p for p in col_photos if p["y"] < sku_y_min - 8]
        if above:
            col_photos = above
    if not col_photos:
        return []

    top_y = min(p["y"] for p in col_photos)
    band = [p for p in col_photos if p["y"] <= top_y + 30]
    band.sort(key=lambda p: p["x"])
    if len(band) < 2:
        return []

    runs = [[band[0]]]
    for photo in band[1:]:
        prev = runs[-1][-1]
        if photo["x"] - prev["x"] <= 85:
            runs[-1].append(photo)
        else:
            runs.append([photo])
    best = max(runs, key=lambda r: (len(r), -r[0]["y"]))
    if len(best) < 2:
        return []
    return best


def photo_letter_index(letter):
    if not letter:
        return None
    letter = letter.upper()
    if letter in "ABCD":
        return ord(letter) - ord("A")
    return None


def assign_block_photos(items, photos, fitz_page, tp, ph, pw, left_ys, right_ys):
    """Associe les photos A/B/C aux variantes d'un même bloc article."""
    from collections import defaultdict

    groups = defaultdict(list)
    for item in items:
        ty, tx = find_title_y(tp, (item.get("Désignation") or "")[:28], ph)
        col = 0 if (tx or 0) < pw / 2 else 1
        groups[(item.get("Désignation"), col)].append((item, ty, tx))

    watch_codes = {"1592784", "4008809", "6300517", "6300522"}

    for (_designation, col), rows in groups.items():
        if not rows:
            continue
        tx = rows[0][2] or (0 if col == 0 else pw * 0.75)
        col_left = tx < pw / 2
        code_ys = []
        for item, _ty, _tx in rows:
            cy, _ = find_title_y(tp, item["Code"], ph)
            if cy is not None:
                code_ys.append(cy)
        if not code_ys:
            continue
        sku_y_min = min(code_ys)
        y0, y1 = band_for(sku_y_min, tx, left_ys, right_ys, pw)
        if y0 is None:
            y0 = max(0.0, sku_y_min - 140)
        if y1 is None:
            y1 = min(ph, max(code_ys) + 50)

        block_photos = collect_block_photo_row(photos, y0, y1, col_left, pw, sku_y_min)
        if len(block_photos) < 2:
            for item, _ty, _tx in rows:
                fname = pick_photo_in_block(photos, y0, y1, tx, sku_y_min, pw)
                if fname:
                    item["Image"] = f"{IMAGE_REL}/{fname}"
            continue

        for item, _ty, _tx in rows:
            letter = item.get("_photo_letter") or find_variant_letter(fitz_page, item["Code"], ph)
            idx = photo_letter_index(letter)
            if idx is None or idx >= len(block_photos):
                fname = pick_photo_in_block(photos, y0, y1, tx, sku_y_min, pw)
                if fname:
                    item["Image"] = f"{IMAGE_REL}/{fname}"
                continue
            item["Image"] = f"{IMAGE_REL}/{block_photos[idx]['file']}"
            if item["Code"] in watch_codes:
                debug_log(
                    "H1,H3,H5",
                    "extract_catalog_hq.py:assign_block_photos",
                    "multi-photo assigned",
                    {
                        "code": item["Code"],
                        "letter": letter,
                        "image": item["Image"],
                        "block_photos": [p["file"] for p in block_photos],
                    },
                )


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
    feats = {"white": round(white, 3), "skin": round(skin, 3), "entropy": round(entropy, 2)}
    # Vignettes catalogue (emballage coloré type tuyau) ≠ photos de personnes
    if max(w, h) <= 165:
        return False, feats
    # Visages : peau modérée + couleurs variées. Les pièces laiton ont skin > 0.5.
    if 0.035 <= skin <= 0.42 and entropy >= 5.0 and white < 0.50:
        return True, {"white": round(white, 3), "skin": round(skin, 3), "entropy": round(entropy, 2)}
    # Portraits / scènes large (équipe, showroom)
    if w >= 300 and h >= 220 and 0.04 <= skin <= 0.40 and entropy >= 4.5 and white < 0.50:
        return True, {"white": round(white, 3), "skin": round(skin, 3), "entropy": round(entropy, 2), "large": True}
    return False, {"white": round(white, 3), "skin": round(skin, 3), "entropy": round(entropy, 2)}


def save_hq_image(pil, dest):
    """PNG à taille catalogue web — pas d'agrandissement, réduction si trop grand."""
    w, h = pil.size
    longest = max(w, h)
    if longest > MAX_IMAGE_PX:
        scale = MAX_IMAGE_PX / longest
        pil = pil.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
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
            bounds = obj.get_bounds()
        except Exception:
            continue
        x0, y0, x1, y1 = bounds
        dw, dh = abs(x1 - x0), abs(y1 - y0)
        if min(px_w, px_h) < 48 or max(px_w, px_h) < 90:
            if max(px_w, px_h) < 70 and max(dw, dh) < 40:
                continue
        aspect = max(px_w, px_h) / max(1, min(px_w, px_h))
        max_aspect = 5.2 if max(px_w, px_h) >= 100 else 3.2
        if aspect > max_aspect:
            continue
        y_top = ph - max(y0, y1)
        if y_top < ph * 0.04 or y_top > ph * 0.92:
            continue

        try:
            pil = obj.get_bitmap().to_pil().convert("RGB")
        except Exception:
            continue
        if min(pil.width, pil.height) < 48 or max(pil.width, pil.height) < 90:
            if max(pil.width, pil.height) < 70 and max(dw, dh) < 40:
                continue

        is_person, feats = looks_like_person(pil)
        if is_person:
            skip_stats["people"] += 1
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

        photos.append(
            {
                "x": (x0 + x1) / 2,
                "y": y_top,
                "y1": y_top + abs(y1 - y0),
                "file": fname,
            }
        )

    photos.sort(key=lambda p: (p["x"] > pw / 2, p["y"]))
    return photos


def find_title_y(tp, title, page_h):
    if not title or not tp:
        return None, None
    needle = title[:24]
    try:
        text = tp.get_text_range().replace("\r", " ").replace("\n", " ")
    except Exception:
        return None, None
    pos = text.find(needle)
    if pos < 0:
        pos = text.upper().find(needle.upper())
    if pos < 0:
        return None, None
    try:
        box = tp.get_charbox(pos)
        return page_h - box[3], box[0]
    except Exception:
        return None, None


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


def article_separator_ys(fitz_page, page_w, page_h):
    """Traits rouges ou verts = limites d'articles dans le catalogue CEDEO."""
    left, right = [0.0], [0.0]
    try:
        drawings = fitz_page.get_drawings()
    except Exception:
        return [0.0, page_h], [0.0, page_h]
    for d in drawings:
        color = d.get("color") or d.get("fill")
        if not color or len(color) < 3:
            continue
        r, g, b = color[:3]
        is_red = r >= 0.65 and g < 0.35 and b < 0.35
        is_green = r < 0.15 and 0.45 < g < 0.75 and b < 0.45
        if not (is_red or is_green):
            continue
        rect = d.get("rect")
        if rect is None or rect.height > 4 or rect.width < 80:
            continue
        y = float(rect.y0)
        cx = (float(rect.x0) + float(rect.x1)) / 2
        if cx < page_w / 2:
            left.append(y)
        else:
            right.append(y)
    left.append(page_h)
    right.append(page_h)
    def uniq(xs):
        out = []
        for y in sorted(xs):
            if not out or abs(y - out[-1]) > 8:
                out.append(y)
        return out
    return uniq(left), uniq(right)


def red_separator_ys(fitz_page, page_w, page_h):
    """Alias conservé pour compatibilité interne."""
    return article_separator_ys(fitz_page, page_w, page_h)


def band_for(y, x, left_ys, right_ys, page_w):
    if y is None:
        return None, None
    ys = left_ys if (x is None or x < page_w / 2) else right_ys
    y0 = ys[0]
    y1 = ys[-1]
    for i in range(len(ys) - 1):
        if ys[i] - 4 <= y < ys[i + 1]:
            return ys[i], ys[i + 1]
    return y0, y1


def pick_photo_in_block(photos, y0, y1, title_x, sku_y, page_w):
    """Photo du bloc : à droite / au-dessus des désignations (bas de photo ≈ tableau)."""
    if not photos or y0 is None:
        return ""
    col_left = title_x is None or title_x < page_w / 2
    cand = [
        p
        for p in photos
        if (y0 - 12) <= p["y"] < (y1 - 6) and (p["x"] < page_w / 2) == col_left
    ]
    if not cand:
        cand = [p for p in photos if (y0 - 12) <= p["y"] < (y1 - 6)]
    if not cand:
        return ""
    if sku_y is not None:
        above = [p for p in cand if p["y"] <= sku_y + 8]
        pool = above or cand
        return min(pool, key=lambda p: abs(p.get("y1", p["y"]) - sku_y))["file"]
    return max(cand, key=lambda p: p["x"])["file"]


def process_pdf():
    if not os.path.isfile(PDF_PATH):
        print(f"PDF introuvable: {PDF_PATH}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(IMAGE_DIR, exist_ok=True)
    pdf = pdfium.PdfDocument(PDF_PATH)
    fitz_doc = fitz.open(PDF_PATH)
    products = []
    seen = set()
    hash_to_name = {}
    skip_stats = {"people": 0, "kept": 0, "logged": 0, "size_logged": 0}
    pending = {"category": "", "title": "", "brand": "", "note": "", "vendu": "", "image": ""}

    pending_by_col = {"L": new_pending(), "R": new_pending()}

    for idx in range(len(pdf)):
        page = pdf[idx]
        text = extract_page_text(page)
        if not text.strip():
            continue
        pw, ph = page.get_size()
        tp = page.get_textpage()
        page_start = len(products)

        cat = detect_category(text, pending["category"])
        if cat:
            pending["category"] = cat
        page_brand = detect_brand(text)
        if page_brand:
            pending["brand"] = page_brand

        if os.environ.get("EXTRACT_TEXT_ONLY"):
            photos = []
        else:
            photos = extract_product_photos(page, idx, IMAGE_DIR, hash_to_name, skip_stats)

        raw_lines = [clean_spaces(x) for x in text.splitlines() if clean_spaces(x)]
        lines = merge_wrapped_lines(raw_lines)

        for line in lines:
            col = line_column(tp, line, pw, ph)
            if col not in pending_by_col:
                pending_by_col[col] = new_pending(pending["category"], pending["brand"])
            pend = pending_by_col[col]
            pend["category"] = pending["category"]
            if pending["brand"]:
                pend["brand"] = pending["brand"]

            if is_skip_line(line) or is_warranty_or_meta_line(line):
                continue
            if is_category_header(line, pend.get("category")):
                pend["category"] = clean_spaces(line)
                continue
            bm = BULLET_NOTE_RE.match(line)
            if bm:
                note = clean_spaces(bm.group(1))
                if note and not CODE_RE.search(note):
                    pend["note"] = note.upper()
                continue

            if pend.get("title") and is_title_continuation(line) and not CODE_RE.search(line):
                pend["title"] = clean_spaces(pend["title"] + " " + line)
                continue

            section_match = SECTION_PHOTO_RE.match(line)
            if section_match:
                kind = section_match.group(1).upper()
                pend["_section_letter"] = "A" if "DROITE" in kind else "B"
                continue

            letter_match = LETTER_PREFIX_RE.match(line)
            if letter_match and not CODE_RE.search(line):
                pend["_pending_letter"] = letter_match.group(1).upper()
                continue

            long_skip = len(line) > 90 and line.count(" ") > 10
            if (
                looks_like_product_title(line)
                and not is_category_header(line, pend["category"])
                and not long_skip
                and not is_title_continuation(line)
            ):
                title = re.sub(r"^\d{1,4}(?=[A-ZÀ-Ÿ])", "", line).strip()
                pend["title"] = title
                pend["note"] = ""
                pend["vendu"] = ""
                pend["_section_letter"] = ""
                pend["_pending_letter"] = ""
                b = detect_brand(line)
                if b:
                    pend["brand"] = b
                ty, tx = find_title_y(tp, title, ph)
                pend["image"] = nearest_photo(photos, ty, tx, pw)
                continue

            parsed = parse_product_row(line, pend["vendu"])
            if not parsed:
                continue
            code = parsed["Code"]
            if code in seen:
                continue
            seen.add(code)

            title = pend["title"]
            category = pend["category"]
            extra = parsed.get("extra") or ""
            product_name = clean_product_title(title or category)
            diam = parsed.get("Diamètre") or ""
            if extra and (
                re.search(r"Ø|L\.\s*\d", extra, re.I)
                or DIM_LINE_RE.match(extra.replace(" ", ""))
            ):
                diam = diam or extra
            variant_label = extra or diam
            variant_label = re.sub(r"\s+\d+,\d{2}(\s+\d{5,})+.*$", "", variant_label or "").strip()
            variant_label = re.sub(r"\s+\d{6,}.*$", "", variant_label).strip()
            if re.search(r"circuit", extra or "", re.I):
                diam = ""
            _peeled, diam_from_title, tech_note = peel_technical(title or category)
            if diam_from_title and not diam:
                diam = diam_from_title
            note = clean_spaces(" · ".join(x for x in (pend["note"], tech_note) if x))
            designation = product_name or build_designation(category, title, "")
            brand = pend["brand"]
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

            img = pend["image"]
            img_path = f"{IMAGE_REL}/{img}" if img else ""
            photo_letter = (
                parsed.get("letter")
                or pend.pop("_pending_letter", "")
                or pend.get("_section_letter", "")
            )

            products.append(
                {
                    "Réf.Pro": parsed["Réf.Pro"],
                    "Réf.Four": parsed["Réf.Four"],
                    "Diamètre": diam,
                    "Vendu par": parsed["Vendu par"],
                    "Marque": brand,
                    "Désignation": designation,
                    "Variante": variant_label,
                    "Ordre": len(products) + 1,
                    "Code": code,
                    "Famille": infer_famille(category, title),
                    "Catégorie": category,
                    "Prix HT": parsed["Prix HT"],
                    "Note": note,
                    "Image": img_path,
                    "_photo_letter": photo_letter,
                }
            )

        left_ys, right_ys = red_separator_ys(fitz_doc[idx], pw, ph)
        title_pts = []
        seen_ty = set()
        for item in products[page_start:]:
            ty, tx = find_title_y(tp, (item.get("Désignation") or "")[:28], ph)
            if ty is None:
                continue
            key = (round(ty, 0), 0 if (tx or 0) < pw / 2 else 1)
            if key in seen_ty:
                continue
            seen_ty.add(key)
            title_pts.append((ty, tx or 0))
        for ty, tx in title_pts:
            if tx < pw / 2:
                left_ys.append(ty)
            else:
                right_ys.append(ty)
        left_ys = sorted(set(round(y, 1) for y in left_ys))
        right_ys = sorted(set(round(y, 1) for y in right_ys))

        assign_block_photos(
            products[page_start:],
            photos,
            fitz_doc[idx],
            tp,
            ph,
            pw,
            left_ys,
            right_ys,
        )

        if (idx + 1) % 25 == 0:
            print(
                f"Page {idx + 1}/{len(pdf)} -> {len(products)} produits, "
                f"{len(hash_to_name)} images (natif PNG, personnes exclues={skip_stats['people']})",
                flush=True,
            )

    fitz_doc.close()
    if FILTER_FAMILLE:
        products = [p for p in products if (p.get("Famille") or "") == FILTER_FAMILLE]
        print(f"Filtre famille {FILTER_FAMILLE} -> {len(products)} lignes", flush=True)
    print(
        f"Terminé {len(pdf)} pages -> {len(products)} produits, "
        f"{len(hash_to_name)} images pièces, {skip_stats['people']} photos personnes ignorées",
        flush=True,
    )
    return products


def write_excel(products):
    products.sort(
        key=lambda p: (
            p.get("Famille") or "",
            p.get("Catégorie") or "",
            p.get("Désignation") or "",
            int(p.get("Ordre") or 0),
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
                vertical="center", wrap_text=name in ("Désignation", "Variante", "Note")
            )
    widths = {
        "A": 12, "B": 16, "C": 16, "D": 12, "E": 18, "F": 42,
        "G": 22, "H": 8, "I": 12, "J": 20, "K": 28, "L": 12, "M": 26, "N": 36,
    }
    for col, width in widths.items():
        ws.column_dimensions[col].width = width
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:N{max(1, len(products) + 1)}"
    wb.save(OUTPUT_PATH)


def main():
    os.makedirs(CATALOGUE_DIR, exist_ok=True)
    os.makedirs(IMAGE_DIR, exist_ok=True)
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
