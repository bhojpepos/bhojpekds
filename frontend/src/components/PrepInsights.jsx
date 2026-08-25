import React from "react";
import { useKds, formatDuration } from "@/state/kdsState";
import { Timer, TrendingUp, RefreshCw } from "lucide-react";

const barColor = (secs, worst) => {
  if (secs == null) return "#E5E7EB";
  const r = worst ? secs / worst : 0;
  if (r > 0.85) return "#DC2626";
  if (r > 0.6) return "#F59E0B";
  return "#16A34A";
};

export const PrepInsights = () => {
  const { state, actions } = useKds();
  const stats = state.stats;
  if (!stats) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-md p-4 text-sm opacity-60" data-testid="prep-insights-empty">
        No prep-time data yet. Move a few orders through COOKING → READY.
      </div>
    );
  }
  const rows = stats.stations || [];
  const worst = Math.max(1, ...rows.map((r) => r.avgSeconds || 0));

  return (
    <div className="space-y-3" data-testid="prep-insights">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
          <div className="text-xs font-bold uppercase tracking-widest opacity-55 flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5" /> Overall Avg
          </div>
          <div className="font-head font-extrabold text-2xl mt-1" data-testid="overall-avg">
            {formatDuration(stats.overallAvgSeconds)}
          </div>
        </div>
        <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
          <div className="text-xs font-bold uppercase tracking-widest opacity-55 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Active Orders
          </div>
          <div className="font-head font-extrabold text-2xl mt-1">
            {rows.reduce((s, r) => s + r.activeCount, 0)}
          </div>
        </div>
      </div>

      {rows.map((r) => (
        <div key={r.station} className="bg-white border border-[#E5E7EB] rounded-md p-3" data-testid={`prep-row-${r.station.replace(/\s+/g, "-").toLowerCase()}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">{r.station}</span>
            <span className="text-sm font-extrabold tabular-nums" style={{ color: barColor(r.avgSeconds, worst) }}>
              {formatDuration(r.avgSeconds)}
            </span>
          </div>
          <div className="h-2 rounded bg-[#F3F4F6] mt-2 overflow-hidden">
            <div
              className="h-full rounded"
              style={{ width: `${Math.min(100, ((r.avgSeconds || 0) / worst) * 100)}%`, background: barColor(r.avgSeconds, worst) }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs opacity-60">
            <span>{r.activeCount} active</span>
            <span>{r.completedCount} measured</span>
            <span>slowest {formatDuration(r.slowestSeconds)}</span>
          </div>
        </div>
      ))}

      <button
        data-testid="refresh-stats-btn"
        onClick={actions.refreshStats}
        className="w-full min-h-[48px] rounded-md border border-[#E5E7EB] bg-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#F7F7F7]"
      >
        <RefreshCw className="w-4 h-4" /> Refresh Insights
      </button>
    </div>
  );
};
