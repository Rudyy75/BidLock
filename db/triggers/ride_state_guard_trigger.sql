CREATE OR REPLACE FUNCTION dispatch.guard_ride_state_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_allowed BOOLEAN := FALSE;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  v_allowed :=
    (OLD.status = 'REQUESTED' AND NEW.status IN ('MATCHED', 'CANCELLED')) OR
    (OLD.status = 'MATCHED' AND NEW.status IN ('PICKED_UP', 'CANCELLED')) OR
    (OLD.status = 'PICKED_UP' AND NEW.status = 'DROPPED_OFF');

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid state transition from % to %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ride_state ON dispatch.ride_requests;

CREATE TRIGGER trg_guard_ride_state
BEFORE UPDATE OF status
ON dispatch.ride_requests
FOR EACH ROW
EXECUTE FUNCTION dispatch.guard_ride_state_transition();
