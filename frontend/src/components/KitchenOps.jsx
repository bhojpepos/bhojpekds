import React, { useEffect, useState } from "react";
import { useKds, formatDuration } from "@/state/kdsState";
import * as api from "@/services/apiService";
import { Printer, RefreshCw, Check, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const PrintQueue = () => {
  const { state, actions, lastPrintJob } = useKds();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setJobs(await api.fetchPrintJobs(30));
    } catch {
      toast.error("Printer queue unavailable");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPrintJob]);

  return (
    <div className="space-y-3" data-testid="print-queue">
      <div className="flex items-center gap-3 justify-between bg-white border border-[#E5E7EB] rounded-md p-3">
        <div>
          <div className="text-sm font-bold">Auto-print new KOTs</div>
          <div className="text-xs opacity-55">Send each new ticket straight to the kitchen printer</div>
        </div>
        <Switch
          data-testid="auto-print-toggle"
          checked={state.settings.autoPrint}
          onCheckedChange={(v) => actions.setSettings({ autoPrint: v })}
        />
      </div>

      <button
        data-testid="reload-print-jobs-btn"
        onClick={load}
        className="w-full min-h-[48px] rounded-md border border-[#E5E7EB] bg-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#F7F7F7]"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh Queue
      </button>

      {jobs.length === 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-md p-4 text-sm opacity-60">No print jobs yet.</div>
      )}

      {jobs.map((j) => (
        <div key={j.id} className="bg-white border border-[#E5E7EB] rounded-md p-3" data-testid={`print-job-${j.kot}`}>
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 opacity-60" />
            <span className="text-sm font-bold">KOT #{j.kot}</span>
            <span
              className="text-[11px] font-extrabold tracking-wider rounded px-1.5 py-0.5"
              style={{
                background: j.status === "printed" ? "#ECFDF5" : j.status === "failed" ? "#FEF2F2" : "#FFFBEB",
                color: j.status === "printed" ? "#047857" : j.status === "failed" ? "#DC2626" : "#B45309",
              }}
            >
              {j.status.toUpperCase()}
            </span>
            <span className="text-xs opacity-55 ml-auto">{j.station}</span>
          </div>
          {j.reason && <div className="text-xs opacity-55 mt-1">{j.reason}</div>}
          <div className="flex gap-2 mt-2">
            <button
              data-testid={`print-job-send-${j.kot}`}
              onClick={async () => {
                actions.sendToPrinter(j);
                await api.ackPrintJob(j.id);
                load();
              }}
              className="flex-1 min-h-[44px] rounded-md bg-[#2C2C2C] text-white text-xs font-bold"
            >
              PRINT TICKET
            </button>
            <button
              data-testid={`print-job-ack-${j.kot}`}
              onClick={async () => {
                await api.ackPrintJob(j.id);
                load();
              }}
              className="min-h-[44px] px-3 rounded-md border border-[#E5E7EB] text-xs font-bold"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              data-testid={`print-job-retry-${j.kot}`}
              onClick={async () => {
                await api.retryPrintJob(j.id);
                load();
              }}
              className="min-h-[44px] px-3 rounded-md border border-[#E5E7EB] text-xs font-bold"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export const ShiftSummary = () => {
  const [data, setData] = useState(null);
  const [hours, setHours] = useState(12);

  const load = async (h) => {
    try {
      setData(await api.fetchShift(h));
    } catch {
      setData(null);
    }
  };

  useEffect(() => {
    load(hours);
  }, [hours]);

  if (!data) return <div className="bg-white border border-[#E5E7EB] rounded-md p-4 text-sm opacity-60" data-testid="shift-summary-empty">Shift data unavailable.</div>;

  const Stat = ({ label, value, testId }) => (
    <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
      <div className="text-xs font-bold uppercase tracking-widest opacity-55">{label}</div>
      <div className="font-head font-extrabold text-2xl mt-1" data-testid={testId}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-3" data-testid="shift-summary">
      <div className="flex gap-2">
        {[6, 12, 24].map((h) => (
          <button
            key={h}
            data-testid={`shift-hours-${h}`}
            onClick={() => setHours(h)}
            className={`flex-1 min-h-[44px] rounded-md border text-sm font-bold ${
              hours === h ? "bg-[#2C2C2C] text-white border-[#2C2C2C]" : "bg-white border-[#E5E7EB]"
            }`}
          >
            Last {h}h
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Orders Served" value={data.ordersServed} testId="shift-orders-served" />
        <Stat label="Items Served" value={data.itemsServed} testId="shift-items-served" />
        <Stat label="Orders Total" value={data.ordersTotal} />
        <Stat label="Avg Prep" value={formatDuration(data.avgPrepSeconds)} testId="shift-avg-prep" />
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
        <div className="text-xs font-bold uppercase tracking-widest opacity-55 mb-2">Slowest Dishes</div>
        {data.slowestDishes.length === 0 ? (
          <div className="text-sm opacity-55">Not enough cooked orders yet.</div>
        ) : (
          data.slowestDishes.map((d) => (
            <div key={d.name} className="flex items-center justify-between py-1.5 border-b border-[#F0F0F0] last:border-0" data-testid={`slow-dish-${d.name.replace(/\s+/g, "-").toLowerCase()}`}>
              <span className="text-sm font-semibold">{d.name}</span>
              <span className="text-sm font-extrabold text-[#DC2626]">{formatDuration(d.avgSeconds)}</span>
            </div>
          ))
        )}
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
        <div className="text-xs font-bold uppercase tracking-widest opacity-55 mb-2">Most Ordered</div>
        {data.topDishes.map((d) => (
          <div key={d.name} className="flex items-center justify-between py-1.5 border-b border-[#F0F0F0] last:border-0">
            <span className="text-sm font-semibold">{d.name}</span>
            <span className="text-sm font-extrabold">{d.qty}</span>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
        <div className="text-xs font-bold uppercase tracking-widest opacity-55 mb-2">By Station</div>
        {Object.entries(data.byStation).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-1.5 border-b border-[#F0F0F0] last:border-0">
            <span className="text-sm font-semibold">{k}</span>
            <span className="text-sm font-extrabold">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
