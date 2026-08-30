import React, { useEffect, useState } from "react";
import { useKds, hasConnectedDevice } from "@/state/kdsState";
import { ChefProfile } from "@/components/ChefProfile";
import { BrandMark } from "@/components/BrandMark";
import { Dot } from "@/components/ConnectionStatus";
import { Volume2, VolumeX, Settings, Maximize2, Minimize2, Package } from "lucide-react";

const clock = () =>
  new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

export const Header = ({ onOpenSettings }) => {
  const { state, actions } = useKds();
  const [time, setTime] = useState(clock());
  const [fs, setFs] = useState(false);

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
  const posConnected = hasConnectedDevice(state.devices, "desktop_pos");

  return (
    <header className="bg-white border-b border-[#E5E7EB] px-3 sm:px-5 py-2.5 flex items-center gap-3 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <BrandMark size={72} />
        <div className="min-w-0 flex items-center gap-2 text-[11px] sm:text-xs font-semibold opacity-70">
          <span className="truncate" data-testid="header-station">{state.station}</span>
          <span className="flex items-center gap-1" data-testid="header-online">
            <Dot ok={online} />
            {online ? "Online" : "Local Mode"}
          </span>
        </div>
      </div>

      <div className="hidden xl:flex items-center gap-2 ml-4 text-xs font-semibold">
        <span className="flex items-center gap-1.5 bg-[#F7F7F7] rounded-md px-2.5 py-1.5" data-testid="header-server-chip">
          <Dot ok={state.connection.serverConnected} /> Server: {state.connection.serverConnected ? "Connected" : "Offline"}
        </span>
        <span className="flex items-center gap-1.5 bg-[#F7F7F7] rounded-md px-2.5 py-1.5" data-testid="header-pos-chip">
          <Dot ok={posConnected} /> POS: {posConnected ? "Connected" : "Offline"}
        </span>
      </div>

      <div className="mx-auto text-center hidden sm:block">
        <div className="text-[10px] tracking-widest uppercase opacity-50 font-bold">Current Time</div>
        <div className="font-head font-extrabold text-lg sm:text-2xl tabular-nums" data-testid="header-clock">
          {time}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          data-testid="sound-toggle-btn"
          onClick={() => actions.setSettings({ soundOn: !state.settings.soundOn })}
          className={`min-h-[48px] px-3 rounded-md border flex items-center gap-2 text-sm font-bold ${
            state.settings.soundOn
              ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]"
              : "bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]"
          }`}
        >
          {state.settings.soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          <span className="hidden lg:inline">Sound {state.settings.soundOn ? "ON" : "OFF"}</span>
        </button>
        <button
          data-testid="items-btn"
          onClick={() => onOpenSettings("items")}
          className="min-h-[48px] px-3 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] flex items-center gap-2 text-sm font-bold"
        >
          <Package className="w-5 h-5" />
          <span className="hidden lg:inline">Items</span>
        </button>
        <button
          data-testid="fullscreen-btn"
          onClick={toggleFullscreen}
          className="min-h-[48px] px-3 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] hidden sm:flex items-center"
        >
          {fs ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
        <button
          data-testid="settings-btn"
          onClick={() => onOpenSettings("connection")}
          className="min-h-[48px] px-3 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] flex items-center"
        >
          <Settings className="w-5 h-5" />
        </button>
        <ChefProfile onOpenSettings={onOpenSettings} />
      </div>
    </header>
  );
};
