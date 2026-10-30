import React from 'react';
import omLogoOrb from '../assets/om-logo-orb.svg';

interface OmLogoMarkProps {
  className?: string;
}

export const OmLogoMark: React.FC<OmLogoMarkProps> = ({ className = '' }) => (
  <span className={`om-logo-mark ${className}`} aria-hidden="true">
    <img src={omLogoOrb} alt="" />
  </span>
);
