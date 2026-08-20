# BhojPe KDS — PRD

## Original Problem Statement
Build a production-quality **BhojPe Kitchen Display System (KDS)** web app: one responsive interface that works on Android tablets, iPads, Windows/Mac desktops, touchscreens and 32"–55"+ TV displays (320px → 2560px). BhojPe branding (#FF3131 primary, #2C2C2C dark, #F7F7F7 background), clean flat SaaS UI, 5–8px radii, Poppins/Inter typography, original identity (not Petpooja/Toast lookalike). V1 is mock/local data only with clean service abstractions for later real APIs.

## Architecture
- Frontend only (React 19 + CRA + Tailwind + shadcn/ui + lucide-react + sonner). Backend `server.py` untouched.
- `src/state/kdsState.js` — Context + reducer, 1s clock tick, localStorage persistence (`bhojpe_kds_v1`).
- `src/services/` — `mockOrderService` (seed KOTs 1018–1033, KOT generator, status machine), `mockDeviceService` (pairing codes, seed connection/devices/chef), `mockSyncService` (POS sync), `soundService` (Web Audio "DING DING DING").
- `src/components/` — Header, FilterBar, StatusColumn, KOTCard, NewOrderAlert, ChefProfile, ConnectionStatus, DeviceCard, ItemAvailability, TokenScreenPreview, SettingsDrawer.
- `src/pages/` — Setup, KDS, TokenScreenPage. Routes: `/setup`, `/`, `/token`.
- Responsive scaling via `--k` CSS variable + `mode-auto|tablet|tv|largetv` classes; columns 1 (segmented nav) → 2 → 4.

## User Personas
- **Head Chef / Kitchen staff** — reads orders at a glance from several feet away, taps one large button per card, marks items out of stock.
- **Kitchen manager** — pairs devices, assigns station, tunes sound/colors/display mode.
- **Customer** — reads the Token Screen for ready order numbers.

## Core Requirements (static)
1. KOT number == Token number, always.
2. Tablet + large-TV readability, touch targets ≥44–52px.
3. Loud sound + strong visual alert on new KOT.
4. Out-of-stock toggling from KDS (availability only, never deletion) with POS sync.
5. Chef profile, station assignment, customizable status colors.
6. POS/KDS/Token Screen/Printer connection always visible; operable while offline (Local Mode).
7. Mock data only for v1, business logic separated from UI.

## Implemented (2026-06)
- Setup/pairing screen: sync code, POS pair code, server/restaurant/branch info, station picker, sound unlock, connection status, Demo Mode badge.
- KDS board: 4 status columns with counts, live age timers (ON TIME / WARNING / DELAYED with icons + colors), order type + table/ref chips, large item quantities, item and order notes, priority cycling (Normal/High/Urgent) with border accents, single large action button per status, DONE removes the card.
- New KOT: Web Audio triple ding (volume/repeat/duration configurable) + fullscreen NEW ORDER alert.
- Filters (All/New/Cooking/Ready/Delayed/Dine-in/Takeaway/Delivery) + search by KOT/table/token.
- Settings drawer: Connection, Devices (toggleable POS/KDS/Token/Printer + Add Device), Kitchen Station (+station-only filter), Chef Profile, Sound, Display modes, Colors (+reset), Items, Token Screen, Notifications, Demo Controls, Fullscreen, Reset Demo, Logout.
- Items screen: availability switches, confirm dialog, OUT OF STOCK badge, "Synced to POS".
- Token Screen: in-settings preview + standalone `/token` route grouped by Dine-in / Takeaway / Delivery-Pickup using READY KOT numbers.
- Offline Local Mode banner; board stays fully usable.
- Verified by testing agent (frontend, ~95% pass, no functional bugs); duplicate-testid and alert z-index nits fixed after the run.

## Backlog
- P0: Real BhojPe server/POS REST + WebSocket wiring replacing the mock services; real menu/stock endpoint.
- P1: Multi-station board switching without reload; order recall/undo; KOT reprint to kitchen printer; audit of who changed status.
- P2: Dark kitchen theme, per-item done ticking, prep-time analytics, multi-language.
