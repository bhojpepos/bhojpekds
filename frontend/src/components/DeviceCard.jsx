import React, { useState } from "react";
import { Dot } from "@/components/ConnectionStatus";
import { Monitor, Printer, Tv, Server, Pencil, Unplug } from "lucide-react";

const ICONS = { desktop_pos: Server, kds: Monitor, captain_app: Tv, printer: Printer };
const TYPE_LABEL = { desktop_pos: "POS", kds: "Kitchen Display", captain_app: "Captain App" };

// Real device row from billing's GET /devices (DeviceController::index) —
// {id, name, type, platform, status: 'connected'|'offline', lastSeen}.
export const DeviceCard = ({ device, onRename, onDisconnect }) => {
  const Icon = ICONS[device.type] || Monitor;
  const [busy, setBusy] = useState(false);
  const connected = device.status === "connected";

  const handleRename = async () => {
    const next = window.prompt("Rename device", device.name);
    if (!next || !next.trim() || next.trim() === device.name) return;
    setBusy(true);
    try {
      await onRename(device.id, next.trim());
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(`Disconnect "${device.name}"? It will need to be paired again to reconnect.`)) return;
    setBusy(true);
    try {
      await onDisconnect(device.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid={`device-card-${device.id}`}
      className="flex items-center gap-3 bg-white border border-[#E5E7EB] rounded-md p-3"
    >
      <div className="w-10 h-10 rounded-md bg-[#F7F7F7] flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#2C2C2C]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">{device.name}</div>
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: connected ? "#16A34A" : "#DC2626" }}>
          <Dot ok={connected} />
          {connected ? "Connected" : "Offline"}
        </div>
        <div className="text-[11px] opacity-50 mt-0.5">
          {TYPE_LABEL[device.type] || device.type} · {device.platform && device.platform !== "—" ? `${device.platform} · ` : ""}
          Last seen {device.lastSeen}
        </div>
      </div>
      <button
        data-testid={`device-rename-${device.id}`}
        onClick={handleRename}
        disabled={busy}
        title="Rename"
        className="w-9 h-9 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] flex items-center justify-center disabled:opacity-40 shrink-0"
      >
        <Pencil className="w-4 h-4" />
      </button>
      <button
        data-testid={`device-disconnect-${device.id}`}
        onClick={handleDisconnect}
        disabled={busy}
        title="Disconnect"
        className="w-9 h-9 rounded-md border border-[#FECACA] bg-white hover:bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center disabled:opacity-40 shrink-0"
      >
        <Unplug className="w-4 h-4" />
      </button>
    </div>
  );
};
