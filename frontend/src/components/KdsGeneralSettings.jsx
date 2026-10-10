import React, { useState } from "react";
import { useKds } from "@/state/kdsState";

// KDS general settings (2026-10-08) — Petpooja-style form: label on the left,
// options on the right, Cancel / Save at the bottom. Shown right after pairing
// (Setup.jsx → Welcome popup → "Go to Settings") and later from the sidebar.
// POS IP comes pre-filled from the Pair Code (bhojpe-poss sends its LAN IP
// when it generates the code) and can be corrected by hand.

const F = "'Inter', system-ui, sans-serif";
const CHECK = "#228BE6";

export const ORDER_TYPE_OPTIONS = [
  { id: "dine-in", label: "Dine In" },
  { id: "takeaway", label: "Pick Up" },
  { id: "delivery", label: "Delivery" },
  { id: "room-service", label: "Room Service" },
];
const ALL_TYPES = ORDER_TYPE_OPTIONS.map((o) => o.id);

const VOLUMES = [
  { id: "off", label: "Off", value: 0 },
  { id: "low", label: "Low", value: 0.35 },
  { id: "mid", label: "Mid", value: 0.65 },
  { id: "high", label: "High", value: 0.9 },
];
const volumeId = (v) => (v <= 0 ? "off" : v < 0.5 ? "low" : v < 0.8 ? "mid" : "high");

