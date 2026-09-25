import React from "react";
import { ageOf, ageLevel, useKds } from "@/state/kdsState";
import { ACTION_LABEL } from "@/services/mockOrderService";
import { AlertTriangle, Clock, CheckCircle2, Flame, ChevronUp, Undo2, Printer, ArrowRightLeft, History, Utensils, ShoppingBag, Bike, BedDouble } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OrderHistoryDialog } from "@/components/Analytics";

const TYPE_META = {
  "dine-in": { label: "Dine In", Icon: Utensils },
  takeaway: { label: "Takeaway", Icon: ShoppingBag },
  delivery: { label: "Delivery", Icon: Bike },
  pickup: { label: "Pickup", Icon: ShoppingBag },
  // Real order_type from billing (hotel_room_id-based QR orders) — see
  // RoomQrBrowserController::storeOrder(), relayed in via
  // App\Listeners\RelayOrderToKds (wired directly from OrderService,
  // 2026-09-18 — EventServiceProvider itself is never registered).
  "room-service": { label: "Room Service", Icon: BedDouble },
};

// Channel the order was actually placed through — distinct from TYPE_META
// (which order is doesn't say who/what created it). Only rendered when it
// tells the kitchen something a plain counter order wouldn't already imply;
// no badge for the ordinary in-house POS case.
const SOURCE_LABEL = {
  online_bhojpe: "BHOJPE",
  online_website: "WEBSITE",
  online_zomato: "ZOMATO",
  online_swiggy: "SWIGGY",
  table_qr: "TABLE QR",
  captain_app: "CAPTAIN APP",
  room_service: "ROOM QR",
};

const TIMER_ICON = { fresh: Clock, warning: AlertTriangle, delayed: Flame };

const PRIORITY = {
  normal: null,
  high: { label: "HIGH PRIORITY", color: "#B45309" },
  urgent: { label: "URGENT", color: "#FF3131" },
};

