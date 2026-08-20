import { wsUrl } from "@/services/apiService";

// Live order feed from the BhojPe server. Auto-reconnects.
export function connectRealtime({ onEvent, onStatus }) {
  let ws = null;
  let closed = false;
  let retry = null;

  const open = () => {
    try {
      ws = new WebSocket(wsUrl());
    } catch {
      schedule();
      return;
    }
    ws.onopen = () => onStatus?.(true);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event !== "ping") onEvent?.(msg.event, msg.payload);
      } catch {
        /* ignore malformed frame */
      }
    };
    ws.onclose = () => {
      onStatus?.(false);
      schedule();
    };
    ws.onerror = () => ws?.close();
  };

  const schedule = () => {
    if (closed) return;
    clearTimeout(retry);
    retry = setTimeout(open, 3000);
  };

  open();
  return () => {
    closed = true;
    clearTimeout(retry);
    ws?.close();
  };
}
