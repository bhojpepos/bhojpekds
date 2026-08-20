import React, { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useKds } from "@/state/kdsState";
import { toast } from "sonner";
import { CheckCircle2, Search } from "lucide-react";

export const ItemAvailability = () => {
  const { state, actions } = useKds();
  const [pending, setPending] = useState(null);
  const [q, setQ] = useState("");
  const [synced, setSynced] = useState({});

  const apply = async (item, available) => {
    await actions.setItemAvailability(item.id, available);
    setSynced((s) => ({ ...s, [item.id]: true }));
    toast.success(`${item.name} · ${available ? "Available" : "OUT OF STOCK"}`, { description: "Synced to POS" });
  };

  const onToggle = (item, next) => {
    if (!next) setPending(item);
    else apply(item, true);
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

      {list.map((m) => (
        <div
          key={m.id}
          data-testid={`item-row-${m.id}`}
          className="flex items-center gap-3 bg-white border rounded-md p-3"
          style={{ borderColor: m.available ? "#E5E7EB" : "#FF3131" }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{m.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                data-testid={`item-status-${m.id}`}
                className="text-[11px] font-extrabold tracking-wider rounded px-1.5 py-0.5"
                style={{
                  background: m.available ? "#ECFDF5" : "#FEF2F2",
                  color: m.available ? "#047857" : "#DC2626",
                }}
              >
                {m.available ? "AVAILABLE" : "OUT OF STOCK"}
              </span>
              <span className="text-[11px] opacity-50">{m.station}</span>
              {synced[m.id] && (
                <span className="text-[11px] text-[#16A34A] flex items-center gap-1" data-testid={`item-synced-${m.id}`}>
                  <CheckCircle2 className="w-3 h-3" /> Synced to POS
                </span>
              )}
            </div>
          </div>
          <Switch data-testid={`item-toggle-${m.id}`} checked={m.available} onCheckedChange={(v) => onToggle(m, v)} />
        </div>
      ))}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent className="bg-white" data-testid="oos-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {pending?.name} as Out of Stock?</AlertDialogTitle>
            <AlertDialogDescription>
              The item stays on the menu — only its availability changes and syncs to the POS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="oos-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="oos-confirm-btn"
              className="bg-[#FF3131] hover:bg-[#e02a2a]"
              onClick={() => {
                apply(pending, false);
                setPending(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
