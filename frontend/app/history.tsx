import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { CURRENCIES } from "@/src/data/currencies";
import {
  clearHistory,
  HistoryItem,
  loadHistory,
} from "@/src/storage/store";

const COLORS = {
  surface: "#1a1a2e",
  surfaceSecondary: "#16213e",
  surfaceTertiary: "#252533",
  onSurface: "#E2E2E8",
  onSurfaceSecondary: "#C5C5D2",
  onSurfaceTertiary: "#A0A0B0",
  brand: "#A78BFA",
  brandTertiary: "#8B5CF6",
  onBrand: "#09090D",
  border: "#2E2E3E",
  error: "#F87171",
};

function fmtAmount(n: number, code: string) {
  const c = CURRENCIES.find((x) => x.code === code);
  const sym = c?.symbol || "";
  return `${sym}${n.toFixed(2)}`;
}

function fmtDate(ts: number) {
  const d = new Date(ts);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  try {
    return d.toLocaleString(undefined, opts);
  } catch {
    return d.toString();
  }
}

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await loadHistory();
    setItems(list);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleClear = useCallback(async () => {
    await clearHistory();
    setItems([]);
  }, []);

  const renderItem: ListRenderItem<HistoryItem> = ({ item }) => (
    <View style={styles.card} testID={`history-row-${item.id}`}>
      <View style={styles.cardTop}>
        <Text style={styles.cardDate}>{fmtDate(item.createdAt)}</Text>
        <View style={styles.tipBadge}>
          <Text style={styles.tipBadgeText}>{item.tipPercent}%</Text>
        </View>
      </View>
      <View style={styles.cardMetrics}>
        <View style={styles.metricCol}>
          <Text style={styles.metricLabel}>TOTAL / PERSON</Text>
          <Text style={styles.metricValueBig}>
            {fmtAmount(item.totalPerPerson, item.currencyCode)}
          </Text>
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.metricCol}>
          <Text style={styles.metricLabel}>TOTAL BILL</Text>
          <Text style={styles.metricValue}>
            {fmtAmount(item.totalBill, item.currencyCode)}
          </Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>
          Bill {fmtAmount(item.bill, item.currencyCode)}
        </Text>
        <Text style={styles.cardMetaDot}>·</Text>
        <Text style={styles.cardMeta}>
          Tip {fmtAmount(item.totalTip, item.currencyCode)}
        </Text>
        <Text style={styles.cardMetaDot}>·</Text>
        <Text style={styles.cardMeta}>
          {item.people} {item.people === 1 ? "person" : "people"}
        </Text>
        {item.roundUp && (
          <>
            <Text style={styles.cardMetaDot}>·</Text>
            <Text style={[styles.cardMeta, { color: COLORS.brand }]}>
              Rounded
            </Text>
          </>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="history-back-button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && { opacity: 0.6 },
          ]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.brand} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.brandTitle}>HISTORY</Text>
          <Text style={styles.brandSub}>RECENT SPLITS</Text>
        </View>
        {items.length > 0 && (
          <Pressable
            testID="history-clear-button"
            onPress={handleClear}
            style={({ pressed }) => [
              styles.clearBtn,
              pressed && { opacity: 0.6 },
            ]}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.error} />
            <Text style={styles.clearBtnText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.emptyWrap} testID="history-loading">
          <Text style={styles.emptyText}>Loading…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap} testID="history-empty">
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name="receipt-outline"
              size={36}
              color={COLORS.brand}
            />
          </View>
          <Text style={styles.emptyTitle}>No past splits</Text>
          <Text style={styles.emptyText}>
            Saved calculations will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 24 + insets.bottom,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    color: COLORS.onSurface,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 2,
  },
  brandSub: {
    color: COLORS.brand,
    fontSize: 10,
    letterSpacing: 3,
    marginTop: 2,
    fontWeight: "600",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
  },
  clearBtnText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  // Card
  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardDate: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  tipBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: COLORS.brand,
  },
  tipBadgeText: {
    color: COLORS.onBrand,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cardMetrics: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: 8,
  },
  metricCol: {
    flex: 1,
  },
  cardDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },
  metricLabel: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "600",
    marginBottom: 4,
  },
  metricValueBig: {
    color: COLORS.brand,
    fontSize: 22,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  metricValue: {
    color: COLORS.onSurface,
    fontSize: 18,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  cardFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cardMeta: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 12,
    fontWeight: "500",
  },
  cardMetaDot: {
    color: COLORS.onSurfaceTertiary,
    marginHorizontal: 6,
    fontWeight: "700",
  },
  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    color: COLORS.onSurface,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  emptyText: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13,
    textAlign: "center",
  },
});
