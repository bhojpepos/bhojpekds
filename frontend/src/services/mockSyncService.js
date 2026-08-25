// Mock POS sync. Replace with real websocket publish later.

export const syncToPOS = (payload) =>
  new Promise((resolve) => setTimeout(() => resolve({ ok: true, syncedAt: Date.now(), payload }), 600));

export const posStateFromMenu = (menu) =>
  menu.map((m) => ({ name: m.name, available: m.available }));
