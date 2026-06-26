import { useEffect, useRef } from 'react';
import { getMavlinkSocket, onMavlinkMessage } from '@/lib/mavlink';
import type { MAVLinkEnvelope, MAVLinkMessageType } from '@/types/mavlink';

const BRIDGE_URL = process.env.EXPO_PUBLIC_MAVLINK_BRIDGE_URL ?? 'ws://localhost:5760';

export function useMavlink(): void {
  const connected = useRef(false);

  useEffect(() => {
    if (!connected.current) {
      getMavlinkSocket(BRIDGE_URL);
      connected.current = true;
    }
  }, []);
}

export function useMavlinkMessage<T>(
  messageType: MAVLinkMessageType,
  callback: (envelope: MAVLinkEnvelope<T>) => void
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = onMavlinkMessage<T>(messageType, (envelope) => {
      callbackRef.current(envelope);
    });
    return unsubscribe;
  }, [messageType]);
}
