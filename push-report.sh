#!/usr/bin/env bash
###############################################################################
# push-report.sh — отправить HTML-отчёт в репозиторий из любого места/диалога
#
# Что делает:
#   Берёт готовый HTML-файл (или stdin), кладёт его как index.html в репозиторий
#   и пушит в main. GitHub Actions дальше сам деплоит страницу на Pages.
#
# Требования:
#   - gh (GitHub CLI), авторизованный:  gh auth login
#   (git и клон репозитория не нужны — заливка идёт через GitHub API)
#
# Использование:
#   ./push-report.sh report.html                       # залить файл
#   cat report.html | ./push-report.sh                 # залить из stdin
#   ./push-report.sh report.html --repo buligindim/html-report
#   ./push-report.sh report.html --path docs/index.html --message "update"
#
# Переменные окружения (альтернатива флагам):
#   REPO   — owner/repo         (по умолчанию buligindim/html-report)
#   DEST   — путь в репозитории  (по умолчанию index.html)
###############################################################################
set -euo pipefail

REPO="${REPO:-buligindim/html-report}"
DEST="${DEST:-index.html}"
MESSAGE="update report $(date -u +%Y-%m-%dT%H:%M:%SZ)"
BRANCH="main"
SRC=""

# --- разбор аргументов ------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)    REPO="$2"; shift 2 ;;
    --path)    DEST="$2"; shift 2 ;;
    --message) MESSAGE="$2"; shift 2 ;;
    --branch)  BRANCH="$2"; shift 2 ;;
    -*)        echo "Неизвестный флаг: $1" >&2; exit 1 ;;
    *)         SRC="$1"; shift ;;
  esac
done

command -v gh >/dev/null || { echo "gh не установлен: https://cli.github.com/" >&2; exit 1; }

# --- получаем содержимое (из файла или stdin) -------------------------------
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
if [[ -n "$SRC" ]]; then
  [[ -f "$SRC" ]] || { echo "Файл не найден: $SRC" >&2; exit 1; }
  cp "$SRC" "$TMP"
else
  cat > "$TMP"    # читаем из stdin
fi
[[ -s "$TMP" ]] || { echo "Пустой ввод — нечего отправлять" >&2; exit 1; }

echo "==> Репозиторий : $REPO"
echo "==> Файл        : $DEST (ветка $BRANCH)"

# --- узнаём текущий sha файла (нужен для обновления существующего) ----------
SHA="$(gh api "repos/$REPO/contents/$DEST?ref=$BRANCH" --jq .sha 2>/dev/null || true)"

# --- заливаем через Contents API (base64) -----------------------------------
CONTENT_B64="$(base64 -w0 "$TMP" 2>/dev/null || base64 "$TMP" | tr -d '\n')"

ARGS=(-X PUT "repos/$REPO/contents/$DEST"
      -f message="$MESSAGE"
      -f content="$CONTENT_B64"
      -f branch="$BRANCH")
[[ -n "$SHA" ]] && ARGS+=(-f sha="$SHA")

COMMIT_URL="$(gh api "${ARGS[@]}" --jq .commit.html_url)"

OWNER="${REPO%/*}"; NAME="${REPO#*/}"
echo ""
echo "======================================================================"
echo " Отправлено. Коммит: $COMMIT_URL"
echo " GitHub Actions задеплоит страницу автоматически:"
echo "   https://${OWNER}.github.io/${NAME}/"
echo "======================================================================"
