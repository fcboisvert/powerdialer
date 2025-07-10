import React from "react";
import PowerDialer from "../components/PowerDialer";

type IndexProps = {
  agent: string;
  onLogout: () => void;
};

export default function Index({ agent, onLogout }: IndexProps) {
  return (
    <div className="min-h-screen">
      {/* PowerDialer handles its own agent and logout logic */}
      <PowerDialer />
    </div>
  );
}