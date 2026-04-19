INSERT INTO public.app_users (id, name, wallet_balance)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Alice', 20000),
  ('22222222-2222-2222-2222-222222222222', 'Bob', 15000),
  ('33333333-3333-3333-3333-333333333333', 'Charlie', 25000),
  ('44444444-4444-4444-4444-444444444444', 'Driver One', 5000),
  ('55555555-5555-5555-5555-555555555555', 'Driver Two', 5000),
  ('66666666-6666-6666-6666-666666666666', 'Driver Three', 5000)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  wallet_balance = EXCLUDED.wallet_balance;

INSERT INTO auction.auctions (id, title, status, start_at, end_at, min_increment, current_max_bid)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Rare Game Item Auction',
  'ACTIVE',
  NOW(),
  NOW() + INTERVAL '2 hours',
  10,
  0
)
ON CONFLICT (id) DO UPDATE
SET
  title = EXCLUDED.title,
  status = EXCLUDED.status,
  end_at = EXCLUDED.end_at,
  min_increment = EXCLUDED.min_increment;
