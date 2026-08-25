import React, { useEffect, useState } from "react";
import * as api from "@/services/apiService";
import { useKds, formatDuration } from "@/state/kdsState";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

const ACTION_TEXT = {
  "status.cooking": "started cooking",
  "status.ready": "marked ready",
  "status.completed": "completed order",
  recall: "recalled order",
  handoff: "moved station",
  priority: "changed priority",
  item: "ticked item",
};

const when = (iso) => (iso ? iso.slice(11, 19) : "");

const EventRow = ({ e }) => (
  <div className="flex items-start gap-3 py-2 border-b border-[#F0F0F0] last:border-0" data-testid={`audit-row-${e.kot}`}>
    <span className="text-xs font-mono opacity-50 shrink-0 mt-0.5">{when(e.at)}</span>
    <div className="min-w-0">
      <div className="text-sm font-semibold">
        <span className="text-[#FF3131]">KOT #{e.kot}</span> · {ACTION_TEXT[e.action] || e.action}
      </div>
      <div className="text-xs opacity-60">
        {e.actor} · {e.station}
        {e.detail ? ` · ${e.detail}` : ""}
      </div>
    </div>
  </div>
);

export const OrderHistoryDialog = ({ order, open, onOpenChange }) => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (open && order) api.fetchOrderEvents(order.id).then(setEvents).catch(() => setEvents([]));
  }, [open, order]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white" data-testid="order-history-dialog">
        <DialogHeader>
          <DialogTitle>KOT #{order?.kot} history</DialogTitle>
          <DialogDescription>Who touched this order during the shift.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto thin-scroll">
          {events.length === 0 ? (
            <div className="text-sm opacity-60 py-3">No actions recorded yet for this order.</div>
          ) : (
            events.map((e) => <EventRow key={e.id} e={e} />)
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const AuditTrail = () => {
  const { lastAudit } = useKds();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setEvents(await api.fetchAudit(100));
    } catch {
      setEvents([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAudit]);

  return (
    <div className="space-y-3" data-testid="audit-trail">
      <button
        data-testid="reload-audit-btn"
        onClick={load}
        className="w-full min-h-[48px] rounded-md border border-[#E5E7EB] bg-white text-sm font-bold flex items-center justify-center gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh Trail
      </button>
      <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
        <div className="text-xs font-bold uppercase tracking-widest opacity-55 mb-1 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" /> Shift activity
        </div>
        {events.length === 0 ? (
          <div className="text-sm opacity-60 py-2">No activity yet. Move an order to record the first entry.</div>
        ) : (
          events.map((e) => <EventRow key={e.id} e={e} />)
        )}
      </div>
    </div>
  );
};

export const WeeklyTrends = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.fetchWeekly().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return <div className="bg-white border border-[#E5E7EB] rounded-md p-4 text-sm opacity-60" data-testid="weekly-empty">Weekly data unavailable.</div>;

  const Row = ({ d, testId }) => {
    const up = (d.deltaSeconds || 0) > 0;
    return (
      <div className="flex items-center justify-between py-2 border-b border-[#F0F0F0] last:border-0" data-testid={testId}>
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{d.name}</div>
          <div className="text-xs opacity-55">
            this week {formatDuration(d.thisWeekAvgSeconds)} · last week {formatDuration(d.lastWeekAvgSeconds)}
          </div>
        </div>
        <span
          className="text-sm font-extrabold flex items-center gap-1 shrink-0"
          style={{ color: up ? "#DC2626" : "#047857" }}
        >
          {up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {up ? "+" : "−"}
          {formatDuration(Math.abs(d.deltaSeconds))}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-3" data-testid="weekly-trends">
      <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
        <div className="text-xs font-bold uppercase tracking-widest opacity-55 mb-2">Slowing Down</div>
        {data.slowingDown.length === 0 ? (
          <div className="text-sm opacity-55">No dish is slower than last week yet.</div>
        ) : (
          data.slowingDown.map((d) => <Row key={d.name} d={d} testId={`slowing-${d.name.replace(/\s+/g, "-").toLowerCase()}`} />)
        )}
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
        <div className="text-xs font-bold uppercase tracking-widest opacity-55 mb-2">Speeding Up</div>
        {data.speedingUp.length === 0 ? (
          <div className="text-sm opacity-55">No comparison data yet — needs two weeks of orders.</div>
        ) : (
          data.speedingUp.map((d) => <Row key={d.name} d={d} testId={`speeding-${d.name.replace(/\s+/g, "-").toLowerCase()}`} />)
        )}
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
        <div className="text-xs font-bold uppercase tracking-widest opacity-55 mb-2">This Week's Dishes</div>
        {data.dishes.slice(0, 12).map((d) => (
          <div key={d.name} className="flex items-center justify-between py-1.5 border-b border-[#F0F0F0] last:border-0">
            <span className="text-sm font-semibold truncate">{d.name}</span>
            <span className="text-sm font-extrabold tabular-nums">
              {formatDuration(d.thisWeekAvgSeconds)} <span className="opacity-45 font-semibold">· {d.thisWeekQty} sold</span>
            </span>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
        <div className="text-xs font-bold uppercase tracking-widest opacity-55 mb-2">Orders Per Day</div>
        {data.ordersPerDay.length === 0 ? (
          <div className="text-sm opacity-55">No orders this week.</div>
        ) : (
          data.ordersPerDay.map((d) => (
            <div key={d.day} className="flex items-center gap-3 py-1.5">
              <span className="text-xs opacity-60 w-24 shrink-0">{d.day}</span>
              <div className="flex-1 h-2 rounded bg-[#F3F4F6] overflow-hidden">
                <div
                  className="h-full bg-[#FF3131]"
                  style={{ width: `${Math.min(100, (d.count / Math.max(...data.ordersPerDay.map((x) => x.count))) * 100)}%` }}
                />
              </div>
              <span className="text-sm font-extrabold w-8 text-right">{d.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
