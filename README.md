# html-report

Автоматическая публикация HTML-отчёта на **GitHub Pages** через GitHub Actions.
При каждом пуше в `main` (изменение `index.html` или ассетов) страница пересобирается и деплоится.

## Структура

```
html-report/
├── index.html                     # сам отчёт (публикуется из корня)
├── deploy.sh                      # скрипт первичного создания репо + деплоя
├── .github/
│   └── workflows/
│       └── deploy.yml             # workflow автодеплоя на Pages
└── README.md
```

## Быстрый старт

```bash
chmod +x deploy.sh
./deploy.sh html-report            # публичный репозиторий (по умолчанию)
# ./deploy.sh html-report --private  # приватный (Pages требует платный план)
```

## Ручная настройка Pages

Settings → Pages → **Source: GitHub Actions**. Больше ничего выбирать не нужно —
источником служит артефакт из workflow.

## Структура папок: root или /docs

| Вариант            | Когда использовать                                            | Настройка `deploy.yml`        |
|--------------------|--------------------------------------------------------------|-------------------------------|
| **root** (корень)  | Простой отчёт, репозиторий = сайт                            | `path: "."`                   |
| **/docs**          | Есть исходники/сборка, отчёт нужно отделить от кода          | `path: "docs"`                |
| **GitHub Actions** | Файлы генерируются сборкой (используется здесь)              | `path` указывает на результат |

Текущая конфигурация публикует из **корня** (`path: "."`).

## Генерация HTML из JSON

Если данные в JSON — сгенерируйте и опубликуйте одной командой:

```bash
./publish-json.sh data.json georgia     # JSON -> HTML -> /georgia/
cat data.json | ./publish-json.sh - q2   # JSON из stdin
```

Только сгенерировать HTML без публикации:

```bash
python gen-report.py data.json -o report.html
```

Формат JSON (все поля кроме `title` необязательны): `title`, `subtitle`,
`badge`, `overview`, `metrics[]` (`name`/`value`/`change`), `table`
(`heading`/`columns`/`rows`), `sections[]` (`heading`/`text`/`items`), `footer`.

## Обновление отчёта

Отредактируйте `index.html`, закоммитьте и запушьте — workflow задеплоит автоматически:

```bash
git add index.html && git commit -m "update report" && git push
```
