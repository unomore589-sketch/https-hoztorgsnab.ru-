#!/usr/bin/env python3
"""Run the list-qty SQL package on a local MariaDB with the MODX 2.7 tables (utf8 and utf8mb4).
Usage: test_package_list_qty.py <repo root> <package dir>"""
import subprocess, sys, os, hashlib

R, P = sys.argv[1], sys.argv[2]
tpl_before = open(os.path.join(P, '_tpl_before_for_test.html'), encoding='utf-8').read()
tpl_after = open(os.path.join(R, 'modx-templates/podkategoriya.html'), encoding='utf-8').read()
chunk = open(os.path.join(R, 'modx-chunks/hts-list-qty.html'), encoding='utf-8').read().rstrip('\n')
filters = open(os.path.join(R, 'modx-chunks/hts-mobile-filters.html'), encoding='utf-8').read().rstrip('\n')
f = lambda n: open(os.path.join(P, n), encoding='utf-8').read()

def sql(db, text):
    r = subprocess.run(['mariadb', '-uroot', '--default-character-set=utf8mb4', '-N', '-B', db], input=text.encode(), capture_output=True)
    if r.returncode: print('SQL ERROR:', r.stderr.decode()[:600]); sys.exit(1)
    return r.stdout.decode()
def hexs(s): return '0x' + s.encode().hex()
def get(db, q): return bytes.fromhex(sql(db, f"SET NAMES utf8mb4; SELECT HEX(CONVERT(({q}) USING utf8mb4));").strip()).decode()
rows = lambda o: [l.split('\t')[:2] for l in o.strip().split('\n') if l.strip()]
ok = True
def expect(label, cond):
    global ok; ok &= bool(cond); print(('  PASS ' if cond else '  FAIL ') + label)

