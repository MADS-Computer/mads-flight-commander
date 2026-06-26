import { io, Socket } from 'socket.io-client';
import type { MAVLinkEnvelope, MAVLinkMessageType } from '@/types/mavlink';

let socket: Socket | null = null;

export function getMavlinkSocket(bridgeUrl: string): Socket {
  if (socket?.connected) return socket;

  socket = io(bridgeUrl, {
    transports: ['websocket'],
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[MAVLink bridge] connected');
  });

  socket.on('disconnect', (reason) => {
    console.warn('[MAVLink bridge] disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[MAVLink bridge] connection error:', err.message);
  });

  return socket;
}

export function disconnectMavlink(): void {
  socket?.disconnect();
  socket = null;
}

export function onMavlinkMessage<T>(
  messageType: MAVLinkMessageType,
  callback: (envelope: MAVLinkEnvelope<T>) => void
): () => void {
  const s = socket;
  if (!s) return () => {};

  s.on(messageType, callback as (data: unknown) => void);
  return () => s.off(messageType, callback as (data: unknown) => void);
}

export function sendMavlinkCommand(
  droneId: string,
  command: string,
  params: Record<string, unknown> = {}
): void {
  if (!socket?.connected) {
    console.warn('[MAVLink bridge] not connected — cannot send command');
    return;
  }
  socket.emit('command', { droneId, command, params });
}
