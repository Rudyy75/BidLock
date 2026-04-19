CREATE OR REPLACE FUNCTION dispatch.claim_driver_for_request(
  p_request_id UUID,
  p_worker_name TEXT
)
RETURNS TABLE (
  request_id UUID,
  matched_driver_id UUID,
  match_status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_request dispatch.ride_requests%ROWTYPE;
  v_driver RECORD;
BEGIN
  SELECT *
  INTO v_request
  FROM dispatch.ride_requests r
  WHERE r.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride request not found';
  END IF;

  IF v_request.status <> 'REQUESTED' THEN
    RETURN QUERY
    SELECT v_request.id, v_request.matched_driver_id, v_request.status;
    RETURN;
  END IF;

  SELECT
    d.driver_id,
    ST_Distance(d.location::GEOGRAPHY, v_request.pickup_location::GEOGRAPHY) AS distance_m
  INTO v_driver
  FROM dispatch.active_drivers d
  WHERE d.is_available = TRUE
    AND d.current_load < d.max_load
    AND d.vehicle_type = v_request.vehicle_type
    AND ST_DWithin(d.location::GEOGRAPHY, v_request.pickup_location::GEOGRAPHY, 3000)
  ORDER BY ST_Distance(d.location::GEOGRAPHY, v_request.pickup_location::GEOGRAPHY)
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_driver.driver_id IS NULL THEN
    INSERT INTO dispatch.matching_log (request_id, worker_name, decision, note)
    VALUES (v_request.id, p_worker_name, 'NO_DRIVER', 'No nearby available driver');

    RETURN QUERY
    SELECT v_request.id, NULL::UUID, 'NO_DRIVER'::TEXT;
    RETURN;
  END IF;

  UPDATE dispatch.active_drivers
  SET is_available = FALSE,
      current_load = current_load + 1,
      updated_at = NOW()
  WHERE driver_id = v_driver.driver_id;

  UPDATE dispatch.ride_requests
  SET status = 'MATCHED',
      matched_driver_id = v_driver.driver_id,
      matched_at = NOW()
  WHERE id = v_request.id;

  INSERT INTO dispatch.matching_log (request_id, driver_id, worker_name, decision, note)
  VALUES (
    v_request.id,
    v_driver.driver_id,
    p_worker_name,
    'ACCEPTED',
    'Driver claimed via FOR UPDATE SKIP LOCKED'
  );

  INSERT INTO dispatch.ride_state_history (request_id, from_state, to_state, changed_by)
  VALUES (v_request.id, 'REQUESTED', 'MATCHED', p_worker_name);

  RETURN QUERY
  SELECT v_request.id, v_driver.driver_id, 'MATCHED'::TEXT;
END;
$$;
