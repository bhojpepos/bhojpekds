import React from "react";
import { useKds, formatDuration } from "@/state/kdsState";
import { Gauge, Flame, Clock } from "lucide-react";

const LEVEL = {
  "on-track": { label: "ON TRACK", bg: "#ECFDF5", fg: "#047857", Icon: Gauge },
  busy: { label: "BUSY", bg: "#FFF7ED", fg: "#B45309", Icon: Clock },
  rush: { label: "RUSH HOUR", bg: "#FEF2F2", fg: "#DC2626", Icon: Flame },
};

export const RushIndicator = () => {
  const { state } = useKds();
  const r = state.rush;
  if (!r) return null;
  const l = LEVEL[r.level] || LEVEL["on-track"];
  return (
    <div
      data-testid="rush-indicator"
      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 border-b border-[#E5E7EB] bg-white overflow-x-auto thin-scroll"
    >
      <span
        data-testid="rush-level"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-extrabold tracking-wider"
        style={{ background: l.bg, color: l.fg }}
      >
        <l.Icon className={`w-4 h-4 ${r.level === "rush" ? "blink-soft" : ""}`} />
        {l.label}
      </span>
      <span className="shrink-0 text-xs font-semibold" data-testid="rush-behind">
        Avg behind by <b className="tabular-nums">{formatDuration(r.behindSeconds)}</b>
      </span>
      <span className="shrink-0 text-xs font-semibold opacity-70">
        {r.activeCount} active · {r.delayedCount} delayed
      </span>
      <span className="shrink-0 text-xs font-semibold opacity-70 hidden sm:inline">
        Oldest {formatDuration(r.oldestSeconds)} · {r.ordersLastHour} orders/hr
      </span>
      <span className="shrink-0 text-xs opacity-45 hidden lg:inline ml-auto">
        Target {formatDuration(r.targetSeconds)} per order
      </span>
    </div>
  );
};
