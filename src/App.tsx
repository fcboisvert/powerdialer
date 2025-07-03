import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
// If you use Sonner (notifications), uncomment below
// import { Toaster as Sonner } from "./components/ui/sonner";

import Login from "./pages/Login";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

export default function App() {
  const [agent, setAgent] = useState(() => localStorage.getItem("texion_agent") || "");

  // Handles both setting state and localStorage
  const handleLogin = (username: string, password: string) => {
    // TODO: implement real authentication logic if needed
    localStorage.setItem("texion_agent", username);
    setAgent(username);
  };

  const handleLogout = () => {
    localStorage.removeItem("texion_agent");
    setAgent("");
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {/* <Sonner /> */}
        <BrowserRouter>
          <Routes>
            {!agent ? (
              <Route path="/*" element={<Login onLogin={handleLogin} />} />
            ) : (
              <Route path="/*" element={<Index agent={agent} onLogout={handleLogout} />} />
            )}
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}