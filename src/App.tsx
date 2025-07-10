import React, { useState, useEffect, useCallback, createContext } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
import CallWebhookHandler from "./components/CallWebhookHandler";
import Login from "./pages/Login";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// You can type TwilioDevice more specifically if you want
export const TwilioDeviceContext = createContext<any>(null);

const queryClient = new QueryClient();

export default function App() {
  const [agent, setAgent] = useState(() => localStorage.getItem("texion_agent") || "");
  const [twilioDevice, setTwilioDevice] = useState<any>(null);

  // Handles login logic
  const handleLogin = useCallback((username: string, password: string) => {
    localStorage.setItem("texion_agent", username);
    setAgent(username);
  }, []);

  // Handles logout and cleanup
  const handleLogout = useCallback(() => {
    localStorage.removeItem("texion_agent");
    setAgent("");
    if (twilioDevice && twilioDevice.destroy) {
      twilioDevice.destroy();
    }
    setTwilioDevice(null);
  }, [twilioDevice]);

  // Initialize Twilio Device after login
  useEffect(() => {
    // Only initialize after agent is set
    if (!agent) {
      if (twilioDevice && twilioDevice.destroy) {
        twilioDevice.destroy();
        setTwilioDevice(null);
      }
      return;
    }
    let isMounted = true;

    async function initTwilio() {
      try {
        if (!(window as any).Twilio || !(window as any).Twilio.Device) {
          console.error("Twilio SDK not loaded!");
          return;
        }
        // Fetch token for this agent
        const resp = await fetch(`https://almond-mouse-3471.twil.io/token-public?agent=${agent}`);
        const data = await resp.json();
        if (!data.token) throw new Error("No Twilio token received");

        // Create new Twilio.Device
        const device = new (window as any).Twilio.Device(data.token, { debug: true });

        // Setup event listeners
        device.on("ready", () => {
          console.log("Twilio Device ready");
        });
        device.on("error", (error: any) => {
          console.error("Twilio Device error:", error);
        });
        device.on("disconnect", () => {
          console.log("Twilio: Call disconnected");
        });
        device.on("connect", () => {
          console.log("Twilio: Call connected");
        });

        if (isMounted) setTwilioDevice(device);
      } catch (err) {
        console.error("Twilio init failed:", err);
        setTwilioDevice(null);
      }
    }

    initTwilio();

    // Cleanup on logout or agent change
    return () => {
      isMounted = false;
      if (twilioDevice && twilioDevice.destroy) twilioDevice.destroy();
      setTwilioDevice(null);
    };
    // eslint-disable-next-line
  }, [agent]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <TwilioDeviceContext.Provider value={twilioDevice}>
          <CallWebhookHandler />
          <BrowserRouter>
            <Routes>
              {!agent ? (
                <Route path="/*" element={<Login onLogin={handleLogin} />} />
              ) : (
                <Route
                  path="/*"
                  element={<Index agent={agent} onLogout={handleLogout} />}
                />
              )}
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </BrowserRouter>
        </TwilioDeviceContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}