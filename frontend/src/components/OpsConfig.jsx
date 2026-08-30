import React, { useEffect, useState } from "react";
import * as api from "@/services/apiService";
import { useKds } from "@/state/kdsState";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Printer, Mail, Send, BellRing } from "lucide-react";

const Input = ({ label, value, onChange, placeholder, testId, type = "text" }) => (
  <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
    <label className="block text-xs font-bold uppercase tracking-widest opacity-55 mb-1.5">{label}</label>
    <input
      data-testid={testId}
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full min-h-[48px] px-3 rounded-md border border-[#E5E7EB] outline-none focus:border-[#FF3131]"
    />
  </div>
);

export const PrinterConfig = () => {
  const { state, actions } = useKds();
  const cfg = state.config;
  const [host, setHost] = useState("");
  const [port, setPort] = useState("9100");
  const [status, setStatus] = useState(null);
  const [printers, setPrinters] = useState(null);
  const [selectedId, setSelectedId] = useState("manual");
  const [manualOpen, setManualOpen] = useState(false);

  const checkStatus = async () => {
    try {
      setStatus(await api.fetchPrinterStatus());
    } catch {
      setStatus(null);
    }
  };

  useEffect(() => {
    if (cfg) {
      setHost(cfg.printerHost || "");
      setPort(String(cfg.printerPort || 9100));
      checkStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);

  // Real registered printers for this branch (billing's Printer records,
  // filtered server-side to reachable network printers - see /printers in
  // server.py). Auto-picks the branch's default KOT printer on first load.
  useEffect(() => {
    let cancelled = false;
    api
      .fetchPrinters()
      .then((list) => {
        if (cancelled) return;
        setPrinters(list);
        if (cfg?.printerHost) {
          const match = list.find((p) => p.ip === cfg.printerHost && p.port === (cfg.printerPort || 9100));
          setSelectedId(match ? match.id : "manual");
          if (!match) setManualOpen(true);
        } else {
          // No printer configured yet on this screen - auto-apply the
          // branch's default KOT printer (or the first registered one) so a
          // freshly-paired KDS starts printing without a manual step.
          const def = list.find((p) => p.isDefaultKot) || list[0];
          if (def) {
            setSelectedId(def.id);
            applyPrinter(def);
          }
        }
      })
      .catch(() => setPrinters([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.printerHost, cfg?.printerPort]);

  const applyPrinter = async (printer) => {
    await actions.saveConfig({ printerHost: printer.ip, printerPort: printer.port });
    toast.success(`Now printing to ${printer.name}`);
    checkStatus();
  };

  if (!cfg) return <div className="bg-white border border-[#E5E7EB] rounded-md p-4 text-sm opacity-60">Printer config unavailable.</div>;

  return (
    <div className="space-y-3" data-testid="printer-config">
      <div className="flex items-center gap-3 justify-between bg-white border border-[#E5E7EB] rounded-md p-3">
        <div>
          <div className="text-sm font-bold flex items-center gap-2">
            <Printer className="w-4 h-4" /> Network printer
          </div>
          <div className="text-xs opacity-55">ESC/POS over TCP — tickets print automatically</div>
        </div>
        <Switch
          data-testid="printer-enabled-toggle"
          checked={!!cfg.printerEnabled}
          onCheckedChange={(v) => actions.saveConfig({ printerEnabled: v })}
        />
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
        <label className="block text-xs font-bold uppercase tracking-widest opacity-55 mb-1.5">
          Registered branch printer
        </label>
        {printers === null ? (
          <div className="text-sm opacity-55">Loading printers…</div>
        ) : printers.length === 0 ? (
          <div className="text-sm opacity-55">
            No network printer registered for this branch yet. Add one in the POS's Printer
            settings, or set one manually below.
          </div>
        ) : (
          <select
            data-testid="printer-select"
            value={selectedId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedId(id);
              if (id === "manual") {
                setManualOpen(true);
                return;
              }
              const p = printers.find((x) => x.id === id);
              if (p) applyPrinter(p);
            }}
            className="w-full min-h-[48px] px-3 rounded-md border border-[#E5E7EB] outline-none focus:border-[#FF3131] bg-white"
          >
            {printers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isDefaultKot ? " (Default KOT)" : ""}
                {p.kitchenName ? ` — ${p.kitchenName}` : ""} · {p.ip}:{p.port}
              </option>
            ))}
            <option value="manual">Manual IP / Host…</option>
          </select>
        )}
      </div>

      {(manualOpen || (printers && printers.length === 0)) && (
        <>
          <Input label="Printer IP / Host" value={host} onChange={setHost} placeholder="192.168.1.50" testId="printer-host-input" />
          <Input label="Port" value={port} onChange={setPort} placeholder="9100" testId="printer-port-input" />
          <button
            data-testid="save-printer-btn"
            onClick={async () => {
              const h = host.trim();
              if (!h) return toast.error("Enter your printer's IP address");
              await actions.saveConfig({ printerHost: h, printerPort: Number(port) || 9100 });
              toast.success("Printer settings saved");
              checkStatus();
            }}
            className="w-full min-h-[48px] rounded-md bg-[#FF3131] text-white text-sm font-bold"
          >
            SAVE PRINTER
          </button>
        </>
      )}
      <button
        data-testid="check-printer-btn"
        onClick={async () => {
          await checkStatus();
          toast.info("Printer status refreshed");
        }}
        className="w-full min-h-[48px] rounded-md border border-[#E5E7EB] bg-white text-sm font-bold"
      >
        CHECK CONNECTION
      </button>
      {status && (
        <div
          data-testid="printer-status"
          className="rounded-md p-3 text-sm font-semibold"
          style={{
            background: status.reachable ? "#ECFDF5" : "#FEF2F2",
            color: status.reachable ? "#047857" : "#DC2626",
          }}
        >
          {status.reachable
            ? `Printer live at ${status.host}:${status.port}${status.enabled ? "" : " — switch it on above to start printing"}`
            : status.error || "Printer not reachable"}
          {status.pendingJobs > 0 && (
            <div className="text-xs font-medium mt-1 opacity-80">{status.pendingJobs} ticket(s) waiting in the queue</div>
          )}
        </div>
      )}
      <button
        data-testid="test-printer-btn"
        onClick={async () => {
          try {
            const res = await api.testPrinter();
            res.ok
              ? toast.success(`Test ticket sent to ${res.host}:${res.port}`)
              : toast.error(res.error || "Printer unreachable");
          } catch (e) {
            toast.error(e?.response?.data?.detail || "Enable the printer and set a host first");
          }
        }}
        className="w-full min-h-[48px] rounded-md border border-[#E5E7EB] bg-white text-sm font-bold"
      >
        TEST PRINT
      </button>
      <div className="text-xs opacity-55">
        {cfg.printerEnabled && cfg.printerHost
          ? `Tickets are sent to ${cfg.printerHost}:${cfg.printerPort}. Failed tickets stay in the queue for retry.`
          : "No printer wired yet — tickets stay in the queue and can be printed from the browser."}
      </div>
    </div>
  );
};

export const RecapConfig = () => {
  const { state, actions } = useKds();
  const cfg = state.config;
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cfg) setEmail(cfg.recapEmail || "");
  }, [cfg]);

  return (
    <div className="space-y-3" data-testid="recap-config">
      <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
        <div className="text-sm font-bold flex items-center gap-2">
          <Mail className="w-4 h-4" /> Daily shift recap
        </div>
        <div className="text-xs opacity-55 mt-1">
          Emailed automatically at 23:30 IST when the kitchen closes.
        </div>
        <div
          data-testid="recap-live-status"
          className="text-xs font-bold mt-2"
          style={{ color: cfg?.recapEmail ? "#047857" : "#B45309" }}
        >
          {cfg?.recapEmail ? `Live — going to ${cfg.recapEmail}` : "Not live yet — add an address below"}
        </div>
      </div>
      <Input label="Head Chef Email" value={email} onChange={setEmail} placeholder="chef@restaurant.com" testId="recap-email-input" type="email" />
      <button
        data-testid="save-recap-email-btn"
        onClick={async () => {
          const v = email.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return toast.error("Enter a valid email address");
          await actions.saveConfig({ recapEmail: v });
          toast.success("Recap recipient saved");
        }}
        className="w-full min-h-[48px] rounded-md bg-[#FF3131] text-white text-sm font-bold"
      >
        SAVE RECIPIENT
      </button>
      <button
        data-testid="send-test-email-btn"
        onClick={async () => {
          try {
            const res = await api.sendTestEmail();
            res.ok ? toast.success(`Test email sent to ${res.to}`) : toast.error(res.reason || "Save a recipient first");
          } catch {
            toast.error("Could not send the test email");
          }
        }}
        className="w-full min-h-[48px] rounded-md border border-[#E5E7EB] bg-white text-sm font-bold"
      >
        SEND TEST EMAIL
      </button>
      <button
        data-testid="send-recap-now-btn"
        disabled={sending}
        onClick={async () => {
          setSending(true);
          try {
            const res = await api.sendShiftRecap(12);
            res.ok ? toast.success(`Recap sent to ${res.to}`) : toast.error(res.reason || "No recipient configured");
          } catch {
            toast.error("Could not send the recap");
          }
          setSending(false);
        }}
        className="w-full min-h-[48px] rounded-md border border-[#E5E7EB] bg-white text-sm font-bold flex items-center justify-center gap-2"
      >
        <Send className="w-4 h-4" /> {sending ? "SENDING…" : "SEND RECAP NOW"}
      </button>
      {cfg?.lastRecapAt && <div className="text-xs opacity-55">Last sent: {cfg.lastRecapAt.slice(0, 19).replace("T", " ")} UTC</div>}
    </div>
  );
};

export const DelayAlertConfig = () => {
  const { state, actions } = useKds();
  const s = state.settings;
  return (
    <div className="space-y-3" data-testid="delay-alert-config">
      <div className="flex items-center gap-3 justify-between bg-white border border-[#E5E7EB] rounded-md p-3">
        <div>
          <div className="text-sm font-bold flex items-center gap-2">
            <BellRing className="w-4 h-4" /> Delay alerts
          </div>
          <div className="text-xs opacity-55">Shout when an order crosses its promised time</div>
        </div>
        <Switch
          data-testid="delay-alerts-toggle"
          checked={s.delayAlerts}
          onCheckedChange={(v) => actions.setSettings({ delayAlerts: v })}
        />
      </div>
      <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
        <div className="text-sm font-bold mb-2">Promised time · {s.slaMinutes} min</div>
        <Slider
          data-testid="sla-slider"
          value={[s.slaMinutes]}
          min={5}
          max={30}
          step={1}
          onValueChange={([v]) => actions.setSettings({ slaMinutes: v })}
        />
        <div className="text-xs opacity-55 mt-2">
          Cards turn orange past {Math.round(s.slaMinutes / 2)} min and red past {s.slaMinutes} min.
        </div>
      </div>
    </div>
  );
};
