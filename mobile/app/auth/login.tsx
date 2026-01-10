import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { useAuthStore, toast } from '@/store';
import { colors } from '@/constants';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp, isLoading } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) {
      toast.warning('Inserisci email e password');
      return;
    }

    if (password.length < 6) {
      toast.warning('La password deve avere almeno 6 caratteri');
      return;
    }

    try {
      if (isRegister) {
        const result = await signUp(email, password);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success('Account creato! Ora puoi accedere.');
          setIsRegister(false);
        }
      } else {
        const result = await signIn(email, password);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success('Login effettuato!');
          router.back();
        }
      }
    } catch (error) {
      toast.error('Errore di connessione');
    }
  };

  return (
    <SafeAreaWrapper edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-4 border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text className="text-primary text-xl font-bold">
            {isRegister ? 'Registrati' : 'Accedi'}
          </Text>
        </View>

        <View className="flex-1 px-4 pt-8">
          {/* Email */}
          <View className="mb-4">
            <Text className="text-secondary text-sm mb-2">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="nome@esempio.com"
              placeholderTextColor={colors.secondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-background-2 text-primary px-4 py-3 rounded-lg border border-border"
            />
          </View>

          {/* Password */}
          <View className="mb-6">
            <Text className="text-secondary text-sm mb-2">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.secondary}
              secureTextEntry
              className="bg-background-2 text-primary px-4 py-3 rounded-lg border border-border"
            />
          </View>

          {/* Submit button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            className="bg-accent py-4 rounded-lg items-center"
            style={{ opacity: isLoading ? 0.6 : 1 }}
          >
            <Text className="text-white font-semibold text-base">
              {isLoading ? 'Caricamento...' : isRegister ? 'Registrati' : 'Accedi'}
            </Text>
          </TouchableOpacity>

          {/* Toggle register/login */}
          <TouchableOpacity
            onPress={() => setIsRegister(!isRegister)}
            className="mt-6 items-center"
          >
            <Text className="text-secondary">
              {isRegister ? 'Hai già un account? ' : 'Non hai un account? '}
              <Text className="text-accent">
                {isRegister ? 'Accedi' : 'Registrati'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
