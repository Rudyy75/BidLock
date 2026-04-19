import { pool } from "../../db/pool";

type CreateRideInput = {
  riderId: string;
  pickupLat: number;
  pickupLon: number;
  dropLat: number;
  dropLon: number;
  vehicleType: "BIKE" | "AUTO" | "CAR";
};

export async function createRideRequest(input: CreateRideInput): Promise<Record<string, unknown>> {
  const result = await pool.query(
    `INSERT INTO dispatch.ride_requests (
      rider_id,
      pickup_location,
      drop_location,
      vehicle_type,
      status
    )
    VALUES (
      $1,
      ST_SetSRID(ST_MakePoint($2, $3), 4326),
      ST_SetSRID(ST_MakePoint($4, $5), 4326),
      $6,
      'REQUESTED'
    )
    RETURNING id, rider_id, vehicle_type, status, requested_at`,
    [
      input.riderId,
      input.pickupLon,
      input.pickupLat,
      input.dropLon,
      input.dropLat,
      input.vehicleType,
    ],
  );

  return result.rows[0];
}

export async function claimDriver(requestId: string, workerName: string): Promise<Record<string, unknown>> {
  const result = await pool.query(
    "SELECT * FROM dispatch.claim_driver_for_request($1, $2)",
    [requestId, workerName],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Driver claim returned no result");
  }

  return row;
}

export async function transitionRideState(
  requestId: string,
  newState: string,
  changedBy: string,
): Promise<Record<string, unknown>> {
  const result = await pool.query(
    "SELECT * FROM dispatch.transition_ride_state($1, $2, $3)",
    [requestId, newState, changedBy],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Transition returned no result");
  }

  return row;
}

export async function findTopDrivers(input: {
  lat: number;
  lon: number;
  vehicleType?: string | undefined;
  maxLoad?: number | undefined;
  limit?: number | undefined;
  radiusM?: number | undefined;
}): Promise<Array<Record<string, unknown>>> {
  const result = await pool.query(
    "SELECT * FROM dispatch.find_top_drivers($1, $2, $3, $4, $5, $6)",
    [
      input.lat,
      input.lon,
      input.vehicleType ?? null,
      input.maxLoad ?? 3,
      input.limit ?? 5,
      input.radiusM ?? 2000,
    ],
  );

  return result.rows;
}

export async function getRideById(requestId: string): Promise<Record<string, unknown>> {
  const result = await pool.query(
    `SELECT
      r.id,
      r.rider_id,
      r.vehicle_type,
      r.status,
      r.matched_driver_id,
      r.requested_at,
      r.matched_at,
      r.completed_at,
      ST_Y(r.pickup_location::geometry) AS pickup_lat,
      ST_X(r.pickup_location::geometry) AS pickup_lon,
      ST_Y(r.drop_location::geometry) AS drop_lat,
      ST_X(r.drop_location::geometry) AS drop_lon
    FROM dispatch.ride_requests r
    WHERE r.id = $1`,
    [requestId],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Ride request not found");
  }

  return row;
}

export async function getHotZones(): Promise<Array<Record<string, unknown>>> {
  const result = await pool.query(
    `SELECT zone_key, demand_count, supply_count, pressure_score, refreshed_at
    FROM dispatch.mv_hot_zones
    ORDER BY pressure_score DESC, demand_count DESC
    LIMIT 20`,
  );

  return result.rows;
}
