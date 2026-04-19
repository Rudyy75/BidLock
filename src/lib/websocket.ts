import type { Server as HttpServer } from "http";
import { Server } from "socket.io";

let io: Server;

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: "*", // allow any origin for testing
    },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Clients can join specific auction rooms to receive updates
    socket.on("join-auction", (auctionId) => {
      socket.join(`auction:${auctionId}`);
      console.log(`Socket ${socket.id} joined auction ${auctionId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  console.log("Socket.io initialized successfully.");
}

export function broadcastAuctionUpdate(auctionId: string, payload: unknown) {
  if (io) {
    io.to(`auction:${auctionId}`).emit("auction-update", payload);
  }
}

export function broadcastRideMatch(requestId: string, payload: unknown) {
  if (io) {
    io.emit("ride-match", { requestId, ...payload as object });
  }
}
