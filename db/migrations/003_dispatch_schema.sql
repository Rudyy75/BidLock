CREATE TABLE IF NOT EXISTS dispatch.active_drivers (
  driver_id UUID PRIMARY KEY REFERENCES public.app_users (id),
  location GEOMETRY(Point, 4326) NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('BIKE', 'AUTO', 'CAR')),
  current_load INTEGER NOT NULL DEFAULT 0,
  max_load INTEGER NOT NULL DEFAULT 3,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (current_load >= 0),
  CHECK (max_load > 0),
  CHECK (current_load <= max_load)
);

CREATE TABLE IF NOT EXISTS dispatch.ride_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID NOT NULL REFERENCES public.app_users (id),
  pickup_location GEOMETRY(Point, 4326) NOT NULL,
  drop_location GEOMETRY(Point, 4326) NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('BIKE', 'AUTO', 'CAR')),
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'MATCHED', 'PICKED_UP', 'DROPPED_OFF', 'CANCELLED')),
  matched_driver_id UUID REFERENCES dispatch.active_drivers (driver_id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS dispatch.matching_log (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES dispatch.ride_requests (id),
  driver_id UUID REFERENCES dispatch.active_drivers (driver_id),
  worker_name TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('OFFERED', 'ACCEPTED', 'SKIPPED', 'NO_DRIVER')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispatch.ride_state_history (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES dispatch.ride_requests (id),
  from_state TEXT,
  to_state TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
