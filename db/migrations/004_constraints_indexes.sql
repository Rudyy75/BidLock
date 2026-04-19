CREATE INDEX IF NOT EXISTS idx_auctions_status_end ON auction.auctions (status, end_at);

CREATE INDEX IF NOT EXISTS idx_bids_auction_amount_created
ON auction.bids (auction_id, bid_amount DESC, created_at ASC)
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_wallet_holds_auction_user_release
ON auction.wallet_holds (auction_id, user_id, released);

CREATE INDEX IF NOT EXISTS idx_wallet_holds_bid_id
ON auction.wallet_holds (bid_id);

CREATE INDEX IF NOT EXISTS idx_active_drivers_location
ON dispatch.active_drivers USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_active_drivers_filters
ON dispatch.active_drivers (is_available, vehicle_type, current_load);

CREATE INDEX IF NOT EXISTS idx_ride_requests_status_requested_at
ON dispatch.ride_requests (status, requested_at);

CREATE INDEX IF NOT EXISTS idx_matching_log_request_time
ON dispatch.matching_log (request_id, created_at DESC);
