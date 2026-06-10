# TipCalc Pro — PRD

## Product
A sleek, dark-themed mobile tip calculator (React Native Expo, SDK 54).
Visual: Dark surface `#0F0F14`, neon purple accent `#A78BFA`.

## Core Features
1. **Bill amount input** (decimal numeric keypad).
2. **Tip percentage chips**: 10 / 15 / 18 / 20 / 25 / Custom (custom % textfield).
3. **Number of people** stepper (1–99).
4. **Live results card** showing Total/Person, Tip/Person, Total Tip, Total Bill.
5. **Round Up** toggle — rounds total bill up to the next whole unit.
6. **Reset** button (sticky footer).
7. **Currency picker** — 165+ ISO currencies with flag emojis, searchable bottom-sheet modal.
8. **Bill split history** — save calculations to AsyncStorage, view on /history, clear all.
9. **Preference persistence** — selected currency + round-up state survive app restarts.

## Tech
- Expo Router file-based routing: `app/index.tsx` (home), `app/history.tsx` (history).
- AsyncStorage for `tipcalc:prefs:v1` and `tipcalc:history:v1` (capped at 50 entries).
- Haptics on chip tap / reset / save.
- No backend changes (server.py untouched; pure client-side app).

## Future Enhancements
- Group-mode (different tip per person).
- Receipt OCR (camera-based bill capture).
- Live FX conversion using the selected currency vs home currency.
