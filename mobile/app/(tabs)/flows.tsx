/**
 * Flow Hub — cross-tile inbox of pending Flow nodes. Mobile equivalent of
 * frontend/app/(dashboard)/flows/page.tsx.
 *
 * Four lifecycle-state filters (done / wait / undo / stop) drive the same
 * backend endpoint as the web. Default selection is "wait" — matches the web.
 */
import React, { useState } from 'react';
import { ObsidianViewsTabHost } from '@/components/obsidian/ViewsTabHost';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
import {
  View,
  Text,
  Pressable,
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
import { usePixelTheme, PixelButton } from '@/components/pixel';
import type { PixelTheme } from '@/constants/pixel-theme';
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

export default function FlowsRoute() {
  if (isObsidianShellEnabled()) return <ObsidianViewsTabHost view="flows" />;
  return <FlowsScreenLegacy />;
}

function FlowsScreenLegacy() {
  const router = useRouter();
  const theme = usePixelTheme();
  const [filter, setFilter] = useState<FlowHubFilter>('wait');
  const { items, isLoading, isError, refetch } = useFlowHub(filter);

  const handleOpen = (item: FlowHubItem) => {
    router.push(`/tile/${item.tile.id}/flow` as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg1 }}>
      {/* Filter tabs — pixel pill row, bordo inferiore 2px */}
      <View style={{ borderBottomWidth: 2, borderBottomColor: theme.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
        >
          {TABS.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setFilter(tab.key)}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    height: 30,
                    borderWidth: 2,
                    borderColor: theme.border,
                    backgroundColor: isActive ? tab.tint : theme.surface,
                  }}
                >
                  <StateGlyph state={tab.key} color={isActive ? '#FFFFFF' : tab.tint} size={12} />
                  <Text
                    style={{
                      fontFamily: theme.fontHead,
                      fontSize: 9,
                      color: isActive ? '#FFFFFF' : theme.ink,
                      letterSpacing: 1,
                    }}
                  >
                    {tab.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={theme.accent as string} />
        </View>
      ) : isError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 }}>
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 10,
              color: theme.cap.voice,
              letterSpacing: 1,
            }}
          >
            ERRORE NEL CARICAMENTO
          </Text>
          <PixelButton
            theme={theme}
            label="RIPROVA"
            onPress={() => refetch()}
            bg={theme.surface}
          />
        </View>
      ) : items.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
            gap: 12,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderWidth: 2,
              borderColor: theme.border,
              backgroundColor: theme.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconRoute size={28} color={theme.ink2} strokeWidth={1.6} />
          </View>
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 10,
              color: theme.ink,
              textAlign: 'center',
              letterSpacing: 1,
            }}
          >
            NESSUN FLUSSO
          </Text>
          <Text
            style={{
              fontFamily: theme.fontBody,
              fontSize: 12,
              color: theme.ink2,
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
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <FlowItemCard item={item} theme={theme} onPress={() => handleOpen(item)} />
          )}
          ListFooterComponent={
            <Text
              style={{
                fontFamily: theme.fontHead,
                fontSize: 9,
                color: theme.ink2,
                textAlign: 'center',
                marginTop: 16,
                letterSpacing: 1,
              }}
            >
              {items.length} {items.length === 1 ? 'FLUSSO' : 'FLUSSI'}
            </Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => refetch()}
              tintColor={theme.ink2}
            />
          }
        />
      )}
    </View>
  );
}

/**
 * 3-column card — pixel styled: border 2px ink, no border-radius, bg surface.
 */
function FlowItemCard({
  item,
  theme,
  onPress,
}: {
  item: FlowHubItem;
  theme: PixelTheme;
  onPress: () => void;
}) {
  const isSelf = isItemSelf(item);
  const isDue =
    item.scheduled_at && new Date(item.scheduled_at).getTime() < Date.now();
  const scheduled = formatScheduled(item.scheduled_at);
  const occurred = formatDate(item.occurred_at);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <View
        style={{
          backgroundColor: theme.surface,
          borderWidth: 2,
          borderColor: theme.border,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Column 1 — tag (caps) + tile title */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: theme.fontHead,
                fontSize: 8,
                letterSpacing: 1.2,
                color: theme.ink2,
              }}
            >
              {item.tile.tag?.name?.toUpperCase() || ' '}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: theme.fontBody,
                fontSize: 13,
                fontWeight: '700',
                color: theme.ink,
                marginTop: 4,
              }}
            >
              {item.tile.title || '(senza titolo)'}
            </Text>
          </View>

          {/* Column 2 — node label + contact pill */}
          <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 4 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: theme.fontBody,
                fontSize: 12,
                color: item.label?.trim() ? theme.ink : theme.ink3,
                fontStyle: item.label?.trim() ? 'normal' : 'italic',
              }}
            >
              {item.label?.trim() || '(senza etichetta)'}
            </Text>
            {item.contact ? (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderWidth: 2,
                  borderColor: theme.border,
                  maxWidth: '100%',
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: theme.fontHead,
                    fontSize: 8,
                    color: item.contact.color || theme.ink,
                    letterSpacing: 1,
                  }}
                >
                  {item.contact.is_self
                    ? `[ ${item.contact.name.toUpperCase()} ]`
                    : item.contact.name.toUpperCase()}
                </Text>
              </View>
            ) : (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderWidth: 2,
                  borderColor: 'transparent',
                }}
              >
                <Text style={{ fontSize: 8, color: 'transparent' }}>—</Text>
              </View>
            )}
          </View>

          {/* Column 3 — mini badge */}
          <FlowMiniBadge isSelf={isSelf} state={item.state} />
        </View>

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
                <IconClock size={11} color={isDue ? theme.cap.voice : theme.ink2} />
                <Text
                  style={{
                    fontFamily: theme.fontBody,
                    fontSize: 11,
                    color: isDue ? theme.cap.voice : theme.ink2,
                  }}
                >
                  {scheduled}
                </Text>
              </View>
            )}
            {!scheduled && item.days_since_activity > 0 && (
              <Text
                style={{
                  fontFamily: theme.fontBody,
                  fontSize: 11,
                  color: theme.ink2,
                }}
              >
                {item.days_since_activity}g fa
              </Text>
            )}
            {occurred && (
              <Text
                style={{
                  fontFamily: theme.fontBody,
                  fontSize: 11,
                  color: theme.ink2,
                  marginLeft: 'auto',
                }}
              >
                {occurred}
              </Text>
            )}
          </View>
        )}

        {!!item.notes && (
          <Text
            numberOfLines={2}
            style={{
              fontFamily: theme.fontBody,
              fontSize: 12,
              color: theme.ink,
              marginTop: 8,
              lineHeight: 17,
            }}
          >
            {item.notes}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

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
          rx={0}
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
