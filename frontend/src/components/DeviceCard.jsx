import React from "react";
import { Dot } from "@/components/ConnectionStatus";
import { Switch } from "@/components/ui/switch";
import { Monitor, Printer, Tv, Server } from "lucide-react";

const ICONS = { pos: Server, kds: Monitor, token: Tv, printer: Printer };

export const DeviceCard = ({ device, onToggle }) => {
  const Icon = ICONS[device.id] || Monitor;
  return (
    <div
      data-testid={`device-card-${device.id}`}
      className="flex items-center gap-3 bg-white border border-[#E5E7EB] rounded-md p-3"
    >
      <div className="w-10 h-10 rounded-md bg-[#F7F7F7] flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#2C2C2C]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold">{device.name}</div>
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: device.connected ? "#16A34A" : "#DC2626" }}>
          <Dot ok={device.connected} />
          {device.connected ? "Connected" : "Disconnected"}
        </div>
        <div className="text-[11px] opacity-50 font-mono mt-0.5">{device.code}</div>
      </div>
      <Switch
        data-testid={`device-toggle-${device.id}`}
        checked={device.connected}
        onCheckedChange={(v) => onToggle(device.id, v)}
      />
    </div>
  );
};
