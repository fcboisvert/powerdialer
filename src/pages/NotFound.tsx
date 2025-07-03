import React from "react";

export default function NotFound() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      marginTop: 100,
      color: "#b33",
      fontFamily: "system-ui, sans-serif"
    }}>
      <h1 style={{ fontSize: "3em", marginBottom: 0 }}>404</h1>
      <p style={{ fontSize: "1.5em" }}>Page not found</p>
      <a href="/" style={{ color: "#1e73be", textDecoration: "underline" }}>Go Home</a>
    </div>
  );
}