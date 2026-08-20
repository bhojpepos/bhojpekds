// Mock device/pairing service. Replace with real BhojPe device APIs later.

export const DEMO_SYNC_CODE = "BHP-8F42-K91";
export const DEMO_POS_CODE = "POS-7F42A9";
export const DEMO_TOKEN_CODE = "TOKEN-A81C32";

export const seedDevices = () => [
  { id: "pos", name: "POS", code: DEMO_POS_CODE, connected: true },
  { id: "kds", name: "KDS", code: "KDS-7F42A9", connected: true },
  { id: "token", name: "Token Screen", code: DEMO_TOKEN_CODE, connected: true },
  { id: "printer", name: "Kitchen Printer", code: "PRN-33B1", connected: true },
];

export const seedConnection = () => ({
  serverConnected: false,
  posConnected: false,
  tokenScreenConnected: true,
  printerConnected: true,
  internet: true,
  realtime: false,
  lastSync: "—",
  deviceId: "KDS-7F42A9",
  restaurant: "BhojPe Cafe",
  branch: "Main Branch",
  server: "BhojPe Server",
});

export const seedChef = () => ({
  name: "Rahul Sharma",
  role: "Head Chef",
  station: "Main Kitchen",
  branch: "Main Branch",
  avatar:
    "https://images.unsplash.com/photo-1583394293214-28ded15ee548?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwxfHxjaGVmJTIwcG9ydHJhaXR8ZW58MHx8fHwxNzg3MjUyNjExfDA&ixlib=rb-4.1.0&q=85&w=200",
});

// Simulates a network round-trip for pairing
export const pairDevice = (code) =>
  new Promise((resolve) => setTimeout(() => resolve({ ok: true, code }), 700));
