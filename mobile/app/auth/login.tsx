import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { IconEye, IconEyeOff } from '@tabler/icons-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { useAuthStore, toast } from '@/store';
import { useThemeColors } from '@/lib/theme';

export default function LoginScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { signIn, signUp, isLoading } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      toast.warning('Enter email and password');
      return;
    }

    if (password.length < 6) {
      toast.warning('Password must be at least 6 characters');
      return;
    }

    try {
      if (isRegister) {
        const result = await signUp(email, password);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success('Account created! You can now sign in.');
          setIsRegister(false);
        }
      } else {
        const result = await signIn(email, password);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success('Login successful!');
          router.back();
        }
      }
    } catch (error) {
      toast.error('Connection error');
    }
  };

  const inputBorderColor = (focused: boolean) =>
    focused ? colors.accent : colors.border;

  return (
    <SafeAreaWrapper edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          {/* Brand */}
          <View className="items-center mb-12">
            <Text
              style={{
                fontSize: 36,
                fontWeight: '700',
                color: colors.accent,
                letterSpacing: -0.5,
              }}
            >
              Gimmick
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: colors.secondary,
                marginTop: 8,
              }}
            >
              Capture everything, anywhere
            </Text>
          </View>

          {/* Email field — filled style */}
          <View className="mb-4">
            <View
              style={{
                borderRadius: 16,
                backgroundColor: colors.background2,
                borderWidth: emailFocused ? 1 : 0,
                borderColor: colors.accent,
              }}
            >
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.tertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                style={{
                  color: colors.primary,
                  fontSize: 16,
                  paddingHorizontal: 20,
                  paddingVertical: 18,
                }}
              />
            </View>
          </View>

          {/* Password field — filled style */}
          <View className="mb-8">
            <View
              style={{
                borderRadius: 16,
                backgroundColor: colors.background2,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: passwordFocused ? 1 : 0,
                borderColor: colors.accent,
              }}
            >
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={colors.tertiary}
                secureTextEntry={!showPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                style={{
                  flex: 1,
                  color: colors.primary,
                  fontSize: 16,
                  paddingHorizontal: 20,
                  paddingVertical: 18,
                }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={{ paddingRight: 20 }}
              >
                {showPassword ? (
                  <IconEyeOff size={20} color={colors.secondary} />
                ) : (
                  <IconEye size={20} color={colors.secondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit button — Phantom vivid purple */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.8}
            style={{
              backgroundColor: colors.fabBg,
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: 'center',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                color: colors.onAccent,
                fontSize: 16,
                fontWeight: '600',
              }}
            >
              {isLoading ? 'Loading...' : isRegister ? 'Create Account' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {/* Toggle register/login */}
          <TouchableOpacity
            onPress={() => setIsRegister(!isRegister)}
            className="mt-6 items-center"
          >
            <Text style={{ color: colors.secondary, fontSize: 14 }}>
              {isRegister ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={{ color: colors.accent, fontWeight: '600' }}>
                {isRegister ? 'Sign in' : 'Sign up'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