const Field = ({ label, hint, children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-[240px_1fr] gap-x-6 gap-y-2 py-4 border-b border-[#F1F3F5] last:border-b-0">
    <div>
      <div className="text-[14px] font-semibold text-[#343A40]">{label}</div>
      {hint ? <div className="text-[12px] text-[#868E96] mt-0.5">{hint}</div> : null}
    </div>
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 min-w-0">{children}</div>
  </div>
);

const Check = ({ checked, onChange, label, testId }) => (
  <label className="inline-flex items-center gap-2.5 cursor-pointer text-[14px] text-[#343A40] select-none">
    <input type="checkbox" data-testid={testId} checked={!!checked} onChange={(e) => onChange(e.target.checked)}
      style={{ width: 18, height: 18, accentColor: CHECK, cursor: "pointer" }} />
    {label}
  </label>
);

const Radio = ({ name, checked, onChange, label, testId }) => (
  <label className="inline-flex items-center gap-2.5 cursor-pointer text-[14px] text-[#343A40] select-none">
    <input type="radio" name={name} data-testid={testId} checked={checked} onChange={onChange}
      style={{ width: 18, height: 18, accentColor: CHECK, cursor: "pointer" }} />
    {label}
  </label>
);

export function KdsGeneralSettings({ onSaved, onCancel, saveLabel = "Save" }) {
  const { state, actions } = useKds();
  const s = state.settings;
  const stations = state.connection.stations || [];

  const [form, setForm] = useState(() => ({
    posIp: state.connection.posIp || "",
    station: stations.includes(state.station) ? state.station : stations[0] || state.station || "",
    orderTypes: Array.isArray(s.orderTypes) ? s.orderTypes : ALL_TYPES,
    soundOn: s.soundOn !== false,
    volume: volumeId(s.volume ?? 0.9),
    slaMinutes: s.slaMinutes || 15,
    boardLayout: s.boardLayout === "normal" ? "normal" : "masonry",
    dblClickAdvance: !!s.dblClickAdvance,
    autoPrint: !!s.autoPrint,
  }));
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleType = (id, on) =>
    set({ orderTypes: on ? [...new Set([...form.orderTypes, id])] : form.orderTypes.filter((t) => t !== id) });

  const ipOk = !form.posIp || /^(\d{1,3}\.){3}\d{1,3}(:\d{2,5})?$/.test(form.posIp.trim());
  const canSave = ipOk && form.orderTypes.length > 0 && (!stations.length || form.station);

  const save = () => {
    if (!canSave) return;
    const vol = VOLUMES.find((v) => v.id === form.volume)?.value ?? 0.9;
    actions.setConnection({ posIp: form.posIp.trim() || null });
    actions.setSettings({
      orderTypes: form.orderTypes.length === ALL_TYPES.length ? null : form.orderTypes,
      soundOn: form.soundOn && vol > 0,
      volume: vol || s.volume || 0.9,
      slaMinutes: Math.max(1, Math.min(120, Number(form.slaMinutes) || 15)),
      boardLayout: form.boardLayout,
      dblClickAdvance: form.dblClickAdvance,
      autoPrint: form.autoPrint,
    });
    if (form.station) actions.setStation(form.station);
    onSaved?.(form);
  };

  return (
    <div className="w-full max-w-[920px] mx-auto bg-white rounded-md border border-[#E9ECEF]" style={{ fontFamily: F }} data-testid="kds-general-settings">
      <div className="px-6 py-5 text-center text-[24px] font-light text-[#495057] border-b border-[#F1F3F5]">Settings</div>

      <div className="px-6">
        <Field label="POS IP address" hint={state.connection.posIp ? "POS pair code se automatic mila" : "POS ka IP — POS me Connected Devices par dikhta hai"}>
          <input data-testid="kds-pos-ip" value={form.posIp} onChange={(e) => set({ posIp: e.target.value })} placeholder="Enter POS IP here (e.g. 192.168.1.20)"
            className="w-full max-w-[420px] h-10 border-0 border-b-[1.5px] outline-none text-[14px] text-[#212529] placeholder:text-[#ADB5BD] bg-transparent"
            style={{ borderBottomColor: ipOk ? "#DEE2E6" : "#E8590C" }} />
          {!ipOk ? <div className="w-full text-[12px] text-[#E8590C]">IP sahi format me daalo, jaise 192.168.1.20</div> : null}
        </Field>

        {stations.length ? (
          <Field label="Kitchen" hint="Is screen par sirf isi kitchen ke KOT aayenge">
            {stations.map((st) => (
              <Radio key={st} name="kds-station" label={st} checked={form.station === st} onChange={() => set({ station: st })}
                testId={`kds-set-station-${st.replace(/\s+/g, "-").toLowerCase()}`} />
            ))}
          </Field>
        ) : null}

        <Field label="View KOTs of orders">
          {ORDER_TYPE_OPTIONS.map((o) => (
            <Check key={o.id} label={o.label} checked={form.orderTypes.includes(o.id)} onChange={(v) => toggleType(o.id, v)} testId={`kds-set-type-${o.id}`} />
          ))}
          {!form.orderTypes.length ? <div className="w-full text-[12px] text-[#E8590C]">Kam se kam ek order type chuno</div> : null}
        </Field>

        <Field label="Notification sound">
          <Check label="Naye KOT par sound bajao" checked={form.soundOn} onChange={(v) => set({ soundOn: v })} testId="kds-set-sound" />
        </Field>

        <Field label="Sound volume">
          {VOLUMES.map((v) => (
            <Radio key={v.id} name="kds-volume" label={v.label.toUpperCase()} checked={form.volume === v.id} onChange={() => set({ volume: v.id })} testId={`kds-set-vol-${v.id}`} />
          ))}
        </Field>

        <Field label="KOT time limit" hint="Itne minute ke baad KOT LATE dikhega">
          <input type="number" min={1} max={120} data-testid="kds-set-sla" value={form.slaMinutes} onChange={(e) => set({ slaMinutes: e.target.value })}
            className="w-24 h-10 border-0 border-b-[1.5px] border-[#DEE2E6] outline-none text-[14px] text-[#212529] bg-transparent" />
          <span className="text-[13px] text-[#868E96]">minutes</span>
        </Field>

        <Field label="Display KDS on">
          <Radio name="kds-layout" label="Normal View" checked={form.boardLayout === "normal"} onChange={() => set({ boardLayout: "normal" })} testId="kds-set-layout-normal" />
          <Radio name="kds-layout" label="Masonry View" checked={form.boardLayout === "masonry"} onChange={() => set({ boardLayout: "masonry" })} testId="kds-set-layout-masonry" />
        </Field>

        <Field label="Change KOT status on double click">
          <Check label="" checked={form.dblClickAdvance} onChange={(v) => set({ dblClickAdvance: v })} testId="kds-set-dblclick" />
        </Field>

        <Field label="Auto print KOT">
          <Check label="" checked={form.autoPrint} onChange={(v) => set({ autoPrint: v })} testId="kds-set-autoprint" />
        </Field>
      </div>

      <div className="px-6 py-4 border-t border-[#F1F3F5] flex justify-end gap-3">
        {onCancel ? (
          <button type="button" onClick={onCancel} data-testid="kds-settings-cancel"
            className="h-11 min-w-[130px] px-6 rounded-md text-white text-[14px] font-semibold uppercase tracking-wide" style={{ background: "#434343" }}>
            Cancel
          </button>
        ) : null}
        <button type="button" onClick={save} disabled={!canSave} data-testid="kds-settings-save"
          className="h-11 min-w-[130px] px-6 rounded-md text-white text-[14px] font-semibold uppercase tracking-wide disabled:opacity-50" style={{ background: "#228BE6" }}>
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
