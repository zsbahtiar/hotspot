-- The exact-coordinate cache is obsolete: geocoding now runs fully offline in D1
-- via geo_boundary + geo_rtree (point-in-polygon), so nothing reads this table.
DROP TABLE IF EXISTS geo_coordinate_cache;
