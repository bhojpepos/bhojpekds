import React from "react";
import { useKds } from "@/state/kdsState";
import { X, BellRing } from "lucide-react";

export const NewOrderAlert = () => {
  const { alert, actions } = useKds();
  if (!alert) return null;
  const items = alert.items.reduce((s, i) => s + i.qty, 0);
  return (
    <div
      data-testid="new-order-alert"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#FF3131]/95 backdrop-blur-sm px-6"
      onClick={actions.dismissAlert}
    >
      <div className="alert-pop text-center text-white">
        <div className="flex items-center justify-center gap-3 mb-4">
          <BellRing className="w-9 h-9 blink-soft" />
          <span className="font-head text-2xl sm:text-4xl font-extrabold tracking-[0.2em]">NEW ORDER</span>
        </div>
        <div className="font-head text-6xl sm:text-8xl font-extrabold tracking-tight">KOT #{alert.kot}</div>
        <div className="mt-4 text-lg sm:text-2xl font-semibold tracking-widest">
          {String(items).padStart(2, "0")} ITEMS
        </div>
        <div className="mt-2 text-base opacity-90 uppercase tracking-wider">
          {alert.type} {alert.table || alert.refNo || ""}
        </div>
        <button
          data-testid="dismiss-alert-btn"
          className="mt-8 inline-flex items-center gap-2 bg-white text-[#FF3131] rounded-md px-6 min-h-[52px] font-bold tracking-wider"
        >
          <X className="w-5 h-5" /> DISMISS
        </button>
      </div>
    </div>
  );
};
