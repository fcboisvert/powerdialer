// src/lib/voiceClient.ts - Optimized for outgoing calls with proper registration
import { Device, Call } from '@twilio/voice-sdk';

let device: Device | null = null;

/**
 * Initialise a single Twilio Device for this browser tab.
 * Re-uses the instance if it already exists.
 */
export async function initTwilioDevice(agent: string): Promise<void> {
  if (device) {
    return; // Already initialized; no-op to avoid duplicates
  }

  try {
    const payload = { agent }
    const res = await fetch(`/api/studio/token`, {
      method: 'POST',  // ← ADDED
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' }
    })
    if (!res.ok) throw new Error(`Failed to fetch Twilio token: ${res.status}`);
    const data: { token: string } = await res.json();

    // Typed options for codec prefs (avoids inference issues)
    const options: Partial<Device.Options> = {
      codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      edge: 'montreal',  // ← ADDED
      logLevel: 1        // ← ADDED for debugging
    };

    device = new Device(data.token, options);

    // Export to window for debugging
    if (typeof window !== 'undefined') {
      (window as any).getTwilioDevice = getTwilioDevice;
    }

    device.on('ready', () => console.log('🔔 Twilio Device ready'));
    device.on('error', (error) => console.error('❌ Twilio error:', error));
    device.on('registered', () => console.log('✅ Device registered with Twilio'));  // ← ADDED
    device.on('unregistered', () => console.log('❌ Device unregistered'));  // ← ADDED
    // REMOVED the incoming handler - PowerDialer handles incoming calls

    await device.register(); // Ensures device is fully registered for status
    console.log('📞 Device register() called for:', agent);  // ← ADDED
  } catch (err: any) {
    console.error("Twilio init error:", err);
    throw err; // Propagate for caller handling
  }
}

export function getTwilioDevice(): Device | null {
  return device;
}

/** Destroy the device (e.g. on logout / page unload). */
export function destroyTwilioDevice(): void {
  if (device) {
    device.disconnectAll();
    device.unregister(); // Clean unregister
    device.destroy();
    device = null;
  }
}
