import { Ionicons } from '@expo/vector-icons';

interface AppleIconProps {
  size?: number;
  color?: string;
}

export function AppleIcon({ size = 20, color = '#000' }: AppleIconProps) {
  return <Ionicons name="logo-apple" size={size} color={color} />;
}
