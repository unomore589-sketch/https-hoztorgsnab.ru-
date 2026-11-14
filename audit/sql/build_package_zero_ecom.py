#!/usr/bin/env python3
"""SQL package: chunks HtsZeroPrice («Цена по запросу») and HtsEcommerce (Metrika add-to-cart), their calls appended to the END of chunk Footers.
Rollback removes exactly those lines and both chunks. Usage: build_package_zero_ecom.py <repo root> <output dir>"""
import sys, os
root, out = sys.argv[1], sys.argv[2]
def chunk(f):
    s = open(os.path.join(root, 'modx-chunks', f), encoding='utf-8').read().rstrip('\n')
    assert '[[' not in s and ']]' not in s
    return s
C = [('HtsZeroPrice', chunk('hts-zero-price.html'), 'Цена по запросу вместо 0 руб.', 'htsZeroPriceBound'),
     ('HtsEcommerce', chunk('hts-ecommerce.html'), 'Метрика: событие добавления в корзину', 'htsEcommerceBound')]
BAK, HOST = 'hts_bak_20261114_ze', 'Footers'
def hx(s): return '_utf8mb4 0x' + s.encode('utf-8').hex().upper()
LINE = ''.join('\n[[$%s]]' % n for n, *_ in C)
SC = "CONVERT(c.snippet USING utf8mb4)"
MARK = "'%[[$HtsZeroPrice]]%'"
OK, DONE, BAD = hx('СОВПАДАЕТ — можно переносить'), hx('УЖЕ ПЕРЕНЕСЕНО'), hx('НЕ СОВПАДАЕТ — стоп, скриншот')
L1 = hx('1. Общий подвал сайта (чанк Footers)')
rows = [f"SELECT {L1} AS chto, CASE WHEN (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = '{HOST}') <> 1 THEN {BAD} WHEN (SELECT snippet FROM modx_site_htmlsnippets WHERE name = '{HOST}') LIKE {MARK} THEN {DONE} ELSE {OK} END AS itog"]
for i, (n, *_ ) in enumerate(C, 2):
    rows.append(f"SELECT {hx(f'{i}. Новый чанк {n}')}, CASE WHEN (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = '{n}') = 0 THEN {OK} ELSE {DONE} END")
sel = "SELECT itog, COUNT(*) AS n, GROUP_CONCAT(chto ORDER BY chto SEPARATOR '; ') AS what FROM (\n" + "\nUNION ALL\n".join(rows) + "\n) q GROUP BY itog;"
head = "-- Paket 14.11.2026 (2): price on request instead of 0 rub + Metrika add-to-cart event (chunks HtsZeroPrice, HtsEcommerce, calls appended to chunk Footers). Text is hex-encoded on purpose.\nSET NAMES utf8mb4;\nSET SESSION group_concat_max_len = 100000;\n"
ins = ''.join(f"""INSERT INTO modx_site_htmlsnippets (source, name, description, category, snippet, properties, static, static_file)
SELECT 1, '{n}', {hx(d)}, 0, {hx(body)}, 'a:0:{{}}', 0, '' FROM (SELECT 1 AS x) d
WHERE NOT EXISTS (SELECT 1 FROM modx_site_htmlsnippets WHERE name = '{n}');
""" for n, body, d, _ in C)
files = {
'1-check.sql': head + "-- CHECK. Changes nothing. Before: 3 x OK. After: 3 x DONE.\n" + sel + "\n",
'2-apply.sql': head + f"""-- APPLY. Saves chunk {HOST} to {BAK} first; safe to run twice.
CREATE TABLE IF NOT EXISTS {BAK} (kind VARCHAR(16) NOT NULL, el_id INT NOT NULL, body MEDIUMTEXT, saved_at DATETIME NOT NULL, PRIMARY KEY (kind, el_id)) DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO {BAK} (kind, el_id, body, saved_at) SELECT 'chunk', c.id, c.snippet, NOW() FROM modx_site_htmlsnippets c WHERE c.name = '{HOST}' AND c.snippet NOT LIKE {MARK};
UPDATE modx_site_htmlsnippets c SET c.snippet = CONCAT({SC}, {hx(LINE)}) WHERE c.name = '{HOST}' AND c.snippet NOT LIKE {MARK} AND (SELECT COUNT(*) FROM (SELECT id FROM modx_site_htmlsnippets WHERE name = '{HOST}') z) = 1;
{ins}{sel}
""",
'rollback.sql': head + f"""-- ROLLBACK: removes the added lines from chunk {HOST} and deletes both chunks.
UPDATE modx_site_htmlsnippets c SET c.snippet = REPLACE({SC}, {hx(LINE)}, '') WHERE c.name = '{HOST}';
""" + ''.join(f"UPDATE modx_site_htmlsnippets c SET c.snippet = REPLACE({SC}, {hx('[[$' + n + ']]')}, '') WHERE c.name = '{HOST}';\n" for n, *_ in C)
 + ''.join(f"DELETE FROM modx_site_htmlsnippets WHERE name = '{n}' AND snippet LIKE '%{m}%';\n" for n, _, _, m in C)
 + f"SELECT CASE WHEN (SELECT snippet FROM modx_site_htmlsnippets WHERE name = '{HOST}') NOT LIKE '%HtsZeroPrice%' AND (SELECT snippet FROM modx_site_htmlsnippets WHERE name = '{HOST}') NOT LIKE '%HtsEcommerce%' AND (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name IN ('HtsZeroPrice', 'HtsEcommerce')) = 0 THEN {hx('Убрано, подвал возвращён')} ELSE {BAD} END AS itog;\n",
'cleanup.sql': f"-- CLEANUP, optional.\nDROP TABLE IF EXISTS {BAK};\n"}
os.makedirs(out, exist_ok=True)
for n, t in files.items():
    open(os.path.join(out, n), 'w', encoding='utf-8').write(t); print(f'{n:14} {len(t)//1024:3d} KB non-ASCII: {sum(1 for c in t if ord(c) > 127)}')
