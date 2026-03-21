import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { IconClock, IconCalendar, IconCheck, IconX } from '@tabler/icons-react-native';
import { useThemeColors } from '@/lib/theme';
import type { ActionType } from '@/types';

interface ActionTypePickerProps {
  visible: boolean;
  mode: 'deadline' | 'event';
  initialDate?: Date;
  initialEndDate?: Date;
  initialAllDay?: boolean;
  onConfirm: (data: {
    action_type: ActionType;
    start_at: string;
    end_at?: string;
    all_day?: boolean;
  }) => void;
  onCancel: () => void;
}

const DURATION_OPTIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '1h 30m', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 },
  { label: '4h', minutes: 240 },
];

export function ActionTypePicker({
  visible,
  mode,
  initialDate,
  initialEndDate,
  initialAllDay,
  onConfirm,
  onCancel,
}: ActionTypePickerProps) {
  const colors = useThemeColors();
  const bottomSheetRef = useRef<BottomSheet>(null);

  const [allDay, setAllDay] = useState(initialAllDay ?? false);
  const [durationMinutes, setDurationMinutes] = useState(() => {
    if (initialDate && initialEndDate) {
      return Math.round((initialEndDate.getTime() - initialDate.getTime()) / 60000);
    }
    return 60;
  });

  // Simple day navigation
  const [dayOffset, setDayOffset] = useState(0);
  const [hourStr, setHourStr] = useState(() => {
    const d = initialDate || new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const displayDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset]);

  const snapPoints = useMemo(() => (mode === 'deadline' ? ['40%'] : ['55%']), [mode]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    []
  );

  const handleConfirm = () => {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + dayOffset);

    if (mode === 'deadline') {
      baseDate.setHours(23, 59, 59, 0);
      onConfirm({
        action_type: 'deadline',
        start_at: baseDate.toISOString(),
        all_day: true,
      });
    } else {
      if (!allDay) {
        const [h, m] = hourStr.split(':').map(Number);
        baseDate.setHours(h || 9, m || 0, 0, 0);
      } else {
        baseDate.setHours(0, 0, 0, 0);
      }
      const endAt = new Date(baseDate.getTime() + durationMinutes * 60000);
      onConfirm({
        action_type: 'event',
        start_at: baseDate.toISOString(),
        end_at: endAt.toISOString(),
        all_day: allDay,
      });
    }
  };

  const formatDisplayDate = (d: Date) =>
    d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

  if (!visible) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onCancel}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.background2 }}
      handleIndicatorStyle={{ backgroundColor: colors.tertiary }}
    >
      <BottomSheetView style={{ flex: 1, paddingHorizontal: 20 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {mode === 'deadline' ? (
              <IconClock size={20} color="#FBBF24" />
            ) : (
              <IconCalendar size={20} color="#60A5FA" />
            )}
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.primary }}>
              {mode === 'deadline' ? 'Scadenza' : 'Evento'}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancel} hitSlop={8}>
            <IconX size={20} color={colors.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Date selector — simple day navigation */}
        <Text style={{ fontSize: 13, color: colors.tertiary, marginBottom: 6 }}>Data</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setDayOffset(dayOffset - 1)}
            style={{ backgroundColor: colors.surfaceVariant, borderRadius: 8, padding: 10 }}
          >
            <Text style={{ color: colors.primary, fontSize: 16 }}>{'<'}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, backgroundColor: colors.surfaceVariant, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 15, color: colors.primary }}>{formatDisplayDate(displayDate)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setDayOffset(dayOffset + 1)}
            style={{ backgroundColor: colors.surfaceVariant, borderRadius: 8, padding: 10 }}
          >
            <Text style={{ color: colors.primary, fontSize: 16 }}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        {/* Event-specific: time + duration */}
        {mode === 'event' && (
          <>
            {/* All day toggle */}
            <TouchableOpacity
              onPress={() => setAllDay(!allDay)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}
            >
              <View
                style={{
                  width: 22, height: 22, borderRadius: 6,
                  borderWidth: 1.5,
                  borderColor: allDay ? '#60A5FA' : colors.tertiary,
                  backgroundColor: allDay ? '#60A5FA' : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {allDay && <IconCheck size={14} color="#fff" />}
              </View>
              <Text style={{ fontSize: 14, color: colors.primary }}>Tutto il giorno</Text>
            </TouchableOpacity>

            {/* Time input (hidden when all-day) */}
            {!allDay && (
              <>
                <Text style={{ fontSize: 13, color: colors.tertiary, marginBottom: 6 }}>Ora (HH:MM)</Text>
                <TextInput
                  value={hourStr}
                  onChangeText={setHourStr}
                  placeholder="09:00"
                  placeholderTextColor={colors.tertiary}
                  keyboardType="numbers-and-punctuation"
                  style={{
                    backgroundColor: colors.surfaceVariant,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    marginBottom: 12,
                    fontSize: 15,
                    color: colors.primary,
                  }}
                />

                {/* Duration chips */}
                <Text style={{ fontSize: 13, color: colors.tertiary, marginBottom: 6 }}>Durata</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {DURATION_OPTIONS.map((opt) => {
                    const isActive = durationMinutes === opt.minutes;
                    return (
                      <TouchableOpacity
                        key={opt.minutes}
                        onPress={() => setDurationMinutes(opt.minutes)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
                          backgroundColor: isActive ? 'rgba(96,165,250,0.2)' : colors.surfaceVariant,
                          borderWidth: isActive ? 1 : 0, borderColor: '#60A5FA',
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '500', color: isActive ? '#60A5FA' : colors.secondary }}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}

        {/* Confirm button */}
        <TouchableOpacity
          onPress={handleConfirm}
          style={{
            backgroundColor: mode === 'deadline' ? '#FBBF24' : '#60A5FA',
            borderRadius: 12, paddingVertical: 14, alignItems: 'center',
            marginTop: mode === 'deadline' ? 8 : 0,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#000' }}>Conferma</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
}
