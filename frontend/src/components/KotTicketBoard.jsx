import React, { useEffect, useMemo, useRef, useState } from "react";
import { useKds, ageOf } from "@/state/kdsState";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OrderHistoryDialog } from "@/components/Analytics";
import { toast } from "sonner";

/* ── KOT board (2026-10-07) — Petpooja-KDS style ticket, same colours as
   Bhojpe POS Live View → KOT:
     header  : [ Table A6 / DINE IN ]  [ ✓ Food Ready ]   (type colour; orange = SLA crossed)
     sub-row : KOT no · MM:SS · B : biller
     items   : qty · name · on/off toggle ("ban gaya")
   Left panel = live item summary (total qty of every un-cooked item across
   the shown active KOTs). ── */

const F = "'Montserrat', system-ui, sans-serif";
const TYPE_KEY = { "dine-in": "Dine In", takeaway: "Pickup", pickup: "Pickup", delivery: "Delivery", "room-service": "Room Service" };
const TYPE_COLOR = { "Dine In": "#F2B33D", Pickup: "#3D9BE9", Delivery: "#2E8B3A", "Room Service": "#7C5CC4" };
const LIMIT_COLOR = "#F2662B";
const LEGEND = [
  { id: "Delivery", label: "Delivery", color: TYPE_COLOR.Delivery },
  { id: "limit", label: "Limit Exceed", color: LIMIT_COLOR },
  { id: "Dine In", label: "Dine In", color: TYPE_COLOR["Dine In"] },
  { id: "Pickup", label: "Pick Up", color: TYPE_COLOR.Pickup },
  { id: "Room Service", label: "Room Service", color: TYPE_COLOR["Room Service"] },
];
// Footer status filters — colours come from KDS Settings → Status colours
// (state.settings.colors: new / cooking / ready / completed).
// No "All" button (2026-10-08): nothing selected = all open KOTs; tap an
// active status again to go back to that view.
const STATUS_TABS = [
  { id: "new", label: "Accept" },
  { id: "cooking", label: "Cooking" },
  { id: "ready", label: "Ready" },
  { id: "completed", label: "Completed" },
];

