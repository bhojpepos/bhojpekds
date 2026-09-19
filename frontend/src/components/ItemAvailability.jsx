import React, { useState } from "react";
import { useKds } from "@/state/kdsState";
import { toast } from "sonner";
import { Search, Ban } from "lucide-react";

export const ItemAvailability = () => {
  const { state, actions } = useKds();
  const [q, setQ] = useState("");

  const toggle = async (item) => {
    const next = !item.available;
    await actions.setItemAvailability(item.id, next);
    toast.success(`${item.name} · ${next ? "Available" : "OUT OF STOCK"}`, { description: "Synced to POS" });
  };

  const list = state.menu.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-3" data-testid="items-screen">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
        <input
          data-testid="item-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search items"
          className="w-full min-h-[48px] pl-9 pr-3 rounded-md border border-[#E5E7EB] bg-white outline-none focus:border-[#FF3131]"
        />
      </div>

      <div className="text-xs opacity-55">Tap an item to mark it out of stock — tap again to bring it back.</div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
        {list.map((m) => (
          <button
            key={m.id}
            type="button"
            data-testid={`item-row-${m.id}`}
            onClick={() => toggle(m)}
            className="relative text-left bg-white border rounded-md p-3 min-h-[84px] flex flex-col justify-between hover:brightness-97 active:scale-[0.98]"
            style={{ borderColor: m.available ? "#E5E7EB" : "#FF3131", opacity: m.available ? 1 : 0.7 }}
          >
            {!m.available && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/40 rounded-md pointer-events-none">
                <Ban className="w-8 h-8 text-[#FF3131]/70" />
              </div>
            )}
            <div className={`text-sm font-bold truncate ${!m.available ? "line-through" : ""}`}>{m.name}</div>
            <div className="flex items-center justify-between gap-1 mt-1">
              <span className="text-[10px] opacity-50 truncate">{m.station}</span>
              <span
                data-testid={`item-status-${m.id}`}
                className="text-[10px] font-extrabold tracking-wider rounded px-1.5 py-0.5 shrink-0"
                style={{
                  background: m.available ? "#ECFDF5" : "#FEF2F2",
                  color: m.available ? "#047857" : "#DC2626",
                }}
              >
                {m.available ? "IN STOCK" : "OUT"}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
