#!/usr/bin/env python3
"""Build the SQL package (check / apply / rollback) for the cart quantity and mobile filters change.

Text is hex-encoded so that pasting into phpMyAdmin cannot damage Cyrillic or quotes.
The cart chunk and the template are changed with REPLACE() on what is in the database, not overwritten,
so everything outside the touched lines stays byte-identical; the originals go to a backup table first.
Usage: build_package.py <repo root> <output dir>
"""
import sys, os

root, out = sys.argv[1], sys.argv[2]
new_cart = open(os.path.join(root, 'modx-chunks/tpl.msCart.html'), encoding='utf-8').read()
filters = open(os.path.join(root, 'modx-chunks/hts-mobile-filters.html'), encoding='utf-8').read().rstrip('\n')

BAK = 'hts_bak_20261113'
def hx(s): return '_utf8mb4 0x' + s.encode('utf-8').hex().upper()
def cut(text, start, end):
    i = text.index(start); j = text.index(end, i) + len(end); return text[i:j]

# --- cart chunk: four single-line anchors (each verified to occur once in the live page) ---
A_old = '<form method="post" class="ms2_form" style="display:flex!important;align-items:center!important;gap:6px!important;margin:0!important">'
A_new = '<form method="post" class="ms2_form hts-qty">'
B_old = '<input type="number" name="count" class="product__count only_digit stepper-input" style="width:56px!important;text-align:center!important;border:1px solid #d7dae3!important;border-radius:6px!important;padding:6px 4px!important" value="{$product.count}"/>'
B_new = cut(new_cart, '<button type="button" class="hts-qty-btn" data-step="-1"', 'aria-label="Увеличить количество">+</button>')
C_old = '$(document).ready(function(){ $("#msCart input[type=number]").stepper(); });'
C_new = cut(new_cart, '/* Кнопки «−» и «+» в корзине (13.11.2026).', "    }, 400);\n  });\n})();")
D_old = '</style>'
css = cut(new_cart, '\n/* Количество в корзине (13.11.2026).', '-webkit-appearance:none!important;margin:0!important}\n')
D_new = css + '</style>'

def forward(s): return s.replace(A_old, A_new).replace(B_old, B_new).replace(C_old, C_new).replace(D_old, D_new)
orig_cart = new_cart.replace(A_new, A_old).replace(B_new, B_old).replace(C_new, C_old).replace(D_new, D_old)
assert forward(orig_cart) == new_cart, 'forward(orig) must reproduce the tested chunk'
for name, s in (('A', A_old), ('B', B_old), ('C', C_old), ('D', D_old)):
    assert orig_cart.count(s) == 1, name
assert 'hts-qty' not in orig_cart and 'stepper' in orig_cart

# --- template: one anchor ---
T_old = '[[$contentcategory]]'
T_new = '[[$contentcategory]]\n                        [[$HtsMobileFilters]]'

SN = "CONVERT(c.snippet USING utf8mb4)"
TC = "CONVERT(t.content USING utf8mb4)"
def occ(col, s): return f"ROUND((CHAR_LENGTH({col}) - CHAR_LENGTH(REPLACE({col}, {hx(s)}, ''))) / {len(s)})"
cart_ready = ' AND '.join(f"{occ(SN, s)} = 1" for s in (A_old, B_old, C_old, D_old))

OK, DONE, BAD = hx('СОВПАДАЕТ — можно переносить'), hx('УЖЕ ПЕРЕНЕСЕНО'), hx('НЕ СОВПАДАЕТ — стоп, скриншот')
L1, L2, L3 = hx('1. Чанк корзины tpl.msCart (17)'), hx('2. Шаблон «Подкатегория» (18)'), hx('3. Новый чанк HtsMobileFilters')
TPLNAME = hx('Подкатегория')

check_select = f"""SELECT itog, COUNT(*) AS n, GROUP_CONCAT(chto ORDER BY chto SEPARATOR '; ') AS what FROM (
SELECT {L1} AS chto, CASE WHEN c.id IS NULL THEN {BAD} WHEN c.snippet LIKE '%hts-qty-btn%' THEN {DONE} WHEN {cart_ready} THEN {OK} ELSE {BAD} END AS itog
FROM (SELECT 1 AS x) d LEFT JOIN modx_site_htmlsnippets c ON c.id = 17 AND c.name = 'tpl.msCart'
UNION ALL
SELECT {L2}, CASE WHEN t.id IS NULL THEN {BAD} WHEN t.content LIKE '%[[$HtsMobileFilters]]%' THEN {DONE} WHEN {occ(TC, T_old)} = 1 THEN {OK} ELSE {BAD} END
FROM (SELECT 1 AS x) d LEFT JOIN modx_site_templates t ON t.id = 18 AND t.templatename = {TPLNAME}
UNION ALL
SELECT {L3}, CASE WHEN (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = 'HtsMobileFilters') = 0 THEN {OK} ELSE {DONE} END
) q GROUP BY itog;"""

head = "-- Paket 13.11.2026: cart quantity buttons (chunk 17) + mobile filters (new chunk, template 18). Text is hex-encoded on purpose.\nSET NAMES utf8mb4;\nSET SESSION group_concat_max_len = 100000;\n"

