// src/types/globals.d.ts

/** Allow `import './something.css'` */
declare module '*.css' {
  const classes: Record<string, string>;
  export default classes;
}

/** Allow `import Logo from './logo.svg'` (Vite returns the URL as string) */
declare module '*.svg' {
  const url: string;
  export default url;
}

/** Absolute-path import used in logo.tsx */
declare module '/texion-logo.svg' {
  const url: string;
  export default url;
}
