// Shared status/label constants used across the real board (KDS.jsx,
// KOTCard.jsx, StatusColumn.jsx, SettingsDrawer.jsx, StationScreen.jsx).
//
// This file used to also hold fake-order generators (seedOrders,
// generateKot) for a "Demo Controls" settings tab — removed 2026-09-18
// along with that tab and the backend's matching /pos/orders/random,
// /demo/reset, /demo/delay endpoints. Real orders only ever come from
// billing's RelayOrderToKds listener now; nothing in this file feeds
// the live board.

export const NEXT_STATUS = { new: "cooking", cooking: "ready", ready: "completed" };
export const ACTION_LABEL = {
  new: "START COOKING",
  cooking: "MARK READY",
  ready: "COMPLETE ORDER",
  completed: "DONE",
};
export const STATUS_ORDER = ["new", "cooking", "ready", "completed"];
export const STATUS_LABEL = { new: "NEW", cooking: "COOKING", ready: "READY", completed: "COMPLETED" };
