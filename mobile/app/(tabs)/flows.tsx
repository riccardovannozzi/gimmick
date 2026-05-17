/**
 * Flow Hub — cross-tile inbox of pending Flow nodes. Mobile equivalent of
 * frontend/app/(dashboard)/flows/page.tsx.
 *
 * Five filter tabs (mine / theirs / due_soon / stalled / blocked) drive the
 * same backend endpoint as the web. Tap a card → open the parent tile's FLOW
 * view with that node pre-selected.
 *
 * NOTE: deep-linking to a specific node selection inside the tile's FLOW
 * screen isn't supported yet by the mobile FLOW screen (it auto-selects the
 * first node). For now the card just navigates to the tile — port `?flow=`
 * if/when needed.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Rect, Circle, Path } from 'react-native-svg';
import {
  IconRoute,
  IconClock,
  IconUserCheck,
  IconUserOff,
  IconHourglassHigh,
  IconLock,
} from '@tabler/icons-react-native';
import { useFlowHub } from '@/hooks/useFlowHub';
import { FLOW_STATE_COLORS, FLOW_STATE_LABELS } from '@/lib/flow-colors';
import { useThemeColors } from '@/lib/theme';
import type { FlowHubItem, FlowHubFilter, FlowNodeState } from '@/types';

const TABS: Array<{
  key: FlowHubFilter;
  label: string;
  icon: typeof IconClock;
  tint: string;
}> = [
  { key: 'mine', label: 'Palla mia', icon: IconUserCheck, tint: '#378ADD' },
  { key: 'theirs', label: 'Loro', icon: IconUserOff, tint: '#EF9F27' },
  { key: 'due_soon', label: 'Scadenza', icon: IconClock, tint: '#A78BFA' },
  { key: 'stalled', label: 'Fermi', icon: IconHourglassHigh, tint: '#94A3B8' },
  { key: 'blocked', label: 'Bloccati', icon: IconLock, tint: '#E24B4A' },
];

const EMPTY_HINTS: Record<FlowHubFilter, string> = {
  mine: 'Quando avrai dei task aperti tocca a te qui appariranno',
  theirs: 'Le palle in mano agli altri compariranno qui',
  due_soon: 'I task pianificati nelle prossime 48h compariranno qui',
  stalled: 'I nodi marcati come "In attesa" compariranno qui',
  blocked: 'I nodi marcati come "Bloccato" compariranno qui',
};

function isItemSelf(item: FlowHubItem): boolean {
  return !item.contact || item.contact.is_self;
}

function formatScheduled(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function FlowsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [filter, setFilter] = useState<FlowHubFilter>('mine');
  const { items, isLoading, isError, refetch } = useFlowHub(filter);

  const handleOpen = (item: FlowHubItem) => {
    router.push(`/tile/${item.tile.id}/flow` as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background1 }}>
      {/* Page title + sub */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 10,
        }}
      >
        <IconRoute size={20} color="#60A5FA" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: colors.primary }}>
            Flow Hub
          </Text>
          <Text style={{ fontSize: 11, color: colors.tertiary, marginTop: 1 }}>
            Inbox dei flussi pendenti, aggregati da tutti i tile
          </Text>
        </View>
      </View>

      {/* Filter tabs — horizontal scroller because 5 buttons don't fit on
          narrow phones in a single fixed-width row. */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setFilter(tab.key)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isActive ? colors.surfaceVariant : 'transparent',
                }}
              >
                <Icon size={14} color={isActive ? tab.tint : colors.tertiary} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    color: isActive ? tab.tint : colors.tertiary,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={colors.tertiary} />
        </View>
      ) : isError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 13, color: '#EF4444' }}>Errore nel caricamento</Text>
          <TouchableOpacity
            onPress={() => refetch()}
            style={{
              marginTop: 12,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: colors.background2,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.primary }}>Riprova</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
        >
          <IconRoute size={36} color={colors.tertiary} />
          <Text
            style={{
              fontSize: 13,
              color: colors.tertiary,
              marginTop: 12,
              textAlign: 'center',
            }}
          >
            Nessun flusso in questa categoria
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: colors.tertiary,
              marginTop: 4,
              textAlign: 'center',
              lineHeight: 16,
            }}
          >
            {EMPTY_HINTS[filter]}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item }) => (
            <FlowItemCard item={item} colors={colors} onPress={() => handleOpen(item)} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => refetch()}
              tintColor={colors.tertiary}
            />
          }
        />
      )}
    </View>
  );
}

