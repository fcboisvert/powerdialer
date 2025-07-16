// src/lib/voiceClient.ts
import { Device } from '@twilio/voice-sdk';

/** 2nd arg of the Device constructor */
type DeviceOptions = ConstructorParameters<typeof Device>[1];
type TwilioAccessTokenResponse = { token: string };

let device: Device | null = null;

/**
 * Initialise a single Twilio Device for this browser tab.
 * Re-uses the instance if it already exists.
 */
export async function initTwilioDevice(identity: string): Promise<void> {
  if (device) {
    console.warn('Twilio Device already initialised');
    return;
  }

  /* ----- Fetch JWT from Pages Function ----- */
  const res = await fetch(
    `/api/token-public?identity=${encodeURIComponent(identity)}`
  );
  if (!res.ok) throw new Error('Failed to fetch Twilio token');

  const { token } = (await res.json()) as TwilioAccessTokenResponse;

  /* ----- Safe, typed options ----- */
  const options: Partial<DeviceOptions> = {
    codecPreferences: ['opus', 'pcmu'], // literal-typed list
    debug: true,
    enableRingingState: true,
  };

  /* ----- Create & wire up the device ----- */
  device = new Device(token, options);

  device.on('ready', () => console.log('🔔 Twilio Device ready'));
  device.on('incoming', (conn) => conn.reject()); // reject unexpected inbound
  device.on('error', (err) => console.error('❌ Twilio error:', err));
}

/** Access the singleton instance (may be null before init). */
export function getTwilioDevice(): Device | null {
  return device;
}

/** Destroy the device (e.g. on logout / page unload). */
export function destroyTwilioDevice(): void {
  if (device) {
    device.disconnectAll();
    device.destroy();
    device = null;
  }
}