for cs in ('utf8', 'utf8mb4'):
    db = 'q_' + cs; print(f'== tables in {cs} ==')
    subprocess.run(['mariadb', '-uroot', '-e', f"DROP DATABASE IF EXISTS {db}; CREATE DATABASE {db} CHARACTER SET {cs};"], check=True)
    sql(db, f"""SET NAMES utf8mb4;
CREATE TABLE modx_site_htmlsnippets (id int unsigned NOT NULL AUTO_INCREMENT, source int unsigned NOT NULL DEFAULT 0, property_preprocess tinyint unsigned NOT NULL DEFAULT 0, name varchar(50) NOT NULL DEFAULT '', description varchar(191) NOT NULL DEFAULT 'Chunk', editor_type int NOT NULL DEFAULT 0, category int NOT NULL DEFAULT 0, cache_type tinyint NOT NULL DEFAULT 0, snippet mediumtext, locked tinyint unsigned NOT NULL DEFAULT 0, properties text, static tinyint unsigned NOT NULL DEFAULT 0, static_file varchar(191) NOT NULL DEFAULT '', PRIMARY KEY (id), UNIQUE KEY name (name)) ENGINE=InnoDB DEFAULT CHARSET={cs};
CREATE TABLE modx_site_templates (id int unsigned NOT NULL AUTO_INCREMENT, source int NOT NULL DEFAULT 0, property_preprocess tinyint unsigned NOT NULL DEFAULT 0, templatename varchar(50) NOT NULL DEFAULT '', description varchar(191) NOT NULL DEFAULT 'Template', editor_type int NOT NULL DEFAULT 0, category int NOT NULL DEFAULT 0, icon varchar(191) NOT NULL DEFAULT '', template_type int NOT NULL DEFAULT 0, content mediumtext NOT NULL, locked tinyint unsigned NOT NULL DEFAULT 0, properties text, static tinyint unsigned NOT NULL DEFAULT 0, static_file varchar(191) NOT NULL DEFAULT '', PRIMARY KEY (id), UNIQUE KEY templatename (templatename)) ENGINE=InnoDB DEFAULT CHARSET={cs};
INSERT INTO modx_site_htmlsnippets (id,source,name,category,snippet,properties) VALUES (17,1,'tpl.msCart',5,'cart','a:0:{{}}'),(208,1,'HtsMobileFilters',0,CONVERT({hexs(filters)} USING utf8mb4),'a:0:{{}}');
INSERT INTO modx_site_templates (id,templatename,content) VALUES (18,CONVERT({hexs('Подкатегория')} USING utf8mb4),CONVERT({hexs(tpl_before)} USING utf8mb4)),(19,'Other','[[$HtsMobileFilters]]');""")
    r = rows(sql(db, f('1-check.sql'))); print('  check before :', r); expect('before: 2 x «можно переносить»', len(r) == 1 and r[0][1] == '2' and 'можно' in r[0][0])
    r = rows(sql(db, f('2-apply.sql'))); print('  apply result :', r); expect('apply: 2 x «УЖЕ ПЕРЕНЕСЕНО»', len(r) == 1 and r[0][1] == '2' and 'УЖЕ' in r[0][0])
    expect('template 18 == repo template, byte for byte', get(db, "SELECT content FROM modx_site_templates WHERE id=18") == tpl_after)
    expect('new chunk == repo chunk file', get(db, "SELECT snippet FROM modx_site_htmlsnippets WHERE name='HtsListQty'") == chunk)
    expect('template 19 and other chunks untouched', get(db, "SELECT content FROM modx_site_templates WHERE id=19") == '[[$HtsMobileFilters]]' and get(db, "SELECT snippet FROM modx_site_htmlsnippets WHERE id=208") == filters and get(db, "SELECT snippet FROM modx_site_htmlsnippets WHERE id=17") == 'cart')
    r = rows(sql(db, f('2-apply.sql'))); expect('apply twice: nothing doubled', len(r) == 1 and r[0][1] == '2' and get(db, "SELECT content FROM modx_site_templates WHERE id=18") == tpl_after and sql(db, "SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name='HtsListQty';").strip() == '1')
    expect('backup keeps the template as it was before', get(db, "SELECT body FROM hts_bak_20261113_qty WHERE kind='template' AND el_id=18") == tpl_before)
    o = sql(db, f('rollback.sql')).strip(); print('  rollback     :', o)
    expect('rollback: template back byte for byte, chunk gone', get(db, "SELECT content FROM modx_site_templates WHERE id=18") == tpl_before and sql(db, "SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name='HtsListQty';").strip() == '0' and 'убраны' in o)
    r = rows(sql(db, f('1-check.sql'))); expect('after rollback: 2 x ready again', len(r) == 1 and r[0][1] == '2' and 'можно' in r[0][0])
    # rollback keeps an edit made to the template after the package
    sql(db, f('2-apply.sql')); sql(db, "UPDATE modx_site_templates SET content=CONCAT(content,'<!-- later edit -->') WHERE id=18;")
    sql(db, f('rollback.sql')); expect('rollback keeps a later edit to the template', get(db, "SELECT content FROM modx_site_templates WHERE id=18") == tpl_before + '<!-- later edit -->')
    # without the filters line (filters rolled back) the package must stop and touch nothing
    sql(db, "UPDATE modx_site_templates SET content=REPLACE(content, '[[$HtsMobileFilters]]', '') WHERE id=18;")
    before = get(db, "SELECT content FROM modx_site_templates WHERE id=18")
    r = rows(sql(db, f('1-check.sql'))); print('  no anchor    :', sorted(r)); expect('no filters line -> mismatch reported', any('НЕ СОВПАДАЕТ' in x[0] for x in r))
    sql(db, f('2-apply.sql')); expect('no filters line -> template untouched', get(db, "SELECT content FROM modx_site_templates WHERE id=18") == before)
    sql(db, f('cleanup.sql')); expect('cleanup drops the backup table', sql(db, "SHOW TABLES LIKE 'hts_bak%';").strip() == '')
print('\nALL PASS' if ok else '\nSOME FAILED')
