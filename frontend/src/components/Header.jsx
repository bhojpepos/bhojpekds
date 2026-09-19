import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useKds } from "@/state/kdsState";
import { ChefProfile } from "@/components/ChefProfile";
import { BrandMark } from "@/components/BrandMark";
import { Dot } from "@/components/ConnectionStatus";
import { QuickDrawer } from "@/components/QuickDrawer";
import { Volume2, VolumeX, Maximize2, Minimize2, Package, Menu, Timer, ClipboardList } from "lucide-react";

const clock = () =>
  new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

export const Header = ({ onOpenSidebar }) => {
  const { state, actions } = useKds();
  const navigate = useNavigate();
  const [time, setTime] = useState(clock());
  const [fs, setFs] = useState(false);
  const [quickDrawer, setQuickDrawer] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setTime(clock()), 1000);
    return () => clearInterval(t);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setFs(true);
    } else {
      document.exitFullscreen?.();
      setFs(false);
    }
  };

  const online = state.connection.serverConnected && state.connection.internet;

  return (
    <header
      className="px-3 sm:px-5 py-1.5 flex items-center gap-3 shrink-0 text-[#1A1A1A] bg-white border-b border-[#E5E7EB]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          data-testid="sidebar-toggle-btn"
          onClick={onOpenSidebar}
          className="min-h-[40px] min-w-[40px] rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] flex items-center justify-center text-[#2C2C2C] shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <BrandMark size={40} tone="dark" />
        <div className="min-w-0 flex items-center gap-2 text-[11px] sm:text-xs font-semibold opacity-60">
          <span className="truncate" data-testid="header-station">{state.station}</span>
          <span className="flex items-center gap-1" data-testid="header-online">
            <Dot ok={online} />
            {online ? "Online" : "Local Mode"}
          </span>
        </div>
      </div>

      <div className="mx-auto text-center hidden sm:block">
        <div className="text-[9px] tracking-widest uppercase opacity-50 font-bold">Current Time</div>
        <div className="font-head font-extrabold text-base sm:text-lg tabular-nums" data-testid="header-clock">
          {time}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          data-testid="sound-toggle-btn"
          onClick={() => actions.setSettings({ soundOn: !state.settings.soundOn })}
          className={`min-h-[38px] px-3 rounded-md border flex items-center gap-2 text-sm font-bold ${
            state.settings.soundOn
              ? "bg-white border-[#E5E7EB] text-[#2C2C2C]"
              : "bg-[#F3F4F6] border-[#E5E7EB] text-[#9CA3AF]"
          }`}
        >
          {state.settings.soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span className="hidden lg:inline">Sound {state.settings.soundOn ? "ON" : "OFF"}</span>
        </button>
        <button
          data-testid="items-btn"
          onClick={() => navigate("/settings/items")}
          className="min-h-[38px] px-3 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] flex items-center gap-2 text-sm font-bold text-[#2C2C2C]"
        >
          <Package className="w-4 h-4" />
          <span className="hidden lg:inline">Items</span>
        </button>
        {/* Prep Insights / Shift Summary — quick glance, opens a right-side
            drawer (QuickDrawer) instead of navigating away. Profile is
            reached only through the ChefProfile avatar dropdown below — a
            separate header icon for it duplicated that same section. */}
        <button
          data-testid="prep-insights-quick-btn"
          onClick={() => setQuickDrawer("insights")}
          className="min-h-[38px] px-3 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] hidden md:flex items-center text-[#2C2C2C]"
        >
          <Timer className="w-4 h-4" />
        </button>
        <button
          data-testid="shift-summary-quick-btn"
          onClick={() => setQuickDrawer("shift")}
          className="min-h-[38px] px-3 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] hidden md:flex items-center text-[#2C2C2C]"
        >
          <ClipboardList className="w-4 h-4" />
        </button>
        <button
          data-testid="fullscreen-btn"
          onClick={toggleFullscreen}
          className="min-h-[38px] px-3 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] hidden sm:flex items-center text-[#2C2C2C]"
        >
          {fs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <ChefProfile />
      </div>

      <QuickDrawer section={quickDrawer} onClose={() => setQuickDrawer(null)} />
    </header>
  );
};
