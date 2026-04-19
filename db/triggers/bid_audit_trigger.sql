CREATE OR REPLACE FUNCTION auction.log_bid_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO auction.bid_audit_log (bid_id, auction_id, event_type, event_payload)
    VALUES (
      NEW.id,
      NEW.auction_id,
      'PLACED',
      jsonb_build_object(
        'bidder_id', NEW.bidder_id,
        'bid_amount', NEW.bid_amount,
        'created_at', NEW.created_at
      )
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
    INSERT INTO auction.bid_audit_log (bid_id, auction_id, event_type, event_payload)
    VALUES (
      NEW.id,
      NEW.auction_id,
      'RETRACTED',
      jsonb_build_object(
        'bidder_id', NEW.bidder_id,
        'bid_amount', NEW.bid_amount,
        'updated_at', NOW()
      )
    );

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bid_audit ON auction.bids;

CREATE TRIGGER trg_bid_audit
AFTER INSERT OR UPDATE
ON auction.bids
FOR EACH ROW
EXECUTE FUNCTION auction.log_bid_change();

CREATE OR REPLACE FUNCTION auction.prevent_bid_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Bid audit log is immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_bid_audit_immutable ON auction.bid_audit_log;

CREATE TRIGGER trg_bid_audit_immutable
BEFORE UPDATE OR DELETE
ON auction.bid_audit_log
FOR EACH ROW
EXECUTE FUNCTION auction.prevent_bid_audit_mutation();
