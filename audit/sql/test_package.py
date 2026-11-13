import subprocess, sys, os
R='/home/user/https-hoztorgsnab.ru-'
orig_cart=open('_orig_cart_for_test.html',encoding='utf-8').read()
new_cart=open(R+'/modx-chunks/tpl.msCart.html',encoding='utf-8').read()
orig_tpl=open('/tmp/orig_template.html',encoding='utf-8').read()
new_tpl=open(R+'/modx-templates/podkategoriya.html',encoding='utf-8').read()
filters=open(R+'/modx-chunks/hts-mobile-filters.html',encoding='utf-8').read().rstrip('\n')
def sql(db, text):
    r=subprocess.run(['mariadb','-uroot','--default-character-set=utf8mb4','-N','-B',db],input=text.encode(),capture_output=True)
    if r.returncode: print('SQL ERROR:',r.stderr.decode()[:600]); sys.exit(1)
    return r.stdout.decode()
def hexs(s): return '0x'+s.encode().hex()
def get(db, q):  # fetch a text cell byte-exactly
    return bytes.fromhex(sql(db, f"SET NAMES utf8mb4; SELECT HEX(CONVERT(({q}) USING utf8mb4));").strip()).decode()
f=lambda n: open(n,encoding='utf-8').read()
ok=True
def expect(label, cond):
    global ok; ok&=bool(cond); print(('  PASS ' if cond else '  FAIL ')+label)
