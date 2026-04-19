CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (wallet_balance >= 0)
);

CREATE TABLE IF NOT EXISTS auction.auctions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'CANCELLED')),
  start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_at TIMESTAMPTZ NOT NULL,
  min_increment NUMERIC(12, 2) NOT NULL DEFAULT 10,
  current_max_bid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  current_winner_id UUID REFERENCES public.app_users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at),
  CHECK (current_max_bid >= 0),
  CHECK (min_increment > 0)
);

CREATE TABLE IF NOT EXISTS auction.bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id UUID NOT NULL REFERENCES auction.auctions (id),
  bidder_id UUID NOT NULL REFERENCES public.app_users (id),
  bid_amount NUMERIC(12, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (auction_id, idempotency_key),
  CHECK (bid_amount > 0)
);

CREATE TABLE IF NOT EXISTS auction.wallet_holds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.app_users (id),
  auction_id UUID NOT NULL REFERENCES auction.auctions (id),
  bid_id UUID REFERENCES auction.bids (id),
  hold_amount NUMERIC(12, 2) NOT NULL,
  released BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  CHECK (hold_amount > 0)
);

CREATE TABLE IF NOT EXISTS auction.bid_audit_log (
  id BIGSERIAL PRIMARY KEY,
  bid_id UUID NOT NULL,
  auction_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('PLACED', 'RETRACTED', 'WINNER_RECALCULATED')),
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
