#!/usr/bin/env bash
# Atualiza pack-data.json (fallback no GitHub Pages) a partir do Gist do pack.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GIST_ID="${GIST_ID:-a82a82743ae0bc3d8887a69fb685d612}"
OWNER="${GIST_OWNER:-alanclovis}"
URL="https://gist.githubusercontent.com/${OWNER}/${GIST_ID}/raw/quality-hub-data.json"
curl -fsSL "$URL" -o "${ROOT}/pack-data.json.tmp"
python3 - "$ROOT/pack-data.json.tmp" "$ROOT/pack-data.json" <<'PY'
import json, sys, datetime
src, dst = sys.argv[1], sys.argv[2]
with open(src, encoding='utf-8') as f:
    data = json.load(f)
data['packUpdatedAt'] = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
if isinstance(data.get('authConfig'), dict) and data['authConfig'].get('packToken'):
    data['authConfig']['packToken'] = ''
with open(dst, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print('Wrote', dst, '—', sum(len(s.get('links', [])) for s in data.get('sections', [])), 'links')
PY
rm -f "${ROOT}/pack-data.json.tmp"
