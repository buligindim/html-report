#!/usr/bin/env bash
###############################################################################
# publish-json.sh — одной командой: JSON -> HTML -> GitHub Pages (уникальная ссылка)
#
# Генерирует HTML из JSON (gen-report.py), затем публикует его через
# push-report.sh. Итог — постоянный адрес вида:
#   https://<owner>.github.io/<repo>/<slug>/
#
# Требования: python3, gh (авторизованный).
#
# Использование:
#   ./publish-json.sh data.json georgia          # -> /georgia/
#   ./publish-json.sh data.json                  # slug из <title> в данных
#   cat data.json | ./publish-json.sh - armenia  # JSON из stdin
#   ./publish-json.sh data.json georgia --repo buligindim/html-report
###############################################################################
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# первые два позиционных аргумента: JSON и slug; остальное -> push-report.sh
JSON="${1:-}"; [[ $# -gt 0 ]] && shift
SLUG=""
if [[ $# -gt 0 && "$1" != -* ]]; then SLUG="$1"; shift; fi

TMP="$(mktemp --suffix=.html)"
trap 'rm -f "$TMP"' EXIT

# --- JSON -> HTML -----------------------------------------------------------
if [[ -n "$JSON" && "$JSON" != "-" ]]; then
  python3 "$DIR/gen-report.py" "$JSON" -o "$TMP"
else
  python3 "$DIR/gen-report.py" - -o "$TMP" < /dev/stdin
fi

# --- HTML -> GitHub Pages ---------------------------------------------------
"$DIR/push-report.sh" "$TMP" "$SLUG" "$@"
