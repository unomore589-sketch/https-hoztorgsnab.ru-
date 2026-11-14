-- Paket 14.11.2026 (3): compact header on phones (new chunk HtsHeaderCompact, call appended to chunk Footers). Text is hex-encoded on purpose.
SET NAMES utf8mb4;
SET SESSION group_concat_max_len = 100000;
-- ROLLBACK: removes the one line from chunk Footers and deletes chunk HtsHeaderCompact.
UPDATE modx_site_htmlsnippets c SET c.snippet = REPLACE(CONVERT(c.snippet USING utf8mb4), _utf8mb4 0x0A5B5B24487473486561646572436F6D706163745D5D, '') WHERE c.name = 'Footers';
UPDATE modx_site_htmlsnippets c SET c.snippet = REPLACE(CONVERT(c.snippet USING utf8mb4), _utf8mb4 0x5B5B24487473486561646572436F6D706163745D5D, '') WHERE c.name = 'Footers';
DELETE FROM modx_site_htmlsnippets WHERE name = 'HtsHeaderCompact' AND snippet LIKE '%htsHeaderCompact%';
SELECT CASE WHEN (SELECT snippet FROM modx_site_htmlsnippets WHERE name = 'Footers') NOT LIKE '%[[$HtsHeaderCompact]]%' AND (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name = 'HtsHeaderCompact') = 0 THEN _utf8mb4 0xD0A8D0B0D0BFD0BAD0B020D0B2D0BED0B7D0B2D180D0B0D189D0B5D0BDD0B02C20D0BFD0BED0B4D0B2D0B0D0BB20D0B2D0BED0B7D0B2D180D0B0D189D191D0BD ELSE _utf8mb4 0xD09DD09520D0A1D09ED092D09FD090D094D090D095D0A220E2809420D181D182D0BED0BF2C20D181D0BAD180D0B8D0BDD188D0BED182 END AS itog;
