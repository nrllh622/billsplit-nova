import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Switch,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { CURRENCIES, Currency } from "@/src/data/currencies";
import {
  addHistory,
  HistoryItem,
  loadPrefs,
  savePrefs,
} from "@/src/storage/store";

const COLORS = {
  surface: "#0F0F14",
  surfaceSecondary: "#1A1A24",
  surfaceTertiary: "#252533",
  onSurface: "#E2E2E8",
  onSurfaceSecondary: "#C5C5D2",
  onSurfaceTertiary: "#A0A0B0",
  brand: "#A78BFA",
  brandTertiary: "#8B5CF6",
  onBrand: "#09090D",
  border: "#2E2E3E",
  borderStrong: "#4B4B63",
  success: "#34D399",
  error: "#F87171",
};

const PRESET_TIPS = [10, 15, 18, 20, 25];

type ChipValue = number | "custom";

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [bill, setBill] = useState<string>("");
  const [selectedTip, setSelectedTip] = useState<ChipValue>(18);
  const [customTip, setCustomTip] = useState<string>("");
  const [people, setPeople] = useState<number>(1);
  const [roundUp, setRoundUp] = useState<boolean>(false);
  const [currency, setCurrency] = useState<Currency>(CURRENCIES[0]);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [savedToast, setSavedToast] = useState<boolean>(false);

  const prefsLoadedRef = useRef(false);

  // Load persisted prefs
  useEffect(() => {
    (async () => {
      const prefs = await loadPrefs();
      const found = CURRENCIES.find((c) => c.code === prefs.currencyCode);
      if (found) setCurrency(found);
      setRoundUp(prefs.roundUp);
      prefsLoadedRef.current = true;
    })();
  }, []);

  // Persist prefs
  useEffect(() => {
    if (!prefsLoadedRef.current) return;
    savePrefs({ currencyCode: currency.code, roundUp });
  }, [currency.code, roundUp]);

  const tipPercent = useMemo(() => {
    if (selectedTip === "custom") {
      const v = parseFloat(customTip);
      return isNaN(v) ? 0 : Math.max(0, v);
    }
    return selectedTip;
  }, [selectedTip, customTip]);

  const billNum = useMemo(() => {
    const v = parseFloat(bill);
    return isNaN(v) ? 0 : Math.max(0, v);
  }, [bill]);

  const calc = useMemo(() => {
    const totalTipRaw = (billNum * tipPercent) / 100;
    let totalBillRaw = billNum + totalTipRaw;
    if (roundUp) {
      totalBillRaw = Math.ceil(totalBillRaw);
    }
    const totalTip = roundUp ? totalBillRaw - billNum : totalTipRaw;
    const safePeople = Math.max(1, people);
    const totalPerPerson = totalBillRaw / safePeople;
    const tipPerPerson = totalTip / safePeople;
    return {
      totalTip,
      totalBill: totalBillRaw,
      totalPerPerson,
      tipPerPerson,
    };
  }, [billNum, tipPercent, roundUp, people]);

  const fmt = useCallback(
    (n: number) => {
      const s = n.toFixed(2);
      return `${currency.symbol}${s}`;
    },
    [currency.symbol]
  );

  const handleTipPress = useCallback((v: ChipValue) => {
    setSelectedTip(v);
    if (v !== "custom") setCustomTip("");
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  const handleReset = useCallback(() => {
    setBill("");
    setSelectedTip(18);
    setCustomTip("");
    setPeople(1);
    Keyboard.dismiss();
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (billNum <= 0) return;
    const item: HistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      bill: billNum,
      tipPercent,
      people: Math.max(1, people),
      totalTip: calc.totalTip,
      totalBill: calc.totalBill,
      totalPerPerson: calc.totalPerPerson,
      tipPerPerson: calc.tipPerPerson,
      currencyCode: currency.code,
      roundUp,
    };
    await addHistory(item);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
    }
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1600);
  }, [billNum, tipPercent, people, calc, currency.code, roundUp]);

  const filteredCurrencies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header} testID="app-header">
        <View>
          <Text style={styles.brandTitle}>TipCalc</Text>
          <Text style={styles.brandSub}>PRO · UTILITY</Text>
        </View>
        <Pressable
          testID="history-button"
          onPress={() => router.push("/history")}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && { opacity: 0.6 },
          ]}
          hitSlop={8}
        >
          <Ionicons name="time-outline" size={20} color={COLORS.brand} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 180 + insets.bottom,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={Keyboard.dismiss}
        >
            {/* Live Results Card */}
            <View style={styles.resultsCard} testID="results-card">
              <View style={styles.resultsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultsLabel}>TOTAL / PERSON</Text>
                  <Text style={styles.bigMetric} testID="total-per-person">
                    {fmt(calc.totalPerPerson)}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultsLabel}>TIP / PERSON</Text>
                  <Text style={styles.bigMetric} testID="tip-per-person">
                    {fmt(calc.tipPerPerson)}
                  </Text>
                </View>
              </View>
              <View style={styles.resultsFooter}>
                <View style={styles.footerCell}>
                  <Text style={styles.resultsLabel}>TOTAL TIP</Text>
                  <Text style={styles.smallMetric} testID="total-tip">
                    {fmt(calc.totalTip)}
                  </Text>
                </View>
                <View style={styles.footerCell}>
                  <Text style={styles.resultsLabel}>TOTAL BILL</Text>
                  <Text style={styles.smallMetric} testID="total-bill">
                    {fmt(calc.totalBill)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Bill Amount */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>BILL AMOUNT</Text>
              <View style={styles.billRow}>
                <Pressable
                  testID="currency-picker-button"
                  style={({ pressed }) => [
                    styles.currencyBtn,
                    pressed && { backgroundColor: COLORS.surfaceTertiary },
                  ]}
                  onPress={() => setPickerOpen(true)}
                >
                  <Text style={styles.currencyFlag}>{currency.flag}</Text>
                  <Text style={styles.currencyCode}>{currency.code}</Text>
                  <Ionicons
                    name="chevron-down"
                    size={14}
                    color={COLORS.onSurfaceTertiary}
                  />
                </Pressable>
                <View style={styles.billInputWrap}>
                  <Text style={styles.billPrefix}>{currency.symbol}</Text>
                  <TextInput
                    testID="bill-amount-input"
                    value={bill}
                    onChangeText={setBill}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.onSurfaceTertiary}
                    keyboardType="decimal-pad"
                    style={styles.billInput}
                    selectionColor={COLORS.brand}
                  />
                </View>
              </View>
            </View>

            {/* Tip Percent Chips */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TIP PERCENTAGE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {PRESET_TIPS.map((p) => {
                  const active = selectedTip === p;
                  return (
                    <Pressable
                      key={p}
                      testID={`tip-chip-${p}`}
                      onPress={() => handleTipPress(p)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {p}%
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  testID="tip-chip-custom"
                  onPress={() => handleTipPress("custom")}
                  style={[
                    styles.chip,
                    selectedTip === "custom" && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedTip === "custom" && styles.chipTextActive,
                    ]}
                  >
                    Custom
                  </Text>
                </Pressable>
              </ScrollView>
              {selectedTip === "custom" && (
                <View style={styles.customTipWrap}>
                  <TextInput
                    testID="custom-tip-input"
                    value={customTip}
                    onChangeText={setCustomTip}
                    placeholder="Enter custom %"
                    placeholderTextColor={COLORS.onSurfaceTertiary}
                    keyboardType="decimal-pad"
                    style={styles.customTipInput}
                    selectionColor={COLORS.brand}
                  />
                  <Text style={styles.customTipSuffix}>%</Text>
                </View>
              )}
            </View>

            {/* People stepper */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>NUMBER OF PEOPLE</Text>
              <View style={styles.stepperRow}>
                <Pressable
                  testID="people-decrement"
                  onPress={() => setPeople((p) => Math.max(1, p - 1))}
                  style={({ pressed }) => [
                    styles.stepBtn,
                    pressed && { backgroundColor: COLORS.surfaceTertiary },
                  ]}
                >
                  <Ionicons name="remove" size={22} color={COLORS.brand} />
                </Pressable>
                <View style={styles.stepValueWrap}>
                  <Text style={styles.stepValue} testID="people-count">
                    {people}
                  </Text>
                  <Text style={styles.stepValueSub}>
                    {people === 1 ? "person" : "people"}
                  </Text>
                </View>
                <Pressable
                  testID="people-increment"
                  onPress={() => setPeople((p) => Math.min(99, p + 1))}
                  style={({ pressed }) => [
                    styles.stepBtn,
                    pressed && { backgroundColor: COLORS.surfaceTertiary },
                  ]}
                >
                  <Ionicons name="add" size={22} color={COLORS.brand} />
                </Pressable>
              </View>
            </View>

            {/* Round up toggle */}
            <View style={[styles.section, styles.toggleRow]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>ROUND UP</Text>
                <Text style={styles.toggleSub}>
                  Round total bill up to nearest whole.
                </Text>
              </View>
              <Switch
                testID="round-up-switch"
                value={roundUp}
                onValueChange={setRoundUp}
                trackColor={{ false: COLORS.surfaceTertiary, true: COLORS.brandTertiary }}
                thumbColor={roundUp ? COLORS.brand : "#7C7C8E"}
                ios_backgroundColor={COLORS.surfaceTertiary}
              />
            </View>

            {/* Save button */}
            <Pressable
              testID="save-button"
              onPress={handleSave}
              disabled={billNum <= 0}
              style={({ pressed }) => [
                styles.saveBtn,
                billNum <= 0 && { opacity: 0.4 },
                pressed && billNum > 0 && { backgroundColor: COLORS.surfaceTertiary },
              ]}
            >
              <Ionicons name="bookmark-outline" size={16} color={COLORS.brand} />
              <Text style={styles.saveBtnText}>Save to History</Text>
            </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Reset Footer */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <Pressable
          testID="reset-button"
          onPress={handleReset}
          style={({ pressed }) => [
            styles.resetBtn,
            pressed && { backgroundColor: COLORS.brandTertiary },
          ]}
        >
          <Ionicons name="refresh" size={18} color={COLORS.onBrand} />
          <Text style={styles.resetBtnText}>RESET</Text>
        </Pressable>
      </View>

      {/* Toast */}
      {savedToast && (
        <View
          style={[styles.toast, { bottom: insets.bottom + 88 }]}
          testID="save-toast"
          pointerEvents="none"
        >
          <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
          <Text style={styles.toastText}>Saved to history</Text>
        </View>
      )}

      {/* Currency Picker Modal */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPickerOpen(false)}
          />
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
            testID="currency-picker-modal"
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Currency</Text>
              <Pressable
                testID="currency-modal-close"
                onPress={() => setPickerOpen(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color={COLORS.onSurface} />
              </Pressable>
            </View>
            <View style={styles.searchWrap}>
              <Ionicons
                name="search"
                size={16}
                color={COLORS.onSurfaceTertiary}
              />
              <TextInput
                testID="currency-search-input"
                value={search}
                onChangeText={setSearch}
                placeholder="Search code or name"
                placeholderTextColor={COLORS.onSurfaceTertiary}
                style={styles.searchInput}
                selectionColor={COLORS.brand}
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filteredCurrencies}
              keyExtractor={(item, idx) => `${item.code}-${idx}`}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => (
                <View style={styles.itemSeparator} />
              )}
              renderItem={({ item }) => {
                const selected = item.code === currency.code;
                return (
                  <Pressable
                    testID={`currency-row-${item.code}`}
                    onPress={() => {
                      setCurrency(item);
                      setPickerOpen(false);
                      setSearch("");
                    }}
                    style={({ pressed }) => [
                      styles.currencyRow,
                      pressed && { backgroundColor: COLORS.surfaceTertiary },
                    ]}
                  >
                    <Text style={styles.currencyRowFlag}>{item.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.currencyRowCode}>{item.code}</Text>
                      <Text style={styles.currencyRowName}>{item.name}</Text>
                    </View>
                    <Text style={styles.currencyRowSymbol}>{item.symbol}</Text>
                    {selected && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={COLORS.brand}
                        style={{ marginLeft: 8 }}
                      />
                    )}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No currencies match</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
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
    justifyContent: "space-between",
  },
  brandTitle: {
    color: COLORS.onSurface,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
  },
  brandSub: {
    color: COLORS.brand,
    fontSize: 10,
    letterSpacing: 3,
    marginTop: 2,
    fontWeight: "600",
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
  // Results card
  resultsCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  resultsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  divider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },
  resultsLabel: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "600",
    marginBottom: 6,
  },
  bigMetric: {
    color: COLORS.brand,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  resultsFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 16,
    paddingTop: 12,
  },
  footerCell: {
    flex: 1,
  },
  smallMetric: {
    color: COLORS.onSurface,
    fontSize: 18,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  // Sections
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "600",
    marginBottom: 8,
  },
  // Bill row
  billRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  currencyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 6,
  },
  currencyFlag: {
    fontSize: 18,
  },
  currencyCode: {
    color: COLORS.onSurface,
    fontWeight: "600",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  billInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  billPrefix: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 20,
    marginRight: 6,
    fontWeight: "500",
  },
  billInput: {
    flex: 1,
    color: COLORS.onSurface,
    fontSize: 22,
    fontWeight: "600",
    paddingVertical: 12,
    fontVariant: ["tabular-nums"],
  },
  // Chip row
  chipRow: {
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    minWidth: 64,
  },
  chipActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },
  chipText: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  chipTextActive: {
    color: COLORS.onBrand,
  },
  customTipWrap: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.brand,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  customTipInput: {
    flex: 1,
    color: COLORS.onSurface,
    fontSize: 16,
    paddingVertical: 12,
    fontWeight: "600",
  },
  customTipSuffix: {
    color: COLORS.brand,
    fontSize: 16,
    fontWeight: "700",
  },
  // Stepper
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  stepBtn: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValueWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
  },
  stepValue: {
    color: COLORS.onSurface,
    fontSize: 22,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  stepValueSub: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "600",
    marginTop: 2,
  },
  // Toggle
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toggleLabel: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  toggleSub: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  // Save
  saveBtn: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.brand,
    backgroundColor: "transparent",
  },
  saveBtnText: {
    color: COLORS.brand,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 1.5,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  resetBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: 8,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  resetBtnText: {
    color: COLORS.onBrand,
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 2,
  },
  // Toast
  toast: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toastText: {
    color: COLORS.onSurface,
    fontSize: 13,
    fontWeight: "500",
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.surfaceSecondary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "85%",
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitle: {
    color: COLORS.onSurface,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceTertiary,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.onSurface,
    fontSize: 14,
    paddingVertical: 10,
  },
  itemSeparator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 56,
  },
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  currencyRowFlag: {
    fontSize: 22,
    width: 28,
    textAlign: "center",
  },
  currencyRowCode: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  currencyRowName: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12,
    marginTop: 1,
  },
  currencyRowSymbol: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 14,
    fontWeight: "600",
    minWidth: 30,
    textAlign: "right",
  },
  emptyWrap: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13,
  },
});
