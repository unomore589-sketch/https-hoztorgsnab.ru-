#!/usr/bin/env python3
"""Run the quick-add SQL package on a local MariaDB (utf8 and utf8mb4). Usage: test_package_quick_add.py <repo root>"""
import subprocess, sys
R = sys.argv[1]; P = R + '/audit/sql/quick-add/'; f = lambda n: open(P + n, encoding='utf-8').read()
chunk = open(R + '/modx-chunks/hts-cart-quick-add.html', encoding='utf-8').read().rstrip('\n')
# resource 12 content as the owner pasted it (13.11.2026)
before = ("[[!mSearchForm?\n    &element=`msProducts`\n    &tplForm=`tpl.mSearch2.Cart.form`\n"
          "    &tpl=`@INLINE <div class=\"mse2-ac-item\" data-price=\"[[+price]]\" data-id=\"[[+id]]\">[[+idx]]. [[+pagetitle]]</div>`\n]]\n\n"
          "<div class=\"ms2_total_products\">\n    [[!msBasketsList? &tpl=`tpl.msBaskets.form`]]\n[[!msCart? &tpl=`tpl.msCart`]]\n</div>")
after = before.replace('<div class="ms2_total_products">', '[[$HtsCartQuickAdd]]\n<div class="ms2_total_products">')
def sql(db, t):
    r = subprocess.run(['mariadb', '-uroot', '--default-character-set=utf8mb4', '-N', '-B', db], input=t.encode(), capture_output=True)
    if r.returncode: print('SQL ERROR', r.stderr.decode()[:500]); sys.exit(1)
    return r.stdout.decode()
hexs = lambda s: '0x' + s.encode().hex()
get = lambda db, q: bytes.fromhex(sql(db, f"SELECT HEX(CONVERT(({q}) USING utf8mb4));").strip()).decode()
rows = lambda o: [l.split('\t')[:2] for l in o.strip().split('\n') if l.strip()]
ok = True
def ex(l, c):
    global ok; ok &= bool(c); print(('  PASS ' if c else '  FAIL ') + l)
for cs in ('utf8', 'utf8mb4'):
    db = 'qa_' + cs; print('==', cs)
    subprocess.run(['mariadb', '-uroot', '-e', f"DROP DATABASE IF EXISTS {db}; CREATE DATABASE {db} CHARACTER SET {cs};"], check=True)
    sql(db, f"""CREATE TABLE modx_site_htmlsnippets (id int unsigned NOT NULL AUTO_INCREMENT, source int unsigned NOT NULL DEFAULT 0, property_preprocess tinyint unsigned NOT NULL DEFAULT 0, name varchar(50) NOT NULL DEFAULT '', description varchar(191) NOT NULL DEFAULT 'Chunk', editor_type int NOT NULL DEFAULT 0, category int NOT NULL DEFAULT 0, cache_type tinyint NOT NULL DEFAULT 0, snippet mediumtext, locked tinyint unsigned NOT NULL DEFAULT 0, properties text, static tinyint unsigned NOT NULL DEFAULT 0, static_file varchar(191) NOT NULL DEFAULT '', PRIMARY KEY (id), UNIQUE KEY name (name)) DEFAULT CHARSET={cs};
CREATE TABLE modx_site_content (id int unsigned NOT NULL AUTO_INCREMENT, alias varchar(191) DEFAULT '', content mediumtext, PRIMARY KEY (id)) DEFAULT CHARSET={cs};
INSERT INTO modx_site_content (id,alias,content) VALUES (12,'cart',CONVERT({hexs(before)} USING utf8mb4)),(2356,'cart2','<div class="ms2_total_products">');""")
    r = rows(sql(db, f('1-check.sql'))); ex('before: 2 x можно переносить', len(r) == 1 and r[0][1] == '2' and 'можно' in r[0][0])
    r = rows(sql(db, f('2-apply.sql'))); ex('apply: 2 x УЖЕ ПЕРЕНЕСЕНО', len(r) == 1 and r[0][1] == '2' and 'УЖЕ' in r[0][0])
    ex('resource 12 byte for byte', get(db, "SELECT content FROM modx_site_content WHERE id=12") == after)
    ex('chunk == repo file', get(db, "SELECT snippet FROM modx_site_htmlsnippets WHERE name='HtsCartQuickAdd'") == chunk)
    ex('other resource untouched', get(db, "SELECT content FROM modx_site_content WHERE id=2356") == '<div class="ms2_total_products">')
    sql(db, f('2-apply.sql')); ex('apply twice: nothing doubled', get(db, "SELECT content FROM modx_site_content WHERE id=12") == after and sql(db, "SELECT COUNT(*) FROM modx_site_htmlsnippets;").strip() == '1')
    o = sql(db, f('rollback.sql')); ex('rollback: content back byte for byte, chunk gone', get(db, "SELECT content FROM modx_site_content WHERE id=12") == before and 'прежнему' in o and sql(db, "SELECT COUNT(*) FROM modx_site_htmlsnippets;").strip() == '0')
    r = rows(sql(db, f('2-apply.sql'))); ex('re-apply after rollback', r[0][1] == '2' and get(db, "SELECT content FROM modx_site_content WHERE id=12") == after)
    sql(db, f('rollback.sql')); sql(db, "UPDATE modx_site_content SET content=REPLACE(content,'<div class=\"ms2_total_products\">','') WHERE id=12;")
    b2 = get(db, "SELECT content FROM modx_site_content WHERE id=12")
    r = rows(sql(db, f('1-check.sql'))); ex('anchor missing -> mismatch', any('НЕ СОВПАДАЕТ' in x[0] for x in r))
    sql(db, f('2-apply.sql')); ex('anchor missing -> page untouched', get(db, "SELECT content FROM modx_site_content WHERE id=12") == b2)
    sql(db, f('cleanup.sql')); ex('cleanup drops backup', sql(db, "SHOW TABLES LIKE 'hts_bak%';").strip() == '')
print('ALL PASS' if ok else 'SOME FAILED')
