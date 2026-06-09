#!/usr/bin/env python3
"""Importa un edificio + sistemas + equipos a Mapelec desde un Excel formato SEMCO (plantilla GreenWood).
Uso: python import_building_excel.py <ruta.xlsx> <NombreEdificio> [--apply]
Sin --apply = dry-run (solo muestra lo que crearía, NO toca la DB)."""
import json, ssl, sys, urllib.request
from pathlib import Path
import openpyxl

ENV = Path(__file__).resolve().parent.parent / ".env.local"
def env(k):
    for line in ENV.read_text().splitlines():
        if line.startswith(k + "="):
            return line.split("=", 1)[1].strip()
    return None
URL = env("NEXT_PUBLIC_SUPABASE_URL")
KEY = env("SUPABASE_SERVICE_ROLE_KEY")
CREATED_BY = "216c8427-8839-4fd1-b679-4effb4a8121f"  # Pacho (ops_manager)

try:
    import certifi; CTX = ssl.create_default_context(cafile=certifi.where())
except Exception: CTX = ssl._create_unverified_context()

def rest(method, path, body=None):
    req = urllib.request.Request(URL + "/rest/v1/" + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY,
                 "Content-Type": "application/json", "Prefer": "return=representation"})
    with urllib.request.urlopen(req, context=CTX, timeout=30) as r:
        return json.loads(r.read() or "[]")

import unicodedata
def norm(s):
    return "".join(ch for ch in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(ch) != "Mn")

SYS_KW = [("transferencia","transferencia_agua_potable"),("reforzador","reforzador_agua_potable"),
    ("incendio","contra_incendios"),("freatico","achique_freatico"),("elevador","achique_elevador"),
    ("pluvial","achique_pluvial"),("sanitar","sanitario"),("diesel","planta_diesel")]
def sys_code(name):
    n = norm(name)
    for kw, code in SYS_KW:
        if kw in n: return code
    return "otro"

def kind_of(name):
    n = name.lower()
    if "panel" in n: return "panel_control"
    if "generador" in n: return "generador"
    if "bomba" in n: return "bomba"
    return None

def starter(name):
    n = name.lower()
    if "suave" in n or "arrancador" in n: return "arrancador_suave"
    if "variador" in n or "frecuencia" in n: return "variador_frecuencia"
    if "contactor" in n or "térmica" in n or "termica" in n: return "contactor_termica"
    return None

def num(v):
    if v is None: return None
    try: return float(str(v).replace(",", ".").strip())
    except Exception: return None

xlsx = sys.argv[1] if len(sys.argv) > 1 else "/Users/usuario/Downloads/Sistemas de bombeo en Greenwood (Para usar de plantilla) (2).xlsx"
bname = sys.argv[2] if len(sys.argv) > 2 else "GreenWood"
APPLY = "--apply" in sys.argv

ws = openpyxl.load_workbook(xlsx, data_only=True).active
systems, equipos, cur = [], [], None
for row in ws.iter_rows(values_only=True):
    c = list(row) + [None] * (8 - len(row))
    a = str(c[0]).strip() if c[0] is not None else ""   # col A = letra del sistema
    b = str(c[1]).strip() if c[1] is not None else ""   # col B = nombre sistema (header) o equipo
    if len(a) == 1 and a.isalpha() and b:        # header de sistema (A..H + nombre)
        cur = sys_code(b)
        if cur not in systems: systems.append(cur)
        continue
    if not b: continue
    k = kind_of(b)                               # tipo se decide por el nombre del equipo (col B)
    if not k: continue
    manu = str(c[2]).strip() if c[2] is not None else None   # col C = Fabricante
    model = str(c[3]).strip() if c[3] is not None else None  # col D = Modelo
    if k == "bomba":
        specs = {"hp": num(c[4]), "voltage": num(c[5]), "pressure_psi": num(c[6]), "flow_gpm": num(c[7])}
    elif k == "panel_control":
        specs = {"starter_type": starter(b), "power": num(c[4]), "voltage": num(c[5])}
    else:  # generador
        specs = {"kva": num(c[4]), "kw": num(c[5]), "current_a": num(c[6]), "voltage": num(c[7])}
    specs = {kk: vv for kk, vv in specs.items() if vv is not None}
    equipos.append({"name": b, "system": cur, "kind": k,
                    "manufacturer": manu, "model": model, "specs": specs})

# Diferenciar nombres repetidos dentro del edificio (índice único building_id+name):
# p.ej. 3 "Panel de Control con contactores y Térmica" en sistemas distintos -> añade el sistema.
from collections import Counter
_dups = Counter(e["name"] for e in equipos)
for e in equipos:
    if _dups[e["name"]] > 1:
        e["name"] = f"{e['name']} ({e['system'].replace('_', ' ')})"

print(f"\n=== {bname} — parseado: {len(systems)} sistemas, {len(equipos)} equipos ===")
print("Sistemas:", systems)
for e in equipos:
    print(f"  {e['system'][:20]:20} | {e['kind']:13} | {e['name'][:38]:38} | {e['manufacturer']}/{e['model']} | {e['specs']}")

if not APPLY:
    print("\n🟡 DRY-RUN — nada se escribió. Corre con --apply para crear en la DB.")
    sys.exit(0)

sys_legacy = sorted({"fire" if s == "contra_incendios" else "pump" for s in systems})
bid = rest("POST", "buildings", {"name": bname, "systems": sys_legacy, "created_by": CREATED_BY,
    "notes": f"Precargado desde Excel SEMCO: {len(equipos)} equipos, {len(systems)} sistemas"})[0]["id"]
print(f"\n✅ Building creado: {bname} ({bid})")
ok = 0
for e in equipos:
    etype = "fire" if e["system"] == "contra_incendios" else "pump"
    try:
        rest("POST", "equipment", {"building_id": bid, "name": e["name"], "equipment_type": etype,
            "kind": e["kind"], "system": e["system"], "manufacturer": e["manufacturer"],
            "model": e["model"], "specs": e["specs"], "is_active": True})
        ok += 1
    except Exception as ex:
        print(f"  ❌ {e['name']}: {ex}")
print(f"✅ {ok}/{len(equipos)} equipos creados.")
