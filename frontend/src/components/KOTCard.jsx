import React from "react";
import { ageOf, ageLevel, useKds } from "@/state/kdsState";
import { ACTION_LABEL } from "@/services/mockOrderService";
import { CheckCircle2, ChevronUp, Undo2, Printer, ArrowRightLeft, History, Timer, Armchair, ChefHat, UserRound } from "lucide-react";
import { OrderTypeIcon } from "@/components/OrderTypeIcon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OrderHistoryDialog } from "@/components/Analytics";
import { light as BP } from '../theme/tokens'

// Minimal KOT card (2026-10-06) — Bhojpe POS ke "KOT" screen jaisa:
// safed card, upar KOT no · order no + status pill, ek line type / timer,
// ek line table / station, items (qty right), icon buttons, neeche poori
// chaudai ka neela main button. Status ka rang sirf chhoti pill-dot / column
// dot me — card header ab rang se nahi bharta.

const TYPE_LABEL = {
  "dine-in": "Dine In",
  takeaway: "Pick Up",
  delivery: "Delivery",
  pickup: "Pick Up",
  // Real order_type from billing (hotel_room_id-based QR orders) — see
  // RoomQrBrowserController::storeOrder(), relayed in via
  // App\Listeners\RelayOrderToKds.
  "room-service": "Room Service",
};
// Online channels → neela "Online · Zomato" badge; baaki source sirf grey text
const ONLINE_SOURCES = new Set(["online_bhojpe", "online_website", "online_zomato", "online_swiggy"]);

// Channel the order was placed through — only shown when it adds info.
const SOURCE_LABEL = {
  online_bhojpe: "Bhojpe",
  online_website: "Website",
  online_zomato: "Zomato",
  online_swiggy: "Swiggy",
  table_qr: "Table QR",
  captain_app: "Captain",
  room_service: "Room QR",
};

const STATUS_PILL = { new: "Pending", cooking: "Cooking", ready: "Ready", completed: "Done" };
const titleCase = (s = "") => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

const PRIORITY = {
  normal: null,
  high: { label: "High", color: "#F59F00", bg: "#FFF4E6" },
  urgent: { label: "Urgent", color: BP.status.danger, bg: "#FFF5F5" },
};

const TIMER_COLOR = { fresh: "#495057", warning: "#E8590C", delayed: BP.status.danger };
const TIMER_BG = { fresh: "#F1F3F5", warning: "#FFF4E6", delayed: "#FFF5F5" };
// Table label "area letter / table no" — billing ab "G/1" bhejta hai; purane
// orders me "Ground Floor / 1" aata tha, use bhi "G/1" dikhao.
const tableLabel = (order) => {
  const t = String(order.table || "").trim();
  if (!t || order.type === "room-service") return t;
  const m = t.match(/^(.+?)\s*\/\s*(.+)$/);
  if (!m) return t;
  const letter = (m[1].match(/[A-Za-z]/) || [""])[0].toUpperCase();
  return letter ? `${letter}/${m[2]}` : t;
};
// "Main Kitchen" → "Main" (chip me jagah bachane ke liye)
const shortStation = (s = "") => String(s).replace(/\s*kitchen\s*/i, " ").trim() || s;

// "Farmhouse Pizza (Regular)" → name + variant (variant neele rang me)
const splitVariant = (name = "") => {
  const m = String(name).match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  return m ? { base: m[1], variant: m[2] } : { base: name, variant: "" };
};

const iconBtn = "inline-flex items-center justify-center rounded-lg border border-[#E9ECEF] bg-white text-[#212529] hover:bg-[#F8F9FA] active:scale-[0.97] transition";
const iconBtnStyle = { width: "calc(40px * var(--k))", height: "calc(40px * var(--k))" };

