import React from "react";
import { KOTCard } from "@/components/KOTCard";
import { useKds } from "@/state/kdsState";

// Minimal column header (2026-10-06): chhota status dot + naam + grey count
// pill — rang se bhari border nahi (Bhojpe POS KOT screen jaisa saaf look).
const COLUMN_LABEL = { new: "Pending", cooking: "Cooking", ready: "Ready", completed: "Completed" };

export const StatusColumn = ({ status, orders }) => {
  const { state } = useKds();
  const color = state.settings.colors[status];
  return (
    <div className="flex flex-col min-h-0 h-full" data-testid={`column-${status}`}>
      <div className="flex items-center gap-2 px-1 pb-2.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="k-col-title truncate text-[#111111]">{COLUMN_LABEL[status] || status}</span>
        <span
          data-testid={`column-count-${status}`}
          className="k-col-count rounded-full px-2 py-0.5 bg-[#F1F3F5] text-[#495057]"
        >
          {orders.length}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto thin-scroll pr-1 space-y-3 pb-6">
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DEE2E6] bg-white/70 py-10 text-center k-meta text-[#ADB5BD]">
            No orders
          </div>
        ) : (
          orders.map((o) => <KOTCard key={o.id} order={o} />)
        )}
      </div>
    </div>
  );
};
