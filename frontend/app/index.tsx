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
  const [fxStatus, setFxStatus] = useState
    "idle" | "loading" | "ok" | "error"
  >("ok");
  const [search, setSearch] = useState<string>("");
  const [savedToast, setSavedToast] = useState<boolean>(false);

  const prefsLoadedRef = useRef(false);

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
    onPress={() =>
