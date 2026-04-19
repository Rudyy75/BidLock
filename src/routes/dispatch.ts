import { Router } from "express";
import { z } from "zod";

import {
  claimDriver,
  createRideRequest,
  findTopDrivers,
  getHotZones,
  getRideById,
  transitionRideState,
} from "../modules/dispatch/dispatchService";
import { toHttpError } from "../utils/errors";

const router = Router();

const createRideBody = z.object({
  riderId: z.string().uuid(),
  pickupLat: z.coerce.number(),
  pickupLon: z.coerce.number(),
  dropLat: z.coerce.number(),
  dropLon: z.coerce.number(),
  vehicleType: z.enum(["BIKE", "AUTO", "CAR"]),
});

const claimBody = z.object({
  workerName: z.string().min(1).default("matching-worker-1"),
});

const transitionBody = z.object({
  newState: z.enum(["MATCHED", "PICKED_UP", "DROPPED_OFF", "CANCELLED"]),
  changedBy: z.string().min(1),
});

router.get("/drivers/nearby", async (req, res) => {
  try {
    const query = z
      .object({
        lat: z.coerce.number(),
        lon: z.coerce.number(),
        vehicleType: z.enum(["BIKE", "AUTO", "CAR"]).optional(),
        maxLoad: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(10).optional(),
        radiusM: z.coerce.number().int().positive().max(10000).optional(),
      })
      .parse(req.query);

    const drivers = await findTopDrivers(query);
    return res.status(200).json({ count: drivers.length, drivers });
  } catch (error) {
    const httpError = toHttpError(error);
    return res.status(httpError.status).json({ message: httpError.message });
  }
});

router.post("/rides", async (req, res) => {
  try {
    const payload = createRideBody.parse(req.body);
    const ride = await createRideRequest(payload);
    return res.status(201).json(ride);
  } catch (error) {
    const httpError = toHttpError(error);
    return res.status(httpError.status).json({ message: httpError.message });
  }
});

router.get("/rides/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;
    const ride = await getRideById(requestId);
    return res.status(200).json(ride);
  } catch (error) {
    const httpError = toHttpError(error);
    return res.status(httpError.status).json({ message: httpError.message });
  }
});

router.post("/rides/:requestId/match", async (req, res) => {
  try {
    const { requestId } = req.params;
    const payload = claimBody.parse(req.body);
    const result = await claimDriver(requestId, payload.workerName);
    return res.status(200).json(result);
  } catch (error) {
    const httpError = toHttpError(error);
    return res.status(httpError.status).json({ message: httpError.message });
  }
});

router.post("/rides/:requestId/state", async (req, res) => {
  try {
    const { requestId } = req.params;
    const payload = transitionBody.parse(req.body);
    const result = await transitionRideState(requestId, payload.newState, payload.changedBy);
    return res.status(200).json(result);
  } catch (error) {
    const httpError = toHttpError(error);
    return res.status(httpError.status).json({ message: httpError.message });
  }
});

router.get("/hot-zones", async (_req, res) => {
  try {
    const zones = await getHotZones();
    return res.status(200).json({ count: zones.length, zones });
  } catch (error) {
    const httpError = toHttpError(error);
    return res.status(httpError.status).json({ message: httpError.message });
  }
});

export default router;
