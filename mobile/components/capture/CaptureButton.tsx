import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store';
import { usePixelTheme, PixelBadge } from '@/components/pixel';

interface CaptureButtonProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  count?: number;
}

export function CaptureButton({
  icon,
  label,
  color,
  onPress,
  disabled = false,
  count = 0,
}: CaptureButtonProps) {
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);
  const theme = usePixelTheme();

  const handlePress = async () => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  const size = 72;

  return (
    <View style={{ flex: 1, alignItems: 'center', opacity: disabled ? 0.5 : 1 }}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <View
          style={{
            width: size,
            height: size,
            borderWidth: 2,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {React.cloneElement(icon as React.ReactElement<any>, {
            size: 30,
            color: color,
            strokeWidth: 1.8,
          })}

          {count > 0 && (
            <View style={{ position: 'absolute', top: -2, right: -2 }}>
              <PixelBadge
                theme={theme}
                label={String(count)}
                bg={color}
                color={theme.onAccent}
              />
            </View>
          )}
        </View>
      </Pressable>

      <Text
        numberOfLines={1}
        style={{
          marginTop: 6,
          fontFamily: theme.fontHead,
          fontSize: 8,
          color: theme.ink,
          letterSpacing: 1,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
