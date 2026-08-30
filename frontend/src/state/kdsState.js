import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as api from "@/services/apiService";
import { connectRealtime } from "@/services/realtime";
import { printTicket } from "@/services/printService";
import { playAlert } from "@/services/soundService";
import { NEXT_STATUS, STATUS_ORDER } from "@/services/mockOrderService";

const KEY = "bhojpe_kds_v1";

export const DEFAULT_COLORS = {
  new: "#16A34A",
  cooking: "#F59E0B",
  ready: "#2563EB",
  completed: "#6B7280",
};

const DEFAULT_SETTINGS = {
  soundOn: true,
  volume: 0.9,
  repeat: 2,
  alertDuration: 5,
  displayMode: "auto",
  colors: { ...DEFAULT_COLORS },
  stationFilterOn: false,
  autoPrint: false,
  delayAlerts: true,
  slaMinutes: 10,
};

// No fake default chef anymore - real identity comes from Setup.jsx's
// passcode stage (POST /login -> billing's real staff roster), not a seeded
// "Rahul Sharma" placeholder. Empty until someone actually logs in.
const EMPTY_CHEF = { id: null, name: "", role: "", branch: "", avatar: null };

// Neutral defaults only — no fabricated "connected"/"paired" values. Real
// values arrive from Setup.jsx's pairing response (restaurant/branch/
// stations/deviceToken) and from fetchDevices() (device list, which
// posConnected is derived from at render time — see hasConnectedDevice()).
const DEFAULT_CONNECTION = {
  serverConnected: false,
  internet: true,
  realtime: false,
  lastSync: "—",
  deviceToken: null,
  restaurant: "",
  branch: "",
  server: "",
  stations: [],
};

function loadLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      paired: !!saved.paired,
      station: saved.station || "Main Kitchen",
      settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}), colors: { ...DEFAULT_COLORS, ...((saved.settings || {}).colors || {}) } },
      chef: { ...EMPTY_CHEF, ...(saved.chef || {}) },
      devices: saved.devices || [],
      orders: saved.orders || [],
      menu: saved.menu || [],
      connection: { ...DEFAULT_CONNECTION, ...(saved.connection || {}) },
    };
  } catch {
    return {
      paired: false,
      station: "Main Kitchen",
      settings: DEFAULT_SETTINGS,
      chef: EMPTY_CHEF,
      devices: [],
      orders: [],
      menu: [],
      connection: DEFAULT_CONNECTION,
    };
  }
}

// A branch's POS badge is "Connected" only when a real, recently-active POS
// device is in the fetched devices list — not a locally-toggled boolean.
export const hasConnectedDevice = (devices, type) =>
  (devices || []).some((d) => d.type === type && d.status === "connected");

const Ctx = createContext(null);

