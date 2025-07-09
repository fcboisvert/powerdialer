// src/types/globals.d.ts

// Type for importing CSS modules (for TypeScript + Vite strict mode)
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

// Universal (non-modular) CSS import fallback
declare module "*.css";

// Type for SVG imports as URL/string (for <img src=...>)
declare module "*.svg" {
  const content: string;
  export default content;
}

// Explicit declaration for your logo import if used directly
declare module "/texion-logo.svg" {
  const content: string;
  export default content;
}
