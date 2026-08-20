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

## Implemented (2026-06)- Setup/pairing screen: sync code, POS pair code, server/restaurant/branch info, station picker, sound unlock, connection status, Demo Mode badge.
- KDS board: 4 status columns with counts, live age timers (ON TIME / WARNING / DELAYED with icons + colors), order type + table/ref chips, large item quantities, item and order notes, priority cycling (Normal/High/Urgent) with border accents, single large action button per status, DONE removes the card.
- New KOT: Web Audio triple ding (volume/repeat/duration configurable) + fullscreen NEW ORDER alert.
- Filters (All/New/Cooking/Ready/Delayed/Dine-in/Takeaway/Delivery) + search by KOT/table/token.
- Settings drawer: Connection, Devices (toggleable POS/KDS/Token/Printer + Add Device), Kitchen Station (+station-only filter), Chef Profile, Sound, Display modes, Colors (+reset), Items, Token Screen, Notifications, Demo Controls, Fullscreen, Reset Demo, Logout.
- Items screen: availability switches, confirm dialog, OUT OF STOCK badge, "Synced to POS".
- Token Screen: in-settings preview + standalone `/token` route grouped by Dine-in / Takeaway / Delivery-Pickup using READY KOT numbers.
- Offline Local Mode banner; board stays fully usable.
- Verified by testing agent (frontend, ~95% pass, no functional bugs); duplicate-testid and alert z-index nits fixed after the run.

## Backlog
- P1: Real hardware printer integration (ESC/POS over LAN) to replace the browser print pipeline; per-user action audit log.
- P2: Dark kitchen theme, prep-time trend charts over time, multi-language, real external POS credential validation.

## Iteration 4 (2026-06) — kitchen operations
- **Printer Wiring**: server-side print job queue (`print_jobs`) — every POS order auto-queues a ticket, plus manual reprint (`POST /api/print/kot/{id}`) and automatic reprint on station handoff. Tickets render as an 80mm monospace ticket through the browser/OS print pipeline (`services/printService.js`); Settings → Printer shows the live queue (auto-updates over WebSocket) with print / ack / retry per job and an Auto-print toggle. NOTE: no physical printer is attached — jobs are real records and printing goes through the OS print dialog.
- **Station Handoff**: `PATCH /api/orders/{id}/station` moves a KOT between stations, appends a `handoffs` history entry and queues a reprint at the new station; each card has a MOVE STATION dropdown and shows a "moved from X" tag.
- **Shift Summary**: `GET /api/stats/shift?hours=6|12|24` → orders/items served, average prep, slowest dishes, most ordered and per-station counts; shown in Settings → Shift Summary.
- **Rush Hour View**: `GET /api/stats/rush` → ON TRACK / BUSY / RUSH level, average time behind the 10-minute target, active/delayed counts, oldest order and orders per hour; live bar under the filters, polled every 15s.
- Verified: backend pytest 30/30 pass, frontend 100% on all tested flows, no bugs reported. Post-run improvements: print queue now live over WebSocket and the rush label reads "Avg behind by".

## Iteration 2 (2026-06) — server-backed
- **Live POS Wiring**: real FastAPI "BhojPe Server" (`/app/backend/server.py` + `models.py`) with MongoDB persistence and a WebSocket feed at `/api/ws`. Endpoints: `/api/health`, `/api/pair`, `/api/orders`, `/api/pos/orders`, `/api/pos/orders/random`, `/api/orders/{id}/status|priority|items/{i}`, `DELETE /api/orders/{id}`, `/api/menu`, `PATCH /api/menu/{id}`, `/api/stats/prep-time`, `/api/demo/reset`, `/api/demo/delay/{id}`. Frontend uses `services/apiService.js` + `services/realtime.js`; new POS orders appear on the board instantly with the loud alert. localStorage still caches orders so the board keeps working in Local Mode.
- **Prep Time Insights**: `/api/stats/prep-time` computes per-station average/slowest cooking time (startedAt → readyAt), measured + active counts and an overall average; surfaced in Settings → Prep Insights with color-coded bars.
- **Item-Level Ticking**: each KOT line is tappable, strikes through when done, shows an `n/m done` chip, and persists server-side.
- **Recall Undo**: undo bar after every status change plus a per-card recall button; moving backwards clears the later timestamps on the server.
- Verified: backend pytest 17/17 pass (`/app/backend/tests/backend_test.py`), frontend flows 100% pass. Fixed after the run: KOT counter gap (first POS order is now 1034) and the Radix dialog-description a11y warning.
