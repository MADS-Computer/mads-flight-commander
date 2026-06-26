import { createSocket } from 'node:dgram';
import { Transform, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import {
  MavLinkPacketSplitter,
  MavLinkPacketParser,
  minimal,
  common,
  ardupilotmega,
  type MavLinkData,
} from 'node-mavlink';
import {
  getOrCreate,
  markHeartbeat,
  buildTelemetry,
  mavStatusToAppStatus,
} from './drone-registry.js';
import type { TelemetryPayload, HeartbeatPayload } from './types.js';

const pipelineAsync = promisify(pipeline);

// Merge registries: ardupilotmega inherits minimal + common
const REGISTRY = {
  ...minimal.REGISTRY,
  ...common.REGISTRY,
  ...ardupilotmega.REGISTRY,
};

const { Heartbeat } = minimal;
const { GlobalPositionInt, BatteryStatus, SysStatus, GpsRawInt } = common;

export type TelemetryHandler = (payload: TelemetryPayload) => void;
export type HeartbeatHandler = (payload: HeartbeatPayload) => void;

export function startMavlinkListener(
  udpPort: number,
  udpHost: string,
  onTelemetry: TelemetryHandler,
  onHeartbeat: HeartbeatHandler
): () => void {
  const udp = createSocket('udp4');

  // Passthrough transform — lets us pipe UDP datagrams into the splitter stream
  const rawStream = new Transform({
    transform(chunk, _enc, cb) {
      this.push(chunk);
      cb();
    },
  });

  const splitter = new MavLinkPacketSplitter();
  const parser = new MavLinkPacketParser();

  splitter.pipe(parser);

  parser.on('data', (packet) => {
    const clazz = REGISTRY[packet.header.msgid as keyof typeof REGISTRY];
    if (!clazz) return;

    let message: MavLinkData;
    try {
      message = packet.protocol.data(packet.payload, clazz);
    } catch {
      return;
    }

    const systemId: number = packet.header.sysid;
    const state = getOrCreate(systemId);

    if (message instanceof Heartbeat) {
      markHeartbeat(systemId);
      state.telemetry.status = mavStatusToAppStatus(
        message.baseMode,
        message.customMode,
        message.systemStatus
      );

      onHeartbeat({
        droneId: state.droneId,
        systemId,
        timestamp: Date.now(),
        type: message.type,
        autopilot: message.autopilot,
        baseMode: message.baseMode,
        customMode: message.customMode,
        systemStatus: message.systemStatus,
        status: state.telemetry.status,
      });
    } else if (message instanceof GlobalPositionInt) {
      state.telemetry.position = {
        latitude: message.lat / 1e7,
        longitude: message.lon / 1e7,
        altitude: message.alt / 1000,
        relativeAltitude: message.relativeAlt / 1000,
      };
      // vx/vy are in cm/s → convert to m/s ground speed
      state.telemetry.speedMs = Math.sqrt((message.vx / 100) ** 2 + (message.vy / 100) ** 2);
      // hdg is in cdeg (0–35999); 65535 = unknown
      state.telemetry.headingDeg = message.hdg !== 65535 ? message.hdg / 100 : 0;

      const payload = buildTelemetry(state);
      if (payload) onTelemetry(payload);
    } else if (message instanceof BatteryStatus) {
      // voltages[0] in mV; 65535 = invalid
      const mv = message.voltages[0];
      if (mv !== 65535) state.telemetry.batteryVoltage = mv / 1000;
      if (message.batteryRemaining >= 0) state.telemetry.batteryPercent = message.batteryRemaining;
    } else if (message instanceof SysStatus) {
      if (message.batteryRemaining >= 0) state.telemetry.batteryPercent = message.batteryRemaining;
      if (message.voltageBattery !== 65535) {
        state.telemetry.batteryVoltage = message.voltageBattery / 1000;
      }
      // drop_rate_comm is per-mille (0–10000); invert for signal quality %
      state.telemetry.signalStrength = Math.max(0, 100 - message.dropRateComm / 100);
    } else if (message instanceof GpsRawInt) {
      state.telemetry.satelliteCount = message.satellitesVisible;
    }
  });

  udp.on('message', (msg) => rawStream.push(msg));

  pipelineAsync(rawStream, splitter).catch((err: unknown) => {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ERR_STREAM_DESTROYED') {
      console.error('[MAVLink] stream pipeline error:', err);
    }
  });

  udp.bind(udpPort, udpHost, () => {
    console.log(`[MAVLink] UDP listener on ${udpHost}:${udpPort}`);
  });

  udp.on('error', (err) => console.error('[MAVLink] UDP error:', err));

  return () => {
    rawStream.destroy();
    udp.close();
  };
}
