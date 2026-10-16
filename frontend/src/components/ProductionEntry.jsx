import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, CookingPot, ArrowLeft, CheckCircle2, Clock, RefreshCw, Plus, X, PackagePlus } from "lucide-react";
import {
  fetchProductionItems, fetchProductionPreview, fetchProductionRecent, saveProduction,
  fetchProductionMaterials, fetchProductionUnits,
} from "@/services/apiService";

// Production entry (2026-10-16) — the chef records bulk prep made in the
// kitchen (gravy, rice, dough …) with no setup needed from the owner:
//   1. Kya banaya  — pick an item, or type a new name (+ unit) → created;
//   2. Kitna banaya — quantity;
//   3. Store se kitna saman liya — search & add each material with its qty
//      (auto-filled when the item has a recipe);
//   4. "Agli baar ke liye yaad rakho" — this list becomes the recipe.
// Save → billing inventory moves at once (material out, prepared item in at
// its real cost). Owner-approval setting is respected by billing.

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (v) => (Math.round((Number(v) || 0) * 1000) / 1000).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const errText = (e, fallback) => e?.response?.data?.detail || e?.response?.data?.message || e?.message || fallback;

const STATUS = {
  posted: { label: "Stock me jud gaya", color: "#2B8A3E", bg: "#EBFBEE", Icon: CheckCircle2 },
  pending_approval: { label: "Owner approval baaki", color: "#E67700", bg: "#FFF4D6", Icon: Clock },
};

const field = "w-full min-h-[48px] px-3 rounded-md border border-[#E5E7EB] bg-white outline-none focus:border-bp-brand-primary";
const Label = ({ n, children, hint }) => (
  <div className="mb-2">
    <div className="text-sm font-extrabold flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-bp-brand-primary text-white text-xs font-extrabold flex items-center justify-center">{n}</span>
      {children}
    </div>
    {hint && <div className="text-xs opacity-55 mt-1 ml-8">{hint}</div>}
  </div>
);

