import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { Clock } from 'lucide-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { colors } from '@/constants';

export default function HistoryScreen() {
  // TODO: Fetch memos from Supabase

  return (
    <SafeAreaWrapper edges={['top']}>
      <View className="flex-1">
        {/* Header */}
        <View className="px-4 py-4 border-b border-border">
          <Text className="text-primary text-xl font-bold">Storico</Text>
        </View>

        {/* Empty state */}
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-background-2 items-center justify-center mb-4">
            <Clock size={40} color={colors.secondary} />
          </View>
          <Text className="text-primary text-lg font-medium text-center mb-2">
            Nessun memo salvato
          </Text>
          <Text className="text-secondary text-sm text-center">
            I memo che caricherai appariranno qui
          </Text>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
