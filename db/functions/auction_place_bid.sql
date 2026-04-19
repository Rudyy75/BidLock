CREATE OR REPLACE FUNCTION auction.place_bid(
  p_auction_id UUID,
  p_user_id UUID,
  p_bid_amount NUMERIC,
  p_idempotency_key TEXT
)
RETURNS TABLE (bid_id UUID, winning_bid NUMERIC, winner_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
  v_auction auction.auctions%ROWTYPE;
  v_user public.app_users%ROWTYPE;
  v_bid_id UUID;
  v_existing_bid_id UUID;
  v_min_required NUMERIC(12, 2);
  v_refund NUMERIC(12, 2);
BEGIN
  IF p_bid_amount <= 0 THEN
    RAISE EXCEPTION 'Bid amount must be greater than 0';
  END IF;

  IF p_idempotency_key IS NULL OR LENGTH(TRIM(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'Idempotency key is required';
  END IF;

  SELECT b.id
  INTO v_existing_bid_id
  FROM auction.bids b
  WHERE b.auction_id = p_auction_id
    AND b.idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_existing_bid_id IS NOT NULL THEN
    RETURN QUERY
    SELECT v_existing_bid_id, a.current_max_bid, a.current_winner_id
    FROM auction.auctions a
    WHERE a.id = p_auction_id;
    RETURN;
  END IF;

  SELECT *
  INTO v_auction
  FROM auction.auctions a
  WHERE a.id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  IF v_auction.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Auction is not active';
  END IF;

  IF NOW() > v_auction.end_at THEN
    RAISE EXCEPTION 'Auction has ended';
  END IF;

  v_min_required := v_auction.current_max_bid + v_auction.min_increment;

  IF p_bid_amount < v_min_required THEN
    RAISE EXCEPTION 'Bid must be at least %', v_min_required;
  END IF;

  SELECT *
  INTO v_user
  FROM public.app_users u
  WHERE u.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  WITH released_own AS (
    UPDATE auction.wallet_holds
    SET released = TRUE,
        released_at = NOW()
    WHERE auction_id = p_auction_id
      AND user_id = p_user_id
      AND released = FALSE
    RETURNING hold_amount
  )
  SELECT COALESCE(SUM(hold_amount), 0)
  INTO v_refund
  FROM released_own;

  IF v_refund > 0 THEN
    UPDATE public.app_users
    SET wallet_balance = wallet_balance + v_refund
    WHERE id = p_user_id;
  END IF;

  IF v_auction.current_winner_id IS NOT NULL
     AND v_auction.current_winner_id <> p_user_id THEN
    WITH released_prev_winner AS (
      UPDATE auction.wallet_holds
      SET released = TRUE,
          released_at = NOW()
      WHERE auction_id = p_auction_id
        AND user_id = v_auction.current_winner_id
        AND released = FALSE
      RETURNING hold_amount
    ),
    refund_prev_winner AS (
      SELECT COALESCE(SUM(hold_amount), 0) AS total_refund
      FROM released_prev_winner
    )
    UPDATE public.app_users u
    SET wallet_balance = wallet_balance + refund_prev_winner.total_refund
    FROM refund_prev_winner
    WHERE u.id = v_auction.current_winner_id
      AND refund_prev_winner.total_refund > 0;
  END IF;

  SELECT *
  INTO v_user
  FROM public.app_users u
  WHERE u.id = p_user_id
  FOR UPDATE;

  IF v_user.wallet_balance < p_bid_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.app_users
  SET wallet_balance = wallet_balance - p_bid_amount
  WHERE id = p_user_id;

  INSERT INTO auction.bids (auction_id, bidder_id, bid_amount, idempotency_key)
  VALUES (p_auction_id, p_user_id, p_bid_amount, p_idempotency_key)
  RETURNING id INTO v_bid_id;

  INSERT INTO auction.wallet_holds (user_id, auction_id, bid_id, hold_amount)
  VALUES (p_user_id, p_auction_id, v_bid_id, p_bid_amount);

  UPDATE auction.auctions
  SET current_max_bid = p_bid_amount,
      current_winner_id = p_user_id
  WHERE id = p_auction_id;

  RETURN QUERY
  SELECT v_bid_id, p_bid_amount, p_user_id;
END;
$$;
