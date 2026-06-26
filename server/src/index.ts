import 'dotenv/config';
import { startMavlinkListener } from './mavlink-listener.js';
import { createSocketServer } from './socket-server.js';
import { getOfflineDrones, all } from './drone-registry.js';
import { writeTelemetry } from './supabase-writer.js';

const UDP_PORT = parseInt(process.env.MAVLINK_UDP_PORT ?? '14550', 10);
const UDP_HOST = process.env.MAVLINK_UDP_HOST ?? '0.0.0.0';
const SOCKET_PORT = parseInt(process.env.SOCKET_PORT ?? '5760', 10);
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim());

console.log('[bridge] Starting MADS Flight Commander MAVLink bridge...');

const socketServer = createSocketServer(SOCKET_PORT, CORS_ORIGINS);

const stopMavlink = startMavlinkListener(
  UDP_PORT,
  UDP_HOST,
  (telemetry) => {
    socketServer.broadcastTelemetry(telemetry);
    writeTelemetry(telemetry).catch(() => {}); // fire-and-forget; errors logged inside
  },
  (heartbeat) => {
    socketServer.broadcastHeartbeat(heartbeat);
  }
);

// Detect drones that stop sending heartbeats and notify clients
setInterval(() => {
  const offline = getOfflineDrones();
  for (const state of offline) {
    socketServer.broadcastDroneOffline(state.droneId);
  }
}, 3_000);

// Log connected drone count every 30 s
setInterval(() => {
  const drones = all();
  if (drones.length > 0) {
    console.log(`[bridge] ${drones.length} drone(s) in registry`);
  }
}, 30_000);

function shutdown() {
  console.log('[bridge] Shutting down...');
  stopMavlink();
  socketServer.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
