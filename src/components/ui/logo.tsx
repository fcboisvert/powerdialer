// src/components/ui/Logo.tsx
import React from "react";

interface LogoProps {
  variant?: "text" | "icon" | "full";
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Logo component (robust for Vite, CRA, Cloudflare, etc.)
 * - 'icon': SVG logo only
 * - 'full': SVG + "texion" text
 * - 'text': just "texion"
 */
const Logo = ({
  variant = "text",
  size = "md",
  className = "",
}: LogoProps) => {
  // Map size prop to px for img, and text size for the wordmark
  const svgPx =
    size === "sm" ? 28 : size === "lg" ? 48 : 36;
  const textClass =
    size === "sm"
      ? "text-lg"
      : size === "lg"
      ? "text-3xl"
      : "text-2xl";

  if (variant === "icon") {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <img
          src="/texion-logo.svg"
          alt="Texion logo"
          width={svgPx}
          height={svgPx}
          style={{ display: "block" }}
        />
      </span>
    );
  }

  if (variant === "full") {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <img
          src="/texion-logo.svg"
          alt="Texion logo"
          width={svgPx}
          height={svgPx}
          style={{ display: "block" }}
        />
        <span
          className={`font-texion font-semibold text-texion-black ${textClass} tracking-tight`}
        >
          texion
        </span>
      </span>
    );
  }

  // fallback: text only
  return (
    <span
      className={`font-texion font-semibold text-texion-black ${textClass} tracking-tight ${className}`}
    >
      texion
    </span>
  );
};

export default Logo;
