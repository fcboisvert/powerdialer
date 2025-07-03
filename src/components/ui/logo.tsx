
import React from 'react';

interface LogoProps {
  variant?: 'text' | 'icon' | 'full';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Logo = ({ variant = 'text', size = 'md', className = '' }: LogoProps) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-lg';
      case 'lg':
        return 'text-3xl';
      default:
        return 'text-2xl';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return { main: 'w-5 h-5', accent: 'w-3 h-3', base: 'w-5 h-1.5' };
      case 'lg':
        return { main: 'w-8 h-8', accent: 'w-6 h-6', base: 'w-8 h-3' };
      default:
        return 'w-6 h-6';
    }
  };

  const iconSizes = getIconSize();

  if (variant === 'icon') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="relative">
          {/* Main circle */}
          <div className={`${typeof iconSizes === 'string' ? iconSizes : iconSizes.main} bg-texion-orange rounded-full`}></div>
          {/* Top right accent */}
          <div className={`absolute -top-1 -right-1 ${typeof iconSizes === 'string' ? 'w-4 h-4' : iconSizes.accent} bg-texion-orange rounded-sm`}></div>
          {/* Bottom left accent */}
          <div className={`absolute -bottom-1 left-1 ${typeof iconSizes === 'string' ? 'w-4 h-2' : iconSizes.base} bg-texion-orange rounded-b-full`}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {variant === 'full' && (
        <div className="relative">
          {/* Main circle */}
          <div className={`${typeof iconSizes === 'string' ? iconSizes : iconSizes.main} bg-texion-orange rounded-full`}></div>
          {/* Top right accent */}
          <div className={`absolute -top-1 -right-1 ${typeof iconSizes === 'string' ? 'w-4 h-4' : iconSizes.accent} bg-texion-orange rounded-sm`}></div>
          {/* Bottom left accent */}
          <div className={`absolute -bottom-1 left-1 ${typeof iconSizes === 'string' ? 'w-4 h-2' : iconSizes.base} bg-texion-orange rounded-b-full`}></div>
        </div>
      )}
      <span className={`font-texion font-semibold text-texion-black ${getSizeClasses()} tracking-tight`}>
        texion
      </span>
    </div>
  );
};

export default Logo;
