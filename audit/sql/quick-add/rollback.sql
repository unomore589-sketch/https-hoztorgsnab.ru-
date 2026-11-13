-- Paket 13.11.2026 (3): cart quick-add block (new chunk HtsCartQuickAdd, resource 12). Text is hex-encoded on purpose.
SET NAMES utf8mb4;
SET SESSION group_concat_max_len = 100000;
-- ROLLBACK: removes the one line from resource 12 and the chunk.
UPDATE modx_site_content r SET r.content = REPLACE(CONVERT(r.content USING utf8mb4), _utf8mb4 0x5B5B2448747343617274517569636B4164645D5D0A, '') WHERE r.id = 12;
UPDATE modx_site_content r SET r.content = REPLACE(CONVERT(r.content USING utf8mb4), _utf8mb4 0x5B5B2448747343617274517569636B4164645D5D, '') WHERE r.id = 12;
DELETE FROM modx_site_htmlsnippets WHERE name = 'HtsCartQuickAdd' AND snippet LIKE '%htsQuickAddBound%';
SELECT CASE WHEN (SELECT content FROM modx_site_content WHERE id = 12) NOT LIKE '%[[$HtsCartQuickAdd]]%' AND (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = 'HtsCartQuickAdd') = 0 THEN _utf8mb4 0xD091D0BBD0BED0BA20D0B2D0BED0B7D0B2D180D0B0D189D191D0BD20D0BA20D0BFD180D0B5D0B6D0BDD0B5D0BCD18320D0B2D0B8D0B4D183 ELSE _utf8mb4 0xD09DD09520D0A1D09ED092D09FD090D094D090D095D0A220E2809420D181D182D0BED0BF2C20D181D0BAD180D0B8D0BDD188D0BED182 END AS itog;
