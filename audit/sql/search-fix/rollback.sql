-- Paket 14.11.2026 (5): forgiving search (layout, typos) + comment icon fix (new chunk HtsSearchFix, call appended to chunk Footers). Text is hex-encoded on purpose.
SET NAMES utf8mb4;
SET SESSION group_concat_max_len = 100000;
-- ROLLBACK: removes the one line from chunk Footers and deletes chunk HtsSearchFix.
UPDATE modx_site_htmlsnippets c SET c.snippet = REPLACE(CONVERT(c.snippet USING utf8mb4), _utf8mb4 0x0A5B5B244874735365617263684669785D5D, '') WHERE c.name = 'Footers';
UPDATE modx_site_htmlsnippets c SET c.snippet = REPLACE(CONVERT(c.snippet USING utf8mb4), _utf8mb4 0x5B5B244874735365617263684669785D5D, '') WHERE c.name = 'Footers';
DELETE FROM modx_site_htmlsnippets WHERE name = 'HtsSearchFix' AND snippet LIKE '%htsSearchFix%';
SELECT CASE WHEN (SELECT snippet FROM modx_site_htmlsnippets WHERE name = 'Footers') NOT LIKE '%[[$HtsSearchFix]]%' AND (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = 'HtsSearchFix') = 0 THEN _utf8mb4 0xD09FD0BED0B8D181D0BA20D0B2D0BED0B7D0B2D180D0B0D189D191D0BD2C20D0BFD0BED0B4D0B2D0B0D0BB20D0B2D0BED0B7D0B2D180D0B0D189D191D0BD ELSE _utf8mb4 0xD09DD09520D0A1D09ED092D09FD090D094D090D095D0A220E2809420D181D182D0BED0BF2C20D181D0BAD180D0B8D0BDD188D0BED182 END AS itog;
