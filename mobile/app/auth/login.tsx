import React, { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { IconEye, IconEyeOff } from '@tabler/icons-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { useAuthStore, toast } from '@/store';
import {
  usePixelTheme,
  PixelButton,
  PixelTextInput,
  PixelWordmark,
} from '@/components/pixel';
import { ObsidianAuthScreenLive } from '@/components/obsidian';
import { isObsidianShellEnabled } from '@/lib/feature-flags';

export default function LoginRoute() {
  const router = useRouter();

  if (isObsidianShellEnabled()) {
    return (
      <ObsidianAuthScreenLive
        onAuthed={() => {
          // Opened from the tabs there's a screen to pop back to; reached via
          // the root auth guard there isn't, and the guard's own redirect to
          // "/" takes over once the token lands in the store.
          if (router.canGoBack()) router.back();
        }}
      />
    );
  }
  return <LoginScreenLegacy />;
}

function LoginScreenLegacy() {
  const theme = usePixelTheme();
  const router = useRouter();
  const { signIn, signUp, isLoading } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
          // Reached from the tabs there's a screen to pop back to; reached via
          // the root auth guard (redirect on a cold, unauthenticated start)
          // there isn't, so the guard's own redirect takes over instead.
          if (router.canGoBack()) router.back();
        }
      }
    } catch (error) {
      toast.error('Connection error');
    }
  };

  return (
    <SafeAreaWrapper edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: theme.bg1 }}
      >
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
          {/* Brand */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <PixelWordmark theme={theme} size={28} />
            <Text
              style={{
                fontFamily: theme.fontHead,
                fontSize: 9,
                color: theme.ink2,
                letterSpacing: 1.2,
                textAlign: 'center',
                marginTop: 12,
              }}
            >
              CAPTURE EVERYTHING, ANYWHERE
            </Text>
          </View>

          {/* Email */}
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 9,
              color: theme.ink2,
              letterSpacing: 1.2,
              marginBottom: 8,
              paddingHorizontal: 4,
            }}
          >
            EMAIL
          </Text>
          <PixelTextInput
            theme={theme}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Password */}
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 9,
              color: theme.ink2,
              letterSpacing: 1.2,
              marginTop: 18,
              marginBottom: 8,
              paddingHorizontal: 4,
            }}
          >
            PASSWORD
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <PixelTextInput
              theme={theme}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              containerStyle={{ flex: 1 }}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                marginLeft: 8,
                borderWidth: 2,
                borderColor: theme.border,
                backgroundColor: theme.surface,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ width: 18, height: 18 }}>
                {showPassword ? (
                  <IconEyeOff size={18} color={theme.ink} strokeWidth={2} />
                ) : (
                  <IconEye size={18} color={theme.ink} strokeWidth={2} />
                )}
              </View>
            </Pressable>
          </View>

          {/* Submit */}
          <View style={{ marginTop: 24 }}>
            <PixelButton
              theme={theme}
              big
              full
              bg={theme.semantic.success}
              color={theme.onAccent}
              label={
                isLoading
                  ? 'LOADING…'
                  : isRegister
                    ? 'CREATE ACCOUNT'
                    : 'SIGN IN'
              }
              onPress={isLoading ? undefined : handleSubmit}
              style={isLoading ? { opacity: 0.5 } : undefined}
            />
          </View>

          {/* Toggle register/login */}
          <Pressable
            onPress={() => setIsRegister(!isRegister)}
            style={({ pressed }) => ({
              alignItems: 'center',
              marginTop: 16,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: theme.fontBody,
                fontSize: 12,
                color: theme.ink2,
                textAlign: 'center',
              }}
            >
              {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            </Text>
            <Text
              style={{
                fontFamily: theme.fontHead,
                fontSize: 10,
                color: theme.accent,
                letterSpacing: 1,
                marginTop: 4,
              }}
            >
              {isRegister ? 'SIGN IN' : 'SIGN UP'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
