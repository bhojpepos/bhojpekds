import axios from "axios";

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

const api = axios.create({ baseURL: BASE, timeout: 12000 });

export const wsUrl = () =>
  `${process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws")}/api/ws`;

export const health = () => api.get("/health").then((r) => r.data);
export const pair = (syncCode, posCode) => api.post("/pair", { syncCode, posCode }).then((r) => r.data);
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