for cs in ('utf8','utf8mb4'):
    db='t_'+cs; print(f'== tables in {cs} ==')
    subprocess.run(['mariadb','-uroot','-e',f"DROP DATABASE IF EXISTS {db}; CREATE DATABASE {db} CHARACTER SET {cs};"],check=True)
    # schema as in MODX Revolution 2.7
    sql(db, f"""SET NAMES utf8mb4;
CREATE TABLE modx_site_htmlsnippets (id int unsigned NOT NULL AUTO_INCREMENT, source int unsigned NOT NULL DEFAULT 0, property_preprocess tinyint unsigned NOT NULL DEFAULT 0, name varchar(50) NOT NULL DEFAULT '', description varchar(191) NOT NULL DEFAULT 'Chunk', editor_type int NOT NULL DEFAULT 0, category int NOT NULL DEFAULT 0, cache_type tinyint NOT NULL DEFAULT 0, snippet mediumtext, locked tinyint unsigned NOT NULL DEFAULT 0, properties text, static tinyint unsigned NOT NULL DEFAULT 0, static_file varchar(191) NOT NULL DEFAULT '', PRIMARY KEY (id), UNIQUE KEY name (name)) ENGINE=InnoDB DEFAULT CHARSET={cs};
CREATE TABLE modx_site_templates (id int unsigned NOT NULL AUTO_INCREMENT, source int NOT NULL DEFAULT 0, property_preprocess tinyint unsigned NOT NULL DEFAULT 0, templatename varchar(50) NOT NULL DEFAULT '', description varchar(191) NOT NULL DEFAULT 'Template', editor_type int NOT NULL DEFAULT 0, category int NOT NULL DEFAULT 0, icon varchar(191) NOT NULL DEFAULT '', template_type int NOT NULL DEFAULT 0, content mediumtext NOT NULL, locked tinyint unsigned NOT NULL DEFAULT 0, properties text, static tinyint unsigned NOT NULL DEFAULT 0, static_file varchar(191) NOT NULL DEFAULT '', PRIMARY KEY (id), UNIQUE KEY templatename (templatename)) ENGINE=InnoDB DEFAULT CHARSET={cs};
INSERT INTO modx_site_htmlsnippets (id,source,name,category,snippet,properties) VALUES (17,1,'tpl.msCart',5,CONVERT({hexs(orig_cart)} USING utf8mb4),'a:0:{{}}'),(147,1,CONVERT({hexs('Копия tpl.msCart')} USING utf8mb4),5,'<div id="msCart" class="hts-cart"></div>','a:0:{{}}'),(207,1,'LichnyKabinetMobile',0,'x','a:0:{{}}');
INSERT INTO modx_site_templates (id,templatename,content) VALUES (18,CONVERT({hexs('Подкатегория')} USING utf8mb4),CONVERT({hexs(orig_tpl)} USING utf8mb4)),(19,'Other','[[$contentcategory]]');""")
    row=lambda o: [l.split('\t')[:2] for l in o.strip().split('\n') if l.strip()]
    r=row(sql(db,f('1-check.sql')));  print('  check before :',r); expect('before: one row, 3 x «можно переносить»', len(r)==1 and r[0][1]=='3' and 'можно переносить' in r[0][0])
    r=row(sql(db,f('2-apply.sql')));  print('  apply result :',r); expect('apply: 3 x «УЖЕ ПЕРЕНЕСЕНО»', len(r)==1 and r[0][1]=='3' and 'УЖЕ' in r[0][0])
    expect('chunk 17 == tested chunk file, byte for byte', get(db,"SELECT snippet FROM modx_site_htmlsnippets WHERE id=17")==new_cart)
    expect('template 18 == repo template file', get(db,"SELECT content FROM modx_site_templates WHERE id=18")==new_tpl)
    expect('new chunk body == repo chunk file', get(db,"SELECT snippet FROM modx_site_htmlsnippets WHERE name='HtsMobileFilters'")==filters)
    expect('other rows untouched (chunk 147, 207, template 19)', sql(db,"SELECT CONCAT(MD5(snippet)) FROM modx_site_htmlsnippets WHERE id IN (147,207) ORDER BY id;").split()==[__import__('hashlib').md5(b'<div id="msCart" class="hts-cart"></div>').hexdigest(), __import__('hashlib').md5(b'x').hexdigest()] and get(db,"SELECT content FROM modx_site_templates WHERE id=19")=='[[$contentcategory]]')
    meta=sql(db,"SELECT id,source,category,static,properties,description FROM modx_site_htmlsnippets WHERE name='HtsMobileFilters';").strip(); print('  new chunk row:',meta)
    r=row(sql(db,f('2-apply.sql')));  expect('apply twice: still 3 x done, nothing doubled', len(r)==1 and r[0][1]=='3' and get(db,"SELECT snippet FROM modx_site_htmlsnippets WHERE id=17")==new_cart and sql(db,"SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name='HtsMobileFilters';").strip()=='1')
    expect('backup holds the ORIGINALS after second apply', get(db,"SELECT body FROM hts_bak_20261113 WHERE kind='chunk'")==orig_cart and get(db,"SELECT body FROM hts_bak_20261113 WHERE kind='template'")==orig_tpl)
    o=sql(db,f('rollback-cart.sql')).strip(); print('  rollback cart:',o); expect('cart rolled back to the original bytes', get(db,"SELECT snippet FROM modx_site_htmlsnippets WHERE id=17")==orig_cart and 'прежнему' in o)
    r=row(sql(db,f('1-check.sql')));  print('  check now    :',sorted(r)); expect('check after cart rollback: 1 ready + 2 done', sorted(x[1] for x in r)==['1','2'])
    o=sql(db,f('rollback-filters.sql')).strip(); print('  rollback filt:',o); expect('template back to original, chunk removed', get(db,"SELECT content FROM modx_site_templates WHERE id=18")==orig_tpl and sql(db,"SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name='HtsMobileFilters';").strip()=='0')
    r=row(sql(db,f('1-check.sql')));  expect('check after full rollback: 3 x ready again', len(r)==1 and r[0][1]=='3' and 'можно' in r[0][0])
    r=row(sql(db,f('2-apply.sql')));  expect('re-apply after rollback works', len(r)==1 and r[0][1]=='3' and get(db,"SELECT snippet FROM modx_site_htmlsnippets WHERE id=17")==new_cart)
    # a chunk somebody edited in the meantime must NOT be half-patched
    sql(db,f('rollback-cart.sql')); sql(db,"UPDATE modx_site_htmlsnippets SET snippet=REPLACE(snippet,'stepper-input','stepper-input-x') WHERE id=17;")
    r=row(sql(db,f('1-check.sql'))); print('  edited chunk :',sorted(r)); expect('changed chunk is reported as mismatch', any('НЕ СОВПАДАЕТ' in x[0] for x in r))
    before=get(db,"SELECT snippet FROM modx_site_htmlsnippets WHERE id=17"); sql(db,f('2-apply.sql')); expect('apply leaves a mismatching chunk untouched', get(db,"SELECT snippet FROM modx_site_htmlsnippets WHERE id=17")==before)
    sql(db,f('cleanup.sql')); expect('cleanup drops the backup table', sql(db,"SHOW TABLES LIKE 'hts_bak%';").strip()=='')
print('\nALL PASS' if ok else '\nSOME FAILED')
