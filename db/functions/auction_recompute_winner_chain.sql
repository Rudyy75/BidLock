CREATE OR REPLACE FUNCTION auction.recompute_winner_chain(
  p_auction_id UUID
)
RETURNS TABLE (winner_bid_id UUID, winner_id UUID, winner_amount NUMERIC)
LANGUAGE plpgsql
AS $$
DECLARE
  v_top_bid_id UUID;
  v_top_bidder_id UUID;
  v_top_amount NUMERIC(12, 2);
BEGIN
  WITH ordered_bids AS (
    SELECT
      b.id,
      b.bidder_id,
      b.bid_amount,
      ROW_NUMBER() OVER (
        ORDER BY b.bid_amount DESC, b.created_at ASC, b.id ASC
      ) AS rank_no
    FROM auction.bids b
    WHERE b.auction_id = p_auction_id
      AND b.is_active = TRUE
  ),
  recursive_chain AS (
    SELECT id, bidder_id, bid_amount, rank_no
    FROM ordered_bids
    WHERE rank_no = 1

    UNION ALL

    SELECT ob.id, ob.bidder_id, ob.bid_amount, ob.rank_no
    FROM ordered_bids ob
    JOIN recursive_chain rc
      ON ob.rank_no = rc.rank_no + 1
  )
  SELECT id, bidder_id, bid_amount
  INTO v_top_bid_id, v_top_bidder_id, v_top_amount
  FROM recursive_chain
  WHERE rank_no = 1;

  IF v_top_bid_id IS NULL THEN
    UPDATE auction.auctions
    SET current_max_bid = 0,
        current_winner_id = NULL
    WHERE id = p_auction_id;

    RETURN QUERY
    SELECT NULL::UUID, NULL::UUID, 0::NUMERIC;
    RETURN;
  END IF;

  UPDATE auction.auctions
  SET current_max_bid = v_top_amount,
      current_winner_id = v_top_bidder_id
  WHERE id = p_auction_id;

  INSERT INTO auction.bid_audit_log (bid_id, auction_id, event_type, event_payload)
  VALUES (
    v_top_bid_id,
    p_auction_id,
    'WINNER_RECALCULATED',
    jsonb_build_object(
      'winner_bid_id', v_top_bid_id,
      'winner_id', v_top_bidder_id,
      'winner_amount', v_top_amount
    )
  );

  RETURN QUERY
  SELECT v_top_bid_id, v_top_bidder_id, v_top_amount;
END;
$$;
