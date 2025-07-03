import React from "react";
import PowerDialer from "../components/PowerDialer";

type IndexProps = {
  agent: string;
  onLogout: () => void;
};

export default function Index({ agent, onLogout }: IndexProps) {
  return (
    <div>
      <div style={{ color: "#888", fontSize: 12, margin: "16px 0" }}>
        Index page loaded ({agent})
      </div>
      <PowerDialer agent={agent} onLogout={onLogout} />
    </div>
  );
}