export const ProductionEntry = () => {
  // list
  const [items, setItems] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  // form
  const [formOpen, setFormOpen] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [picked, setPicked] = useState(null);      // existing item
  const [newName, setNewName] = useState("");       // or a new one
  const [unitId, setUnitId] = useState("");
  const [qty, setQty] = useState("");
  const [lines, setLines] = useState([]);           // {item_id, name, unit, available_stock, unit_cost, taken, fromRecipe, touched}
  const [matQ, setMatQ] = useState("");
  const [remember, setRemember] = useState(true);
  const [notes, setNotes] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const qtyRef = useRef(null);
  const matRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, today] = await Promise.all([fetchProductionItems(), fetchProductionRecent()]);
      setItems(Array.isArray(list) ? list : []);
      setRecent(Array.isArray(today) ? today : []);
    } catch (e) {
      setError(errText(e, "Production load nahi hua."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openForm = async (item = null) => {
    setPicked(item);
    setNewName("");
    setUnitId("");
    setQty(item?.recipe_yield ? String(item.recipe_yield) : "");
    setLines([]);
    setMatQ("");
    setNotes("");
    setRemember(!item?.has_recipe);
    setFormOpen(true);
    try {
      const [m, u] = await Promise.all([fetchProductionMaterials(), fetchProductionUnits()]);
      setMaterials(Array.isArray(m) ? m : []);
      setUnits(Array.isArray(u) ? u : []);
    } catch (e) {
      toast.error(errText(e, "Store ka saman load nahi hua."));
    }
    setTimeout(() => (item ? qtyRef.current : null)?.focus(), 50);
  };
  const closeForm = () => { setFormOpen(false); setPicked(null); };

  // recipe → fill material for the quantity (keeps lines the chef edited / added)
  useEffect(() => {
    if (!formOpen || !picked?.has_recipe || num(qty) <= 0) return undefined;
    const t = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await fetchProductionPreview(picked.id, num(qty));
        const fromRecipe = (res?.lines || []).map((l) => ({ ...l, taken: String(l.required_quantity), fromRecipe: true }));
        setLines((prev) => {
          const kept = prev.filter((l) => l.touched || !l.fromRecipe);
          const keptIds = new Set(kept.map((l) => l.item_id));
          return [...fromRecipe.filter((l) => !keptIds.has(l.item_id)), ...kept];
        });
      } catch (e) {
        toast.error(errText(e, "Recipe load nahi hui."));
      } finally {
        setPreviewing(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [formOpen, picked, qty]);

  // name suggestions while typing a new item
  const nameMatches = useMemo(() => {
    const t = newName.trim().toLowerCase();
    return t ? items.filter((i) => i.name.toLowerCase().includes(t)).slice(0, 6) : [];
  }, [newName, items]);
  const exact = items.find((i) => i.name.toLowerCase() === newName.trim().toLowerCase());

  const matMatches = useMemo(() => {
    const t = matQ.trim().toLowerCase();
    if (!t) return [];
    const taken = new Set(lines.map((l) => l.item_id));
    return materials.filter((m) => !taken.has(m.item_id) && m.item_id !== picked?.id && m.name.toLowerCase().includes(t)).slice(0, 8);
  }, [matQ, materials, lines, picked]);

  const addMaterial = (m) => {
    setLines((prev) => [...prev, { ...m, taken: "", fromRecipe: false, touched: true }]);
    setMatQ("");
    setTimeout(() => document.querySelector(`[data-testid="production-taken-${m.item_id}"]`)?.focus(), 30);
  };
  const setTaken = (id, v) => setLines((prev) => prev.map((l) => (l.item_id === id ? { ...l, taken: v, touched: true } : l)));
  const removeLine = (id) => setLines((prev) => prev.filter((l) => l.item_id !== id));

  const unitLabel = picked?.unit || exact?.unit || units.find((u) => u.id === unitId)?.short_code || units.find((u) => u.id === unitId)?.name || "";
  const cost = lines.reduce((t, l) => t + num(l.taken) * (Number(l.unit_cost) || 0), 0);
  const short = lines.filter((l) => num(l.taken) > (Number(l.available_stock) || 0) + 0.0005);
  const itemName = picked?.name || newName.trim();

  const save = async () => {
    if (!picked && !newName.trim()) { toast.error("1. Kya banaya — naam likhein ya list se chunein."); return; }
    if (!picked && !exact && !unitId) { toast.error("Naye item ki unit chunein (kg, litre…)."); return; }
    if (num(qty) <= 0) { toast.error("2. Kitna banaya — quantity daalein."); qtyRef.current?.focus(); return; }
    const payloadLines = lines.filter((l) => num(l.taken) > 0).map((l) => ({ item_id: l.item_id, quantity: num(l.taken) }));
    if (!payloadLines.length) { toast.error("3. Store se liya saman jodein (kam se kam ek)."); matRef.current?.focus(); return; }
    setSaving(true);
    try {
      const res = await saveProduction({
        item_id: picked?.id || exact?.id || null,
        new_item_name: picked || exact ? null : newName.trim(),
        unit_id: picked || exact ? null : unitId,
        planned_quantity: num(qty),
        actual_quantity: num(qty),
        lines: payloadLines,
        save_as_recipe: remember,
        notes: notes.trim() || null,
      });
      const pending = res?.run?.status === "pending_approval";
      toast.success(pending ? "Owner approval ke liye bhej diya" : `${fmt(qty)} ${unitLabel} ${itemName} stock me jud gaya`, {
        description: pending ? "Approve hote hi stock update hoga." : "Saman stock se kam ho gaya — billing / POS inventory me bhi dikhega.",
      });
      closeForm();
      load();
    } catch (e) {
      toast.error(errText(e, "Production save nahi hua."));
    } finally {
      setSaving(false);
    }
  };

  // ── entry form ───────────────────────────────────────────────────────
  if (formOpen) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto" data-testid="production-form">
        <button type="button" onClick={closeForm} className="flex items-center gap-2 text-sm font-bold opacity-70 hover:opacity-100" data-testid="production-back">
          <ArrowLeft className="w-4 h-4" /> Wapas
        </button>

        {/* 1. what */}
        <div className="bg-white border border-[#E5E7EB] rounded-md p-4">
          <Label n="1" hint={picked ? null : "List se chunein, ya naya naam likhein — naya item apne aap ban jayega."}>Kya banaya?</Label>
          {picked ? (
            <div className="flex items-center gap-3 ml-8">
              <CookingPot className="w-5 h-5 text-bp-brand-primary" />
              <div className="flex-1">
                <div className="text-base font-extrabold">{picked.name}</div>
                <div className="text-xs opacity-55">Abhi stock: {fmt(picked.current_stock)} {picked.unit}{picked.has_recipe ? " · recipe set hai" : ""}</div>
              </div>
              <button type="button" onClick={() => { setPicked(null); setLines([]); setRemember(true); }} className="text-sm font-bold text-bp-brand-primary" data-testid="production-change-item">Badlo</button>
            </div>
          ) : (
            <div className="ml-8 space-y-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Jaise: Jeera Rice, Makhani Gravy, Pizza Dough"
                className={field}
                autoFocus
                data-testid="production-name"
              />
              {nameMatches.length > 0 && !exact && (
                <div className="flex flex-wrap gap-2">
                  {nameMatches.map((m) => (
                    <button key={m.id} type="button" onClick={() => { setPicked(m); setNewName(""); setRemember(!m.has_recipe); setQty(m.recipe_yield ? String(m.recipe_yield) : qty); }}
                      className="px-3 min-h-[36px] rounded-full border border-[#E5E7EB] bg-[#F8F9FA] text-sm font-semibold" data-testid={`production-suggest-${m.id}`}>
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
              {newName.trim() && !exact && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: "#E7F5FF", color: "#1864AB" }}>Naya item</span>
                  <span className="text-sm opacity-70">Unit:</span>
                  <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="min-h-[44px] px-3 rounded-md border border-[#E5E7EB] bg-white font-semibold" data-testid="production-unit">
                    <option value="">Chunein</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.short_code ? `${u.short_code} — ${u.name}` : u.name}</option>)}
                  </select>
                </div>
              )}
              {exact && <div className="text-xs opacity-60">"{exact.name}" pehle se hai — usi me jud jayega.</div>}
            </div>
          )}
        </div>

        {/* 2. how much */}
        <div className="bg-white border border-[#E5E7EB] rounded-md p-4">
          <Label n="2">Kitna banaya?</Label>
          <div className="ml-8 flex items-center gap-2">
            <input
              ref={qtyRef}
              type="number" inputMode="decimal" min="0" step="0.001"
              value={qty} onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              className="w-40 min-h-[52px] px-3 rounded-md border border-[#E5E7EB] bg-white text-lg font-extrabold outline-none focus:border-bp-brand-primary"
              data-testid="production-qty"
            />
            <span className="text-base font-bold opacity-60">{unitLabel}</span>
          </div>
        </div>

        {/* 3. material taken */}
        <div className="bg-white border border-[#E5E7EB] rounded-md overflow-hidden">
          <div className="p-4 pb-2">
            <Label n="3" hint={picked?.has_recipe ? "Recipe se bhara hai — store se jitna asal me liya, utna likhein." : "Store se jo-jo saman liya, search karke jodein aur quantity likhein."}>Store se kitna saman liya?</Label>
          </div>

          {lines.length > 0 && (
            <div className="divide-y divide-[#F1F3F5] border-t border-[#F1F3F5]">
              {lines.map((l) => {
                const over = num(l.taken) > (Number(l.available_stock) || 0) + 0.0005;
                return (
                  <div key={l.item_id} className="px-4 py-3 flex items-center gap-3 flex-wrap" data-testid={`production-line-${l.item_id}`}>
                    <div className="flex-1 min-w-[150px]">
                      <div className="text-sm font-bold">{l.name}</div>
                      <div className="text-xs opacity-55">
                        {l.fromRecipe ? `Recipe: ${fmt(l.required_quantity)} ${l.unit} · ` : ""}Store me: <span style={{ color: over ? "#E67700" : undefined, fontWeight: over ? 700 : 400 }}>{fmt(l.available_stock)} {l.unit}</span>
                      </div>
                    </div>
                    <input
                      type="number" inputMode="decimal" min="0" step="0.001"
                      value={l.taken} onChange={(e) => setTaken(l.item_id, e.target.value)}
                      placeholder="0"
                      className="w-28 min-h-[44px] px-3 rounded-md border border-[#E5E7EB] bg-white text-base font-bold outline-none focus:border-bp-brand-primary"
                      data-testid={`production-taken-${l.item_id}`}
                    />
                    <span className="text-sm font-semibold opacity-60 w-8">{l.unit}</span>
                    <button type="button" onClick={() => removeLine(l.item_id)} className="w-9 h-9 rounded-md border border-[#E5E7EB] flex items-center justify-center opacity-60 hover:opacity-100" title="Hatao" data-testid={`production-remove-${l.item_id}`}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="p-4 pt-3 relative">
            <div className="relative">
              <Plus className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                ref={matRef}
                value={matQ}
                onChange={(e) => setMatQ(e.target.value)}
                placeholder="Saman jodo — chawal, tel, pyaz…"
                className={`${field} pl-9`}
                data-testid="production-material-search"
              />
            </div>
            {matMatches.length > 0 && (
              <div className="absolute left-4 right-4 mt-1 bg-white border border-[#E5E7EB] rounded-md shadow-lg z-20 max-h-72 overflow-auto">
                {matMatches.map((m) => (
                  <button key={m.item_id} type="button" onClick={() => addMaterial(m)}
                    className="w-full text-left px-3 py-2.5 flex justify-between gap-3 hover:bg-[#F8F9FA] border-b border-[#F1F3F5] last:border-0" data-testid={`production-material-${m.item_id}`}>
                    <span className="text-sm font-bold">{m.name}</span>
                    <span className="text-xs opacity-55">Store me {fmt(m.available_stock)} {m.unit}</span>
                  </button>
                ))}
              </div>
            )}
            {matQ.trim() && matMatches.length === 0 && (
              <div className="text-xs opacity-55 mt-2">"{matQ}" store me nahi mila — owner se Inventory me item jodne ko kahein.</div>
            )}
            {previewing && <div className="text-xs opacity-55 mt-2">Recipe se saman nikal raha hai…</div>}
          </div>

          {lines.length > 0 && (
            <div className="px-4 py-3 bg-[#F8F9FA] border-t border-[#E5E7EB] flex justify-between text-sm">
              <span className="opacity-60">Saman ki laagat</span>
              <b>₹{fmt(Math.round(cost * 100) / 100)}{num(qty) > 0 && unitLabel ? ` · ₹${fmt(Math.round((cost / num(qty)) * 100) / 100)} / ${unitLabel}` : ""}</b>
            </div>
          )}
        </div>

        {short.length > 0 && (
          <div className="rounded-md px-4 py-3 text-sm font-semibold" style={{ background: "#FFF4D6", color: "#E67700" }}>
            Store me kam dikh raha hai: {short.map((l) => l.name).join(", ")}. Save karne par stock minus ho sakta hai — owner ko batayein.
          </div>
        )}

        <label className="flex items-start gap-3 bg-white border border-[#E5E7EB] rounded-md p-4 cursor-pointer" data-testid="production-remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-5 h-5 mt-0.5 accent-[#228BE6]" />
          <span>
            <span className="text-sm font-bold block">{picked?.has_recipe ? "Recipe ko is entry se update karo" : "Agli baar ke liye ye saman yaad rakho"}</span>
            <span className="text-xs opacity-55">Agli baar {itemName || "ye item"} chunte hi saman apne aap bhar jayega.</span>
          </span>
        </label>

        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (optional) — jaise: dopahar ka batch" className={field} data-testid="production-notes" />

        <button
          type="button" onClick={save} disabled={saving || previewing}
          className="w-full min-h-[56px] rounded-md bg-bp-brand-primary text-white text-base font-extrabold disabled:opacity-50 active:scale-[0.99]"
          data-testid="production-save"
        >
          {saving ? "Save ho raha hai…" : num(qty) > 0 && itemName ? `Save — ${fmt(qty)} ${unitLabel} ${itemName} stock me jodo` : "Save"}
        </button>
      </div>
    );
  }

  // ── list ─────────────────────────────────────────────────────────────
  const list = items.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4" data-testid="production-screen">
      <button
        type="button" onClick={() => openForm(null)}
        className="w-full min-h-[64px] rounded-md bg-bp-brand-primary text-white text-base font-extrabold flex items-center justify-center gap-2 active:scale-[0.99]"
        data-testid="production-new"
      >
        <PackagePlus className="w-5 h-5" /> Nayi Production Entry
      </button>
      <div className="text-xs opacity-55 -mt-2 text-center">Gravy, rice, dough… jo bhi pehle bana kar rakhte ho — kya banaya, kitna banaya aur store se kitna saman liya, likh kar Save. Stock apne aap update ho jayega.</div>

      {error && <div className="rounded-md px-4 py-3 text-sm font-semibold" style={{ background: "#FFF4D6", color: "#E67700" }} data-testid="production-error">{error}</div>}

      {items.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pehle bane items me dhoondo" className={`${field} pl-9`} data-testid="production-search" />
            </div>
            <button type="button" onClick={load} className="min-h-[48px] px-3 rounded-md border border-[#E5E7EB] bg-white" title="Refresh" data-testid="production-refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {list.map((m) => (
              <button key={m.id} type="button" onClick={() => openForm(m)} data-testid={`production-item-${m.id}`}
                className="text-left bg-white border border-[#E5E7EB] rounded-md p-3 min-h-[92px] flex flex-col justify-between hover:brightness-97 active:scale-[0.98]">
                <div className="flex items-start gap-2">
                  <CookingPot className="w-4 h-4 mt-0.5 text-bp-brand-primary shrink-0" />
                  <div className="text-sm font-bold leading-snug">{m.name}</div>
                </div>
                <div className="text-xs opacity-60 mt-2">Stock: <b>{fmt(m.current_stock)} {m.unit}</b></div>
              </button>
            ))}
            {list.length === 0 && <div className="col-span-full p-6 text-center text-sm opacity-55">"{q}" nahi mila — upar "Nayi Production Entry" se naya banayein.</div>}
          </div>
        </>
      )}
      {loading && !items.length && !error && <div className="p-6 text-center text-sm opacity-55">Loading…</div>}

      <div className="bg-white border border-[#E5E7EB] rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB] text-sm font-extrabold">Aaj ki production</div>
        {recent.length === 0 ? (
          <div className="p-5 text-center text-sm opacity-55">Aaj abhi kuch nahi bana.</div>
        ) : (
          <div className="divide-y divide-[#F1F3F5]">
            {recent.map((r) => {
              const s = STATUS[r.status] || { label: r.status, color: "#495057", bg: "#F1F3F5", Icon: Clock };
              return (
                <div key={r.id} className="px-4 py-3 flex items-center gap-3 flex-wrap" data-testid={`production-recent-${r.id}`}>
                  <div className="flex-1 min-w-[160px]">
                    <div className="text-sm font-bold">{r.item} · {fmt(r.actual_quantity)} {r.unit}</div>
                    <div className="text-xs opacity-55">
                      {r.time ? new Date(r.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}{r.by ? ` · ${r.by}` : ""} · ₹{fmt(r.total_cost)}
                    </div>
                  </div>
                  <span className="text-[11px] font-extrabold rounded px-2 py-1 flex items-center gap-1" style={{ background: s.bg, color: s.color }}>
                    <s.Icon className="w-3.5 h-3.5" /> {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
