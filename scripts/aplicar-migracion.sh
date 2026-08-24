#!/bin/bash
# Aplica una migración SQL a la base de SEMCO.
#
# POR QUÉ EXISTE: el classifier de auto-mode bloquea que Claudia escriba esquema en la
# base del cliente, y así debe ser. Pero cada vez le hacía redactar un script nuevo, lo
# cual es lento y propenso a error. Este es fijo: ella escribe el .sql, tú corres esto.
#
#   ! bash scripts/aplicar-migracion.sh supabase/migrations/2026XXXX_lo_que_sea.sql
#   ! bash scripts/aplicar-migracion.sh <archivo.sql> 'CLAVE'   <- si la de .env.local venció
#
# El Mac NO alcanza la base (el pooler no resuelve y el host directo es IPv6 sin ruta).
# Hetzner sí, y tiene psql. Por eso el rodeo.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL="${1:-}"
REF="ismcakzioekwvcebrmtt"
HETZNER="root@188.245.220.238"

if [ -z "$SQL" ]; then
  echo "Uso: bash scripts/aplicar-migracion.sh <archivo.sql> ['clave']"
  echo ""
  echo "Migraciones sin aplicar (las más nuevas primero):"
  ls -t "$REPO/supabase/migrations/"*.sql 2>/dev/null | head -5 | sed 's|^|  |'
  exit 1
fi
[ -f "$SQL" ] || SQL="$REPO/$SQL"
if [ ! -f "$SQL" ]; then
  echo "❌ No encontré $SQL"
  exit 1
fi

PW="${2:-$(grep -E '^SUPABASE_DB_PASSWORD=' "$REPO/.env.local" | cut -d= -f2- | tr -d '"'"'"'')}"
if [ -z "$PW" ]; then
  echo "❌ Sin SUPABASE_DB_PASSWORD. Pásala como 2º argumento."
  exit 1
fi

echo "▶ $(basename "$SQL")"
echo "  Migración en seco primero (BEGIN … ROLLBACK), para ver si revienta sin dejar rastro."

correr_remoto () {   # $1 = "seco" | "real"
  ssh -o BatchMode=yes -o ConnectTimeout=15 "$HETZNER" "bash -s" <<REMOTE
set -uo pipefail
export PGPASSWORD='$PW'
CONN="postgresql://postgres:\$PGPASSWORD@db.$REF.supabase.co:5432/postgres"

if [ "$1" = "seco" ]; then
  psql "\$CONN" -v ON_ERROR_STOP=1 -q <<'SQLEOF'
BEGIN;
$(cat "$SQL")
ROLLBACK;
SQLEOF
else
  psql "\$CONN" -v ON_ERROR_STOP=1 <<'SQLEOF'
$(cat "$SQL")
SQLEOF
fi
REMOTE
}

# Ojo: si el .sql ya trae su propio BEGIN/COMMIT, el ensayo en seco no puede envolverlo.
if grep -qiE '^\s*(BEGIN|COMMIT)\s*;' "$SQL"; then
  echo "  (el archivo ya maneja su propia transacción — me salto el ensayo)"
else
  if ! correr_remoto seco; then
    echo ""
    echo "❌ Falló en seco. NO se tocó la base. Arregla el SQL y vuelve a correr."
    echo "   Si dice 28P01, la clave venció: sácala de Supabase → Settings → Database"
    echo "   y corre:  bash $0 '$SQL' 'CLAVE_NUEVA'"
    exit 1
  fi
  echo "  ✅ pasó en seco"
fi

echo "  Aplicando de verdad…"
if ! correr_remoto real; then
  echo ""
  echo "❌ Falló al aplicar."
  echo "   Plan B: pega esto en el SQL Editor de Supabase:"
  echo "   ─────────────────────────────────────────────"
  grep -v '^--' "$SQL" | grep -v '^$'
  echo "   ─────────────────────────────────────────────"
  exit 1
fi

echo ""
echo "✅ Aplicada: $(basename "$SQL")"
echo "   Avísale a Claudia. Si la migración agrega columnas que el código nuevo LEE,"
echo "   el deploy va DESPUÉS de esto (si no, PostgREST devuelve 400)."
