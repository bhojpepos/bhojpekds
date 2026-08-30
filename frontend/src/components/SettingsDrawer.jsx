import React, { useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useKds, DEFAULT_COLORS, hasConnectedDevice } from "@/state/kdsState";
import { STATUS_ORDER, STATUS_LABEL } from "@/services/mockOrderService";
import { ConnectionStatus, StatusLine } from "@/components/ConnectionStatus";
import { DeviceCard } from "@/components/DeviceCard";
import { ItemAvailability } from "@/components/ItemAvailability";
import { TokenScreenPreview } from "@/components/TokenScreenPreview";
import { PrepInsights } from "@/components/PrepInsights";
import { PrintQueue, ShiftSummary } from "@/components/KitchenOps";
import { PrinterConfig, RecapConfig, DelayAlertConfig } from "@/components/OpsConfig";
import { AuditTrail, WeeklyTrends } from "@/components/Analytics";
import { playTestBeep } from "@/services/soundService";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Plug, MonitorSmartphone, ChefHat, User, Volume2, LayoutGrid, Palette, Package, Tv, Bell, Maximize2, RotateCcw, LogOut, Beaker, ExternalLink, Timer, Printer, ClipboardList, Mail, TrendingUp, History } from "lucide-react";

const TABS = [
  { id: "connection", label: "Connection", Icon: Plug },
  { id: "devices", label: "Devices", Icon: MonitorSmartphone },
  { id: "station", label: "Kitchen Station", Icon: ChefHat },
  { id: "profile", label: "Chef Profile", Icon: User },
  { id: "sound", label: "Sound", Icon: Volume2 },
  { id: "display", label: "Display", Icon: LayoutGrid },
  { id: "colors", label: "Colors", Icon: Palette },
  { id: "items", label: "Items", Icon: Package },
  { id: "token", label: "Token Screen", Icon: Tv },
  { id: "insights", label: "Prep Insights", Icon: Timer },
  { id: "printer", label: "Printer", Icon: Printer },
  { id: "shift", label: "Shift Summary", Icon: ClipboardList },
  { id: "recap", label: "Email Recap", Icon: Mail },
  { id: "weekly", label: "Weekly Trends", Icon: TrendingUp },
  { id: "audit", label: "Audit Trail", Icon: History },
  { id: "stations", label: "Station Screens", Icon: MonitorSmartphone },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "demo", label: "Demo Controls", Icon: Beaker },
];

const Row = ({ label, hint, children, testId }) => (
  <div className="flex items-center gap-3 justify-between bg-white border border-[#E5E7EB] rounded-md p-3" data-testid={testId}>
    <div className="min-w-0">
      <div className="text-sm font-bold">{label}</div>
      {hint && <div className="text-xs opacity-55">{hint}</div>}
    </div>
    {children}
  </div>
);

const Btn = ({ children, onClick, testId, variant = "default" }) => (
  <button
    data-testid={testId}
    onClick={onClick}
    className={`w-full min-h-[48px] rounded-md text-sm font-bold px-3 border ${
      variant === "primary"
        ? "bg-[#FF3131] text-white border-[#FF3131] hover:brightness-95"
        : variant === "danger"
        ? "bg-white text-[#FF3131] border-[#FECACA] hover:bg-[#FEF2F2]"
        : "bg-white text-[#2C2C2C] border-[#E5E7EB] hover:bg-[#F7F7F7]"
    }`}
  >
    {children}
  </button>
);

