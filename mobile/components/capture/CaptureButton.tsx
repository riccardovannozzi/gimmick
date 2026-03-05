import React from 'react';
import { TouchableOpacity, Text, View, Platform } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop, Rect as SvgRect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store';
import { useThemeColors } from '@/lib/theme';

interface CaptureButtonProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  count?: number;
  isSvg?: boolean;
}

export function CaptureButton({
  icon,
  label,
  color,
  onPress,
  disabled = false,
  count = 0,
  isSvg = false,
}: CaptureButtonProps) {
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);
  const colors = useThemeColors();

  const handlePress = async () => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  const size = 96;
  const strokeW = 3;
  const radius = (size - strokeW) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.5; // 50% of circle

  return (
    <View className={`flex-1 items-center ${disabled ? 'opacity-50' : ''}`}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.85}
        className="items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.background2,
          borderWidth: 1,
          borderColor: colors.primary,
          ...Platform.select({
            ios: {
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 3,
            },
            android: {
              elevation: 1,
            },
          }),
        }}
      >
        {/* Gradient fill + thick arc accent */}
        <Svg
          width={size}
          height={size}
          style={{ position: 'absolute' }}
        >
          <Defs>
            <RadialGradient id={`grad-${label}`} cx="70%" cy="35%" r="65%">
              <Stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <Stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </RadialGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 1}
            fill={`url(#grad-${label})`}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.primary}
            strokeWidth={strokeW}
            fill="none"
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            strokeDashoffset={circumference * 0.25}
            strokeLinecap="round"
          />
        </Svg>

        {/* Badge */}
        {count > 0 && (() => {
          const badgeSize = 36;
          const badgeR = (badgeSize - 2) / 2;
          const badgeCirc = 2 * Math.PI * badgeR;
          const badgeArc = badgeCirc * 0.5;
          return (
            <View
              className="absolute -top-2 -right-2 z-10 items-center justify-center"
              style={{ width: badgeSize, height: badgeSize }}
            >
              <Svg width={badgeSize} height={badgeSize} style={{ position: 'absolute' }}>
                <Defs>
                  <RadialGradient id={`badge-${label}`} cx="70%" cy="35%" r="65%">
                    <Stop offset="0%" stopColor={color} stopOpacity={0.45} />
                    <Stop offset="100%" stopColor={color} stopOpacity={0.05} />
                  </RadialGradient>
                </Defs>
                <Circle cx={badgeSize / 2} cy={badgeSize / 2} r={badgeSize / 2 - 1} fill={`url(#badge-${label})`} />
                <Circle
                  cx={badgeSize / 2}
                  cy={badgeSize / 2}
                  r={badgeR}
                  stroke={colors.primary}
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray={`${badgeArc} ${badgeCirc - badgeArc}`}
                  strokeDashoffset={badgeCirc * 0.25}
                  strokeLinecap="round"
                />
              </Svg>
              <View
                style={{
                  width: badgeSize,
                  height: badgeSize,
                  borderRadius: badgeSize / 2,
                  backgroundColor: colors.background2,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: 'bold' }}>{count}</Text>
              </View>
            </View>
          );
        })()}

        {/* Icon */}
        {React.cloneElement(icon as React.ReactElement<any>, isSvg ? {
          width: 32,
          height: 32,
          stroke: colors.primary,
          strokeWidth: 1.8,
        } : {
          size: 32,
          color: colors.primary,
          strokeWidth: 1.8,
        })}
      </TouchableOpacity>
    </View>
  );
}
