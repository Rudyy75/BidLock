CREATE OR REPLACE FUNCTION auction.retract_bid(
  p_bid_id UUID,
  p_reason TEXT
)
RETURNS TABLE (new_winner_id UUID, new_winning_bid NUMERIC)
LANGUAGE plpgsql
AS $$
DECLARE
  v_bid auction.bids%ROWTYPE;
  v_refund NUMERIC(12, 2);
  v_winner_record RECORD;
BEGIN
  SELECT *
  INTO v_bid
  FROM auction.bids b
  WHERE b.id = p_bid_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bid not found';
  END IF;

  IF v_bid.is_active = FALSE THEN
    RETURN QUERY
    SELECT a.current_winner_id, a.current_max_bid
    FROM auction.auctions a
    WHERE a.id = v_bid.auction_id;
    RETURN;
  END IF;

  UPDATE auction.bids
  SET is_active = FALSE
  WHERE id = p_bid_id;

  WITH released_hold AS (
    UPDATE auction.wallet_holds
    SET released = TRUE,
        released_at = NOW()
    WHERE bid_id = p_bid_id
      AND released = FALSE
    RETURNING user_id, hold_amount
  )
  SELECT COALESCE(SUM(hold_amount), 0)
  INTO v_refund
  FROM released_hold;

  IF v_refund > 0 THEN
    UPDATE public.app_users
    SET wallet_balance = wallet_balance + v_refund
    WHERE id = v_bid.bidder_id;
  END IF;

  INSERT INTO auction.bid_audit_log (bid_id, auction_id, event_type, event_payload)
  VALUES (
    p_bid_id,
    v_bid.auction_id,
    'RETRACTED',
    jsonb_build_object(
      'reason', COALESCE(p_reason, 'no reason provided'),
      'retracted_by', v_bid.bidder_id,
      'retracted_at', NOW()
    )
  );

  SELECT *
  INTO v_winner_record
  FROM auction.recompute_winner_chain(v_bid.auction_id);

  RETURN QUERY
  SELECT v_winner_record.winner_id, v_winner_record.winner_amount;
END;
$$;
