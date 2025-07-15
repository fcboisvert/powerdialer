import { Device } from '@twilio/voice-sdk';

// 🔁 Infer proper type for second constructor arg
type DeviceOptions = ConstructorParameters<typeof Device>[1];
type TwilioAccessTokenResponse = { token: string };

let device: Device | null = null;

export async function initTwilioDevice(identity: string): Promise<void> {
  if (device) {
    console.warn('Twilio Device already initialized');
    return;
  }

  const res = await fetch(`/api/token-public?identity=${encodeURIComponent(identity)}`);
  if (!res.ok) throw new Error('Failed to fetch Twilio token');

  const { token } = (await res.json()) as TwilioAccessTokenResponse;

const options = {
  codecPreferences: ['opus', 'pcmu'],
  debug: true,
  enableRingingState: true,
} satisfies Partial<ConstructorParameters<typeof Device>[1]>;


  device = new Device(token, options);

  device.on('ready', () => console.log('🔔 Twilio Device ready'));
  device.on('incoming', (conn) => {
    console.log('📞 Incoming call received');
    conn.reject(); // or conn.accept()
  });
  device.on('error', (err) => console.error('❌ Twilio error:', err));
}

export function getTwilioDevice(): Device | null {
  return device;
}

export function destroyTwilioDevice(): void {
  if (device) {
    device.disconnectAll();
    device.destroy();
    device = null;
  }
}
