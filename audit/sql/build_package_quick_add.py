#!/usr/bin/env python3
"""SQL package for the cart quick-add block: new chunk HtsCartQuickAdd + one line in resource 12 «Корзина».

The call goes BEFORE <div class="ms2_total_products">: miniShop2 replaces that div's contents after every
cart change, so anything placed inside it (styles included) would vanish.
Usage: build_package_quick_add.py <repo root> <output dir>"""
import sys, os
root, out = sys.argv[1], sys.argv[2]
chunk = open(os.path.join(root, 'modx-chunks/hts-cart-quick-add.html'), encoding='utf-8').read().rstrip('\n')
assert '[[' not in chunk and ']]' not in chunk
BAK, NAME = 'hts_bak_20261113_qa', 'HtsCartQuickAdd'
def hx(s): return '_utf8mb4 0x' + s.encode('utf-8').hex().upper()
ANCHOR = '<div class="ms2_total_products">'
CALL = '[[$HtsCartQuickAdd]]'
NEW = CALL + '\n' + ANCHOR
RC = "CONVERT(r.content USING utf8mb4)"
def occ(col, s): return f"ROUND((CHAR_LENGTH({col}) - CHAR_LENGTH(REPLACE({col}, {hx(s)}, ''))) / {len(s)})"
OK, DONE, BAD = hx('СОВПАДАЕТ — можно переносить'), hx('УЖЕ ПЕРЕНЕСЕНО'), hx('НЕ СОВПАДАЕТ — стоп, скриншот')
L1, L2 = hx('1. Страница «Корзина» (12)'), hx('2. Новый чанк HtsCartQuickAdd')
sel = f"""SELECT itog, COUNT(*) AS n, GROUP_CONCAT(chto ORDER BY chto SEPARATOR '; ') AS what FROM (
SELECT {L1} AS chto, CASE WHEN r.id IS NULL THEN {BAD} WHEN r.content LIKE '%[[$HtsCartQuickAdd]]%' THEN {DONE} WHEN {occ(RC, ANCHOR)} = 1 THEN {OK} ELSE {BAD} END AS itog
FROM (SELECT 1 AS x) d LEFT JOIN modx_site_content r ON r.id = 12 AND r.alias = 'cart'
UNION ALL
SELECT {L2}, CASE WHEN (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = '{NAME}') = 0 THEN {OK} ELSE {DONE} END
) q GROUP BY itog;"""
head = "-- Paket 13.11.2026 (3): cart quick-add block (new chunk HtsCartQuickAdd, resource 12). Text is hex-encoded on purpose.\nSET NAMES utf8mb4;\nSET SESSION group_concat_max_len = 100000;\n"
files = {
'1-check.sql': head + "-- CHECK. Changes nothing. Before: 2 x OK. After: 2 x DONE.\n" + sel + "\n",
'2-apply.sql': head + f"""-- APPLY. Saves the page content to {BAK} first; safe to run twice.
CREATE TABLE IF NOT EXISTS {BAK} (kind VARCHAR(16) NOT NULL, el_id INT NOT NULL, body MEDIUMTEXT, saved_at DATETIME NOT NULL, PRIMARY KEY (kind, el_id)) DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO {BAK} (kind, el_id, body, saved_at) SELECT 'resource', r.id, r.content, NOW() FROM modx_site_content r WHERE r.id = 12 AND r.content NOT LIKE '%[[$HtsCartQuickAdd]]%';
UPDATE modx_site_content r SET r.content = REPLACE({RC}, {hx(ANCHOR)}, {hx(NEW)})
WHERE r.id = 12 AND r.alias = 'cart' AND r.content NOT LIKE '%[[$HtsCartQuickAdd]]%' AND {occ(RC, ANCHOR)} = 1;
INSERT INTO modx_site_htmlsnippets (source, name, description, category, snippet, properties, static, static_file)
SELECT 1, '{NAME}', {hx('Блок «Добавить товар по-быстрому» в корзине: подписи, количество, сумма')}, 0, {hx(chunk)}, 'a:0:{{}}', 0, '' FROM (SELECT 1 AS x) d
WHERE NOT EXISTS (SELECT 1 FROM modx_site_htmlsnippets WHERE name = '{NAME}');
{sel}
""",
'rollback.sql': head + f"""-- ROLLBACK: removes the one line from resource 12 and the chunk.
UPDATE modx_site_content r SET r.content = REPLACE({RC}, {hx(CALL + chr(10))}, '') WHERE r.id = 12;
UPDATE modx_site_content r SET r.content = REPLACE({RC}, {hx(CALL)}, '') WHERE r.id = 12;
DELETE FROM modx_site_htmlsnippets WHERE name = '{NAME}' AND snippet LIKE '%htsQuickAddBound%';
SELECT CASE WHEN (SELECT content FROM modx_site_content WHERE id = 12) NOT LIKE '%[[$HtsCartQuickAdd]]%' AND (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = '{NAME}') = 0 THEN {hx('Блок возвращён к прежнему виду')} ELSE {BAD} END AS itog;
""",
'cleanup.sql': f"-- CLEANUP, optional.\nDROP TABLE IF EXISTS {BAK};\n"}
os.makedirs(out, exist_ok=True)
for n, t in files.items():
    open(os.path.join(out, n), 'w', encoding='utf-8').write(t); print(f'{n:14} {len(t)//1024:3d} KB non-ASCII: {sum(1 for c in t if ord(c)>127)}')
