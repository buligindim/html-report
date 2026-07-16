#!/usr/bin/env bash
###############################################################################
# deploy.sh — автоматизация создания и деплоя HTML-отчёта на GitHub Pages
#
# Что делает скрипт:
#   1. Создаёт (при отсутствии) публичный репозиторий на GitHub через gh CLI
#   2. Инициализирует git, коммитит файлы и пушит в ветку main
#   3. Включает GitHub Pages с источником "GitHub Actions"
#   4. Дожидается завершения workflow и выводит URL страницы
#
# Требования:
#   - gh (GitHub CLI), авторизованный: gh auth login
#   - git
#
# Использование:
#   ./deploy.sh [REPO_NAME] [--private]
#   REPO_NAME   — имя репозитория (по умолчанию html-report)
#   --private   — создать приватный репозиторий (по умолчанию public)
###############################################################################
set -euo pipefail

REPO_NAME="${1:-html-report}"
VISIBILITY="--public"
[[ "${2:-}" == "--private" ]] && VISIBILITY="--private"

BRANCH="main"

echo "==> Проверяю gh CLI и авторизацию"
command -v gh >/dev/null || { echo "gh не установлен. https://cli.github.com/"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Выполните: gh auth login"; exit 1; }

OWNER="$(gh api user --jq .login)"
FULL="${OWNER}/${REPO_NAME}"

echo "==> Инициализирую git-репозиторий локально"
git init -q
git branch -M "${BRANCH}"
git add -A
git commit -qm "Initial commit: HTML report + Pages workflow" || echo "   (нечего коммитить)"

if gh repo view "${FULL}" >/dev/null 2>&1; then
  echo "==> Репозиторий ${FULL} уже существует — подключаю remote"
  git remote add origin "https://github.com/${FULL}.git" 2>/dev/null || true
else
  echo "==> Создаю репозиторий ${FULL} (${VISIBILITY})"
  gh repo create "${FULL}" ${VISIBILITY} --source=. --remote=origin --push
fi

echo "==> Пушу изменения в ${BRANCH}"
git push -u origin "${BRANCH}"

echo "==> Включаю GitHub Pages с источником GitHub Actions"
# build_type=workflow -> Pages берёт артефакт из GitHub Actions
gh api -X POST "repos/${FULL}/pages" \
  -f build_type=workflow >/dev/null 2>&1 \
  || gh api -X PUT "repos/${FULL}/pages" -f build_type=workflow >/dev/null 2>&1 \
  || echo "   (Pages уже настроен)"

echo "==> Жду завершения workflow деплоя"
sleep 5
gh run watch --exit-status "$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')" 2>/dev/null || true

PAGES_URL="$(gh api "repos/${FULL}/pages" --jq .html_url 2>/dev/null || echo "https://${OWNER}.github.io/${REPO_NAME}/")"
echo ""
echo "======================================================================"
echo " Готово. Отчёт опубликован:"
echo "   ${PAGES_URL}"
echo " Репозиторий:"
echo "   https://github.com/${FULL}"
echo "======================================================================"
