import React from 'react';

// Import the SVG as a React component (Vite/CRA compatible)
import { ReactComponent as TexionLogoSVG } from '/texion-logo.svg'; // Use '?react' for Vite if needed

interface LogoProps {
  variant?: 'text' | 'icon' | 'full';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Logo component. Now uses texion-logo.svg for icon/full variants.
 * - 'icon': just the SVG
 * - 'full': SVG + text
 * - 'text': just the text
 */
const Logo = ({ variant = 'text', size = 'md', className = '' }: LogoProps) => {
  // Sizes for the SVG and text
  const getSvgSize = () => {
    switch (size) {
      case 'sm':
        return 28;
      case 'lg':
        return 48;
      default:
        return 36;
    }
  };

  const getTextClass = () => {
    switch (size) {
      case 'sm':
        return 'text-lg';
      case 'lg':
        return 'text-3xl';
      default:
        return 'text-2xl';
    }
  };

  if (variant === 'icon') {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <TexionLogoSVG width={getSvgSize()} height={getSvgSize()} />
      </span>
    );
  }

  if (variant === 'full') {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <TexionLogoSVG width={getSvgSize()} height={getSvgSize()} />
        <span className={`font-texion font-semibold text-texion-black ${getTextClass()} tracking-tight`}>
          texion
        </span>
      </span>
    );
  }

  // fallback: text only
  return (
    <span className={`font-texion font-semibold text-texion-black ${getTextClass()} tracking-tight ${className}`}>
      texion
    </span>
  );
};

export default Logo;