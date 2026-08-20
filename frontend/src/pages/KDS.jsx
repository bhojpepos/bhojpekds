import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useKds, ageOf, ageLevel } from "@/state/kdsState";
import { STATUS_ORDER, STATUS_LABEL } from "@/services/mockOrderService";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { StatusColumn } from "@/components/StatusColumn";
import { NewOrderAlert } from "@/components/NewOrderAlert";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { UndoBar } from "@/components/UndoBar";
import { WifiOff } from "lucide-react";

export default function KDS() {
  const { state, actions, now } = useKds();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState("connection");
  const [mobileStatus, setMobileStatus] = useState("new");

  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    if (!state.paired) navigate("/setup");
  }, [state.paired, navigate]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = (e) => setIsNarrow(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const openSettings = (t) => {
    setTab(t || "connection");
    setSettingsOpen(true);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.orders.filter((o) => {
      if (state.settings.stationFilterOn && o.station !== state.station) return false;
      if (["new", "cooking", "ready"].includes(filter) && o.status !== filter) return false;
      if (["dine-in", "takeaway", "delivery"].includes(filter) && o.type !== filter) return false;
      if (filter === "delayed" && ageLevel(ageOf(o, now).seconds) !== "delayed") return false;
      if (q) {
        const hay = `${o.kot} ${o.table || ""} ${o.refNo || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [state.orders, state.settings.stationFilterOn, state.station, filter, query, now]);

  const byStatus = (st) => filtered.filter((o) => o.status === st);
  const mode = state.settings.displayMode;
  const offline = !state.connection.serverConnected || !state.connection.internet;

  return (
    <div className={`kds-scope mode-${mode} h-screen flex flex-col bg-[#F7F7F7] overflow-hidden`} data-testid="kds-screen">
      <Header onOpenSettings={openSettings} />

      {offline && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#FFFBEB] border-b border-[#FDE68A] text-[#92400E] text-sm font-semibold" data-testid="offline-banner">
          <WifiOff className="w-4 h-4" />
          <span className="font-extrabold tracking-wider">● LOCAL MODE</span>
          <span className="hidden sm:inline">Local network active. Orders will sync with server when internet is restored.</span>
        </div>
      )}

      <FilterBar filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} />

      {/* Mobile segmented status navigation */}
      {isNarrow && <div className="flex gap-2 px-3 py-2 bg-white border-b border-[#E5E7EB] overflow-x-auto thin-scroll">
        {STATUS_ORDER.map((st) => (
          <button
            key={st}
            data-testid={`mobile-status-${st}`}
            onClick={() => setMobileStatus(st)}
            className={`shrink-0 min-h-[48px] px-4 rounded-md text-sm font-extrabold border flex items-center gap-2 ${
              mobileStatus === st ? "text-white" : "bg-white text-[#2C2C2C] border-[#E5E7EB]"
            }`}
            style={mobileStatus === st ? { background: state.settings.colors[st], borderColor: state.settings.colors[st] } : {}}
          >
            {STATUS_LABEL[st]}
            <span className="rounded px-1.5 bg-black/10">{byStatus(st).length}</span>
          </button>
        ))}
      </div>}

      <main className="flex-1 min-h-0 p-3 sm:p-5">
        {isNarrow ? (
          <div className="h-full min-h-0">
            <StatusColumn status={mobileStatus} orders={byStatus(mobileStatus)} />
          </div>
        ) : (
          <div className="grid h-full min-h-0 gap-4 lg:gap-5 grid-cols-2 xl:grid-cols-4">
            {STATUS_ORDER.map((st) => (
              <StatusColumn key={st} status={st} orders={byStatus(st)} />
            ))}
          </div>
        )}
      </main>

      <NewOrderAlert />
      <UndoBar />
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} tab={tab} setTab={setTab} />
    </div>
  );
}
