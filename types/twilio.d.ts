// src/types/twilio.d.ts or src/types/twilio.ts

export type DeviceOptions = {
  codecPreferences?: ('opus' | 'pcmu')[];
  debug?: boolean;
  enableRingingState?: boolean;
};

export type TwilioAccessTokenResponse = {
  token: string;
};
