/**
 * Flow Hub — cross-tile inbox of pending Flow nodes. Mobile equivalent of
 * frontend/app/(dashboard)/flows/page.tsx.
 *
 * Four lifecycle-state filters (done / wait / undo / stop) drive the same
 * backend endpoint as the web. Default selection is "wait" — matches the web.
 * Tab labels and glyphs mirror the status decorators used inside the flow
 * nodes themselves, so the Hub is visually consistent with the inspector.
 *
 * Tapping a card opens the parent tile's FLOW view (deep-link to a specific
 * node selection isn't supported on mobile yet — see TODO at handleOpen).
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
import { IconRoute, IconClock } from '@tabler/icons-react-native';
import { useFlowHub } from '@/hooks/useFlowHub';
import { FLOW_STATE_COLORS } from '@/lib/flow-colors';
import { useThemeColors } from '@/lib/theme';
import type { FlowHubItem, FlowHubFilter, FlowNodeState } from '@/types';

const TABS: Array<{ key: FlowHubFilter; label: string; tint: string }> = [
  { key: 'done', label: 'DONE', tint: FLOW_STATE_COLORS.done },
  { key: 'wait', label: 'WAIT', tint: FLOW_STATE_COLORS.wait },
  { key: 'undo', label: 'UNDO', tint: FLOW_STATE_COLORS.undo },
  { key: 'stop', label: 'STOP', tint: FLOW_STATE_COLORS.stop },
];

const EMPTY_HINTS: Record<FlowHubFilter, string> = {
  done: 'I nodi marcati come "Fatto" compariranno qui',
  wait: 'I nodi marcati come "In attesa" compariranno qui',
  undo: 'I nodi marcati come "Annullato" compariranno qui',
  stop: 'I nodi marcati come "Bloccato" compariranno qui',
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
  const [filter, setFilter] = useState<FlowHubFilter>('wait');
  const { items, isLoading, isError, refetch } = useFlowHub(filter);

  const handleOpen = (item: FlowHubItem) => {
    router.push(`/tile/${item.tile.id}/flow` as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background1 }}>
      {/* Filter tabs — 4 lifecycle decorators. Each tab uses the same status
          glyph that decorates a flow node in that state. */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}
        >
          {TABS.map((tab) => {
            const isActive = filter === tab.key;
            const tabColor = isActive ? tab.tint : colors.tertiary;
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
                  borderRadius: 6,
                  backgroundColor: isActive ? colors.surfaceVariant : 'transparent',
                }}
              >
                <StateGlyph state={tab.key} color={tabColor} size={13} />
                <Text style={{ fontSize: 12, fontWeight: '500', color: tabColor }}>
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
          <IconRoute size={32} color={colors.tertiary} />
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
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <FlowItemCard item={item} colors={colors} onPress={() => handleOpen(item)} />
          )}
          ListFooterComponent={
            <Text
              style={{
                fontSize: 11,
                color: colors.tertiary,
                textAlign: 'center',
                marginTop: 16,
              }}
            >
              {items.length} {items.length === 1 ? 'flusso' : 'flussi'}
            </Text>
          }
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

/**
 * 3-column layout matching the frontend FlowItemCard:
 *   col 1 — tag (top, caps) + tile title (bottom)
 *   col 2 — node label (top) + contact pill (bottom)
 *   col 3 — mini badge (spans both rows)
 */
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
  const isDue =
    item.scheduled_at && new Date(item.scheduled_at).getTime() < Date.now();
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
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* Column 1 — tag (top) + tile title (bottom) */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 10,
              letterSpacing: 1.2,
              color: colors.tertiary,
              textTransform: 'uppercase',
            }}
          >
            {item.tile.tag?.name || ' '}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: colors.primary,
              marginTop: 2,
            }}
          >
            {item.tile.title || '(senza titolo)'}
          </Text>
        </View>

        {/* Column 2 — node label (top) + contact pill (bottom) */}
        <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 4 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              color: item.label?.trim() ? colors.secondary : colors.tertiary,
              fontStyle: item.label?.trim() ? 'normal' : 'italic',
            }}
          >
            {item.label?.trim() || '(senza etichetta)'}
          </Text>
          {item.contact ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: '#52525B',
                maxWidth: '100%',
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  color: item.contact.color || '#D4D4D8',
                }}
              >
                {item.contact.is_self
                  ? `[ ${item.contact.name} ]`
                  : item.contact.name}
              </Text>
            </View>
          ) : (
            // Invisible placeholder keeps row height stable across cards.
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: 'transparent',
              }}
            >
              <Text style={{ fontSize: 11, color: 'transparent' }}>—</Text>
            </View>
          )}
        </View>

        {/* Column 3 — mini badge (square = self, circle = other) */}
        <FlowMiniBadge isSelf={isSelf} state={item.state} />
      </View>

      {/* Secondary metadata — schedule date / age / occurred_at — only when
          something is present. Matches the frontend's bottom row. */}
      {(scheduled || (!scheduled && item.days_since_activity > 0) || occurred) && (
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
          numberOfLines={2}
          style={{ fontSize: 12, color: colors.secondary, marginTop: 8 }}
        >
          {item.notes}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/**
 * Square (self) or circle (other) node body with the inline status glyph.
 * Mirrors the web FlowMiniBadge exactly (radius 16, same body fill/stroke).
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

/** Compact status glyph used inside the filter tabs — same proportions as
 *  the inspector's status icons, sized to 13px by default for inline use. */
function StateGlyph({
  state,
  color,
  size = 13,
}: {
  state: Exclude<FlowNodeState, 'active'>;
  color: string;
  size?: number;
}) {
  const half = size / 2;
  return (
    <Svg width={size} height={size}>
      <StatusGlyph state={state} color={color} cx={half} cy={half} size={size} />
    </Svg>
  );
}

/** Inline status glyph paths — port of frontend StatusIcon. Re-implemented
 *  here so the Hub doesn't pull the entire graph layout module. */
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
