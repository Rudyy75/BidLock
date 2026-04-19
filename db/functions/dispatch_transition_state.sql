CREATE OR REPLACE FUNCTION dispatch.transition_ride_state(
  p_request_id UUID,
  p_new_state TEXT,
  p_changed_by TEXT
)
RETURNS TABLE (
  request_id UUID,
  status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_request dispatch.ride_requests%ROWTYPE;
  v_prev_state TEXT;
  v_is_allowed BOOLEAN := FALSE;
BEGIN
  SELECT *
  INTO v_request
  FROM dispatch.ride_requests r
  WHERE r.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride request not found';
  END IF;

  v_prev_state := v_request.status;

  IF v_prev_state = p_new_state THEN
    RETURN QUERY
    SELECT v_request.id, v_request.status;
    RETURN;
  END IF;

  v_is_allowed :=
    (v_prev_state = 'REQUESTED' AND p_new_state IN ('MATCHED', 'CANCELLED')) OR
    (v_prev_state = 'MATCHED' AND p_new_state IN ('PICKED_UP', 'CANCELLED')) OR
    (v_prev_state = 'PICKED_UP' AND p_new_state = 'DROPPED_OFF');

  IF NOT v_is_allowed THEN
    RAISE EXCEPTION 'Invalid state transition from % to %', v_prev_state, p_new_state;
  END IF;

  UPDATE dispatch.ride_requests
  SET status = p_new_state,
      completed_at = CASE WHEN p_new_state = 'DROPPED_OFF' THEN NOW() ELSE completed_at END
  WHERE id = p_request_id;

  INSERT INTO dispatch.ride_state_history (request_id, from_state, to_state, changed_by)
  VALUES (p_request_id, v_prev_state, p_new_state, p_changed_by);

  IF p_new_state IN ('DROPPED_OFF', 'CANCELLED')
     AND v_request.matched_driver_id IS NOT NULL THEN
    UPDATE dispatch.active_drivers
    SET is_available = TRUE,
        current_load = GREATEST(current_load - 1, 0),
        updated_at = NOW()
    WHERE driver_id = v_request.matched_driver_id;
  END IF;

  RETURN QUERY
  SELECT p_request_id, p_new_state;
END;
$$;
