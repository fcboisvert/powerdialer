// src/lib/voiceClient.ts - Production Ready Twilio Voice Client
import { Device, Call } from '@twilio/voice-sdk';

let device: Device | null = null;

/** 
 * Initialize Twilio Device with token from serverless function
 * @param agent - The agent identifier (e.g., 'frederic' or 'simon')
 */
export async function initTwilioDevice(agent: string): Promise<void> {
  // Return early if device already exists and is registered
  if (device && device.state === Device.State.Registered) {
    console.log('📱 Device already registered, skipping initialization');
    return;
  }

  // Clean up any existing device first
  if (device) {
    console.log('🔄 Cleaning up existing device before reinitializing');
    destroyTwilioDevice();
  }

  try {
    console.log(`🔐 Fetching token for agent: ${agent}`);

    // Fetch token from Twilio Function
    const res = await fetch(`https://almond-mouse-3471.twil.io/token-public?agent=${agent}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch Twilio token: ${res.status} - ${errorText}`);
    }

    const data: { token: string; identity?: string } = await res.json();

    if (!data.token) {
      throw new Error('No token received from server');
    }

    console.log('🎫 Token received, identity:', data.identity || 'unknown');

    // Configure device options
    const options: Partial<Device.Options> = {
      codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      edge: 'roaming', // Auto-selects closest edge location
      logLevel: 1, // 0 = trace, 1 = info, 2 = warn, 3 = error
      enableImprovedSignalingErrorPrecision: true,
      maxCallSignalingTimeoutMs: 30000, // 30 seconds timeout
    };

    // Create new device instance
    device = new Device(data.token, options);

    // Make device globally accessible for debugging
    if (typeof window !== 'undefined') {
      (window as any).getTwilioDevice = getTwilioDevice;
      (window as any).twilioDevice = device; // Direct reference for emergency debugging
    }

    // Set up device event handlers
    setupDeviceEventHandlers(device, agent);

    // Register the device
    console.log('📞 Registering device...');
    await device.register();

    // Verify registration succeeded
    if (device.state !== Device.State.Registered) {
      throw new Error(`Device registration failed. State: ${device.state}`);
    }

    console.log('✅ Device successfully registered for:', agent);

  } catch (err: any) {
    console.error('❌ Twilio initialization error:', err);

    // Clean up on error
    if (device) {
      try {
        device.destroy();
      } catch (cleanupError) {
        console.error('Error during device cleanup:', cleanupError);
      }
      device = null;
    }

    throw err;
  }
}

/**
 * Set up event handlers for the Twilio Device
 */
function setupDeviceEventHandlers(device: Device, agent: string): void {
  // Device lifecycle events
  device.on('registered', () => {
    console.log(`✅ Device registered successfully [${agent}]`);
    console.log('📊 Device info:', {
      state: device.state,
      identity: device.identity,
      edge: device.edge,
    });
  });

  device.on('unregistered', () => {
    console.log('⚠️ Device unregistered');
  });

  device.on('registrationFailed', (error) => {
    console.error('❌ Device registration failed:', error.message);
    console.error('Registration error details:', {
      code: error.code,
      message: error.message,
      causes: error.causes,
    });
  });

  device.on('error', (error) => {
    console.error('❌ Twilio Device error:', error.message);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      twilioError: error,
    });
  });

  // Token expiry warning (tokens typically expire after 1 hour)
  device.on('tokenWillExpire', () => {
    console.warn('⚠️ Token will expire soon, refresh needed');
    // In production, implement token refresh here
    refreshToken(agent);
  });

  // Connection events
  device.on('incoming', (call) => {
    console.log('📞 Incoming call:', {
      from: call.parameters.From,
      to: call.parameters.To,
      callSid: call.parameters.CallSid,
    });
  });

  // Debug: log all events in development
  if (process.env.NODE_ENV === 'development') {
    const allEvents = [
      'cancel', 'connect', 'disconnect', 'error', 'incoming',
      'offline', 'ready', 'registered', 'registrationFailed',
      'tokenWillExpire', 'unregistered'
    ];

    allEvents.forEach(eventName => {
      device.on(eventName as any, (...args) => {
        console.log(`[Device Event] ${eventName}:`, ...args);
      });
    });
  }
}

/**
 * Refresh the device token before it expires
 */
async function refreshToken(agent: string): Promise<void> {
  if (!device) return;

  try {
    console.log('🔄 Refreshing token for:', agent);

    const res = await fetch(`https://almond-mouse-3471.twil.io/token-public?agent=${agent}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to refresh token: ${res.status}`);
    }

    const data: { token: string } = await res.json();

    // Update the device with new token
    device.updateToken(data.token);
    console.log('✅ Token refreshed successfully');

  } catch (err) {
    console.error('❌ Token refresh failed:', err);
    // In production, implement retry logic or user notification
  }
}

/**
 * Get the current Twilio Device instance
 */
export function getTwilioDevice(): Device | null {
  return device;
}

/**
 * Check if device is ready for calls
 */
export function isDeviceReady(): boolean {
  return device !== null && device.state === Device.State.Registered;
}

/**
 * Get device state information
 */
export function getDeviceState(): {
  exists: boolean;
  state: string | null;
  identity: string | null;
  isBusy: boolean;
} {
  return {
    exists: device !== null,
    state: device?.state || null,
    identity: device?.identity || null,
    isBusy: device?.isBusy || false,
  };
}

/**
 * Destroy the Twilio Device and clean up
 */
export function destroyTwilioDevice(): void {
  if (device) {
    try {
      console.log('🔌 Destroying Twilio device...');

      // Disconnect any active calls
      if (device.isBusy) {
        device.disconnectAll();
      }

      // Unregister from Twilio
      if (device.state === Device.State.Registered) {
        device.unregister();
      }

      // Remove all event listeners
      device.removeAllListeners();

      // Destroy the device
      device.destroy();

      console.log('✅ Device destroyed successfully');

    } catch (err) {
      console.error('❌ Error destroying device:', err);
    } finally {
      device = null;

      // Clean up global references
      if (typeof window !== 'undefined') {
        delete (window as any).twilioDevice;
      }
    }
  }
}

/**
 * Reconnect device if connection is lost
 */
export async function reconnectDevice(agent: string): Promise<void> {
  console.log('🔄 Attempting to reconnect device...');

  // Destroy existing device
  destroyTwilioDevice();

  // Wait a moment before reconnecting
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Reinitialize
  await initTwilioDevice(agent);
}

// Export device states for easy access
export const DeviceState = Device.State;