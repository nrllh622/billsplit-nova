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

import { CURRENCIES, Currency, getCurrencyFlag } from "@/src/data/currencies";
import {
  addHistory,
  HistoryItem,
  loadPrefs,
  savePrefs,
} from "@/src/storage/store";
import { fetchRatesForBase } from "@/src/utils/fx";
import { useAnimatedNumber } from "@/src/hooks/use-animated-number";
import mobileAds, { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : "ca-app-pub-2984878117732696/8580357859";

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
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(
    CURRENCIES[0],
  );
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [pickerMode, setPickerMode] = useState<"base" | "display" | "person">(
    "base",
  );
  const [personPickerIndex, setPersonPickerIndex] = useState<number>(0);
  const [splitOpen, setSplitOpen] = useState<boolean>(false);
  const [personCurrencies, setPersonCurrencies] = useState<Currency[]>([
    CURRENCIES[0],
  ]);
  const [allRates, setAllRates] = useState<Record<string, number>>({});
  const [fxRate, setFxRate] = useState<number>(1);
  const [fxStatus, setFxStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("ok");
  const [search, setSearch] = useState<string>("");
  const [savedToast, setSavedToast] = useState<boolean>(false);

  const prefsLoadedRef = useRef(false);

  // Initialize AdMob SDK once
  useEffect(() => {
    mobileAds()
      .initialize()
      .catch(() => {});
  }, []);

  // Load persisted prefs
  useEffect(() => {
    (async () => {
      const prefs = await loadPrefs();
      const found = CURRENCIES.find((c) => c.code === prefs.currencyCode);
      if (found) {
        setCurrency(found);
        setDisplayCurrency(found);
      }
      setRoundUp(prefs.roundUp);
      prefsLoadedRef.current = true;
    })();
  }, []);

  // Persist prefs
  useEffect(() => {
    if (!prefsLoadedRef.current) return;
    savePrefs({ currencyCode: currency.code, roundUp });
  }, [currency.code, roundUp]);

  // Fetch FX rate when base or display currency changes (also populate full rate table for split view)
  useEffect(() => {
    let aborted = false;
    setFxStatus("loading");
    fetchRatesForBase(currency.code)
      .then((rates) => {
        if (aborted) return;
        setAllRates(rates);
        if (currency.code === displayCurrency.code) {
          setFxRate(1);
        } else {
          const norm = displayCurrency.code.replace(/\d+$/, "");
          const r = rates[norm];
          setFxRate(typeof r === "number" ? r : 1);
        }
        setFxStatus("ok");
      })
      .catch(() => {
        if (aborted) return;
        setAllRates({});
        setFxRate(1);
        setFxStatus("error");
      });
    return () => {
      aborted = true;
    };
  }, [currency.code, displayCurrency.code]);

  // Keep per-person currency array length in sync with people count
  useEffect(() => {
    setPersonCurrencies((prev) => {
      if (prev.length === people) return prev;
      if (prev.length < people) {
        const fill = Array.from({ length: people - prev.length }, () => currency);
        return [...prev, ...fill];
      }
      return prev.slice(0, people);
    });
  }, [people, currency]);

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

  // Converted (display) values
  const display = useMemo(
    () => ({
      totalTip: calc.totalTip * fxRate,
      totalBill: calc.totalBill * fxRate,
      totalPerPerson: calc.totalPerPerson * fxRate,
      tipPerPerson: calc.tipPerPerson * fxRate,
    }),
    [calc, fxRate],
  );

  // Animated metrics (smooth transitions on change)
  const aTotalPerPerson = useAnimatedNumber(display.totalPerPerson);
  const aTipPerPerson = useAnimatedNumber(display.tipPerPerson);
  const aTotalTip = useAnimatedNumber(display.totalTip);
  const aTotalBill = useAnimatedNumber(display.totalBill);

  const fmtBase = useCallback(
    (n: number) => `${currency.symbol}${n.toFixed(2)}`,
    [currency.symbol],
  );
  const fmtDisplay = useCallback(
    (n: number) => `${displayCurrency.symbol}${n.toFixed(2)}`,
    [displayCurrency.symbol],
  );

  const isConverting = currency.code !== displayCurrency.code;

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
          <Text style={styles.brandTitle}>BillSplit Nova</Text>
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
            paddingBottom: 200 + insets.bottom,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={Keyboard.dismiss}
        >
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
                  onPress={() => {
                    setPickerMode("base");
                    setPickerOpen(true);
                  }}
                >
                  <Text style={styles.currencyFlag}>{getCurrencyFlag(currency.code)}</Text>
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
              <View style={styles.chipGrid}>
                <View style={styles.chipGridRow}>
                  {[10, 15, 18].map((p) => {
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
                </View>
              <View style={styles.chipGridRow}>
  {[20, 25].map((p) => {
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
      styles.chipCustom,
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
</View>
              
              </View>
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

            {/* Live Results Card (purple) */}
            <View style={styles.resultsCard} testID="results-card">
              <View style={styles.resultsHeader}>
                <Ionicons name="cash-outline" size={14} color="#FFFFFF" />
                <Text style={styles.resultsHeaderText}>RESULT</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.resultsHeaderMeta}>
                  {tipPercent}% · {people} {people === 1 ? "person" : "people"}
                </Text>
              </View>

              {/* FX / display currency switcher */}
              <View style={styles.fxRow}>
                <Text style={styles.fxLabel}>SHOW IN</Text>
                <Pressable
                  testID="display-currency-button"
                  onPress={() => {
                    setPickerMode("display");
                    setPickerOpen(true);
                  }}
                  style={({ pressed }) => [
                    styles.fxChip,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.fxFlag}>{getCurrencyFlag(displayCurrency.code)}</Text>
                  <Text style={styles.fxCode}>{displayCurrency.code}</Text>
                  <Ionicons
                    name="swap-horizontal"
                    size={12}
                    color="#FFFFFF"
                  />
                </Pressable>
                {isConverting && (
                  <Text
                    style={styles.fxStatusText}
                    testID="fx-status"
                  >
                    {fxStatus === "loading"
                      ? "Loading rate…"
                      : fxStatus === "error"
                        ? "Rate unavailable"
                        : `1 ${currency.code} = ${fxRate.toFixed(4)} ${displayCurrency.code}`}
                  </Text>
                )}
              </View>

              <View style={styles.heroBlock}>
                <Text style={styles.heroLabel}>TOTAL PER PERSON</Text>
                <Text style={styles.heroMetric} testID="total-per-person">
                  {fmtDisplay(aTotalPerPerson)}
                </Text>
                {isConverting && (
                  <Text style={styles.heroSub} testID="total-per-person-base">
                    ≈ {fmtBase(calc.totalPerPerson)} {currency.code}
                  </Text>
                )}
              </View>

              <View style={styles.subBlock}>
                <Text style={styles.subLabel}>TIP PER PERSON</Text>
                <Text style={styles.subMetric} testID="tip-per-person">
                  {fmtDisplay(aTipPerPerson)}
                </Text>
                {isConverting && (
                  <Text style={styles.subSub} testID="tip-per-person-base">
                    ≈ {fmtBase(calc.tipPerPerson)} {currency.code}
                  </Text>
                )}
              </View>

              <View style={styles.resultsFooter}>
                <View style={styles.footerCell}>
                  <Text style={styles.footerLabel}>TOTAL TIP</Text>
                  <Text style={styles.footerMetric} testID="total-tip">
                    {fmtDisplay(aTotalTip)}
                  </Text>
                  {isConverting && (
                    <Text style={styles.footerSub}>
                      ≈ {fmtBase(calc.totalTip)}
                    </Text>
                  )}
                </View>
                <View style={styles.footerDivider} />
                <View style={styles.footerCell}>
                  <Text style={styles.footerLabel}>TOTAL BILL</Text>
                  <Text style={styles.footerMetric} testID="total-bill">
                    {fmtDisplay(aTotalBill)}
                  </Text>
                  {isConverting && (
                    <Text style={styles.footerSub}>
                      ≈ {fmtBase(calc.totalBill)}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Split View button (multi-currency split) */}
            {people > 1 && (
              <Pressable
                testID="split-view-button"
                onPress={() => setSplitOpen(true)}
                style={({ pressed }) => [
                  styles.splitBtn,
                  pressed && { backgroundColor: COLORS.surfaceTertiary },
                ]}
              >
                <Ionicons name="people-outline" size={18} color={COLORS.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.splitBtnText}>Split View</Text>
                  <Text style={styles.splitBtnSub}>
                    Each of the {people} people in their own currency
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.brand} />
              </Pressable>
            )}
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
        <View style={styles.bannerWrap}>
          <BannerAd
            unitId={BANNER_AD_UNIT_ID}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          />
        </View>
        <Pressable
          testID="save-button"
          onPress={handleSave}
          disabled={billNum <= 0}
          style={({ pressed }) => [
            styles.saveBtn,
            billNum <= 0 && { opacity: 0.4 },
            pressed && billNum > 0 && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="bookmark-outline" size={16} color="#FFFFFF" />
          <Text style={styles.saveBtnText}>Save to History</Text>
        </Pressable>
        <Pressable
          testID="reset-button"
          onPress={handleReset}
          style={({ pressed }) => [
            styles.resetBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="refresh" size={18} color="#FFFFFF" />
          <Text style={styles.resetBtnText}>RESET</Text>
        </Pressable>
      </View>

      {/* Toast */}
      {savedToast && (
        <View
          style={[
            styles.toast,
            { bottom: insets.bottom + 88, pointerEvents: "none" },
          ]}
          testID="save-toast"
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
              <View>
                <Text style={styles.modalTitle}>
                  {pickerMode === "display"
                    ? "Show Results In"
                    : pickerMode === "person"
                      ? `Currency for Person ${personPickerIndex + 1}`
                      : "Bill Currency"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {pickerMode === "display"
                    ? "Convert results to this currency"
                    : pickerMode === "person"
                      ? "Their share will be shown in this currency"
                      : "Currency you're entering the bill in"}
                </Text>
              </View>
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
                const activeCode =
                  pickerMode === "display"
                    ? displayCurrency.code
                    : pickerMode === "person"
                      ? personCurrencies[personPickerIndex]?.code
                      : currency.code;
                const selected = item.code === activeCode;
                return (
                  <Pressable
                    testID={`currency-row-${item.code}`}
                    onPress={() => {
                      if (pickerMode === "display") {
                        setDisplayCurrency(item);
                      } else if (pickerMode === "person") {
                        setPersonCurrencies((prev) => {
                          const next = [...prev];
                          next[personPickerIndex] = item;
                          return next;
                        });
                      } else {
                        setCurrency(item);
                        // keep display in sync if it was equal before
                        setDisplayCurrency((prev) =>
                          prev.code === currency.code ? item : prev,
                        );
                      }
                      setPickerOpen(false);
                      setSearch("");
                    }}
                    style={({ pressed }) => [
                      styles.currencyRow,
                      pressed && { backgroundColor: COLORS.surfaceTertiary },
                    ]}
                  >
                    <Text style={styles.currencyRowFlag}>{getCurrencyFlag(item.code)}</Text>
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

      {/* Split View Modal — per-person currency */}
      <Modal
        visible={splitOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSplitOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSplitOpen(false)}
          />
          <View
            style={[
              styles.splitSheet,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
            testID="split-view-modal"
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Split View</Text>
                <Text style={styles.modalSubtitle}>
                  Each person&apos;s share in their own currency
                </Text>
              </View>
              <Pressable
                testID="split-modal-close"
                onPress={() => setSplitOpen(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color={COLORS.onSurface} />
              </Pressable>
            </View>

            <View style={styles.splitSummary}>
              <View style={styles.splitSummaryCell}>
                <Text style={styles.splitSummaryLabel}>TOTAL BILL</Text>
                <Text style={styles.splitSummaryValue}>
                  {fmtBase(calc.totalBill)}
                </Text>
              </View>
              <View style={styles.splitSummaryDivider} />
              <View style={styles.splitSummaryCell}>
                <Text style={styles.splitSummaryLabel}>BASE / PERSON</Text>
                <Text style={styles.splitSummaryValue}>
                  {fmtBase(calc.totalPerPerson)}
                </Text>
              </View>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {Array.from({ length: people }).map((_, idx) => {
                const personCur = personCurrencies[idx] || currency;
                const isBase = personCur.code === currency.code;
                let rate = 1;
                if (!isBase) {
                  const norm = personCur.code.replace(/\d+$/, "");
                  const r = allRates[norm];
                  if (typeof r === "number") rate = r;
                }
                const personAmount = calc.totalPerPerson * rate;
                const personTip = calc.tipPerPerson * rate;
                return (
                  <View
                    key={idx}
                    style={styles.personCard}
                    testID={`person-row-${idx}`}
                  >
                    <View style={styles.personHeader}>
                      <View style={styles.personAvatar}>
                        <Text style={styles.personAvatarText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.personLabel}>
                        Person {idx + 1}
                      </Text>
                      <View style={{ flex: 1 }} />
                      <Pressable
                        testID={`person-currency-button-${idx}`}
                        onPress={() => {
                          setPersonPickerIndex(idx);
                          setPickerMode("person");
                          setPickerOpen(true);
                        }}
                        style={({ pressed }) => [
                          styles.personCurrencyChip,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={styles.personCurrencyFlag}>
                          {getCurrencyFlag(personCur.code)}
                        </Text>
                        <Text style={styles.personCurrencyCode}>
                          {personCur.code}
                        </Text>
                        <Ionicons
                          name="chevron-down"
                          size={12}
                          color={COLORS.onSurfaceTertiary}
                        />
                      </Pressable>
                    </View>
                    <View style={styles.personAmounts}>
                      <Text style={styles.personAmountLabel}>THEY PAY</Text>
                      <Text
                        style={styles.personAmountBig}
                        testID={`person-amount-${idx}`}
                      >
                        {personCur.symbol}
                        {personAmount.toFixed(2)}
                      </Text>
                      {!isBase && (
                        <Text style={styles.personAmountSub}>
                          ≈ {fmtBase(calc.totalPerPerson)} {currency.code} · tip{" "}
                          {personCur.symbol}
                          {personTip.toFixed(2)}
                        </Text>
                      )}
                      {isBase && (
                        <Text style={styles.personAmountSub}>
                          Tip {fmtBase(calc.tipPerPerson)}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
              <Text style={styles.splitHint}>
                Tap a flag to change a person&apos;s currency. Rates are live from
                exchangerate-api.
              </Text>
            </ScrollView>
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
  // Results card (purple hero)
  resultsCard: {
    backgroundColor: "#0F4C5C",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#0F4C5C",
    padding: 20,
    marginTop: 4,
    marginBottom: 16,
    boxShadow: "0px 8px 24px rgba(15, 76, 92, 0.35)",
    elevation: 8,
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  resultsHeaderText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.5,
  },
  resultsHeaderMeta: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  // FX row in results card
  fxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(9,9,13,0.18)",
    flexWrap: "wrap",
  },
  fxLabel: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.5,
    opacity: 0.7,
  },
  fxChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(9,9,13,0.16)",
    borderWidth: 1,
    borderColor: "rgba(9,9,13,0.22)",
  },
  fxFlag: {
    fontSize: 14,
  },
  fxCode: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  fxStatusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "500",
    opacity: 0.75,
    flexShrink: 1,
  },
  heroSub: {
    marginTop: 4,
    color: "#FFFFFF",
    opacity: 0.65,
    fontSize: 12,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  subSub: {
    marginTop: 2,
    color: "#FFFFFF",
    opacity: 0.6,
    fontSize: 11,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  footerSub: {
    marginTop: 2,
    color: "#FFFFFF",
    opacity: 0.6,
    fontSize: 10,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  heroBlock: {
    paddingBottom: 14,
  },
  heroLabel: {
    color: "#FFFFFF",
    opacity: 0.7,
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: "700",
    marginBottom: 4,
  },
  heroMetric: {
    color: "#FFFFFF",
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -1.2,
    fontVariant: ["tabular-nums"],
  },
  subBlock: {
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(9,9,13,0.18)",
  },
  subLabel: {
    color: "#FFFFFF",
    opacity: 0.7,
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: "700",
    marginBottom: 4,
  },
  subMetric: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  resultsFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(9,9,13,0.18)",
    paddingTop: 12,
  },
  footerCell: {
    flex: 1,
  },
  footerDivider: {
    width: 1,
    backgroundColor: "rgba(9,9,13,0.18)",
    marginHorizontal: 12,
  },
  footerLabel: {
    color: "#FFFFFF",
    opacity: 0.7,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 4,
  },
  footerMetric: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
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
  // Chip grid (3x2)
  chipGrid: {
    gap: 8,
  },
 chipGridRow: {
    flexDirection: "row",
    gap: 8,
  },
  chipCustom: {
    borderColor: COLORS.brand,
    borderWidth: 1.5,
  },
  chip: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0F4C5C",
    backgroundColor: "#0F4C5C",
    marginBottom: 8,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 1.5,
  },
  // Split View button
  splitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.brand,
    backgroundColor: COLORS.surfaceSecondary,
    marginBottom: 10,
  },
  splitBtnText: {
    color: COLORS.brand,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  splitBtnSub: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  // Split sheet (modal)
  splitSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: "92%",
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  splitSummary: {
    flexDirection: "row",
    backgroundColor: COLORS.surfaceSecondary,
    marginHorizontal: 16,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  splitSummaryCell: {
    flex: 1,
  },
  splitSummaryDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },
  splitSummaryLabel: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "600",
    marginBottom: 4,
  },
  splitSummaryValue: {
    color: COLORS.onSurface,
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  personCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  personHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  personAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  personAvatarText: {
    color: COLORS.onBrand,
    fontSize: 13,
    fontWeight: "800",
  },
  personLabel: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  personCurrencyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceTertiary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  personCurrencyFlag: {
    fontSize: 16,
  },
  personCurrencyCode: {
    color: COLORS.onSurface,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  personAmounts: {
    paddingTop: 6,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  personAmountLabel: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },
  personAmountBig: {
    color: COLORS.brand,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  personAmountSub: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  splitHint: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11,
    paddingHorizontal: 16,
    paddingTop: 4,
    fontStyle: "italic",
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
  bannerWrap: {
    alignItems: "center",
    marginBottom: 10,
  },
  resetBtn: {
    backgroundColor: "#0F4C5C",
    borderRadius: 8,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  resetBtnText: {
    color: "#FFFFFF",
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
  modalSubtitle: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
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
