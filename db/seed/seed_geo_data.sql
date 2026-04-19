INSERT INTO dispatch.active_drivers (driver_id, location, vehicle_type, current_load, max_load, is_available)
VALUES
  (
    '44444444-4444-4444-4444-444444444444',
    ST_SetSRID(ST_MakePoint(77.2167, 28.6315), 4326),
    'CAR',
    0,
    3,
    TRUE
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    ST_SetSRID(ST_MakePoint(77.2250, 28.6360), 4326),
    'CAR',
    0,
    3,
    TRUE
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    ST_SetSRID(ST_MakePoint(77.2060, 28.6250), 4326),
    'CAR',
    0,
    3,
    TRUE
  )
ON CONFLICT (driver_id) DO UPDATE
SET
  location = EXCLUDED.location,
  vehicle_type = EXCLUDED.vehicle_type,
  current_load = EXCLUDED.current_load,
  max_load = EXCLUDED.max_load,
  is_available = EXCLUDED.is_available,
  updated_at = NOW();

INSERT INTO dispatch.ride_requests (id, rider_id, pickup_location, drop_location, vehicle_type, status)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '11111111-1111-1111-1111-111111111111',
  ST_SetSRID(ST_MakePoint(77.2190, 28.6320), 4326),
  ST_SetSRID(ST_MakePoint(77.2290, 28.6450), 4326),
  'CAR',
  'REQUESTED'
)
ON CONFLICT (id) DO UPDATE
SET
  pickup_location = EXCLUDED.pickup_location,
  drop_location = EXCLUDED.drop_location,
  vehicle_type = EXCLUDED.vehicle_type,
  status = 'REQUESTED',
  matched_driver_id = NULL,
  matched_at = NULL,
  completed_at = NULL;
