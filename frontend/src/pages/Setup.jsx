import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useKds } from "@/state/kdsState";
import { DEMO_POS_CODE, DEMO_SYNC_CODE, pairDevice } from "@/services/mockDeviceService";
import { STATIONS } from "@/services/mockOrderService";
import { ConnectionStatus, Dot } from "@/components/ConnectionStatus";
import { unlockAudio, playTestBeep } from "@/services/soundService";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowRight, Volume2 } from "lucide-react";

const Field = ({ label, value, onChange, placeholder, testId, disabled }) => (
  <div>
    <label className="block text-xs font-bold uppercase tracking-widest opacity-55 mb-1.5">{label}</label>
    <input
      data-testid={testId}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full min-h-[52px] px-3.5 rounded-md border border-[#E5E7EB] bg-white outline-none focus:border-[#FF3131] font-mono tracking-wider disabled:opacity-60"
    />
  </div>
);

export default function Setup() {
  const { state, actions } = useKds();
  const navigate = useNavigate();
  const [syncCode, setSyncCode] = useState(DEMO_SYNC_CODE);
  const [posCode, setPosCode] = useState(DEMO_POS_CODE);
  const [serverOk, setServerOk] = useState(false);
  const [posOk, setPosOk] = useState(false);
  const [busy, setBusy] = useState(null);
  const [station, setStation] = useState(state.station);

  const connectServer = async () => {
    if (!syncCode.trim()) return toast.error("Enter a Server Sync Code");
    unlockAudio();
    setBusy("server");
    await pairDevice(syncCode);
    setBusy(null);
    setServerOk(true);
    actions.setConnection({ serverConnected: true, internet: true, lastSync: "Just now" });
    toast.success("Connected to Demo Server");
  };

  const pairPos = async () => {
    if (!posCode.trim()) return toast.error("Enter a POS Pair Code");
    unlockAudio();
    setBusy("pos");
    await pairDevice(posCode);
    setBusy(null);
    setPosOk(true);
    actions.setConnection({ posConnected: true });
    toast.success("POS paired successfully");
  };

  const enter = () => {
    unlockAudio();
    actions.setStation(station);
    actions.setPaired(true);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col">
      <header className="bg-white border-b border-[#E5E7EB] px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-md bg-[#FF3131] text-white font-head font-extrabold flex items-center justify-center text-xl">B</div>
          <div>
            <div className="font-head text-xl sm:text-2xl font-extrabold leading-tight">
              Bhoj<span className="text-[#FF3131]">Pe</span> KDS
            </div>
            <div className="text-xs sm:text-sm opacity-60 font-medium">Kitchen Display System</div>
          </div>
        </div>
        <span data-testid="demo-mode-badge" className="text-[11px] font-extrabold tracking-widest uppercase rounded-md bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] px-2.5 py-1.5">
          Demo Mode
        </span>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-8 grid lg:grid-cols-[1.2fr_1fr] gap-6 items-start">
        <div className="bg-white border border-[#E5E7EB] rounded-md p-5 sm:p-8 space-y-6">
          <div>
            <h2 className="font-head text-xl sm:text-2xl font-extrabold">Connect to BhojPe Server</h2>
            <div className="mt-4 space-y-3">
              <Field label="Server Sync Code" value={syncCode} onChange={setSyncCode} placeholder="Enter Sync Code" testId="sync-code-input" />
              <button
                data-testid="connect-sync-btn"
                onClick={connectServer}
                className="w-full min-h-[52px] rounded-md bg-[#FF3131] text-white font-bold tracking-wider hover:brightness-95 flex items-center justify-center gap-2"
              >
                {busy === "server" ? <Loader2 className="w-5 h-5 animate-spin" /> : serverOk ? <CheckCircle2 className="w-5 h-5" /> : null}
                {serverOk ? "SERVER CONNECTED" : "CONNECT & SYNC"}
              </button>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-4">
              <div className="bg-[#F7F7F7] rounded-md p-3">
                <div className="text-[11px] uppercase tracking-widest opacity-55 font-bold">Connected Server</div>
                <div className="text-sm font-bold flex items-center gap-1.5 mt-1"><Dot ok={serverOk || state.connection.serverConnected} /> Demo Server</div>
              </div>
              <div className="bg-[#F7F7F7] rounded-md p-3">
                <div className="text-[11px] uppercase tracking-widest opacity-55 font-bold">Restaurant</div>
                <div className="text-sm font-bold mt-1">BhojPe Cafe</div>
              </div>
              <div className="bg-[#F7F7F7] rounded-md p-3">
                <div className="text-[11px] uppercase tracking-widest opacity-55 font-bold">Branch</div>
                <div className="text-sm font-bold mt-1">Main Branch</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px bg-[#E5E7EB] flex-1" />
            <span className="text-xs font-extrabold tracking-widest opacity-45">OR</span>
            <div className="h-px bg-[#E5E7EB] flex-1" />
          </div>

          <div>
            <h2 className="font-head text-xl sm:text-2xl font-extrabold">Pair with POS</h2>
            <div className="mt-4 space-y-3">
              <Field label="POS Pair Code" value={posCode} onChange={setPosCode} placeholder="Enter POS Pair Code" testId="pos-code-input" />
              <button
                data-testid="pair-pos-btn"
                onClick={pairPos}
                className="w-full min-h-[52px] rounded-md bg-[#2C2C2C] text-white font-bold tracking-wider hover:brightness-125 flex items-center justify-center gap-2"
              >
                {busy === "pos" ? <Loader2 className="w-5 h-5 animate-spin" /> : posOk ? <CheckCircle2 className="w-5 h-5" /> : null}
                {posOk ? "POS PAIRED" : "PAIR POS"}
              </button>
              <p className="text-sm opacity-60">
                Connect this KDS with the restaurant POS to receive kitchen orders in real time.
              </p>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-widest opacity-55 mb-2">Select Kitchen Station</div>
            <div className="flex flex-wrap gap-2">
              {STATIONS.map((st) => (
                <button
                  key={st}
                  data-testid={`setup-station-${st.replace(/\s+/g, "-").toLowerCase()}`}
                  onClick={() => setStation(st)}
                  className={`min-h-[48px] px-4 rounded-md border text-sm font-bold ${
                    station === st ? "border-[#FF3131] bg-[#FEF2F2] text-[#FF3131]" : "border-[#E5E7EB] bg-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 w-full">
          <ConnectionStatus
            connection={{
              serverConnected: serverOk || state.connection.serverConnected,
              posConnected: posOk || state.connection.posConnected,
              tokenScreenConnected: state.connection.tokenScreenConnected,
            }}
          />
          <div className="bg-white border border-[#E5E7EB] rounded-md p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest opacity-55">Enable Kitchen Sound</div>
            <p className="text-sm opacity-65">Browsers require one tap before loud alerts can play. Tap to test the new-order alert.</p>
            <button
              data-testid="enable-sound-btn"
              onClick={() => { unlockAudio(); playTestBeep(state.settings.volume); toast.success("Sound enabled"); }}
              className="w-full min-h-[52px] rounded-md border border-[#E5E7EB] bg-white font-bold flex items-center justify-center gap-2 hover:bg-[#F7F7F7]"
            >
              <Volume2 className="w-5 h-5" /> Test Alert Sound
            </button>
          </div>
          <button
            data-testid="enter-kds-btn"
            onClick={enter}
            className="w-full min-h-[56px] rounded-md bg-[#FF3131] text-white font-head font-extrabold tracking-wider flex items-center justify-center gap-2 hover:brightness-95"
          >
            OPEN KITCHEN DISPLAY <ArrowRight className="w-5 h-5" />
          </button>
          <div className="text-xs opacity-50 text-center">
            Device ID {state.connection.deviceId} · Mock data only
          </div>
        </div>
      </main>
    </div>
  );
}
