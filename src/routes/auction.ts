import { Router } from "express";
import { z } from "zod";

import {
  getAuctionSnapshot,
  placeBidWithRetry,
  retractBid,
} from "../modules/auction/auctionService";
import { toHttpError } from "../utils/errors";

const router = Router();

const placeBidBody = z.object({
  userId: z.string().min(1),
  bidAmount: z.coerce.number().positive(),
  idempotencyKey: z.string().optional(),
});

const retractBidBody = z.object({
  reason: z.string().min(1).default("user retracted"),
});

router.get("/auctions/:auctionId", async (req, res) => {
  try {
    const { auctionId } = req.params;
    const data = await getAuctionSnapshot(auctionId);
    return res.status(200).json(data);
  } catch (error) {
    const httpError = toHttpError(error);
    return res.status(httpError.status).json({ message: httpError.message });
  }
});

router.post("/auctions/:auctionId/bids", async (req, res) => {
  try {
    const { auctionId } = req.params;
    const payload = placeBidBody.parse(req.body);

    const result = await placeBidWithRetry({
      auctionId,
      userId: payload.userId,
      bidAmount: payload.bidAmount,
      idempotencyKey: payload.idempotencyKey,
    });

    return res.status(201).json(result);
  } catch (error) {
    const httpError = toHttpError(error);
    return res.status(httpError.status).json({ message: httpError.message });
  }
});

router.post("/bids/:bidId/retract", async (req, res) => {
  try {
    const { bidId } = req.params;
    const payload = retractBidBody.parse(req.body);
    const result = await retractBid(bidId, payload.reason);

    return res.status(200).json(result);
  } catch (error) {
    const httpError = toHttpError(error);
    return res.status(httpError.status).json({ message: httpError.message });
  }
});

export default router;
