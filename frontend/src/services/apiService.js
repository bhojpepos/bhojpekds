import axios from "axios";

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

const api = axios.create({ baseURL: BASE, timeout: 12000 });

let actorName = "Kitchen Device";
export const setActor = (name) => {
  actorName = name || "Kitchen Device";
};

// The paired branch's device token (from POST /pair) - sent on every request
// so the backend can scope data to this branch. See get_branch_context() in
// server.py. null until Setup.jsx completes real pairing.
let deviceToken = null;
export const setDeviceToken = (token) => {
  deviceToken = token || null;
};
export const getDeviceToken = () => deviceToken;

api.interceptors.request.use((cfg) => {
  cfg.headers["X-Actor"] = actorName;
  if (deviceToken) cfg.headers["X-KDS-Device"] = deviceToken;
  return cfg;
});

export const fetchOrderEvents = (id) => api.get(`/orders/${id}/events`).then((r) => r.data);
export const fetchAudit = (limit = 100) => api.get("/audit", { params: { limit } }).then((r) => r.data);
export const fetchWeekly = () => api.get("/stats/weekly").then((r) => r.data);
export const fetchPrinterStatus = () => api.get("/printer/status").then((r) => r.data);
export const sendTestEmail = () => api.post("/reports/test-email").then((r) => r.data);

// Native browser WebSocket can't set custom headers, so the device token
// travels as a query param here instead of X-KDS-Device (see ws_endpoint()).
export const wsUrl = () => {
  const base = `${process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws")}/api/ws`;
  return deviceToken ? `${base}?device=${encodeURIComponent(deviceToken)}` : base;
};

export const health = () => api.get("/health").then((r) => r.data);

// Stable per-browser id, generated once and kept in localStorage - lets
// billing recognize "this is the same physical screen" across re-pairs
// (e.g. after clearing localStorage's paired flag but not this id) instead
// of creating a new Device row every time. Separate from deviceToken, which
// is the CURRENT pairing session's identity and does get cleared on logout.
const DEVICE_ID_KEY = "bhojpe_kds_device_id";
const getDeviceIdentifier = () => {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

export const pair = (syncCode, pairCode) =>
  api.post("/pair", { syncCode, pairCode, deviceIdentifier: getDeviceIdentifier() }).then((r) => r.data);

// Branch staff roster (for the passcode login screen) and passcode-only
// shift login - both require pairing first (see require_pairing() in
// server.py), so both 401 until Setup.jsx's connect step has succeeded.
export const fetchStaff = () => api.get("/staff").then((r) => r.data);
export const chefLogin = (passcode) => api.post("/login", { passcode }).then((r) => r.data);

export const fetchOrders = () => api.get("/orders").then((r) => r.data);
export const fetchMenu = () => api.get("/menu").then((r) => r.data);
export const fetchPrepStats = () => api.get("/stats/prep-time").then((r) => r.data);

export const setOrderStatus = (id, status) =>
  api.patch(`/orders/${id}/status`, { status }).then((r) => r.data);
export const setOrderPriority = (id, priority) =>
  api.patch(`/orders/${id}/priority`, { priority }).then((r) => r.data);
export const setItemDone = (id, index, done) =>
  api.patch(`/orders/${id}/items/${index}`, { done }).then((r) => r.data);
export const clearOrder = (id) => api.delete(`/orders/${id}`).then((r) => r.data);
export const setItemAvailability = (id, available) =>
  api.patch(`/menu/${id}`, { available }).then((r) => r.data);

export const setOrderStation = (id, station, reason) =>
  api.patch(`/orders/${id}/station`, { station, reason }).then((r) => r.data);

export const printKot = (id, copies = 1) =>
  api.post(`/print/kot/${id}`, null, { params: { copies } }).then((r) => r.data);
export const fetchPrintJobs = (limit = 40) =>
  api.get("/print/jobs", { params: { limit } }).then((r) => r.data);
export const ackPrintJob = (jobId) => api.post(`/print/jobs/${jobId}/ack`).then((r) => r.data);
export const retryPrintJob = (jobId) => api.post(`/print/jobs/${jobId}/retry`).then((r) => r.data);

export const fetchConfig = () => api.get("/config").then((r) => r.data);
export const saveConfig = (patch) => api.put("/config", patch).then((r) => r.data);
export const testPrinter = () => api.post("/print/test").then((r) => r.data);
export const sendShiftRecap = (hours = 12) =>
  api.post("/reports/shift-recap/send", null, { params: { hours } }).then((r) => r.data);

export const fetchRush = () => api.get("/stats/rush").then((r) => r.data);
export const fetchShift = (hours = 12) =>
  api.get("/stats/shift", { params: { hours } }).then((r) => r.data);

export const posCreateRandomOrder = (station) =>
  api.post("/pos/orders/random", null, { params: station ? { station } : {} }).then((r) => r.data);
export const resetDemo = () => api.post("/demo/reset").then((r) => r.data);
export const delayOrder = (id) => api.post(`/demo/delay/${id}`).then((r) => r.data);
