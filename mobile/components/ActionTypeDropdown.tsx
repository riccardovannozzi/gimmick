import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal as RNModal, TouchableWithoutFeedback } from 'react-native';
import { IconCircle, IconBolt, IconClock, IconCalendar, IconCheck } from '@tabler/icons-react-native';
import { useThemeColors } from '@/lib/theme';
import type { ActionType } from '@/types';

const OPTIONS: { value: ActionType; label: string; icon: typeof IconCircle; color: string }[] = [
  { value: 'none', label: 'Appunto', icon: IconCircle, color: '#9CA3AF' },
  { value: 'anytime', label: 'Da fare', icon: IconBolt, color: '#4ADE80' },
  { value: 'deadline', label: 'Scadenza', icon: IconClock, color: '#FBBF24' },
  { value: 'event', label: 'Evento', icon: IconCalendar, color: '#60A5FA' },
];

interface ActionTypeDropdownProps {
  value: ActionType;
  onSelect: (type: ActionType) => void;
  subtitle?: string;
}

export function ActionTypeDropdown({ value, onSelect, subtitle }: ActionTypeDropdownProps) {
  const [open, setOpen] = useState(false);
  const colors = useThemeColors();
  const current = OPTIONS.find((o) => o.value === value) || OPTIONS[0];
  const Icon = current.icon;

  return (
    <View>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{ flexDirection: 'column', gap: 2 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon size={14} color={current.color} />
          <Text style={{ fontSize: 13, color: current.color, fontWeight: '500' }}>
            {current.label} ▾
          </Text>
        </View>
        {subtitle ? (
          <Text style={{ fontSize: 11, color: colors.tertiary }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </TouchableOpacity>

      <RNModal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: colors.background2, borderRadius: 16, width: '100%', maxWidth: 260, overflow: 'hidden' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
                  Tipo azione
                </Text>
                {OPTIONS.map((opt) => {
                  const OptIcon = opt.icon;
                  const isActive = value === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => {
                        setOpen(false);
                        onSelect(opt.value);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        gap: 10,
                        backgroundColor: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                      }}
                    >
                      <OptIcon size={18} color={opt.color} />
                      <Text style={{ flex: 1, fontSize: 14, color: colors.primary }}>{opt.label}</Text>
                      {isActive && <IconCheck size={16} color="#60A5FA" />}
                    </TouchableOpacity>
                  );
                })}
                <View style={{ height: 8 }} />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </RNModal>
    </View>
  );
}
