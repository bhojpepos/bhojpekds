import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { seedOrders, generateKot, MENU_ITEMS, NEXT_STATUS } from "@/services/mockOrderService";
import { seedConnection, seedChef, seedDevices } from "@/services/mockDeviceService";
import { syncToPOS } from "@/services/mockSyncService";
import { playAlert } from "@/services/soundService";

const KEY = "bhojpe_kds_v1";

export const DEFAULT_COLORS = {
  new: "#16A34A",
  cooking: "#F59E0B",
  ready: "#2563EB",
  completed: "#6B7280",
};

const initialState = () => ({
  paired: false,
  connection: seedConnection(),
  devices: seedDevices(),
  chef: seedChef(),
  station: "Main Kitchen",
  orders: seedOrders(),
  menu: MENU_ITEMS.map((m) => ({ ...m })),
  nextKot: 1034,
  settings: {
    soundOn: true,
    volume: 0.9,
    repeat: 2,
    alertDuration: 5,
    displayMode: "auto",
    colors: { ...DEFAULT_COLORS },
    stationFilterOn: false,
  },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const saved = JSON.parse(raw);
    const base = initialState();
    return {
      ...base,
      ...saved,
      connection: { ...base.connection, ...(saved.connection || {}) },
      chef: { ...base.chef, ...(saved.chef || {}) },
      settings: { ...base.settings, ...(saved.settings || {}), colors: { ...DEFAULT_COLORS, ...((saved.settings || {}).colors || {}) } },
    };
  } catch {
    return initialState();
  }
}

function reducer(state, a) {
  switch (a.type) {
    case "patch":
      return { ...state, ...a.payload };
    case "settings":
      return { ...state, settings: { ...state.settings, ...a.payload } };
    case "colors":
      return { ...state, settings: { ...state.settings, colors: { ...state.settings.colors, ...a.payload } } };
    case "connection":
      return { ...state, connection: { ...state.connection, ...a.payload } };
    case "advance": {
      const orders = state.orders.map((o) => {
        if (o.id !== a.id) return o;
        const next = NEXT_STATUS[o.status];
        return next ? { ...o, status: next, statusAt: Date.now() } : o;
      });
      return { ...state, orders };
    }
    case "priority":
      return { ...state, orders: state.orders.map((o) => (o.id === a.id ? { ...o, priority: a.priority } : o)) };
    case "removeOrder":
      return { ...state, orders: state.orders.filter((o) => o.id !== a.id) };
    case "addOrder":
      return { ...state, orders: [a.order, ...state.orders], nextKot: state.nextKot + 1 };
    case "menu":
      return { ...state, menu: state.menu.map((m) => (m.id === a.id ? { ...m, available: a.available } : m)) };
    case "device":
      return {
        ...state,
        devices: state.devices.map((d) => (d.id === a.id ? { ...d, connected: a.connected } : d)),
      };
    case "reset":
      return { ...initialState(), paired: state.paired, station: state.station };
    default:
      return state;
  }
}

const Ctx = createContext(null);

export function KdsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [now, setNow] = useState(Date.now());
  const [alert, setAlert] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);
  const alertTimer = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const fireAlert = (order) => {
    setAlert(order);
    if (state.settings.soundOn) playAlert({ volume: state.settings.volume, repeat: state.settings.repeat });
    clearTimeout(alertTimer.current);
    alertTimer.current = setTimeout(() => setAlert(null), (state.settings.alertDuration || 5) * 1000);
  };

  const actions = useMemo(
    () => ({
      setPaired: (v) => dispatch({ type: "patch", payload: { paired: v } }),
      setStation: (station) => dispatch({ type: "patch", payload: { station } }),
      setSettings: (p) => dispatch({ type: "settings", payload: p }),
      setColors: (p) => dispatch({ type: "colors", payload: p }),
      resetColors: () => dispatch({ type: "colors", payload: { ...DEFAULT_COLORS } }),
      setConnection: (p) => dispatch({ type: "connection", payload: p }),
      advance: (id) => dispatch({ type: "advance", id }),
      removeOrder: (id) => dispatch({ type: "removeOrder", id }),
      setPriority: (id, priority) => dispatch({ type: "priority", id, priority }),
      toggleDevice: (id, connected) => {
        dispatch({ type: "device", id, connected });
        if (id === "pos") dispatch({ type: "connection", payload: { posConnected: connected } });
        if (id === "token") dispatch({ type: "connection", payload: { tokenScreenConnected: connected } });
        if (id === "printer") dispatch({ type: "connection", payload: { printerConnected: connected } });
      },
      setItemAvailability: async (id, available) => {
        dispatch({ type: "menu", id, available });
        const res = await syncToPOS({ itemId: id, available });
        setLastSynced({ id, at: res.syncedAt });
        return res;
      },
      newKot: (station) => {
        const o = generateKot(state.nextKot, station || state.station);
        dispatch({ type: "addOrder", order: o });
        fireAlert(o);
        return o;
      },
      markRandomReady: () => {
        const cand = state.orders.filter((o) => o.status === "cooking");
        if (!cand.length) return null;
        const o = cand[Math.floor(Math.random() * cand.length)];
        dispatch({ type: "advance", id: o.id });
        return o;
      },
      simulateDelayed: () => {
        const cand = state.orders.filter((o) => o.status === "new" || o.status === "cooking");
        if (!cand.length) return null;
        const o = cand[Math.floor(Math.random() * cand.length)];
        dispatch({
          type: "patch",
          payload: {
            orders: state.orders.map((x) =>
              x.id === o.id ? { ...x, createdAt: Date.now() - 16 * 60 * 1000, priority: "urgent" } : x
            ),
          },
        });
        return o;
      },
      resetDemo: () => dispatch({ type: "reset" }),
      dismissAlert: () => setAlert(null),
      testAlert: fireAlert,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state]
  );

  return (
    <Ctx.Provider value={{ state, actions, now, alert, lastSynced }}>{children}</Ctx.Provider>
  );
}

export const useKds = () => useContext(Ctx);

export function ageOf(order, now) {
  const s = Math.max(0, Math.floor((now - order.createdAt) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return { seconds: s, text: `${mm}:${ss}` };
}

export function ageLevel(seconds) {
  if (seconds < 300) return "fresh";
  if (seconds < 600) return "warning";
  return "delayed";
}
