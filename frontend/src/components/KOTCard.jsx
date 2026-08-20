import React from "react";
import { ageOf, ageLevel, useKds } from "@/state/kdsState";
import { ACTION_LABEL, NEXT_STATUS } from "@/services/mockOrderService";
import { AlertTriangle, Clock, CheckCircle2, Flame, Bike, ShoppingBag, Utensils, PackageCheck, ChevronUp, Undo2, Check } from "lucide-react";

const TYPE_META = {
  "dine-in": { label: "DINE-IN", Icon: Utensils },
  takeaway: { label: "TAKEAWAY", Icon: ShoppingBag },
  delivery: { label: "DELIVERY", Icon: Bike },
  pickup: { label: "PICKUP", Icon: PackageCheck },
};

const TIMER_STYLE = {
  fresh: { bg: "#ECFDF5", fg: "#047857", Icon: Clock, label: "ON TIME" },
  warning: { bg: "#FFF7ED", fg: "#B45309", Icon: AlertTriangle, label: "WARNING" },
  delayed: { bg: "#FEF2F2", fg: "#DC2626", Icon: Flame, label: "DELAYED" },
};

const PRIORITY = {
  normal: null,
  high: { label: "HIGH PRIORITY", color: "#B45309" },
  urgent: { label: "URGENT", color: "#FF3131" },
};

export const KOTCard = ({ order }) => {
  const { now, state, actions } = useKds();
  const age = ageOf(order, now);
  const level = ageLevel(age.seconds);
  const timer = TIMER_STYLE[level];
  const type = TYPE_META[order.type] || TYPE_META["dine-in"];
  const statusColor = state.settings.colors[order.status];
  const pr = PRIORITY[order.priority];
  const isDone = order.status === "completed";
  const doneCount = order.items.filter((i) => i.done).length;

  const cyclePriority = () => {
    const seq = ["normal", "high", "urgent"];
    actions.setPriority(order.id, seq[(seq.indexOf(order.priority) + 1) % seq.length]);
  };

  return (
    <div
      data-testid={`kot-card-${order.kot}`}
      className="kot-enter relative bg-white rounded-md border overflow-hidden"
      style={{ borderColor: pr ? pr.color : "#E5E7EB", borderWidth: pr ? 2 : 1 }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[6px]" style={{ background: statusColor }} />

      {pr && (
        <div
          data-testid={`kot-priority-${order.kot}`}
          className="flex items-center gap-1.5 pl-4 pr-3 py-1 text-white k-note"
          style={{ background: pr.color }}
        >
          <ChevronUp className="w-4 h-4" />
          {pr.label}
        </div>
      )}

      <div className="pl-4 pr-3 sm:pr-4 pt-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="k-token-label">KOT / TOKEN</div>
            <div className="k-token" data-testid={`kot-number-${order.kot}`}>
              {order.kot}
            </div>
          </div>
          <div
            data-testid={`kot-timer-${order.kot}`}
            className="rounded-md px-2.5 py-1.5 flex flex-col items-end"
            style={{ background: timer.bg, color: timer.fg }}
          >
            <div className="flex items-center gap-1.5">
              <timer.Icon className={`w-4 h-4 ${level === "delayed" ? "blink-soft" : ""}`} />
              <span className="k-timer">{age.text}</span>
            </div>
            <span className="text-[10px] font-bold tracking-wider">{timer.label}</span>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F3F4F6] text-[#2C2C2C] px-2 py-1 k-meta">
            <type.Icon className="w-4 h-4" />
            {type.label}
          </span>
          {(order.table || order.refNo) && (
            <span className="rounded-md px-2 py-1 k-meta bg-[#2C2C2C] text-white">{order.table || order.refNo}</span>
          )}
          <span className="k-meta opacity-60">{order.station}</span>
          {doneCount > 0 && (
            <span data-testid={`kot-progress-${order.kot}`} className="k-meta text-[#047857] bg-[#ECFDF5] rounded px-2 py-1">
              {doneCount}/{order.items.length} done
            </span>
          )}
        </div>

        <div className="mt-3 border-t border-b border-[#F0F0F0] py-2.5 space-y-2">
          {order.items.map((i, idx) => (
            <div key={idx} data-testid={`kot-${order.kot}-item-${idx}`}>
              <button
                data-testid={`kot-${order.kot}-item-tick-${idx}`}
                onClick={() => actions.toggleItemDone(order.id, idx, !i.done)}
                className="w-full text-left flex items-start gap-2.5 rounded hover:bg-[#FAFAFA] py-0.5"
              >
                <span
                  className="mt-0.5 w-6 h-6 shrink-0 rounded border flex items-center justify-center"
                  style={{
                    borderColor: i.done ? "#16A34A" : "#D4D4D8",
                    background: i.done ? "#16A34A" : "#FFFFFF",
                  }}
                >
                  {i.done && <Check className="w-4 h-4 text-white" />}
                </span>
                <span className={`k-item-qty shrink-0 ${i.done ? "opacity-40" : "text-[#FF3131]"}`}>{i.qty}×</span>
                <span className={`k-item-name ${i.done ? "line-through opacity-40" : ""}`}>{i.name}</span>
              </button>
              {i.note && (
                <div className={`k-note mt-1 ml-[54px] text-[#B45309] bg-[#FFFBEB] rounded px-2 py-1 inline-block ${i.done ? "opacity-40" : ""}`}>
                  {i.note}
                </div>
              )}
            </div>
          ))}
        </div>

        {order.note && (
          <div className="mt-2.5 k-note text-[#FF3131] bg-[#FEF2F2] rounded px-2 py-1.5">Note: {order.note}</div>
        )}

        <div className="mt-3 flex gap-2">
          {isDone ? (
            <button
              data-testid={`kot-done-btn-${order.kot}`}
              onClick={() => actions.removeOrder(order.id)}
              className="k-action flex-1 rounded-md text-white flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.99]"
              style={{ background: state.settings.colors.completed }}
            >
              <CheckCircle2 className="w-5 h-5" /> {ACTION_LABEL.completed}
            </button>
          ) : (
            <button
              data-testid={`kot-action-btn-${order.kot}`}
              onClick={() => actions.advance(order.id)}
              className="k-action flex-1 rounded-md text-white hover:brightness-95 active:scale-[0.99]"
              style={{ background: state.settings.colors[NEXT_STATUS[order.status]] }}
            >
              {ACTION_LABEL[order.status]}
            </button>
          )}
          {order.status !== "new" && (
            <button
              data-testid={`kot-recall-btn-${order.kot}`}
              onClick={() => actions.recall(order.id)}
              title="Recall to previous status"
              className="k-action px-3 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] text-[#2C2C2C]"
            >
              <Undo2 className="w-5 h-5" />
            </button>
          )}
          <button
            data-testid={`kot-priority-btn-${order.kot}`}
            onClick={cyclePriority}
            title="Change priority"
            className="k-action px-3 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] text-[#2C2C2C]"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
