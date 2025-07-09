import { useState, useEffect, useCallback } from "react";

export type DialerStatus = "idle" | "connecting" | "in-call" | "disconnected" | "error";

interface UseDialerOptions {
  agent: string;
  device?: any; // Twilio.Device, injected from context/provider
}

interface UseDialerResult {
  status: DialerStatus;
  error: string | null;
  call: any | null; // Twilio.Connection or similar
  callNumber: (to: string) => Promise<void>;
  hangUp: () => void;
  mute: (mute: boolean) => void;
}

export function useDialer({ agent, device }: UseDialerOptions): UseDialerResult {
  const [status, setStatus] = useState<DialerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [call, setCall] = useState<any | null>(null);

  // Call a number
  const callNumber = useCallback(
    async (to: string) => {
      if (!device) {
        setError("Twilio device not ready");
        setStatus("error");
        return;
      }
      setError(null);
      setStatus("connecting");
      try {
        const connection = device.connect({ To: to, agent });
        setCall(connection);
        setStatus("in-call");
        connection.on("disconnect", () => {
          setStatus("disconnected");
          setCall(null);
        });
        connection.on("error", (err: any) => {
          setError(err.message || "Call error");
          setStatus("error");
          setCall(null);
        });
      } catch (err: any) {
        setError(err.message || "Call failed");
        setStatus("error");
      }
    },
    [device, agent]
  );

  // Hang up
  const hangUp = useCallback(() => {
    if (call && call.disconnect) {
      call.disconnect();
    }
    setStatus("idle");
    setCall(null);
  }, [call]);

  // Mute/unmute
  const mute = useCallback(
    (shouldMute: boolean) => {
      if (call && call.mute) {
        call.mute(shouldMute);
      }
    },
    [call]
  );

  // Cleanup on device change/unmount
  useEffect(() => {
    return () => {
      if (call && call.disconnect) call.disconnect();
    };
  }, [call]);

  return {
    status,
    error,
    call,
    callNumber,
    hangUp,
    mute,
  };
}