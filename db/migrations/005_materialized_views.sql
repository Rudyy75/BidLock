CREATE MATERIALIZED VIEW IF NOT EXISTS dispatch.mv_hot_zones AS
WITH demand AS (
  SELECT
    ST_SnapToGrid(pickup_location, 0.02, 0.02) AS zone_geom,
    COUNT(*)::INT AS request_count
  FROM dispatch.ride_requests
  WHERE status IN ('REQUESTED', 'MATCHED')
  GROUP BY 1
),
supply AS (
  SELECT
    ST_SnapToGrid(location, 0.02, 0.02) AS zone_geom,
    COUNT(*)::INT AS driver_count
  FROM dispatch.active_drivers
  WHERE is_available = TRUE
  GROUP BY 1
)
SELECT
  ST_AsText(COALESCE(demand.zone_geom, supply.zone_geom)) AS zone_key,
  COALESCE(demand.zone_geom, supply.zone_geom) AS zone_geom,
  COALESCE(demand.request_count, 0) AS demand_count,
  COALESCE(supply.driver_count, 0) AS supply_count,
  COALESCE(demand.request_count, 0) - COALESCE(supply.driver_count, 0) AS pressure_score,
  NOW() AS refreshed_at
FROM demand
FULL OUTER JOIN supply
ON ST_AsText(demand.zone_geom) = ST_AsText(supply.zone_geom);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_hot_zones_zone_key
ON dispatch.mv_hot_zones (zone_key);
