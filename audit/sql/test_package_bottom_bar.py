#!/usr/bin/env python3
"""Run the bottom-bar SQL package on a local MariaDB (utf8 and utf8mb4). Usage: test_package_bottom_bar.py <repo root>"""
import subprocess, sys
R = sys.argv[1]; P = R + '/audit/sql/bottom-bar/'; f = lambda n: open(P + n, encoding='utf-8').read()
chunk = open(R + '/modx-chunks/hts-bottom-bar.html', encoding='utf-8').read().rstrip('\n')
footers = '<footer>\n  <p class="footer_block">Информация</p>\n  <a href="/o-nas/yuridicheskaya/" title="ХозТоргСнаб">Юридическая</a>\n</footer>\n<div id="inline" style="display:none;"><p>Заполните поля</p></div>\n<script src="https://example.com/x.js" async defer></script>\n'
after = footers + '\n[[$HtsBottomBar]]'
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
    db = 'bb_' + cs; print('==', cs)
    subprocess.run(['mariadb', '-uroot', '-e', f"DROP DATABASE IF EXISTS {db}; CREATE DATABASE {db} CHARACTER SET {cs};"], check=True)
    sql(db, f"""CREATE TABLE modx_site_htmlsnippets (id int unsigned NOT NULL AUTO_INCREMENT, source int unsigned NOT NULL DEFAULT 0, property_preprocess tinyint unsigned NOT NULL DEFAULT 0, name varchar(50) NOT NULL DEFAULT '', description varchar(191) NOT NULL DEFAULT 'Chunk', editor_type int NOT NULL DEFAULT 0, category int NOT NULL DEFAULT 0, cache_type tinyint NOT NULL DEFAULT 0, snippet mediumtext, locked tinyint unsigned NOT NULL DEFAULT 0, properties text, static tinyint unsigned NOT NULL DEFAULT 0, static_file varchar(191) NOT NULL DEFAULT '', PRIMARY KEY (id), UNIQUE KEY name (name)) DEFAULT CHARSET={cs};
INSERT INTO modx_site_htmlsnippets (id,name,snippet,properties) VALUES (30,'Footers',CONVERT({hexs(footers)} USING utf8mb4),'a:0:{{}}'),(31,'Heads','<head></head>','a:0:{{}}');""")
    r = rows(sql(db, f('1-check.sql'))); ex('before: 2 x можно переносить', len(r) == 1 and r[0][1] == '2' and 'можно' in r[0][0])
    r = rows(sql(db, f('2-apply.sql'))); ex('apply: 2 x УЖЕ ПЕРЕНЕСЕНО', len(r) == 1 and r[0][1] == '2' and 'УЖЕ' in r[0][0])
    ex('Footers == old text + one line, byte for byte', get(db, "SELECT snippet FROM modx_site_htmlsnippets WHERE name='Footers'") == after)
    ex('new chunk == repo file', get(db, "SELECT snippet FROM modx_site_htmlsnippets WHERE name='HtsBottomBar'") == chunk)
    ex('Heads untouched', get(db, "SELECT snippet FROM modx_site_htmlsnippets WHERE name='Heads'") == '<head></head>')
    sql(db, f('2-apply.sql')); ex('apply twice: nothing doubled', get(db, "SELECT snippet FROM modx_site_htmlsnippets WHERE name='Footers'") == after and sql(db, "SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name='HtsBottomBar';").strip() == '1')
    ex('backup holds the original Footers', get(db, "SELECT body FROM hts_bak_20261113_bb WHERE kind='chunk'") == footers)
    o = sql(db, f('rollback.sql')); ex('rollback: Footers back byte for byte, chunk gone', get(db, "SELECT snippet FROM modx_site_htmlsnippets WHERE name='Footers'") == footers and 'убрана' in o and sql(db, "SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name='HtsBottomBar';").strip() == '0')
    r = rows(sql(db, f('2-apply.sql'))); ex('re-apply after rollback', r[0][1] == '2' and get(db, "SELECT snippet FROM modx_site_htmlsnippets WHERE name='Footers'") == after)
    sql(db, "UPDATE modx_site_htmlsnippets SET snippet=CONCAT(snippet,'<!-- later edit -->') WHERE name='Footers';"); sql(db, f('rollback.sql'))
    ex('rollback keeps a later edit', get(db, "SELECT snippet FROM modx_site_htmlsnippets WHERE name='Footers'") == footers + '<!-- later edit -->')
    sql(db, "INSERT INTO modx_site_htmlsnippets (name,snippet) VALUES ('Footers2','x'); UPDATE modx_site_htmlsnippets SET name='Footers' WHERE name='Footers2' AND 1=0;")
    sql(db, "DELETE FROM modx_site_htmlsnippets WHERE name='Footers';")
    r = rows(sql(db, f('1-check.sql'))); ex('no Footers chunk -> mismatch', any('НЕ СОВПАДАЕТ' in x[0] for x in r))
    sql(db, f('cleanup.sql')); ex('cleanup drops backup', sql(db, "SHOW TABLES LIKE 'hts_bak%';").strip() == '')
print('ALL PASS' if ok else 'SOME FAILED')
