#!/usr/bin/env python3
"""
gen-report.py — генерирует HTML-отчёт из JSON по встроенному шаблону.

Использование:
    python gen-report.py data.json                 # -> печатает HTML в stdout
    python gen-report.py data.json -o report.html  # -> в файл
    cat data.json | python gen-report.py           # JSON из stdin

Формат JSON (все поля кроме "title" необязательны):
{
  "title": "Заголовок отчёта",
  "subtitle": "Подзаголовок / описание",
  "badge": "Автодеплой",
  "overview": "Вводный абзац текста.",
  "metrics": [
    {"name": "Всего записей", "value": "1 248", "change": "+3.2%"}
  ],
  "sections": [
    {"heading": "Заголовок раздела", "text": "Абзац.",
     "items": ["пункт списка 1", "пункт списка 2"]}
  ],
  "table": {
    "columns": ["Колонка A", "Колонка B"],
    "rows": [["a1", "b1"], ["a2", "b2"]]
  },
  "footer": "Текст в подвале"
}
"""
import sys
import json
import argparse
import html
from datetime import datetime


def esc(v):
    return html.escape(str(v), quote=True)


def render_metrics(metrics):
    if not metrics:
        return ""
    rows = "".join(
        f"<tr><td>{esc(m.get('name',''))}</td>"
        f"<td>{esc(m.get('value',''))}</td>"
        f"<td>{esc(m.get('change',''))}</td></tr>"
        for m in metrics
    )
    return f"""
    <div class="card">
      <h2>Показатели</h2>
      <table>
        <thead><tr><th>Метрика</th><th>Значение</th><th>Изменение</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>"""


def render_table(table):
    if not table or not table.get("columns"):
        return ""
    cols = table.get("columns", [])
    rows = table.get("rows", [])
    thead = "".join(f"<th>{esc(c)}</th>" for c in cols)
    tbody = "".join(
        "<tr>" + "".join(f"<td>{esc(c)}</td>" for c in row) + "</tr>"
        for row in rows
    )
    return f"""
    <div class="card">
      <h2>{esc(table.get('heading','Данные'))}</h2>
      <table>
        <thead><tr>{thead}</tr></thead>
        <tbody>{tbody}</tbody>
      </table>
    </div>"""


def render_sections(sections):
    out = []
    for s in sections or []:
        parts = [f"<h2>{esc(s.get('heading',''))}</h2>"]
        if s.get("text"):
            parts.append(f"<p>{esc(s['text'])}</p>")
        if s.get("items"):
            lis = "".join(f"<li>{esc(i)}</li>" for i in s["items"])
            parts.append(f'<ul style="padding-left:1.2rem;margin-top:.5rem;">{lis}</ul>')
        out.append(f'<div class="card">{"".join(parts)}</div>')
    return "\n".join(out)


def build_html(d):
    title = esc(d.get("title", "HTML-отчёт"))
    subtitle = f'<p class="subtitle">{esc(d["subtitle"])}</p>' if d.get("subtitle") else ""
    badge = f'<span class="badge">{esc(d["badge"])}</span>' if d.get("badge") else ""
    overview = f'<div class="card"><h2>Обзор</h2><p>{esc(d["overview"])}</p></div>' if d.get("overview") else ""
    footer = esc(d.get("footer", "Сгенерировано автоматически · GitHub Pages"))
    generated = datetime.now().strftime("%d.%m.%Y %H:%M")

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
  :root {{ --bg:#0f172a; --card:#1e293b; --accent:#38bdf8; --text:#e2e8f0; --muted:#94a3b8; }}
  * {{ box-sizing:border-box; margin:0; padding:0; }}
  body {{ font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
         background:var(--bg); color:var(--text); line-height:1.6; padding:2rem 1rem; }}
  .container {{ max-width:900px; margin:0 auto; }}
  header {{ border-bottom:1px solid #334155; padding-bottom:1.5rem; margin-bottom:2rem; }}
  h1 {{ font-size:2rem; color:var(--accent); }}
  .subtitle {{ color:var(--text); margin-top:.4rem; }}
  .meta {{ color:var(--muted); font-size:.9rem; margin-top:.5rem; }}
  .card {{ background:var(--card); border-radius:12px; padding:1.5rem; margin-bottom:1.5rem; border:1px solid #334155; }}
  .card h2 {{ font-size:1.25rem; margin-bottom:.75rem; color:var(--accent); }}
  table {{ width:100%; border-collapse:collapse; margin-top:.5rem; }}
  th,td {{ text-align:left; padding:.6rem .5rem; border-bottom:1px solid #334155; }}
  th {{ color:var(--muted); font-weight:600; }}
  footer {{ text-align:center; color:var(--muted); font-size:.85rem; margin-top:2rem; }}
  .badge {{ display:inline-block; background:var(--accent); color:#0f172a; padding:.2rem .6rem;
           border-radius:999px; font-size:.8rem; font-weight:600; margin-right:.5rem; }}
</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>{title}</h1>
      {subtitle}
      <p class="meta">{badge}Обновлено: {generated}</p>
    </header>
    {overview}
    {render_metrics(d.get("metrics"))}
    {render_table(d.get("table"))}
    {render_sections(d.get("sections"))}
    <footer>{footer}</footer>
  </div>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser(description="Генерирует HTML-отчёт из JSON.")
    ap.add_argument("json_file", nargs="?", help="путь к JSON (или '-' / пусто для stdin)")
    ap.add_argument("-o", "--output", help="файл для записи HTML (по умолчанию stdout)")
    args = ap.parse_args()

    if args.json_file and args.json_file != "-":
        with open(args.json_file, encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = json.load(sys.stdin)

    out = build_html(data)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out)
        print(f"HTML записан: {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(out)


if __name__ == "__main__":
    main()
