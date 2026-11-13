#!/usr/bin/env python3
"""Build the SQL package (check / apply / rollback / cleanup) for the quantity buttons in catalogue cards.

Adds the chunk HtsListCompact and one line [[$HtsListCompact]] to template 18 «Подкатегория», right after
[[$HtsListQty]] (which the previous package put there). Text is hex-encoded so that pasting into
phpMyAdmin cannot damage Cyrillic or quotes. The template is changed with REPLACE() on that one line,
and the rollback removes exactly that line, so later edits to the template survive a rollback.
Usage: build_package_list_compact.py <repo root> <output dir>
"""
import sys, os

root, out = sys.argv[1], sys.argv[2]
chunk = open(os.path.join(root, 'modx-chunks/hts-list-compact.html'), encoding='utf-8').read().rstrip('\n')
tpl_new = open(os.path.join(root, 'modx-templates/podkategoriya.html'), encoding='utf-8').read()

BAK = 'hts_bak_20261113_cmp'
NAME = 'HtsListCompact'
def hx(s): return '_utf8mb4 0x' + s.encode('utf-8').hex().upper()

ANCHOR = '[[$HtsListQty]]'
LINE = '\n                        [[$HtsListCompact]]'
tpl_old = tpl_new.replace(ANCHOR + LINE, ANCHOR)
assert tpl_old.replace(ANCHOR, ANCHOR + LINE) == tpl_new and tpl_old.count(ANCHOR) == 1 and '[[$HtsListCompact]]' not in tpl_old
assert '[[' not in chunk and ']]' not in chunk, 'MODX would parse the chunk'

TC = "CONVERT(t.content USING utf8mb4)"
def occ(col, s): return f"ROUND((CHAR_LENGTH({col}) - CHAR_LENGTH(REPLACE({col}, {hx(s)}, ''))) / {len(s)})"
TPLNAME = hx('Подкатегория')
OK, DONE, BAD = hx('СОВПАДАЕТ — можно переносить'), hx('УЖЕ ПЕРЕНЕСЕНО'), hx('НЕ СОВПАДАЕТ — стоп, скриншот')
L1, L2 = hx('1. Шаблон «Подкатегория» (18)'), hx('2. Новый чанк HtsListCompact')

check_select = f"""SELECT itog, COUNT(*) AS n, GROUP_CONCAT(chto ORDER BY chto SEPARATOR '; ') AS what FROM (
SELECT {L1} AS chto, CASE WHEN t.id IS NULL THEN {BAD} WHEN t.content LIKE '%[[$HtsListCompact]]%' THEN {DONE} WHEN {occ(TC, ANCHOR)} = 1 THEN {OK} ELSE {BAD} END AS itog
FROM (SELECT 1 AS x) d LEFT JOIN modx_site_templates t ON t.id = 18 AND t.templatename = {TPLNAME}
UNION ALL
SELECT {L2}, CASE WHEN (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = '{NAME}') = 0 THEN {OK} ELSE {DONE} END
) q GROUP BY itog;"""

head = "-- Paket 13.11.2026 (5): compact catalogue cards on phones (new chunk HtsListCompact, template 18). Text is hex-encoded on purpose.\nSET NAMES utf8mb4;\nSET SESSION group_concat_max_len = 100000;\n"

check = head + "-- CHECK. Changes nothing. Before: 2 x OK. After: 2 x DONE. Any MISMATCH - stop.\n" + check_select + "\n"

apply_sql = head + f"""-- APPLY. Saves the template to {BAK} first; safe to run twice.
CREATE TABLE IF NOT EXISTS {BAK} (kind VARCHAR(16) NOT NULL, el_id INT NOT NULL, body MEDIUMTEXT, saved_at DATETIME NOT NULL, PRIMARY KEY (kind, el_id)) DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO {BAK} (kind, el_id, body, saved_at) SELECT 'template', t.id, t.content, NOW() FROM modx_site_templates t WHERE t.id = 18 AND t.content NOT LIKE '%[[$HtsListCompact]]%';
UPDATE modx_site_templates t SET t.content = REPLACE({TC}, {hx(ANCHOR)}, {hx(ANCHOR + LINE)})
WHERE t.id = 18 AND t.templatename = {TPLNAME} AND t.content NOT LIKE '%[[$HtsListCompact]]%' AND {occ(TC, ANCHOR)} = 1;
INSERT INTO modx_site_htmlsnippets (source, name, description, category, snippet, properties, static, static_file)
SELECT 1, '{NAME}', {hx('Компактные карточки каталога на телефоне')}, 0, {hx(chunk)}, 'a:0:{{}}', 0, '' FROM (SELECT 1 AS x) d
WHERE NOT EXISTS (SELECT 1 FROM modx_site_htmlsnippets WHERE name = '{NAME}');
-- RESULT: expect 2 x DONE.
{check_select}
"""

RB_OK = hx('Компактный вид убран, шаблон возвращён')
rollback = head + f"""-- ROLLBACK: removes the one line from template 18 and the chunk.
UPDATE modx_site_templates t SET t.content = REPLACE({TC}, {hx(LINE)}, '') WHERE t.id = 18;
UPDATE modx_site_templates t SET t.content = REPLACE({TC}, {hx('[[$HtsListCompact]]')}, '') WHERE t.id = 18;
DELETE FROM modx_site_htmlsnippets WHERE name = '{NAME}' AND snippet LIKE '%htsListCompact%';
SELECT CASE WHEN (SELECT content FROM modx_site_templates WHERE id = 18) NOT LIKE '%[[$HtsListCompact]]%' AND (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = '{NAME}') = 0 THEN {RB_OK} ELSE {BAD} END AS itog;
"""
cleanup = f"-- CLEANUP, optional, once everything has worked for a while: removes the spare copy of the template.\nDROP TABLE IF EXISTS {BAK};\n"

os.makedirs(out, exist_ok=True)
for name, text in (('1-check.sql', check), ('2-apply.sql', apply_sql), ('rollback.sql', rollback), ('cleanup.sql', cleanup)):
    open(os.path.join(out, name), 'w', encoding='utf-8').write(text)
    print(f'{name:14} {len(text)//1024:3d} KB  non-ASCII: {sum(1 for ch in text if ord(ch) > 127)}')
open(os.path.join(out, '_tpl_before_for_test.html'), 'w', encoding='utf-8').write(tpl_old)