export const SettingsDrawer = ({ open, onOpenChange, tab, setTab }) => {
  const { state, actions } = useKds();
  const navigate = useNavigate();

  useEffect(() => {
    if (open && tab === "devices") actions.fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);
  const s = state.settings;

  const body = () => {
    switch (tab) {
      case "connection":
        return (
          <div className="space-y-3">
            <div className="bg-white border border-[#E5E7EB] rounded-md p-4">
              <div className="font-head font-extrabold text-lg">
                Bhoj<span className="text-[#FF3131]">Pe</span> KDS
              </div>
              <div className="text-sm opacity-60 mb-2">{state.station}</div>
              <StatusLine label="Server" ok={state.connection.serverConnected} />
              <StatusLine label="POS" ok={hasConnectedDevice(state.devices, "desktop_pos")} />
              <StatusLine
                label="Real-time Sync"
                ok={state.connection.serverConnected}
                okText="Active"
                badText="Paused"
              />
              <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                <div><div className="text-xs opacity-55">Last Sync</div><div className="font-semibold">{state.connection.lastSync}</div></div>
                <div><div className="text-xs opacity-55">Branch ID</div><div className="font-semibold font-mono">{state.connection.branchId ? state.connection.branchId.slice(0, 8) : "—"}</div></div>
                <div><div className="text-xs opacity-55">Restaurant</div><div className="font-semibold">{state.connection.restaurant}</div></div>
                <div><div className="text-xs opacity-55">Branch</div><div className="font-semibold">{state.connection.branch}</div></div>
              </div>
            </div>
            {!state.connection.internet && (
              <div className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] p-3 text-sm text-[#92400E]">
                Local network active. Orders will sync with server when internet is restored.
              </div>
            )}
          </div>
        );
      case "devices":
        return (
          <div className="space-y-3">
            {state.devices.length === 0 && (
              <div className="text-xs opacity-55 text-center py-4">
                No devices paired for this branch yet.
              </div>
            )}
            {state.devices.map((d) => (
              <DeviceCard
                key={d.id}
                device={d}
                onRename={async (id, name) => {
                  try {
                    await actions.renameDevice(id, name);
                    toast.success("Device renamed");
                  } catch (err) {
                    toast.error(err?.response?.data?.detail || "Could not rename device");
                  }
                }}
                onDisconnect={async (id) => {
                  try {
                    await actions.disconnectDevice(id);
                    toast.success("Device disconnected");
                  } catch (err) {
                    toast.error(err?.response?.data?.detail || "Could not disconnect device");
                  }
                }}
              />
            ))}
          </div>
        );
      case "station":
        return (
          <div className="space-y-3">
            <Row label="Show only this station's orders" hint="Filter the board by kitchen station">
              <Switch data-testid="station-filter-toggle" checked={s.stationFilterOn} onCheckedChange={(v) => actions.setSettings({ stationFilterOn: v })} />
            </Row>
            <div className="text-xs font-bold uppercase tracking-widest opacity-55">Current Station: {state.station}</div>
            {(state.connection.stations ?? []).map((st) => (
              <button
                key={st}
                data-testid={`settings-station-${st.replace(/\s+/g, "-").toLowerCase()}`}
                onClick={() => actions.setStation(st)}
                className={`w-full min-h-[52px] rounded-md border px-4 text-left text-sm font-bold ${
                  state.station === st ? "border-[#FF3131] bg-[#FEF2F2] text-[#FF3131]" : "border-[#E5E7EB] bg-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        );
      case "profile":
        return (
          <div className="space-y-3">
            <div className="bg-white border border-[#E5E7EB] rounded-md p-4 flex items-center gap-3">
              <img src={state.chef.avatar} alt={state.chef.name} className="w-16 h-16 rounded-md object-cover" />
              <div>
                <div className="font-head font-extrabold text-lg">{state.chef.name}</div>
                <div className="text-sm opacity-60">{state.chef.role}</div>
              </div>
            </div>
            <Row label="Name" testId="profile-name"><span className="text-sm font-semibold">{state.chef.name}</span></Row>
            <Row label="Role"><span className="text-sm font-semibold">{state.chef.role}</span></Row>
            <Row label="Station"><span className="text-sm font-semibold">{state.station}</span></Row>
            <Row label="Branch"><span className="text-sm font-semibold">{state.chef.branch}</span></Row>
          </div>
        );
      case "sound":
      case "notifications":
        return (
          <div className="space-y-3">
            <Row label="Sound" hint="Loud alert on every new KOT">
              <Switch data-testid="settings-sound-toggle" checked={s.soundOn} onCheckedChange={(v) => actions.setSettings({ soundOn: v })} />
            </Row>
            <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
              <div className="text-sm font-bold mb-2">Volume · {Math.round(s.volume * 100)}%</div>
              <Slider data-testid="volume-slider" value={[s.volume * 100]} max={100} step={5} onValueChange={([v]) => actions.setSettings({ volume: v / 100 })} />
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
              <div className="text-sm font-bold mb-2">Repeat Alert · {s.repeat}×</div>
              <Slider data-testid="repeat-slider" value={[s.repeat]} min={1} max={5} step={1} onValueChange={([v]) => actions.setSettings({ repeat: v })} />
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-md p-3">
              <div className="text-sm font-bold mb-2">Alert Duration · {s.alertDuration}s</div>
              <Slider data-testid="duration-slider" value={[s.alertDuration]} min={2} max={15} step={1} onValueChange={([v]) => actions.setSettings({ alertDuration: v })} />
            </div>
            <Btn testId="test-sound-btn" onClick={() => playTestBeep(s.volume)}>Test Sound</Btn>
            <div className="h-px bg-[#E5E7EB]" />
            <DelayAlertConfig />
            <Btn testId="simulate-kot-btn" variant="primary" onClick={async () => { const o = await actions.newKot(); toast[o ? "success" : "error"](o ? `KOT #${o.kot} received` : "Server unreachable"); }}>
              Simulate New KOT
            </Btn>
          </div>
        );
      case "display":
        return (
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest opacity-55">Display Mode</div>
            {[
              ["auto", "Auto", "Detects width and scales columns, fonts and cards"],
              ["tablet", "Tablet", "Compact, touch-friendly cards"],
              ["tv", "TV", "Large cards for 32\"–43\" screens"],
              ["largetv", "Large TV", "Maximum readability for 50\"+ screens"],
            ].map(([id, label, hint]) => (
              <button
                key={id}
                data-testid={`display-mode-${id}`}
                onClick={() => actions.setSettings({ displayMode: id })}
                className={`w-full min-h-[56px] rounded-md border px-4 text-left ${
                  s.displayMode === id ? "border-[#FF3131] bg-[#FEF2F2]" : "border-[#E5E7EB] bg-white"
                }`}
              >
                <div className="text-sm font-bold">{label}</div>
                <div className="text-xs opacity-55">{hint}</div>
              </button>
            ))}
            <Btn testId="settings-fullscreen-btn" onClick={() => (document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.())}>
              <span className="flex items-center justify-center gap-2"><Maximize2 className="w-4 h-4" /> Fullscreen</span>
            </Btn>
          </div>
        );
      case "colors":
        return (
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest opacity-55">KDS Appearance</div>
            {STATUS_ORDER.map((st) => (
              <Row key={st} label={STATUS_LABEL[st]} hint={s.colors[st].toUpperCase()} testId={`color-row-${st}`}>
                <input
                  data-testid={`color-input-${st}`}
                  type="color"
                  value={s.colors[st]}
                  onChange={(e) => actions.setColors({ [st]: e.target.value })}
                  className="w-12 h-10 rounded-md border border-[#E5E7EB] bg-white cursor-pointer"
                />
              </Row>
            ))}
            <Btn testId="reset-colors-btn" onClick={() => { actions.resetColors(); toast.success("Colors reset to default"); }}>
              <span className="flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> Reset to Default</span>
            </Btn>
            <div className="text-xs opacity-55">
              Defaults: NEW {DEFAULT_COLORS.new} · COOKING {DEFAULT_COLORS.cooking} · READY {DEFAULT_COLORS.ready} · COMPLETED {DEFAULT_COLORS.completed}
            </div>
          </div>
        );
      case "items":
        return <ItemAvailability />;
      case "insights":
        return <PrepInsights />;
      case "printer":
        return (
          <div className="space-y-4">
            <PrinterConfig />
            <div className="h-px bg-[#E5E7EB]" />
            <PrintQueue />
          </div>
        );
      case "shift":
        return <ShiftSummary />;
      case "recap":
        return <RecapConfig />;
      case "weekly":
        return <WeeklyTrends />;
      case "audit":
        return <AuditTrail />;
      case "stations":
        return (
          <div className="space-y-3">
            <div className="bg-white border border-[#E5E7EB] rounded-md p-3 text-sm opacity-70">
              Open a station screen on any tablet or TV — it shows only that station's dishes and stays fully interactive.
            </div>
            {(state.connection.stations ?? []).length === 0 && (
              <div className="text-xs opacity-55">No kitchen stations configured for this branch yet.</div>
            )}
            {(state.connection.stations ?? []).map((st) => (
              <Btn
                key={st}
                testId={`open-station-${st.replace(/\s+/g, "-").toLowerCase()}`}
                onClick={() => window.open(`/station/${st.replace(/\s+/g, "-").toLowerCase()}`, "_blank")}
              >
                <span className="flex items-center justify-center gap-2">
                  <ExternalLink className="w-4 h-4" /> {st}
                </span>
              </Btn>
            ))}
          </div>
        );
      case "token":
        return (
          <div className="space-y-3">
            <Btn testId="open-token-screen-btn" onClick={() => window.open("/token", "_blank")}>
              <span className="flex items-center justify-center gap-2"><ExternalLink className="w-4 h-4" /> Open Token Screen</span>
            </Btn>
            <TokenScreenPreview compact />
            <div className="text-xs opacity-55">KOT number is used as the token number — no separate token is generated.</div>
          </div>
        );
      case "demo":
        return (
          <div className="space-y-3">
            <Btn testId="demo-generate-kot" variant="primary" onClick={async () => { const o = await actions.newKot(); toast[o ? "success" : "error"](o ? `KOT #${o.kot} created` : "Server unreachable"); }}>Generate New KOT</Btn>
            <Btn testId="demo-random-ready" onClick={async () => { const o = await actions.markRandomReady(); toast[o ? "success" : "info"](o ? `KOT #${o.kot} marked ready` : "No cooking orders"); }}>Mark Random Order Ready</Btn>
            <Btn testId="demo-delayed" onClick={async () => { const o = await actions.simulateDelayed(); toast[o ? "warning" : "info"](o ? `KOT #${o.kot} is now delayed` : "No active orders"); }}>Simulate Delayed Order</Btn>
            <Btn testId="demo-toggle-internet" onClick={() => actions.setConnection({ internet: !state.connection.internet, serverConnected: !state.connection.internet })}>
              Toggle Internet · {state.connection.internet ? "ON" : "OFF"}
            </Btn>
            <Btn testId="demo-toggle-server" onClick={() => actions.setConnection({ serverConnected: !state.connection.serverConnected })}>
              Toggle Server Connection · {state.connection.serverConnected ? "ON" : "OFF"}
            </Btn>
            <Btn testId="demo-reset" variant="danger" onClick={async () => { await actions.resetDemo(); toast.success("Demo data reset"); }}>Reset Demo Data</Btn>
            <Btn testId="settings-logout-btn" variant="danger" onClick={() => { actions.setPaired(false); navigate("/setup"); }}>
              <span className="flex items-center justify-center gap-2"><LogOut className="w-4 h-4" /> Logout</span>
            </Btn>
            <ConnectionStatus connection={state.connection} posConnected={hasConnectedDevice(state.devices, "desktop_pos")} testId="demo-connection-status" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-[#F7F7F7] w-full sm:max-w-[560px] p-0 flex flex-col" data-testid="settings-drawer">
        <SheetHeader className="px-4 py-3 bg-white border-b border-[#E5E7EB]">
          <SheetTitle className="font-head font-extrabold">Settings</SheetTitle>
          <SheetDescription className="sr-only">
            Configure connection, devices, station, sound, display, colors, items and demo controls.
          </SheetDescription>
        </SheetHeader>
        <div className="flex gap-2 overflow-x-auto thin-scroll px-3 py-2 bg-white border-b border-[#E5E7EB] shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              data-testid={`settings-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`shrink-0 min-h-[44px] px-3 rounded-md text-xs font-bold border flex items-center gap-1.5 ${
                tab === t.id ? "bg-[#2C2C2C] text-white border-[#2C2C2C]" : "bg-white border-[#E5E7EB]"
              }`}
            >
              <t.Icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll p-4">{body()}</div>
      </SheetContent>
    </Sheet>
  );
};