function FlowItemCard({
  item,
  colors,
  onPress,
}: {
  item: FlowHubItem;
  colors: any;
  onPress: () => void;
}) {
  const isSelf = isItemSelf(item);
  const ownerLabel = isSelf ? 'Palla mia' : item.contact?.name ?? 'Palla loro';
  const stateLabel = FLOW_STATE_LABELS[item.state];
  const pillLabel = item.state !== 'active' ? stateLabel : ownerLabel;
  const isDue = item.scheduled_at && new Date(item.scheduled_at).getTime() < Date.now();
  const scheduled = formatScheduled(item.scheduled_at);
  const occurred = formatDate(item.occurred_at);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        backgroundColor: colors.background2,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* Left: tag + title + node label + contact */}
        <View style={{ flex: 1, minWidth: 0 }}>
          {!!item.tile.tag?.name && (
            <Text
              style={{
                fontSize: 10,
                letterSpacing: 1.2,
                color: colors.tertiary,
                textTransform: 'uppercase',
              }}
              numberOfLines={1}
            >
              {item.tile.tag.name}
            </Text>
          )}
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: colors.primary,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {item.tile.title || '(senza titolo)'}
          </Text>

          <Text
            style={{
              fontSize: 12,
              color: colors.secondary,
              marginTop: 6,
            }}
            numberOfLines={1}
          >
            {item.label?.trim() || '(senza etichetta)'}
          </Text>
          {item.contact && (
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: '#52525B',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: item.contact.color || colors.secondary,
                }}
                numberOfLines={1}
              >
                {item.contact.is_self ? `[ ${item.contact.name} ]` : item.contact.name}
              </Text>
            </View>
          )}
        </View>

        {/* Right: mini badge (square = self, circle = other) */}
        <FlowMiniBadge isSelf={isSelf} state={item.state} />
      </View>

      {/* Secondary metadata */}
      {(scheduled || (!scheduled && item.days_since_activity > 0) || item.notes || occurred) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 8,
          }}
        >
          {scheduled && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <IconClock size={11} color={isDue ? '#EF4444' : colors.tertiary} />
              <Text style={{ fontSize: 11, color: isDue ? '#EF4444' : colors.tertiary }}>
                {scheduled}
              </Text>
            </View>
          )}
          {!scheduled && item.days_since_activity > 0 && (
            <Text style={{ fontSize: 11, color: colors.tertiary }}>
              {item.days_since_activity}g fa
            </Text>
          )}
          {occurred && (
            <Text style={{ fontSize: 11, color: colors.tertiary, marginLeft: 'auto' }}>
              {occurred}
            </Text>
          )}
        </View>
      )}

      {!!item.notes && (
        <Text
          style={{ fontSize: 12, color: colors.secondary, marginTop: 6 }}
          numberOfLines={2}
        >
          {item.notes}
        </Text>
      )}
      <Text style={{ fontSize: 10, color: colors.tertiary, marginTop: 6 }}>{pillLabel}</Text>
    </TouchableOpacity>
  );
}

/**
 * Square (self) or circle (other) node body with the inline status glyph.
 * Mirrors the web FlowMiniBadge.
 */
function FlowMiniBadge({
  isSelf,
  state,
}: {
  isSelf: boolean;
  state: FlowNodeState;
}) {
  const r = 16;
  const SIZE = r * 2 + 4;
  const half = SIZE / 2;
  const bodyFill = '#000000';
  const bodyStroke = '#FFFFFF';
  const statusColor = FLOW_STATE_COLORS[state];
  const useSquare = isSelf;

  return (
    <Svg width={SIZE} height={SIZE}>
      {useSquare ? (
        <Rect
          x={half - r}
          y={half - r}
          width={r * 2}
          height={r * 2}
          rx={4}
          fill={bodyFill}
          stroke={bodyStroke}
          strokeWidth={1}
        />
      ) : (
        <Circle cx={half} cy={half} r={r} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      )}
      {state !== 'active' && (
        <StatusGlyph
          state={state}
          color={statusColor}
          cx={half}
          cy={half}
          size={r * 1.2}
        />
      )}
    </Svg>
  );
}

/** Inline status glyph paths. Re-implemented here (rather than imported from
 *  VerticalFlowTrack) so the Hub doesn't pull the entire graph layout module
 *  for a single 32×32 badge. */
function StatusGlyph({
  state,
  color,
  cx,
  cy,
  size,
}: {
  state: Exclude<FlowNodeState, 'active'>;
  color: string;
  cx: number;
  cy: number;
  size: number;
}) {
  const s = size / 2;
  const sw = Math.max(1.6, size * 0.16);
  if (state === 'done') {
    return (
      <Path
        d={`M ${cx - s * 0.7},${cy} L ${cx - s * 0.15},${cy + s * 0.55} L ${cx + s * 0.75},${cy - s * 0.55}`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (state === 'wait') {
    return (
      <>
        <Path
          d={`M ${cx - s * 0.7},${cy - s * 0.75} L ${cx + s * 0.7},${cy - s * 0.75} L ${cx},${cy} Z`}
          fill={color}
        />
        <Path
          d={`M ${cx - s * 0.7},${cy + s * 0.75} L ${cx + s * 0.7},${cy + s * 0.75} L ${cx},${cy} Z`}
          fill={color}
        />
      </>
    );
  }
  if (state === 'undo') {
    return (
      <Path
        d={`M ${cx - s * 0.7},${cy + s * 0.7} L ${cx + s * 0.7},${cy - s * 0.7}`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    );
  }
  return (
    <>
      <Path
        d={`M ${cx - s * 0.65},${cy - s * 0.65} L ${cx + s * 0.65},${cy + s * 0.65}`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <Path
        d={`M ${cx + s * 0.65},${cy - s * 0.65} L ${cx - s * 0.65},${cy + s * 0.65}`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </>
  );
}
