#!/usr/bin/env python3
"""SQL package: new chunk HtsSearchCompact + calls of HtsSearchCompact, HtsListCompact, HtsListQty appended to the END of chunk Footers
(the last two chunks already exist on the site; template 18 keeps its own calls, duplicates are harmless: CSS twice, JS guarded).
Rollback removes exactly those lines and chunk HtsSearchCompact. Usage: build_package_search.py <repo root> <output dir>"""
import sys, os
root, out = sys.argv[1], sys.argv[2]
body = open(os.path.join(root, 'modx-chunks', 'hts-search-compact.html'), encoding='utf-8').read().rstrip('\n')
assert '[[' not in body and ']]' not in body
BAK, HOST, NAME = 'hts_bak_20261114_sr', 'Footers', 'HtsSearchCompact'
NEED = ('HtsListCompact', 'HtsListQty')
def hx(s): return '_utf8mb4 0x' + s.encode('utf-8').hex().upper()
LINE = '\n[[$HtsSearchCompact]]\n[[$HtsListCompact]]\n[[$HtsListQty]]'
SC = "CONVERT(c.snippet USING utf8mb4)"
MARK = "'%[[$HtsSearchCompact]]%'"
OK, DONE, BAD = hx('СОВПАДАЕТ — можно переносить'), hx('УЖЕ ПЕРЕНЕСЕНО'), hx('НЕ СОВПАДАЕТ — стоп, скриншот')
rows = [f"SELECT {hx('1. Общий подвал сайта (чанк Footers)')} AS chto, CASE WHEN (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = '{HOST}') <> 1 THEN {BAD} WHEN (SELECT snippet FROM modx_site_htmlsnippets WHERE name = '{HOST}') LIKE {MARK} THEN {DONE} ELSE {OK} END AS itog",
        f"SELECT {hx('2. Новый чанк HtsSearchCompact')}, CASE WHEN (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = '{NAME}') = 0 THEN {OK} ELSE {DONE} END",
        f"SELECT {hx('3. Чанки HtsListCompact и HtsListQty есть на сайте')}, CASE WHEN (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name IN ('HtsListCompact', 'HtsListQty')) = 2 THEN (CASE WHEN (SELECT snippet FROM modx_site_htmlsnippets WHERE name = '{HOST}') LIKE {MARK} THEN {DONE} ELSE {OK} END) ELSE {BAD} END"]
sel = "SELECT itog, COUNT(*) AS n, GROUP_CONCAT(chto ORDER BY chto SEPARATOR '; ') AS what FROM (\n" + "\nUNION ALL\n".join(rows) + "\n) q GROUP BY itog;"
head = "-- Paket 14.11.2026 (4): compact search results on phones (chunk HtsSearchCompact; calls of HtsSearchCompact, HtsListCompact, HtsListQty appended to chunk Footers). Text is hex-encoded on purpose.\nSET NAMES utf8mb4;\nSET SESSION group_concat_max_len = 100000;\n"
need_ok = "(SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name IN ('HtsListCompact', 'HtsListQty')) = 2"
files = {
'1-check.sql': head + "-- CHECK. Changes nothing. Before: 3 x OK. After: 3 x DONE.\n" + sel + "\n",
'2-apply.sql': head + f"""-- APPLY. Saves chunk {HOST} to {BAK} first; safe to run twice. Does nothing if HtsListCompact or HtsListQty is missing.
CREATE TABLE IF NOT EXISTS {BAK} (kind VARCHAR(16) NOT NULL, el_id INT NOT NULL, body MEDIUMTEXT, saved_at DATETIME NOT NULL, PRIMARY KEY (kind, el_id)) DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO {BAK} (kind, el_id, body, saved_at) SELECT 'chunk', c.id, c.snippet, NOW() FROM modx_site_htmlsnippets c WHERE c.name = '{HOST}' AND c.snippet NOT LIKE {MARK};
UPDATE modx_site_htmlsnippets c SET c.snippet = CONCAT({SC}, {hx(LINE)}) WHERE c.name = '{HOST}' AND c.snippet NOT LIKE {MARK} AND (SELECT COUNT(*) FROM (SELECT id FROM modx_site_htmlsnippets WHERE name = '{HOST}') z) = 1 AND (SELECT COUNT(*) FROM (SELECT id FROM modx_site_htmlsnippets WHERE name IN ('HtsListCompact', 'HtsListQty')) y) = 2;
INSERT INTO modx_site_htmlsnippets (source, name, description, category, snippet, properties, static, static_file)
SELECT 1, '{NAME}', {hx('Страница поиска: компактные карточки и −/+ на телефоне')}, 0, {hx(body)}, 'a:0:{{}}', 0, '' FROM (SELECT 1 AS x) d
WHERE NOT EXISTS (SELECT 1 FROM modx_site_htmlsnippets WHERE name = '{NAME}') AND {need_ok};
{sel}
""",
'rollback.sql': head + f"""-- ROLLBACK: removes the added lines from chunk {HOST} and deletes chunk {NAME}. HtsListCompact and HtsListQty stay (template 18 uses them).
UPDATE modx_site_htmlsnippets c SET c.snippet = REPLACE({SC}, {hx(LINE)}, '') WHERE c.name = '{HOST}';
UPDATE modx_site_htmlsnippets c SET c.snippet = REPLACE({SC}, {hx('[[$HtsSearchCompact]]')}, '') WHERE c.name = '{HOST}';
DELETE FROM modx_site_htmlsnippets WHERE name = '{NAME}' AND snippet LIKE '%htsSearchCompact%';
SELECT CASE WHEN (SELECT snippet FROM modx_site_htmlsnippets WHERE name = '{HOST}') NOT LIKE '%HtsSearchCompact%' AND (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = '{NAME}') = 0 THEN {hx('Убрано, подвал возвращён')} ELSE {BAD} END AS itog;
""",
'cleanup.sql': f"-- CLEANUP, optional.\nDROP TABLE IF EXISTS {BAK};\n"}
os.makedirs(out, exist_ok=True)
for n, t in files.items():
    open(os.path.join(out, n), 'w', encoding='utf-8').write(t); print(f'{n:14} {len(t)//1024:3d} KB non-ASCII: {sum(1 for c in t if ord(c) > 127)}')