// How a finished ticket left the pass — from billing (order.outcome) or by type.
const OUTCOME_BY_TYPE = { "dine-in": "served", "room-service": "served", delivery: "delivered", takeaway: "picked", pickup: "picked" };
const OUTCOME_LABEL = { served: "Served", delivered: "Delivered", picked: "Picked" };
// Where the order came from (billing relay `source`) — shown on every card
// (2026-10-10). Online channels get a blue chip; KDS uses no red.
const SOURCE_LABEL = {
  online_bhojpe: "Bhojpe", online_website: "Website", online_zomato: "Zomato", online_swiggy: "Swiggy",
  table_qr: "Table QR", captain_app: "Captain", room_service: "Room QR", kiosk: "Kiosk",
  pos_dinein: "POS", pos_pickup: "POS", pos_delivery: "POS",
};
const ONLINE_SOURCES = new Set(["online_bhojpe", "online_website", "online_zomato", "online_swiggy"]);
const outcomeOf = (o) => o.outcome || OUTCOME_BY_TYPE[o.type] || "served";
// Hex → light tint (mix with white) for the card header — KDS Settings colours.
const tint = (hex, amount = 0.16) => {
  const h = String(hex || "#6B7280").replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  const mix = (c) => Math.round(255 - (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
};
const createdMs = (o) => (typeof o.createdAt === "number" ? o.createdAt : Date.parse(o.createdAt));
const isOpen = (o) => o.status === "new" || o.status === "cooking";
const isLate = (o, now, slaMin) => isOpen(o) && createdMs(o) && now - createdMs(o) > slaMin * 60 * 1000;
const tableLabel = (o) => {
  const t = String(o.table || "").trim();
  const m = t.match(/^(.+?)\s*\/\s*(.+)$/);
  if (!m) return t.replace(/^(TABLE|T)[\s-]*/i, "") || "—";
  const letter = (m[1].match(/[A-Za-z]/) || [""])[0].toUpperCase();
  return letter ? `${letter}${m[2]}` : t;
};

const IcoSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const IcoCheckCircle = ({ size = 26 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
const IcoClose = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const REJECT_REASONS = ["Item khatam", "Kitchen band", "Galat order", "Customer ne mana kiya"];

// ✕ Reject confirm (2026-10-09) — orange, KDS uses no red.
function RejectDialog({ order, onClose, onDone }) {
  const { actions } = useKds();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await actions.rejectOrder(order.id, reason.trim() || null);
      toast.success(`KOT #${order.kot} reject — POS me bhi cancel ho gaya`);
      onDone();
    } catch (e) {
      toast.error(e.message);
      setBusy(false);
    }
  };
  return (
    <div onClick={busy ? undefined : onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(17,24,39,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div data-testid="kot-reject-dialog" onClick={(e) => e.stopPropagation()} style={{ width: "min(400px, 100%)", background: "#fff", borderRadius: 12, padding: 20, fontFamily: F, boxShadow: "0 20px 50px rgba(0,0,0,.25)" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#212529" }}>KOT #{order.kot} reject karein?</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 6, lineHeight: 1.45 }}>Ye KOT kitchen se hat jayega aur POS / bill me bhi cancel ho jayega ({order.items.length} item).</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
          {REJECT_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} style={{ height: 30, padding: "0 12px", borderRadius: 15, fontSize: 12.5, fontWeight: 600, fontFamily: F, cursor: "pointer", border: `1px solid ${reason === r ? "#E8590C" : "#DEE2E6"}`, background: reason === r ? "#FFF4E6" : "#fff", color: reason === r ? "#E8590C" : "#495057" }}>{r}</button>
          ))}
        </div>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Kaaran (optional)" maxLength={190} style={{ width: "100%", boxSizing: "border-box", height: 40, marginTop: 10, padding: "0 12px", border: "1px solid #DEE2E6", borderRadius: 8, fontSize: 13.5, fontFamily: F, outline: "none" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button type="button" onClick={onClose} disabled={busy} style={{ height: 40, padding: "0 18px", borderRadius: 8, border: "1px solid #DEE2E6", background: "#fff", color: "#343A40", fontSize: 14, fontWeight: 600, fontFamily: F, cursor: "pointer" }}>Wapas</button>
          <button type="button" data-testid="kot-reject-confirm" onClick={submit} disabled={busy} style={{ height: 40, padding: "0 18px", borderRadius: 8, border: "none", background: "#E8590C", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: F, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? "Reject ho raha…" : "Reject KOT"}</button>
        </div>
      </div>
    </div>
  );
}

const IcoPrint = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>;
const IcoUndo = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-1" /></svg>;
const IcoFlag = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>;
const IcoSwap = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>;
const IcoHistory = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>;
const IcoChevron = ({ open }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}><polyline points="6 9 12 15 18 9" /></svg>;

/* Petpooja-style on/off switch — grey off, green on ("ban gaya") */
function ItemToggle({ on, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={disabled ? undefined : onChange} disabled={disabled}
      title={disabled ? "Pehle KOT Accept karein" : label}
      style={{ position: "relative", width: 38, height: 20, borderRadius: 10, padding: 0, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, flexShrink: 0, border: `1px solid ${on ? "#2F9E44" : "#D0D5DB"}`, background: on ? "#2F9E44" : "#F1F3F5", transition: "background .15s, border-color .15s" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 14, height: 14, borderRadius: "50%", background: on ? "#fff" : "#C4C9CF", transition: "left .15s, background .15s" }} />
    </button>
  );
}

const PRIORITY = {
  normal: null,
  high: { label: "High", color: "#B4530F", bg: "#FFF0E3" },
  urgent: { label: "Urgent", color: "#D9480F", bg: "#FFF4E6" },
};
const shortStation = (s = "") => String(s).replace(/\s*kitchen\s*/i, " ").trim() || s;

function KotTicket({ order, now, slaMin }) {
  const { actions, state, undoItem } = useKds();
  const canUndo = undoItem?.id === order.id;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const type = TYPE_KEY[order.type] || "Dine In";
  const open = isOpen(order);
  const late = isLate(order, now, slaMin);
  // Card colour = KDS Settings → status colour (new / cooking / ready / completed),
  // shown as a light tint; SLA-crossed tickets keep an orange accent.
  const statusColor = state.settings.colors?.[order.status] || "#6B7280";
  // Card colour = status colour ALWAYS (an orange "late" override made a late
  // Accept KOT look like Cooking). Late is shown on the timer instead.
  const accent = statusColor;
  const headBg = tint(accent, 0.16);
  const where = type === "Dine In"
    ? { cap: "Table", val: order.table ? tableLabel(order) : "—", sub: "DINE IN" }
    : type === "Room Service"
      ? { cap: "Room", val: order.table || "—", sub: "ROOM SERVICE" }
      : { cap: "Order", val: order.refNo || order.kot, sub: type === "Delivery" ? "DELIVERY" : "PICK UP" };
  const age = ageOf(order, now);
  const biller = order.createdByName || order.waiterName || "";
  const doneCount = order.items.filter((i) => i.done).length;
  const pr = PRIORITY[order.priority];
  const otherStations = (state.connection.stations || []).filter((s) => s !== order.station);

  // Flow (2026-10-08): Accept → Cooking (tick every item) → Food Ready (only
  // once all items are ticked) → Served / Delivered / Picked (by order type;
  // also arrives automatically from billing when the POS serves/delivers).
  const allDone = order.items.length > 0 && doneCount === order.items.length;
  const outcomeLabel = OUTCOME_LABEL[outcomeOf(order)];
  const mainAction = order.status === "new"
    // Button colour = the card header's status colour (2026-10-09).
    ? { label: "Accept", bg: accent, run: () => actions.advance(order.id) }
    : order.status === "cooking"
      ? (allDone
        ? { label: "Food Ready", bg: accent, run: () => actions.advance(order.id) }
        : { label: `Food Ready ${doneCount}/${order.items.length}`, bg: accent, disabled: true, hint: "Pehle saare items toggle karein" })
      : order.status === "ready"
        ? { label: outcomeLabel, bg: accent, run: () => actions.advance(order.id) }
        : { label: "Clear", bg: accent, run: () => actions.removeOrder(order.id) };
  const cyclePriority = () => {
    const seq = ["normal", "high", "urgent"];
    actions.setPriority(order.id, seq[(seq.indexOf(order.priority || "normal") + 1) % seq.length]);
  };

  const cell = (cap, val, sub, last, color) => (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "7px 4px", borderRight: last ? "none" : `1px solid ${tint(accent, 0.35)}` }}>
      {cap ? <div style={{ fontSize: 11, fontWeight: cap === "LATE" ? 800 : 500, color: cap === "LATE" ? "#E8590C" : undefined, letterSpacing: cap === "LATE" ? 0.5 : 0 }}>{cap}</div> : null}
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.15, color: color || accent, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", filter: "brightness(0.8)" }}>{val}</div>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3 }}>{sub}</div>
    </div>
  );
  const iconBtn = { width: 32, height: 32, borderRadius: "50%", border: "1.5px solid #CED4DA", background: "#fff", color: "#495057", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 };

  return (
    <div data-testid={`kot-card-${order.kot}`}
      onDoubleClick={state.settings.dblClickAdvance && !mainAction.disabled ? (e) => { if (!e.target.closest("button")) mainAction.run(); } : undefined}
      style={{ display: "inline-block", width: "100%", background: "#fff", borderRadius: 6, boxShadow: "0 1px 4px rgba(0,0,0,0.12)", border: pr ? `1.5px solid ${pr.color}` : `1px solid ${tint(accent, 0.45)}`, borderTop: `4px solid ${accent}`, overflow: "hidden", fontFamily: F, opacity: order.status === "completed" ? 0.6 : 1, breakInside: "avoid", marginBottom: 14 }}>
      {/* Header: where · KOT no · timer */}
      <div style={{ display: "flex", background: headBg, color: "#343A40" }}>
        {cell(where.cap, where.val, where.sub)}
        {cell("KOT", order.kot, "NO.")}
        {cell(open ? (late ? "LATE" : "Time") : "Status", open ? age.text : order.status === "ready" ? "Ready" : outcomeLabel, open ? "MM : SS" : "", true, late ? "#E8590C" : undefined)}
      </div>

      {/* Info row: biller · station · priority · progress */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: "#F5F5F5", borderBottom: "1px solid #E9ECEF", fontSize: 11.5, color: "#6B7280", minWidth: 0 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>B : {biller || "—"}</span>
        {SOURCE_LABEL[order.source] ? (
          <span data-testid={`kot-source-${order.kot}`} style={{ flexShrink: 0, padding: "1px 7px", borderRadius: 10, fontWeight: 700,
            background: ONLINE_SOURCES.has(order.source) ? "#E7F5FF" : "#fff", color: ONLINE_SOURCES.has(order.source) ? "#1971C2" : "#434343",
            border: `1px solid ${ONLINE_SOURCES.has(order.source) ? "#A5D8FF" : "#E5E7EB"}` }}>
            {ONLINE_SOURCES.has(order.source) ? `Online · ${SOURCE_LABEL[order.source]}` : SOURCE_LABEL[order.source]}
          </span>
        ) : null}
        {order.station ? <span style={{ flexShrink: 0, padding: "1px 7px", borderRadius: 10, background: "#fff", border: "1px solid #E5E7EB", color: "#434343", fontWeight: 600 }}>{shortStation(order.station)}</span> : null}
        {pr ? <span style={{ flexShrink: 0, padding: "1px 7px", borderRadius: 10, background: pr.bg, color: pr.color, fontWeight: 700 }}>{pr.label}</span> : null}
        {order.handoffs?.length ? <span style={{ flexShrink: 0, color: "#1971C2", fontWeight: 600 }}>from {shortStation(order.handoffs[order.handoffs.length - 1].from)}</span> : null}
        <span style={{ marginLeft: "auto", flexShrink: 0, fontWeight: 700, color: doneCount === order.items.length && doneCount ? "#2F9E44" : "#9CA3AF" }}>{doneCount}/{order.items.length} ready</span>
      </div>

      {/* Items: qty · name · toggle */}
      <div>
        {order.items.map((it, idx) => (
          <div key={idx} data-testid={`kot-${order.kot}-item-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderBottom: "1px solid #F1F3F5", background: it.done ? "#F1FBF4" : "#fff" }}>
            <span style={{ width: 18, textAlign: "center", fontSize: 13.5, fontWeight: 600, color: it.done ? "#2B8A3E" : "#212529", flexShrink: 0 }}>{it.qty}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: it.done ? "#2B8A3E" : "#212529", textDecoration: it.done ? "line-through" : "none", textDecorationColor: "rgba(43,138,62,.5)" }}>
                {it.name}
                {it.variant ? <span style={{ color: it.done ? "#2B8A3E" : "#228BE6" }}> ({it.variant})</span> : null}
              </div>
              {it.addons?.length ? <div style={{ fontSize: 11.5, color: "#495057", marginTop: 1 }}>+ {it.addons.join(", ")}</div> : null}
              {it.specialNotes?.length || it.note ? (
                <div style={{ fontSize: 11.5, color: "#868E96", fontStyle: "italic", marginTop: 1 }}>[Note] {[...(it.specialNotes || []), it.note].filter(Boolean).join(", ")}</div>
              ) : null}
            </div>
            <ItemToggle on={!!it.done} disabled={order.status === "new" || order.status === "completed"} label={it.done ? `${it.name} — wapas karein` : `${it.name} ban gaya`} onChange={() => actions.toggleItemDone(order.id, idx, !it.done)} />
          </div>
        ))}
      </div>
      {order.note ? <div style={{ padding: "8px 10px", fontSize: 12, color: "#D9480F", background: "#FFF4E6" }}>Note: {order.note}</div> : null}

      {/* Footer: print · recall · priority · kitchen change · history · main action */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px", borderTop: "1px solid #F1F1F1" }}>
        <button type="button" onClick={() => actions.printKot(order.id)} title="Print KOT" data-testid={`kot-print-btn-${order.kot}`} style={iconBtn}><IcoPrint /></button>
        {canUndo ? (
          // Just changed (Accept / Food Ready / Served…) → compact blue Undo in
          // the Recall slot, so the footer never overflows (2026-10-08).
          <button type="button" onClick={actions.undoLast} title={`Undo — wapas ${String(undoItem.from).toUpperCase()}`} data-testid={`kot-undo-btn-${order.kot}`}
            style={{ ...iconBtn, color: "#228BE6", borderColor: "#228BE6", background: "#E7F5FF" }}><IcoUndo /></button>
        ) : order.status !== "new" && order.status !== "completed" ? (
          <button type="button" onClick={() => actions.recall(order.id)} title="Recall (pichhla status)" data-testid={`kot-recall-btn-${order.kot}`} style={iconBtn}><IcoUndo /></button>
        ) : null}
        <button type="button" onClick={cyclePriority} title="Priority badlein" data-testid={`kot-priority-btn-${order.kot}`} style={{ ...iconBtn, color: pr ? pr.color : "#495057", borderColor: pr ? pr.color : "#CED4DA" }}><IcoFlag /></button>
        {otherStations.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" title="Kitchen change" data-testid={`kot-handoff-btn-${order.kot}`} style={iconBtn}><IcoSwap /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-white">
              <DropdownMenuLabel className="text-xs">KOT {order.kot} — kitchen change</DropdownMenuLabel>
              {otherStations.map((s) => (
                <DropdownMenuItem key={s} data-testid={`kot-handoff-${order.kot}-${s.replace(/\s+/g, "-").toLowerCase()}`} onClick={() => actions.handoff(order.id, s)}>{s}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <button type="button" onClick={() => setHistoryOpen(true)} title="Order history" data-testid={`kot-history-btn-${order.kot}`} style={iconBtn}><IcoHistory /></button>
        {order.status === "new" ? (
          <button type="button" onClick={() => setRejectOpen(true)} title="KOT reject (POS me bhi cancel)" aria-label="Reject KOT" data-testid={`kot-reject-btn-${order.kot}`}
            style={{ ...iconBtn, marginLeft: "auto", width: 36, height: 36 }}><IcoClose /></button>
        ) : null}
        <button type="button" onClick={mainAction.disabled ? undefined : mainAction.run} disabled={!!mainAction.disabled} title={mainAction.hint || mainAction.label} data-testid={`kot-action-btn-${order.kot}`}
          style={{ marginLeft: order.status === "new" ? 0 : "auto", minWidth: 0, height: 36, padding: "0 12px", borderRadius: 4, border: "none", background: mainAction.bg, color: "#fff", fontSize: 13, fontWeight: 700, cursor: mainAction.disabled ? "not-allowed" : "pointer", opacity: mainAction.disabled ? 0.45 : 1, fontFamily: F, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <IcoCheckCircle size={16} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{mainAction.label}</span>
        </button>
      </div>
      <OrderHistoryDialog order={order} open={historyOpen} onOpenChange={setHistoryOpen} />
      {rejectOpen ? <RejectDialog order={order} onClose={() => setRejectOpen(false)} onDone={() => setRejectOpen(false)} /> : null}
    </div>
  );
}

/* Left panel — live total of every item still to cook across the shown KOTs */
function ItemSummary({ orders }) {
  const { state, actions } = useKds();
  const [open, setOpen] = useState(true);
  // Menu item for a KOT line — same name, this kitchen's entry preferred.
  const menuFor = (name) => {
    const n = String(name || "").trim().toLowerCase();
    const hits = (state.menu || []).filter((m) => String(m.name || "").trim().toLowerCase() === n);
    return hits.find((m) => !state.station || m.station === state.station) || hits[0] || null;
  };
  const rows = useMemo(() => {
    const map = new Map();
    orders.filter(isOpen).forEach((o) => o.items.forEach((it) => {
      if (it.done) return;
      map.set(it.name, (map.get(it.name) || 0) + (Number(it.qty) || 1));
    }));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [orders]);
  return (
    <div style={{ width: 250, flexShrink: 0, background: "#fff", borderRadius: 4, boxShadow: "0 1px 4px rgba(0,0,0,0.10)", alignSelf: "flex-start", overflow: "hidden", fontFamily: F }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 14px", border: "none", background: "#F8F9FA", cursor: "pointer", fontFamily: F, color: "#1F3A5F", fontSize: 14, fontWeight: 600, textAlign: "left", textTransform: "uppercase" }}>
        Items to cook <IcoChevron open={open} />
      </button>
      {open ? (
        rows.length ? rows.map(([name, qty]) => {
          const m = menuFor(name);
          const out = m && m.available === false;
          return (
            <div key={name} data-testid="kds-summary-row" style={{ padding: "9px 14px", borderTop: "1px solid #F1F3F5", background: out ? "#FFF4E6" : "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: out ? "#9CA3AF" : "#343A40", textDecoration: out ? "line-through" : "none" }}>{name}</span>
                <span style={{ minWidth: 44, height: 26, padding: "0 8px", border: "1.5px solid #343A40", borderRadius: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "#212529" }}>{qty}</span>
              </div>
              {m ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  {/* Out of stock = the one place KDS keeps red (user request 2026-10-08). */}
                  {out ? <span style={{ fontSize: 10.5, fontWeight: 700, color: "#E03131", letterSpacing: 0.4 }}>OUT OF STOCK</span> : null}
                  <button type="button" data-testid="kds-summary-stock" onClick={() => actions.setItemAvailability(m.id, out)}
                    style={{ marginLeft: "auto", height: 24, padding: "0 10px", borderRadius: 4, border: `1px solid ${out ? "#2F9E44" : "#E03131"}`, background: "#fff", color: out ? "#2F9E44" : "#E03131", fontSize: 11.5, fontWeight: 700, fontFamily: F, cursor: "pointer" }}>
                    {out ? "Mark in stock" : "Out of stock"}
                  </button>
                </div>
              ) : null}
            </div>
          );
        }) : <div style={{ padding: "16px 14px", fontSize: 12.5, color: "#9CA3AF" }}>Sab ban gaya</div>
      ) : null}
    </div>
  );
}

// Normal View (2026-10-09): KOTs fill the shortest column one by one, so a
// short ticket doesn't leave an empty gap under it (CSS grid rows took the
// tallest card's height). Oldest stays first, read left → right.
const COL_MIN = 290;
const COL_GAP = 14;
const estHeight = (o) => 190 + (o.items || []).reduce((h, it) =>
  h + 46 + (it.addons?.length ? 18 : 0) + ((it.note || it.specialNotes?.length) ? 18 : 0), 0) + (o.note ? 36 : 0);

function PackedColumns({ orders, render }) {
  const ref = useRef(null);
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => setCols(Math.max(1, Math.floor((el.clientWidth + COL_GAP) / (COL_MIN + COL_GAP))));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const columns = useMemo(() => {
    const out = Array.from({ length: cols }, () => ({ h: 0, list: [] }));
    orders.forEach((o) => {
      const c = out.reduce((min, col) => (col.h < min.h ? col : min), out[0]);
      c.list.push(o);
      c.h += estHeight(o) + COL_GAP;
    });
    return out;
  }, [orders, cols]);
  return (
    <div ref={ref} data-testid="kds-packed" style={{ display: "flex", gap: COL_GAP, alignItems: "flex-start" }}>
      {columns.map((col, i) => (
        <div key={i} style={{ flex: 1, minWidth: 0 }}>{col.list.map(render)}</div>
      ))}
    </div>
  );
}

export function KotTicketBoard({ stations = [], stationFilter = "all", onStationFilterChange }) {
  const { state, actions, now, undoItem } = useKds();
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusTab, setStatusTab] = useState("all");
  const slaMin = state.settings.slaMinutes || 15;

  // Only this screen's kitchen (picked at setup / header) — 2026-10-08.
  // A KOT moved away via "Kitchen change" leaves this board; one moved here appears.
  // + KDS Settings → "View KOTs of orders" (order types this screen shows).
  const orderTypes = state.settings.orderTypes;
  const base = useMemo(
    () => state.orders.filter((o) =>
      (!state.station || o.station === state.station) &&
      (!Array.isArray(orderTypes) || orderTypes.includes(o.type === "pickup" ? "takeaway" : o.type))
    ),
    [state.orders, state.station, orderTypes]
  );
  const masonry = state.settings.boardLayout !== "normal";
  // "All" = everything still on the line (new + cooking + ready); Completed has its own tab.
  const inStatus = (o, tab) => (tab === "all" ? o.status !== "completed" : o.status === tab);
  const statusCounts = useMemo(() => {
    const c = {};
    STATUS_TABS.forEach((t) => { c[t.id] = base.filter((o) => inStatus(o, t.id)).length; });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);
  const typeCounts = useMemo(() => {
    const scoped = base.filter((o) => inStatus(o, statusTab));
    const c = { all: scoped.length };
    scoped.forEach((o) => {
      const k = TYPE_KEY[o.type] || "Dine In";
      c[k] = (c[k] || 0) + 1;
      if (isLate(o, now, slaMin)) c.limit = (c.limit || 0) + 1;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, statusTab, now, slaMin]);

  const shown = useMemo(() => {
    return base
      // The card just moved (e.g. → Completed) stays in place while its Undo is offered.
      .filter((o) => inStatus(o, statusTab) || o.id === undoItem?.id)
      .filter((o) => (typeFilter === "all" ? true : typeFilter === "limit" ? isLate(o, now, slaMin) : (TYPE_KEY[o.type] || "Dine In") === typeFilter))
      .sort((a, b) => createdMs(a) - createdMs(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, statusTab, typeFilter, now, slaMin, undoItem]);


  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#FAFAFA", fontFamily: F }}>
      {/* Search + MFR bar removed (2026-10-08) per request. */}
      {/* Body: item summary (left) · tickets (column-wrap) */}
      {/* Items-to-cook panel and the KOT cards scroll separately (2026-10-09). */}
      <div style={{ minHeight: 0, flex: 1, overflow: "hidden", padding: "16px 0 0 16px", display: "flex", gap: 16, alignItems: "stretch" }}>
        <div data-testid="kds-summary-scroll" style={{ flexShrink: 0, minHeight: 0, overflowY: "auto", paddingBottom: 16 }}>
          <ItemSummary orders={shown} />
        </div>
        <div data-testid="kds-cards-scroll" style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto", padding: "0 16px 16px 0" }}>
          {shown.length === 0 ? (
            <div style={{ padding: "80px 20px", display: "flex", flexDirection: "column", alignItems: "center", color: "#9ca3af" }}>
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v4a2 2 0 0 0 0 4v4a2 2 0 0 1 0 4H4v-4a2 2 0 0 0 0-4V4z" /><line x1="9" y1="8.5" x2="15" y2="8.5" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="15.5" x2="13" y2="15.5" /></svg>
              <div style={{ marginTop: 16, fontSize: 17, fontWeight: 600, color: "#6b7280" }}>Koi KOT nahi hai</div>
            </div>
          ) : (
            masonry ? (
              <div style={{ columnWidth: 290, columnGap: 14 }}>
                {shown.map((o) => <KotTicket key={o.id} order={o} now={now} slaMin={slaMin} />)}
              </div>
            ) : (
              <PackedColumns orders={shown} render={(o) => <KotTicket key={o.id} order={o} now={now} slaMin={slaMin} />} />
            )
          )}
        </div>
      </div>

      {/* ── Sticky footer: status filters (Settings colours) · All stations ── */}
      <div data-testid="kds-footer" style={{ flexShrink: 0, position: "sticky", bottom: 0, zIndex: 5, background: "#fff", borderTop: "1px solid #E5E7EB", boxShadow: "0 -2px 8px rgba(16,24,40,0.05)", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {STATUS_TABS.map((t) => {
          const on = statusTab === t.id;
          const col = state.settings.colors?.[t.id] || "#434343";
          return (
            <button key={t.id} type="button" data-testid={`kds-status-${t.id}`} onClick={() => setStatusTab(on ? "all" : t.id)}
              style={{ height: 38, padding: "0 14px", borderRadius: 6, border: `1.5px solid ${col}`, background: on ? col : "#fff", color: on ? "#fff" : col, fontSize: 13, fontWeight: 700, fontFamily: F, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: on ? "#fff" : col }} />
              {t.label}
              <span style={{ minWidth: 22, height: 20, padding: "0 6px", borderRadius: 10, background: on ? "rgba(255,255,255,0.25)" : `${col}1A`, color: on ? "#fff" : col, fontSize: 11.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{statusCounts[t.id] || 0}</span>
            </button>
          );
        })}
        {/* Kitchen list removed from the footer (2026-10-08) — this screen shows only its own kitchen. */}
        <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: "#6B7280" }}>
          {state.station || "Kitchen"}
        </span>
        {/* Connection — same rule as the header (server + internet) */}
        {(() => {
          const online = state.connection.serverConnected && state.connection.internet;
          const c = online ? "#2F9E44" : "#E8590C";
          return (
            <span data-testid="kds-footer-net" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", borderRadius: 6, background: online ? "#EBFBEE" : "#FFF4E6", color: c, fontSize: 12.5, fontWeight: 700 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" />
                {online ? null : <line x1="2" y1="2" x2="22" y2="22" />}
              </svg>
              {online ? "Online" : "Offline"}
            </span>
          );
        })()}
      </div>
    </div>
  );
}