export function KdsProvider({ children }) {
  // `useRef(loadLocal())` alone only memoizes the VALUE `boot` reads once -
  // it doesn't stop the surrounding component body from re-running on every
  // render. A bare `api.setDeviceToken(...)` statement here previously ran on
  // every single re-render (order updates, polling, anything), each time
  // resetting the token back to whatever localStorage held at PAGE LOAD -
  // silently undoing any later api.setDeviceToken() call from Setup.jsx (a
  // fresh pairing, a logout) within a beat, since the app re-renders
  // constantly. Guard with a ref so this restore genuinely runs once.
  const bootRef = useRef(null);
  if (bootRef.current === null) {
    bootRef.current = loadLocal();
    if (bootRef.current.connection?.deviceToken) api.setDeviceToken(bootRef.current.connection.deviceToken);
  }
  const boot = bootRef.current;
  const [paired, setPaired] = useState(boot.paired);
  const [station, setStationState] = useState(boot.station);
  const [settings, setSettingsState] = useState(boot.settings);
  const [chef, setChefState] = useState(boot.chef);
  const [devices, setDevices] = useState(boot.devices);
  const [connection, setConnectionState] = useState(boot.connection);
  const [orders, setOrders] = useState(boot.orders);
  const [menu, setMenu] = useState(boot.menu);
  const [stats, setStats] = useState(null);
  const [rush, setRush] = useState(null);
  const [lastPrintJob, setLastPrintJob] = useState(null);
  const [config, setConfig] = useState(null);
  const [overdueAlert, setOverdueAlert] = useState(null);
  const [lastAudit, setLastAudit] = useState(null);
  const alertedOverdue = useRef(new Set());
  const [now, setNow] = useState(Date.now());
  const [alert, setAlert] = useState(null);
  const [undoItem, setUndoItem] = useState(null);
  const alertTimer = useRef(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ paired, station, settings, chef, devices, connection, orders, menu })
    );
  }, [paired, station, settings, chef, devices, connection, orders, menu]);

  const markOnline = (ok) =>
    setConnectionState((c) =>
      c.serverConnected === ok && c.internet === ok
        ? c
        : { ...c, serverConnected: ok, internet: ok, lastSync: ok ? "Just now" : c.lastSync }
    );

  const fireAlert = useCallback((order) => {
    setAlert(order);
    const s = settingsRef.current;
    if (s.soundOn) playAlert({ volume: s.volume, repeat: s.repeat });
    clearTimeout(alertTimer.current);
    alertTimer.current = setTimeout(() => setAlert(null), (s.alertDuration || 5) * 1000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [o, m, st, ru] = await Promise.all([
        api.fetchOrders(),
        api.fetchMenu(),
        api.fetchPrepStats(),
        api.fetchRush(),
      ]);
      setOrders(o);
      setMenu(m);
      setStats(st);
      setRush(ru);
      api.fetchConfig().then(setConfig).catch(() => {});
      markOnline(true);
      return true;
    } catch {
      markOnline(false);
      return false;
    }
  }, []);

  const fetchDevicesList = useCallback(async () => {
    const res = await call(() => api.fetchDevices());
    if (res) setDevices(res);
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetched once on load (paired screens only) - not part of the 20s order
  // poll, since the device list changes far less often. Devices tab / after
  // rename-disconnect re-fetch manually via actions.fetchDevices.
  useEffect(() => {
    if (paired) fetchDevicesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paired]);

  const refreshStats = useCallback(async () => {
    try {
      const [st, ru] = await Promise.all([api.fetchPrepStats(), api.fetchRush()]);
      setStats(st);
      setRush(ru);
    } catch {
      /* offline: keep last stats */
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      api.fetchRush().then(setRush).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 20000);
    return () => clearInterval(poll);
  }, [refresh]);

  // live order feed
  useEffect(() => {
    return connectRealtime({
      onStatus: (ok) => {
        if (ok) markOnline(true);
        setConnectionState((c) => ({ ...c, realtime: ok }));
      },
      onEvent: (event, payload) => {
        if (event === "order.created") {
          setOrders((prev) => (prev.some((o) => o.id === payload.id) ? prev : [payload, ...prev]));
          fireAlert(payload);
          refreshStats();
        } else if (event === "order.updated") {
          setOrders((prev) => prev.map((o) => (o.id === payload.id ? payload : o)));
          refreshStats();
        } else if (event === "order.removed") {
          setOrders((prev) => prev.filter((o) => o.id !== payload.id));
        } else if (event === "menu.updated") {
          setMenu((prev) => prev.map((m) => (m.id === payload.id ? { ...m, ...payload } : m)));
        } else if (event === "print.queued") {
          setLastPrintJob(payload);
          if (settingsRef.current.autoPrint) {
            printTicket(payload);
            api.ackPrintJob(payload.id).catch(() => {});
          }
        } else if (event === "audit.logged") {
          setLastAudit(payload);
        } else if (event === "data.reset") {
          refresh();
        }
      },
    });
    // Reconnect once pairing sets/changes the device token, so the socket
    // picks up ?device=... and starts receiving this branch's events (Setup
    // pairs, then this provider is already mounted with the old connection).
  }, [fireAlert, refresh, refreshStats, connection.deviceToken]);

  const patchOrder = (id, patch) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const call = async (fn) => {
    try {
      const res = await fn();
      markOnline(true);
      return res;
    } catch {
      markOnline(false);
      return null;
    }
  };

  useEffect(() => {
    api.setActor(`${chef.name} (${station})`);
  }, [chef.name, station]);

  // Delay alerts: shout once when an order crosses its promised time
  useEffect(() => {
    if (!settings.delayAlerts) return;
    const sla = settings.slaMinutes * 60;
    const crossed = orders.filter(
      (o) =>
        (o.status === "new" || o.status === "cooking") &&
        ageOf(o, now).seconds >= sla &&
        !alertedOverdue.current.has(o.id)
    );
    if (!crossed.length) return;
    crossed.forEach((o) => alertedOverdue.current.add(o.id));
    setOverdueAlert({ kot: crossed[0].kot, station: crossed[0].station, count: crossed.length, at: Date.now() });
    if (settings.soundOn) playAlert({ volume: settings.volume, repeat: 1 });
    setTimeout(() => setOverdueAlert(null), 8000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, orders, settings.delayAlerts, settings.slaMinutes]);

  const actions = useMemo(
    () => ({
      setPaired,
      setStation: setStationState,
      setSettings: (p) => setSettingsState((s) => ({ ...s, ...p })),
      setColors: (p) => setSettingsState((s) => ({ ...s, colors: { ...s.colors, ...p } })),
      resetColors: () => setSettingsState((s) => ({ ...s, colors: { ...DEFAULT_COLORS } })),
      setConnection: (p) => setConnectionState((c) => ({ ...c, ...p })),
      setChef: (p) => setChefState((c) => ({ ...c, ...p })),
      refresh,
      refreshStats,
      fetchDevices: fetchDevicesList,

      // Deliberately NOT routed through call() (which swallows errors as
      // null) - billing's rename/disconnect are owner/manager-gated
      // (DeviceController::authorizeDeviceManager), so a chef-role login can
      // get a real 403 here. Let it throw so SettingsDrawer can toast
      // billing's actual message instead of a generic failure.
      renameDevice: async (id, name) => {
        const res = await api.renameDevice(id, name);
        await fetchDevicesList();
        return res;
      },

      disconnectDevice: async (id) => {
        const res = await api.disconnectDevice(id);
        await fetchDevicesList();
        return res;
      },

      saveConfig: async (patch) => {
        const res = await call(() => api.saveConfig(patch));
        if (res) setConfig(res);
        return res;
      },

      advance: async (id) => {
        const order = orders.find((o) => o.id === id);
        if (!order) return;
        const next = NEXT_STATUS[order.status];
        if (!next) return;
        patchOrder(id, { status: next });
        setUndoItem({ id, kot: order.kot, from: order.status, to: next, at: Date.now() });
        const res = await call(() => api.setOrderStatus(id, next));
        if (res) patchOrder(id, res);
      },

      recall: async (id) => {
        const order = orders.find((o) => o.id === id);
        if (!order) return;
        const idx = STATUS_ORDER.indexOf(order.status);
        if (idx <= 0) return;
        const prev = STATUS_ORDER[idx - 1];
        patchOrder(id, { status: prev });
        const res = await call(() => api.setOrderStatus(id, prev));
        if (res) patchOrder(id, res);
      },

      undoLast: async () => {
        if (!undoItem) return null;
        const { id, from } = undoItem;
        patchOrder(id, { status: from });
        const res = await call(() => api.setOrderStatus(id, from));
        if (res) patchOrder(id, res);
        const done = undoItem;
        setUndoItem(null);
        return done;
      },
      clearUndo: () => setUndoItem(null),

      setPriority: async (id, priority) => {
        patchOrder(id, { priority });
        const res = await call(() => api.setOrderPriority(id, priority));
        if (res) patchOrder(id, res);
      },

      handoff: async (id, station) => {
        patchOrder(id, { station });
        const res = await call(() => api.setOrderStation(id, station, "Chef handoff"));
        if (res) patchOrder(id, res);
        return res;
      },

      printKot: async (id) => {
        const job = await call(() => api.printKot(id));
        if (job) {
          printTicket(job);
          api.ackPrintJob(job.id).catch(() => {});
        }
        return job;
      },

      sendToPrinter: (job) => printTicket(job),

      toggleItemDone: async (id, index, done) => {
        const order = orders.find((o) => o.id === id);
        if (!order) return;
        patchOrder(id, { items: order.items.map((i, x) => (x === index ? { ...i, done } : i)) });
        const res = await call(() => api.setItemDone(id, index, done));
        if (res) patchOrder(id, res);
      },

      removeOrder: async (id) => {
        setOrders((prev) => prev.filter((o) => o.id !== id));
        await call(() => api.clearOrder(id));
      },

      setItemAvailability: async (id, available) => {
        setMenu((prev) => prev.map((m) => (m.id === id ? { ...m, available } : m)));
        return call(() => api.setItemAvailability(id, available));
      },

      newKot: async (st) => {
        const res = await call(() => api.posCreateRandomOrder(st || station));
        if (res) {
          setOrders((prev) => (prev.some((o) => o.id === res.id) ? prev : [res, ...prev]));
          if (!alert) fireAlert(res);
        }
        return res;
      },

      markRandomReady: async () => {
        const cand = orders.filter((o) => o.status === "cooking");
        if (!cand.length) return null;
        const o = cand[Math.floor(Math.random() * cand.length)];
        patchOrder(o.id, { status: "ready" });
        const res = await call(() => api.setOrderStatus(o.id, "ready"));
        if (res) patchOrder(o.id, res);
        return o;
      },

      simulateDelayed: async () => {
        const cand = orders.filter((o) => o.status === "new" || o.status === "cooking");
        if (!cand.length) return null;
        const o = cand[Math.floor(Math.random() * cand.length)];
        const res = await call(() => api.delayOrder(o.id));
        if (res) patchOrder(o.id, res);
        return o;
      },

      resetDemo: async () => {
        await call(() => api.resetDemo());
        await refresh();
      },

      dismissAlert: () => setAlert(null),
      testAlert: fireAlert,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, station, undoItem, alert, refresh, refreshStats, fireAlert]  );

  const state = { paired, station, settings, chef, devices, connection, orders, menu, stats, rush, config };

  return <Ctx.Provider value={{ state, actions, now, alert, undoItem, lastPrintJob, overdueAlert, lastAudit }}>{children}</Ctx.Provider>;
}

export const useKds = () => useContext(Ctx);

export function ageOf(order, now) {
  const created = typeof order.createdAt === "number" ? order.createdAt : Date.parse(order.createdAt);
  const s = Math.max(0, Math.floor((now - created) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return { seconds: s, text: `${mm}:${ss}` };
}

export function ageLevel(seconds, slaSeconds = 600) {
  if (seconds < slaSeconds / 2) return "fresh";
  if (seconds < slaSeconds) return "warning";
  return "delayed";
}

export function formatDuration(seconds) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}
