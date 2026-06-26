import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, TelemetryPayload, HeartbeatPayload } from './types.js';

export function createSocketServer(port: number, corsOrigins: string[]) {
  const http = createServer();

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(http, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[socket.io] client connected: ${socket.id}`);

    socket.on('subscribe', (droneId) => {
      socket.join(`drone:${droneId}`);
      console.log(`[socket.io] ${socket.id} subscribed to ${droneId}`);
    });

    socket.on('unsubscribe', (droneId) => {
      socket.leave(`drone:${droneId}`);
    });

    socket.on('command', (payload) => {
      // Commands are logged; actual MAVLink command sending is wired in index.ts
      console.log(`[socket.io] command from ${socket.id}:`, payload);
      io.emit('commandAck', { droneId: payload.droneId, command: payload.command, result: 0 });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[socket.io] client disconnected: ${socket.id} (${reason})`);
    });
  });

  http.listen(port, () => {
    console.log(`[socket.io] server listening on port ${port}`);
  });

  return {
    broadcastTelemetry(payload: TelemetryPayload) {
      // Broadcast to both the drone-specific room and all connected clients
      io.to(`drone:${payload.droneId}`).emit('telemetry', payload);
      io.emit('telemetry', payload);
    },

    broadcastHeartbeat(payload: HeartbeatPayload) {
      io.to(`drone:${payload.droneId}`).emit('heartbeat', payload);
      io.emit('heartbeat', payload);
    },

    broadcastDroneOffline(droneId: string) {
      io.emit('droneOffline', droneId);
    },

    close() {
      io.close();
      http.close();
    },
  };
}
