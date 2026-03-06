import React from 'react';
import { SvgProps } from 'react-native-svg';

interface SvgIconProps extends SvgProps {
  icon: React.FC<SvgProps>;
  size?: number;
  color?: string;
}

export function SvgIcon({ icon: Icon, size = 24, color, ...props }: SvgIconProps) {
  return <Icon width={size} height={size} fill={color} {...props} />;
}
