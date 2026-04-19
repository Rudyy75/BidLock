CREATE OR REPLACE FUNCTION dispatch.find_top_drivers(
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_vehicle_type TEXT DEFAULT NULL,
  p_max_load INTEGER DEFAULT 3,
  p_limit INTEGER DEFAULT 5,
  p_radius_m INTEGER DEFAULT 2000
)
RETURNS TABLE (
  driver_id UUID,
  vehicle_type TEXT,
  current_load INTEGER,
  max_load INTEGER,
  distance_m DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_pickup GEOMETRY(Point, 4326);
BEGIN
  v_pickup := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);

  RETURN QUERY
  SELECT
    d.driver_id,
    d.vehicle_type,
    d.current_load,
    d.max_load,
    ST_Distance(d.location::GEOGRAPHY, v_pickup::GEOGRAPHY) AS distance_m
  FROM dispatch.active_drivers d
  WHERE d.is_available = TRUE
    AND d.current_load < LEAST(d.max_load, p_max_load)
    AND (p_vehicle_type IS NULL OR d.vehicle_type = p_vehicle_type)
    AND ST_DWithin(d.location::GEOGRAPHY, v_pickup::GEOGRAPHY, p_radius_m)
  ORDER BY ST_Distance(d.location::GEOGRAPHY, v_pickup::GEOGRAPHY)
  LIMIT p_limit;
END;
$$;
