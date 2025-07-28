// src/lib/voiceClient.ts - Updated to use Twilio Function
import { Device, Call } from '@twilio/voice-sdk';

let device: Device | null = null;

export async function initTwilioDevice(agent: string): Promise<void> {
  if (device) {
    return;
  }

  try {
    // To this simpler version:
    const res = await fetch(`https://almond-mouse-3471.twil.io/token-public?agent=${agent}`, {
      method: 'GET'  // Your function accepts GET requests
    });

    if (!res.ok) throw new Error(`Failed to fetch Twilio token: ${res.status}`);
    const data: { token: string } = await res.json();

    const options: Partial<Device.Options> = {
      codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      edge: 'montreal',
      logLevel: 1
    };

    device = new Device(data.token, options);

    if (typeof window !== 'undefined') {
      (window as any).getTwilioDevice = getTwilioDevice;
    }

    device.on('ready', () => console.log('🔔 Twilio Device ready'));
    device.on('error', (error) => console.error('❌ Twilio error:', error));
    device.on('registered', () => console.log('✅ Device registered with Twilio'));
    device.on('unregistered', () => console.log('❌ Device unregistered'));

    await device.register();
    console.log('📞 Device register() called for:', agent);
  } catch (err: any) {
    console.error("Twilio init error:", err);
    throw err;
  }
}

export function getTwilioDevice(): Device | null {
  return device;
}

export function destroyTwilioDevice(): void {
  if (device) {
    device.disconnectAll();
    device.unregister();
    device.destroy();
    device = null;
  }
}