check = head + "-- CHECK. Changes nothing. Before: 3 x OK. After: 3 x DONE. Any MISMATCH - stop.\n" + check_select + "\n"

apply_sql = head + f"""-- APPLY. Saves the originals to {BAK} first; safe to run twice.
CREATE TABLE IF NOT EXISTS {BAK} (kind VARCHAR(16) NOT NULL, el_id INT NOT NULL, body MEDIUMTEXT, saved_at DATETIME NOT NULL, PRIMARY KEY (kind, el_id)) DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO {BAK} (kind, el_id, body, saved_at) SELECT 'chunk', c.id, c.snippet, NOW() FROM modx_site_htmlsnippets c WHERE c.id = 17 AND c.name = 'tpl.msCart' AND c.snippet NOT LIKE '%hts-qty-btn%';
INSERT IGNORE INTO {BAK} (kind, el_id, body, saved_at) SELECT 'template', t.id, t.content, NOW() FROM modx_site_templates t WHERE t.id = 18 AND t.content NOT LIKE '%[[$HtsMobileFilters]]%';
UPDATE modx_site_htmlsnippets c SET c.snippet = REPLACE(REPLACE(REPLACE(REPLACE({SN}, {hx(A_old)}, {hx(A_new)}), {hx(B_old)}, {hx(B_new)}), {hx(C_old)}, {hx(C_new)}), {hx(D_old)}, {hx(D_new)})
WHERE c.id = 17 AND c.name = 'tpl.msCart' AND c.snippet NOT LIKE '%hts-qty-btn%' AND {cart_ready};
UPDATE modx_site_templates t SET t.content = REPLACE({TC}, {hx(T_old)}, {hx(T_new)})
WHERE t.id = 18 AND t.templatename = {TPLNAME} AND t.content NOT LIKE '%[[$HtsMobileFilters]]%' AND {occ(TC, T_old)} = 1;
INSERT INTO modx_site_htmlsnippets (source, name, description, category, snippet, properties, static, static_file)
SELECT 1, 'HtsMobileFilters', {hx('Кнопка «Фильтры» и панель фильтров на телефоне')}, 0, {hx(filters)}, 'a:0:{{}}', 0, '' FROM (SELECT 1 AS x) d
WHERE NOT EXISTS (SELECT 1 FROM modx_site_htmlsnippets WHERE name = 'HtsMobileFilters');
-- RESULT: expect 3 x DONE.
{check_select}
"""

RB_CART = hx('Корзина возвращена к прежнему виду')
RB_FILT = hx('Фильтры убраны, шаблон возвращён')
NOBAK = hx('В резервной таблице нет копии — откатывать нечего')
rollback_cart = head + f"""-- ROLLBACK, cart only: puts chunk 17 back from {BAK}.
UPDATE modx_site_htmlsnippets c JOIN {BAK} b ON b.kind = 'chunk' AND b.el_id = c.id SET c.snippet = b.body WHERE c.id = 17;
SELECT CASE WHEN (SELECT COUNT(*) FROM {BAK} WHERE kind = 'chunk' AND el_id = 17) = 0 THEN {NOBAK} WHEN (SELECT snippet FROM modx_site_htmlsnippets WHERE id = 17) NOT LIKE '%hts-qty-btn%' THEN {RB_CART} ELSE {BAD} END AS itog;
"""
rollback_filters = head + f"""-- ROLLBACK, filters only: puts template 18 back from {BAK} and removes the new chunk.
UPDATE modx_site_templates t JOIN {BAK} b ON b.kind = 'template' AND b.el_id = t.id SET t.content = b.body WHERE t.id = 18;
DELETE FROM modx_site_htmlsnippets WHERE name = 'HtsMobileFilters' AND snippet LIKE '%htsFiltersBound%';
SELECT CASE WHEN (SELECT COUNT(*) FROM {BAK} WHERE kind = 'template' AND el_id = 18) = 0 THEN {NOBAK} WHEN (SELECT content FROM modx_site_templates WHERE id = 18) NOT LIKE '%[[$HtsMobileFilters]]%' AND (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = 'HtsMobileFilters') = 0 THEN {RB_FILT} ELSE {BAD} END AS itog;
"""
cleanup = f"-- CLEANUP, optional, once everything has worked for a while: removes the backup copies. After this there is no rollback.\nDROP TABLE IF EXISTS {BAK};\n"

os.makedirs(out, exist_ok=True)
for name, text in (('1-check.sql', check), ('2-apply.sql', apply_sql), ('rollback-cart.sql', rollback_cart), ('rollback-filters.sql', rollback_filters), ('cleanup.sql', cleanup)):
    open(os.path.join(out, name), 'w', encoding='utf-8').write(text)
    print(f'{name:22} {len(text)//1024:3d} KB  non-ASCII bytes: {sum(1 for ch in text if ord(ch) > 127)}')
open(os.path.join(out, '_orig_cart_for_test.html'), 'w', encoding='utf-8').write(orig_cart)
