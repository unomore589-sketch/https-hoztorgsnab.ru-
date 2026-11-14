-- Paket 14.11.2026 (2): price on request instead of 0 rub + Metrika add-to-cart event (chunks HtsZeroPrice, HtsEcommerce, calls appended to chunk Footers). Text is hex-encoded on purpose.
SET NAMES utf8mb4;
SET SESSION group_concat_max_len = 100000;
-- ROLLBACK: removes the added lines from chunk Footers and deletes both chunks.
UPDATE modx_site_htmlsnippets c SET c.snippet = REPLACE(CONVERT(c.snippet USING utf8mb4), _utf8mb4 0x0A5B5B244874735A65726F50726963655D5D0A5B5B2448747345636F6D6D657263655D5D, '') WHERE c.name = 'Footers';
UPDATE modx_site_htmlsnippets c SET c.snippet = REPLACE(CONVERT(c.snippet USING utf8mb4), _utf8mb4 0x5B5B244874735A65726F50726963655D5D, '') WHERE c.name = 'Footers';
UPDATE modx_site_htmlsnippets c SET c.snippet = REPLACE(CONVERT(c.snippet USING utf8mb4), _utf8mb4 0x5B5B2448747345636F6D6D657263655D5D, '') WHERE c.name = 'Footers';
DELETE FROM modx_site_htmlsnippets WHERE name = 'HtsZeroPrice' AND snippet LIKE '%htsZeroPriceBound%';
DELETE FROM modx_site_htmlsnippets WHERE name = 'HtsEcommerce' AND snippet LIKE '%htsEcommerceBound%';
SELECT CASE WHEN (SELECT snippet FROM modx_site_htmlsnippets WHERE name = 'Footers') NOT LIKE '%HtsZeroPrice%' AND (SELECT snippet FROM modx_site_htmlsnippets WHERE name = 'Footers') NOT LIKE '%HtsEcommerce%' AND (SELECT COUNT(*) FROM modx_site_htmlsnippets WHERE name IN ('HtsZeroPrice', 'HtsEcommerce')) = 0 THEN _utf8mb4 0xD0A3D0B1D180D0B0D0BDD0BE2C20D0BFD0BED0B4D0B2D0B0D0BB20D0B2D0BED0B7D0B2D180D0B0D189D191D0BD ELSE _utf8mb4 0xD09DD09520D0A1D09ED092D09FD090D094D090D095D0A220E2809420D181D182D0BED0BF2C20D181D0BAD180D0B8D0BDD188D0BED182 END AS itog;
