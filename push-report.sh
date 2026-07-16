#!/usr/bin/env bash
###############################################################################
# push-report.sh — опубликовать HTML-отчёт на GitHub Pages с УНИКАЛЬНОЙ ссылкой
#
# Что делает:
#   Берёт готовый HTML-файл (или stdin) и кладёт его в подпапку репозитория
#   как <slug>/index.html. Каждый отчёт получает свой постоянный адрес:
#     https://<owner>.github.io/<repo>/<slug>/
#   GitHub Actions дальше сам деплоит страницу на Pages.
#
# Требования:
#   - gh (GitHub CLI), авторизованный:  gh auth login
#   (git и клон репозитория не нужны — заливка идёт через GitHub API)
#
# Использование:
#   ./push-report.sh report.html georgia            # -> /georgia/
#   ./push-report.sh report.html                    # slug сгенерируется из <title>
#   cat report.html | ./push-report.sh - georgia    # HTML из stdin, слаг georgia
#   ./push-report.sh report.html georgia --repo buligindim/html-report
#
# Аргументы:
#   1) путь к HTML-файлу или "-" для чтения из stdin
#   2) slug (необязательно) — имя подпапки/ссылки; если не задан,
#      берётся из <title> файла, иначе report-<timestamp>
#
# Флаги:
#   --repo owner/repo     репозиторий (по умолчанию buligindim/html-report)
#   --branch main         ветка (по умолчанию main)
#   --message "..."       сообщение коммита
###############################################################################
set -euo pipefail

REPO="${REPO:-buligindim/html-report}"
BRANCH="main"
MESSAGE=""
SRC=""
SLUG=""

# --- разбор аргументов ------------------------------------------------------
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)    REPO="$2"; shift 2 ;;
    --branch)  BRANCH="$2"; shift 2 ;;
    --message) MESSAGE="$2"; shift 2 ;;
    -*)        echo "Неизвестный флаг: $1" >&2; exit 1 ;;
    *)         POSITIONAL+=("$1"); shift ;;
  esac
done
SRC="${POSITIONAL[0]:-}"
SLUG="${POSITIONAL[1]:-}"

command -v gh >/dev/null || { echo "gh не установлен: https://cli.github.com/" >&2; exit 1; }

# --- получаем содержимое (из файла или stdin) -------------------------------
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
if [[ -n "$SRC" && "$SRC" != "-" ]]; then
  [[ -f "$SRC" ]] || { echo "Файл не найден: $SRC" >&2; exit 1; }
  cp "$SRC" "$TMP"
else
  cat > "$TMP"    # читаем из stdin
fi
[[ -s "$TMP" ]] || { echo "Пустой ввод — нечего отправлять" >&2; exit 1; }

# --- функция транслитерации + очистки слага ---------------------------------
slugify() {
  # кириллица -> латиница, всё лишнее -> дефис
  echo "$1" | sed -E '
    s/[Аа]/a/g;s/[Бб]/b/g;s/[Вв]/v/g;s/[Гг]/g/g;s/[Дд]/d/g;s/[Ее]/e/g;
    s/[Ёё]/e/g;s/[Жж]/zh/g;s/[Зз]/z/g;s/[Ии]/i/g;s/[Йй]/y/g;s/[Кк]/k/g;
    s/[Лл]/l/g;s/[Мм]/m/g;s/[Нн]/n/g;s/[Оо]/o/g;s/[Пп]/p/g;s/[Рр]/r/g;
    s/[Сс]/s/g;s/[Тт]/t/g;s/[Уу]/u/g;s/[Фф]/f/g;s/[Хх]/h/g;s/[Цц]/c/g;
    s/[Чч]/ch/g;s/[Шш]/sh/g;s/[Щщ]/sch/g;s/[Ъъ]//g;s/[Ыы]/y/g;s/[Ьь]//g;
    s/[Ээ]/e/g;s/[Юю]/yu/g;s/[Яя]/ya/g' \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
  | cut -c1-50
}

# --- определяем slug --------------------------------------------------------
if [[ -z "$SLUG" ]]; then
  TITLE="$(grep -o '<title>[^<]*</title>' "$TMP" | head -1 | sed 's/<[^>]*>//g' || true)"
  SLUG="$(slugify "$TITLE")"
  [[ -z "$SLUG" ]] && SLUG="report-$(date -u +%Y%m%d-%H%M%S)"
else
  SLUG="$(slugify "$SLUG")"
fi

DEST="${SLUG}/index.html"
[[ -z "$MESSAGE" ]] && MESSAGE="publish report: ${SLUG}"

echo "==> Репозиторий : $REPO"
echo "==> Слаг        : $SLUG"
echo "==> Файл        : $DEST (ветка $BRANCH)"

# --- узнаём текущий sha (если файл уже существует — обновляем) --------------
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
URL="https://${OWNER}.github.io/${NAME}/${SLUG}/"
echo ""
echo "======================================================================"
echo " Отправлено. Коммит: $COMMIT_URL"
echo " Уникальная ссылка на отчёт (готова через ~30 сек):"
echo "   ${URL}"
echo "======================================================================"