export const KOTCard = ({ order }) => {
  const { now, state, actions } = useKds();
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const age = ageOf(order, now);
  const level = ageLevel(age.seconds, state.settings.slaMinutes * 60);
  const typeLabel = TYPE_LABEL[order.type] || TYPE_LABEL["dine-in"];
  const isOnline = ONLINE_SOURCES.has(order.source);
  const pr = PRIORITY[order.priority];
  const isDone = order.status === "completed";
  const statusColor = state.settings.colors[order.status];
  const context = order.table
    ? null
    : (order.type === "pickup" || order.type === "takeaway") && order.pickupAt
      ? new Date(order.pickupAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      : order.type === "delivery" && order.customerName
        ? order.customerName
        : null;
  const sourceLabel = order.source === "captain_app" && order.createdByName
    ? order.createdByName
    : SOURCE_LABEL[order.source];

  const cyclePriority = () => {
    const seq = ["normal", "high", "urgent"];
    actions.setPriority(order.id, seq[(seq.indexOf(order.priority) + 1) % seq.length]);
  };

  return (
    <div
      data-testid={`kot-card-${order.kot}`}
      className="kot-enter bg-white rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${pr ? pr.color : "#EEF0F2"}`, boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}
    >
      {/* ── Header ──
          1: KOT no · order no  |  order-type icon (beech me, bg = status ka rang)  |  timer
          2: chhote chips — table · kitchen · captain · Online / priority
          Status text (Pending / Cooking…) nahi — icon ka rang hi status batata hai. */}
      <div className="px-4 pt-3 pb-2.5 space-y-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="k-kot-no text-[#111111] shrink-0" data-testid={`kot-number-${order.kot}`}>KOT {order.kot}</span>
            {order.refNo ? <span className="k-note text-[#ADB5BD] truncate">#{order.refNo}</span> : null}
          </div>
          <span
            className="k-type-badge rounded-full flex items-center justify-center text-white"
            style={{ background: statusColor }}
            title={`${typeLabel} · ${STATUS_PILL[order.status] || order.status}`}
            data-testid={`kot-type-icon-${order.kot}`}
          >
            <OrderTypeIcon type={order.type} size={22} />
          </span>
          <span
            className="justify-self-end k-timer-pill inline-flex items-center gap-1 tabular-nums"
            style={{ color: TIMER_COLOR[level], background: TIMER_BG[level] }}
            data-testid={`kot-timer-${order.kot}`}
          >
            <Timer className={`w-3.5 h-3.5 ${level === "delayed" ? "blink-soft" : ""}`} />
            {age.text}
          </span>
        </div>

        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden" data-testid={`kot-type-${order.kot}`} title={typeLabel}>
          {order.table ? (
            <span className="k-chip"><Armchair className="w-3 h-3 shrink-0" /><span className="truncate">{tableLabel(order)}</span></span>
          ) : context ? (
            <span className="k-chip"><UserRound className="w-3 h-3 shrink-0" /><span className="truncate">{context}</span></span>
          ) : null}
          {order.station && (
            <span className="k-chip"><ChefHat className="w-3 h-3 shrink-0" /><span className="truncate">{shortStation(order.station)}</span></span>
          )}
          {!isOnline && sourceLabel && (
            <span className="k-chip"><UserRound className="w-3 h-3 shrink-0" /><span className="truncate">{sourceLabel}</span></span>
          )}
          {isOnline && (
            <span className="k-chip" style={{ background: "#E7F5FF", color: "#1971C2" }} data-testid={`kot-online-${order.kot}`}>
              Online{SOURCE_LABEL[order.source] ? ` · ${SOURCE_LABEL[order.source]}` : ""}
            </span>
          )}
          {pr && (
            <span data-testid={`kot-priority-${order.kot}`} className="k-chip" style={{ color: pr.color, background: pr.bg }}>{pr.label}</span>
          )}
          {order.handoffs?.length > 0 && (
            <span data-testid={`kot-handoff-tag-${order.kot}`} className="k-chip" style={{ color: "#1971C2" }}>from {shortStation(order.handoffs[order.handoffs.length - 1].from)}</span>
          )}
        </div>
      </div>

      {/* ── Items — tap = "ban gaya" (green ✓), dobara tap = hatao ── */}
      <div className="border-t border-[#F1F3F5]">
        {order.items.map((i, idx) => {
          const { base, variant } = splitVariant(i.name);
          return (
            <button
              key={idx}
              data-testid={`kot-${order.kot}-item-${idx}`}
              onClick={() => actions.toggleItemDone(order.id, idx, !i.done)}
              title={i.done ? "Ban gaya — dobara tap karke hatao" : "Ban jaye to tap karo"}
              className={`w-full text-left flex items-start gap-2 px-4 py-2.5 border-b border-[#F1F3F5] transition-colors ${i.done ? "bg-[#EBFBEE]" : "hover:bg-[#F8F9FA]"}`}
            >
              {i.done ? <CheckCircle2 data-testid={`kot-${order.kot}-item-${idx}-done`} className="w-5 h-5 mt-0.5 shrink-0" style={{ color: BP.status.success }} /> : null}
              <span className="min-w-0 flex-1">
                <span className={`k-item-name ${i.done ? "text-[#2B8A3E]" : "text-[#111111]"}`}>{base}</span>
                {variant ? <span className="k-item-name" style={{ color: i.done ? "#2B8A3E" : "#228BE6" }}> ({variant})</span> : null}
                {i.note && (
                  <span className={`block k-note italic mt-0.5 ${i.done ? "text-[#2F9E44]" : "text-[#868E96]"}`}>{i.note}</span>
                )}
              </span>
              <span className={`k-item-qty shrink-0 ${i.done ? "text-[#2B8A3E]" : "text-[#111111]"}`}>{i.qty}</span>
            </button>
          );
        })}
      </div>

      {order.note && (
        <div className="px-4 py-2 k-note text-[#C92A2A] bg-[#FFF5F5] border-b border-[#F1F3F5]">Note: {order.note}</div>
      )}

      {/* ── Actions: icon buttons + poori chaudai ka main button ── */}
      <div className="px-4 pt-3 pb-3.5 space-y-2.5">
        <div className="flex items-center gap-2">
          <button data-testid={`kot-print-btn-${order.kot}`} onClick={() => actions.printKot(order.id)} title="Print ticket" className={iconBtn} style={iconBtnStyle}>
            <Printer className="w-[18px] h-[18px]" />
          </button>
          {order.status !== "new" && (
            <button data-testid={`kot-recall-btn-${order.kot}`} onClick={() => actions.recall(order.id)} title="Recall to previous status" className={iconBtn} style={iconBtnStyle}>
              <Undo2 className="w-[18px] h-[18px]" />
            </button>
          )}
          <button data-testid={`kot-priority-btn-${order.kot}`} onClick={cyclePriority} title="Change priority" className={iconBtn} style={iconBtnStyle}>
            <ChevronUp className="w-[18px] h-[18px]" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid={`kot-handoff-btn-${order.kot}`} title="Move station" className={iconBtn} style={iconBtnStyle}>
                <ArrowRightLeft className="w-[18px] h-[18px]" />
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
          <button data-testid={`kot-history-btn-${order.kot}`} onClick={() => setHistoryOpen(true)} title="Order history" className={`${iconBtn} ml-auto`} style={iconBtnStyle}>
            <History className="w-[18px] h-[18px]" />
          </button>
        </div>

        {isDone ? (
          <button
            data-testid={`kot-done-btn-${order.kot}`}
            onClick={() => actions.removeOrder(order.id)}
            className="k-action w-full rounded-lg text-white flex items-center justify-center gap-2 bg-[var(--bp-button-primary-bg)] hover:bg-[var(--bp-button-primary-hover)] active:scale-[0.99] transition"
          >
            <CheckCircle2 className="w-5 h-5" /> {titleCase(ACTION_LABEL.completed)}
          </button>
        ) : (
          <button
            data-testid={`kot-action-btn-${order.kot}`}
            onClick={() => actions.advance(order.id)}
            className="k-action w-full rounded-lg text-white bg-[var(--bp-button-primary-bg)] hover:bg-[var(--bp-button-primary-hover)] active:scale-[0.99] transition"
          >
            {titleCase(ACTION_LABEL[order.status])}
          </button>
        )}
      </div>
      <OrderHistoryDialog order={order} open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
};
