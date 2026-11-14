#!/usr/bin/env python3
"""SQL package for the compact cookie banner: new chunk HtsCookieCompact + its call appended to the END of chunk Footers.
Appending needs no anchor in the owner's Footers code, which has not been seen. Rollback removes exactly that line.
Usage: build_package_cookie_compact.py <repo root> <output dir>"""
import sys, os
root, out = sys.argv[1], sys.argv[2]
chunk = open(os.path.join(root, 'modx-chunks/hts-cookie-compact.html'), encoding='utf-8').read().rstrip('\n')
assert '[[' not in chunk and ']]' not in chunk
BAK, NAME, HOST = 'hts_bak_20261114_ck', 'HtsCookieCompact', 'Footers'
def hx(s): return '_utf8mb4 0x' + s.encode('utf-8').hex().upper()
CALL = '[[$HtsCookieCompact]]'; LINE = '\n' + CALL
SC = "CONVERT(c.snippet USING utf8mb4)"
OK, DONE, BAD = hx('СОВПАДАЕТ — можно переносить'), hx('УЖЕ ПЕРЕНЕСЕНО'), hx('НЕ СОВПАДАЕТ — стоп, скриншот')
L1, L2 = hx('1. Общий подвал сайта (чанк Footers)'), hx('2. Новый чанк HtsCookieCompact')
sel = f"""SELECT itog, COUNT(*) AS n, GROUP_CONCAT(chto ORDER BY chto SEPARATOR '; ') AS what FROM (
SELECT {L1} AS chto, CASE WHEN (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = '{HOST}') <> 1 THEN {BAD} WHEN (SELECT snippet FROM modx_site_htmlsnippets WHERE name = '{HOST}') LIKE '%[[$HtsCookieCompact]]%' THEN {DONE} ELSE {OK} END AS itog
UNION ALL
SELECT {L2}, CASE WHEN (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = '{NAME}') = 0 THEN {OK} ELSE {DONE} END
) q GROUP BY itog;"""
head = "-- Paket 14.11.2026: compact cookie banner on phones (new chunk HtsCookieCompact, call appended to chunk Footers). Text is hex-encoded on purpose.\nSET NAMES utf8mb4;\nSET SESSION group_concat_max_len = 100000;\n"
files = {
'1-check.sql': head + "-- CHECK. Changes nothing. Before: 2 x OK. After: 2 x DONE.\n" + sel + "\n",
'2-apply.sql': head + f"""-- APPLY. Saves chunk {HOST} to {BAK} first; safe to run twice.
CREATE TABLE IF NOT EXISTS {BAK} (kind VARCHAR(16) NOT NULL, el_id INT NOT NULL, body MEDIUMTEXT, saved_at DATETIME NOT NULL, PRIMARY KEY (kind, el_id)) DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO {BAK} (kind, el_id, body, saved_at) SELECT 'chunk', c.id, c.snippet, NOW() FROM modx_site_htmlsnippets c WHERE c.name = '{HOST}' AND c.snippet NOT LIKE '%[[$HtsCookieCompact]]%';
UPDATE modx_site_htmlsnippets c SET c.snippet = CONCAT({SC}, {hx(LINE)}) WHERE c.name = '{HOST}' AND c.snippet NOT LIKE '%[[$HtsCookieCompact]]%' AND (SELECT COUNT(*) FROM (SELECT id FROM modx_site_htmlsnippets WHERE name = '{HOST}') z) = 1;
INSERT INTO modx_site_htmlsnippets (source, name, description, category, snippet, properties, static, static_file)
SELECT 1, '{NAME}', {hx('Компактное окно про cookie на телефоне (только оформление)')}, 0, {hx(chunk)}, 'a:0:{{}}', 0, '' FROM (SELECT 1 AS x) d
WHERE NOT EXISTS (SELECT 1 FROM modx_site_htmlsnippets WHERE name = '{NAME}');
{sel}
""",
'rollback.sql': head + f"""-- ROLLBACK: removes the one line from chunk {HOST} and deletes chunk {NAME}.
UPDATE modx_site_htmlsnippets c SET c.snippet = REPLACE({SC}, {hx(LINE)}, '') WHERE c.name = '{HOST}';
UPDATE modx_site_htmlsnippets c SET c.snippet = REPLACE({SC}, {hx(CALL)}, '') WHERE c.name = '{HOST}';
DELETE FROM modx_site_htmlsnippets WHERE name = '{NAME}' AND snippet LIKE '%htsCookieCompact%';
SELECT CASE WHEN (SELECT snippet FROM modx_site_htmlsnippets WHERE name = '{HOST}') NOT LIKE '%[[$HtsCookieCompact]]%' AND (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = '{NAME}') = 0 THEN {hx('Оформление cookie убрано, подвал возвращён')} ELSE {BAD} END AS itog;
""",
'cleanup.sql': f"-- CLEANUP, optional.\nDROP TABLE IF EXISTS {BAK};\n"}
os.makedirs(out, exist_ok=True)
for n, t in files.items():
    open(os.path.join(out, n), 'w', encoding='utf-8').write(t); print(f'{n:14} {len(t)//1024:3d} KB non-ASCII: {sum(1 for c in t if ord(c) > 127)}')