export const KOTCard = ({ order }) => {
  const { now, state, actions } = useKds();
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const age = ageOf(order, now);
  const level = ageLevel(age.seconds, state.settings.slaMinutes * 60);
  const TimerIcon = TIMER_ICON[level];
  const type = TYPE_META[order.type] || TYPE_META["dine-in"];
  const statusColor = state.settings.colors[order.status];
  const pr = PRIORITY[order.priority];
  const isDone = order.status === "completed";
  const doneCount = order.items.filter((i) => i.done).length;
  // The type label is always shown now; this is the one extra piece of
  // context worth a kitchen/counter glance for that specific order type —
  // table for dine-in/room-service, pickup time for pickup/takeaway (only
  // ever set for a customer-app takeaway order today), customer name for
  // delivery — falling back to the order number when none of those apply.
  const context = order.table
    ? order.table
    : (order.type === "pickup" || order.type === "takeaway") && order.pickupAt
      ? new Date(order.pickupAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      : order.type === "delivery" && order.customerName
        ? order.customerName
        : order.refNo
          ? `#${order.refNo}`
          : null;
  const sourceLabel = SOURCE_LABEL[order.source];

  const cyclePriority = () => {
    const seq = ["normal", "high", "urgent"];
    actions.setPriority(order.id, seq[(seq.indexOf(order.priority) + 1) % seq.length]);
  };

  return (
    <div
      data-testid={`kot-card-${order.kot}`}
      className="kot-enter bg-white rounded-md border overflow-hidden shadow-sm"
      style={{ borderColor: pr ? pr.color : "#E5E7EB", borderWidth: pr ? 2 : 1 }}
    >
      {pr && (
        <div
          data-testid={`kot-priority-${order.kot}`}
          className="flex items-center gap-1.5 px-3 py-1 text-white k-note"
          style={{ background: pr.color }}
        >
          <ChevronUp className="w-4 h-4" />
          {pr.label}
        </div>
      )}

      {/* ── Ticket header: whole bar tinted by live status (red=new,
          yellow=cooking, green=ready) — the color itself is the at-a-glance
          signal, same language as the reference board. Type icon + context
          on top, order # / time / elapsed underneath. ── */}
      <div className="px-3 pt-2.5 pb-2 space-y-1.5 text-white" style={{ background: statusColor }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0" data-testid={`kot-type-${order.kot}`}>
            <type.Icon className="w-4 h-4 shrink-0 opacity-90" />
            <span className="k-meta font-bold truncate">
              {context || type.label}
            </span>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-white/50 shrink-0">
            {type.label}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="k-note text-white/85" data-testid={`kot-number-${order.kot}`}>
            Order #{order.kot}
            {sourceLabel ? ` · ${sourceLabel}` : ""}
          </span>
          <div className="flex items-center gap-1 shrink-0" data-testid={`kot-timer-${order.kot}`}>
            <TimerIcon className={`w-3.5 h-3.5 ${level === "delayed" ? "blink-soft" : "opacity-85"}`} />
            <span className="k-note font-bold tabular-nums">{age.text}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-1 bg-[#FAFAFA] border-b border-[#F0F0F0]" data-testid={`kot-progress-${order.kot}`}>
        <span className="k-note opacity-55">{doneCount}/{order.items.length} items done</span>
        <span className="k-note opacity-55">{order.station}</span>
      </div>

      {order.handoffs?.length > 0 && (
        <div data-testid={`kot-handoff-tag-${order.kot}`} className="k-note text-[#2563EB] bg-[#EFF6FF] px-3 py-1 text-center">
          moved from {order.handoffs[order.handoffs.length - 1].from}
        </div>
      )}

      {/* ── Item list — tap a line to strike it done, modifiers in italic gray ── */}
      <div className="px-3 py-2 space-y-2">
        {order.items.map((i, idx) => (
          <button
            key={idx}
            data-testid={`kot-${order.kot}-item-${idx}`}
            onClick={() => actions.toggleItemDone(order.id, idx, !i.done)}
            className="w-full text-left block rounded hover:bg-[#FAFAFA] py-0.5"
          >
            <span className={`k-item-qty ${i.done ? "opacity-35" : "text-[#111]"}`}>{i.qty}x </span>
            <span className={`k-item-name ${i.done ? "line-through opacity-35" : "text-[#111]"}`}>{i.name}</span>
            {i.note && (
              <div className={`k-note italic mt-0.5 ${i.done ? "opacity-35 line-through" : "text-[#6B7280]"}`}>
                {i.note}
              </div>
            )}
          </button>
        ))}
      </div>

      {order.note && (
        <div className="mx-3 mb-2 k-note font-extrabold text-[#DC2626]">NOTE: {order.note}</div>
      )}

      {/* ── Primary action ── */}
      <div className="px-3 pb-2.5">
        {isDone ? (
          <button
            data-testid={`kot-done-btn-${order.kot}`}
            onClick={() => actions.removeOrder(order.id)}
            className="k-action w-full rounded-md text-white flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.99]"
            style={{ background: state.settings.colors.completed }}
          >
            <CheckCircle2 className="w-5 h-5" /> {ACTION_LABEL.completed}
          </button>
        ) : (
          <button
            data-testid={`kot-action-btn-${order.kot}`}
            onClick={() => actions.advance(order.id)}
            className="k-action w-full rounded-md text-white hover:brightness-95 active:scale-[0.99]"
            style={{ background: "var(--bhoj-primary)" }}
          >
            {ACTION_LABEL[order.status]}
          </button>
        )}

        {/* ── Secondary actions — condensed to icon-only, kept fully functional ── */}
        <div className="mt-2 flex items-center gap-1.5">
          {order.status !== "new" && (
            <button
              data-testid={`kot-recall-btn-${order.kot}`}
              onClick={() => actions.recall(order.id)}
              title="Recall to previous status"
              className="min-h-[36px] px-2.5 rounded border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] text-[#2C2C2C]"
            >
              <Undo2 className="w-4 h-4" />
            </button>
          )}
          <button
            data-testid={`kot-priority-btn-${order.kot}`}
            onClick={cyclePriority}
            title="Change priority"
            className="min-h-[36px] px-2.5 rounded border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] text-[#2C2C2C]"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid={`kot-handoff-btn-${order.kot}`}
                title="Move station"
                className="min-h-[36px] px-2.5 rounded border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] text-[#2C2C2C]"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-white">
              <DropdownMenuLabel className="text-xs">Hand off KOT #{order.kot}</DropdownMenuLabel>
              {(state.connection.stations ?? []).filter((s) => s !== order.station).map((s) => (
                <DropdownMenuItem
                  key={s}
                  data-testid={`kot-handoff-${order.kot}-${s.replace(/\s+/g, "-").toLowerCase()}`}
                  onClick={() => actions.handoff(order.id, s)}
                >
                  {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            data-testid={`kot-print-btn-${order.kot}`}
            onClick={() => actions.printKot(order.id)}
            title="Print ticket"
            className="min-h-[36px] px-2.5 rounded border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7]"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            data-testid={`kot-history-btn-${order.kot}`}
            onClick={() => setHistoryOpen(true)}
            title="Order history"
            className="min-h-[36px] px-2.5 rounded border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7]"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>
      <OrderHistoryDialog order={order} open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
};
