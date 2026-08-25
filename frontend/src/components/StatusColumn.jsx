import React from "react";
import { KOTCard } from "@/components/KOTCard";
import { STATUS_LABEL } from "@/services/mockOrderService";
import { useKds } from "@/state/kdsState";

export const StatusColumn = ({ status, orders }) => {
  const { state } = useKds();
  const color = state.settings.colors[status];
  return (
    <div className="flex flex-col min-h-0 h-full" data-testid={`column-${status}`}>
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b-2" style={{ borderColor: color }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
          <span className="k-col-title truncate" style={{ color: "#2C2C2C" }}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        <span
          data-testid={`column-count-${status}`}
          className="k-col-count rounded-md px-2.5 py-0.5 text-white"
          style={{ background: color }}
        >
          {orders.length}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto thin-scroll pr-1 space-y-3 pb-6">
        {orders.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#E5E7EB] bg-white/60 py-8 text-center k-meta opacity-50">
            No orders
          </div>
        ) : (
          orders.map((o) => <KOTCard key={o.id} order={o} />)
        )}
      </div>
    </div>
  );
};
