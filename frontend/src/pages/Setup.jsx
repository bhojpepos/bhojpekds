import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useKds } from "@/state/kdsState";
import * as api from "@/services/apiService";
import { STATIONS } from "@/services/mockOrderService";
import { unlockAudio } from "@/services/soundService";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowRight, KeyRound, Link2, Delete, CornerDownLeft } from "lucide-react";

const RED = "#FF3131";
const BLACK = "#111111";

// Same gradient + pill language as bhojpe-poss's ConnectPage.jsx/LoginPage.jsx
// (Connect Restaurant / Unlock with Passcode) — this screen mirrors that same
// two-stage shape (connect, then passcode), plus a bhojpekds-specific middle
// stage (pick which kitchen station this screen is for). The passcode stage
// additionally mirrors LoginPage.jsx's left-illustration/right-form split.
const PageShell = ({ children, showImage }) => (
  <div
    className="min-h-screen w-full flex flex-col"
    style={{ background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #FFEEEE 100%)" }}
  >
    <header className="h-16 flex items-center px-4 sm:px-8 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-md flex items-center justify-center text-white font-extrabold" style={{ background: RED }}>
          B
        </div>
        <div className="font-extrabold text-lg tracking-tight">
          Bhoj<span style={{ color: RED }}>Pe</span> KDS
        </div>
      </div>
    </header>
    {showImage ? (
      <main className="flex-1 flex">
        <div className="hidden md:flex flex-1 items-center justify-center px-8">
          <img src="/chef-character.svg" alt="" className="w-full max-w-[420px] h-auto" />
        </div>
        <div className="flex-1 flex items-center justify-center px-4 py-6">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </main>
    ) : (
      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>
    )}
  </div>
);

const pillInputClass =
  "w-full h-[50px] rounded-full bg-[#e5e6e1] outline-none text-center font-bold tracking-[0.25em] uppercase text-black placeholder:normal-case placeholder:tracking-normal placeholder:text-black/30 pl-12";

const pillButtonClass =
  "w-full h-12 rounded-full text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-60";

/* ── Stage 1: Connect (Sync Code + POS Pair Code) ─────────────────────── */
function ConnectStage({ onConnected }) {
  const [syncCode, setSyncCode] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(null);

  const connect = async (e) => {
    e.preventDefault();
    if (!syncCode.trim() || !pairCode.trim() || busy) return;
    unlockAudio();
    setBusy(true);
    setError(null);
    try {
      const res = await api.pair(syncCode.trim(), pairCode.trim());
      api.setDeviceToken(res.deviceToken);
      setConnected(res);
    } catch (err) {
      api.setDeviceToken(null);
      setError(err?.response?.data?.detail || "Invalid sync code or Pair Code");
    }
    setBusy(false);
  };

  if (connected) {
    return (
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="w-11 h-11 mb-3" style={{ color: "#38853D" }} />
        <div className="text-[22px] font-extrabold mb-1">Connected</div>
        <div className="text-[13px] text-black/55 mb-5">This screen is now paired to:</div>
        <div className="w-full bg-[#e5e6e1] rounded-[20px] px-6 py-5 mb-6">
          <div className="text-[17px] font-extrabold">{connected.restaurant || "—"}</div>
          {connected.branch && connected.branch !== connected.restaurant && (
            <div className="text-[12.5px] text-black/55 mt-1">{connected.branch}</div>
          )}
        </div>
        <button
          data-testid="continue-after-connect-btn"
          onClick={() => onConnected(connected)}
          className={pillButtonClass + " px-10 w-auto"}
          style={{ background: RED }}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="text-[12px] font-bold text-black/40 tracking-[0.2em] uppercase mb-1.5">Terminal Setup</div>
      <div className="text-[28px] font-extrabold leading-tight tracking-tight mb-1">Connect Restaurant</div>
      <div className="text-[13px] text-black/55 mb-6">
        Enter this branch&apos;s Sync Code and a fresh POS Pair Code — both from bhojpe-poss&apos;s Connected Devices screen.
      </div>
      <form onSubmit={connect} className="flex flex-col">
        <div className="relative mb-3">
          <KeyRound className="w-[18px] h-[18px] text-black/40 absolute left-[18px] top-1/2 -translate-y-1/2" />
          <input
            data-testid="sync-code-input"
            value={syncCode}
            onChange={(e) => setSyncCode(e.target.value.toUpperCase())}
            placeholder="Sync Code — e.g. A1B2C3D4"
            maxLength={12}
            autoFocus
            className={pillInputClass}
          />
        </div>
        <div className="relative mb-3">
          <Link2 className="w-[18px] h-[18px] text-black/40 absolute left-[18px] top-1/2 -translate-y-1/2" />
          <input
            data-testid="pos-pair-code-input"
            value={pairCode}
            onChange={(e) => setPairCode(e.target.value.toUpperCase())}
            placeholder="POS Pair — e.g. RDD96Y76"
            maxLength={12}
            className={pillInputClass}
          />
        </div>
        {error && <div className="text-[12.5px] font-semibold text-center mb-3" style={{ color: "#C4001C" }}>{error}</div>}
        <button data-testid="connect-sync-btn" type="submit" disabled={busy} className={pillButtonClass} style={{ background: RED }}>
          {busy ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : "Verify & Connect"}
        </button>
        <div className="text-[11.5px] text-black/40 text-center mt-5">
          Ask your restaurant owner/manager for both codes. The POS Pair Code expires in 5 minutes.
        </div>
      </form>
    </>
  );
}

/* ── Stage 2: Kitchen Station ─────────────────────────────────────────── */
function StationStage({ initial, stations, onNext }) {
  const [station, setStation] = useState(initial);
  const list = stations && stations.length ? stations : STATIONS;
  return (
    <>
      <div className="text-[12px] font-bold text-black/40 tracking-[0.2em] uppercase mb-1.5">Terminal Setup</div>
      <div className="text-[28px] font-extrabold leading-tight tracking-tight mb-1">Select Kitchen Station</div>
      <div className="text-[13px] text-black/55 mb-6">Which station is this screen for?</div>
      {!stations?.length && (
        <div className="text-[12px] text-black/45 mb-4 -mt-3">
          No kitchens configured for this branch yet — showing default stations. Add kitchens from the billing admin panel.
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-8">
        {list.map((st) => (
          <button
            key={st}
            data-testid={`setup-station-${st.replace(/\s+/g, "-").toLowerCase()}`}
            onClick={() => { unlockAudio(); setStation(st); }}
            className="h-11 px-4 rounded-full text-sm font-bold border transition"
            style={
              station === st
                ? { background: RED, borderColor: RED, color: "#fff" }
                : { background: "#e5e6e1", borderColor: "transparent", color: BLACK }
            }
          >
            {st}
          </button>
        ))}
      </div>
      <button data-testid="station-continue-btn" onClick={() => onNext(station)} className={pillButtonClass} style={{ background: RED }}>
        Continue <ArrowRight className="w-4 h-4" />
      </button>
    </>
  );
}

/* ── Stage 3: Passcode login ──────────────────────────────────────────── */
function PasscodeStage({ onLoggedIn, onSessionLost }) {
  const [code, setCode] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Billing passcodes are 4-6 digits (see AuthController's validation and
  // create.blade.php's "e.g. 1234 (4-6 digits)" hint) - not fixed at 4, so
  // this can't auto-submit on the 4th digit. The explicit Enter key (already
  // present for exactly this reason) is what confirms entry once done.
  const MIN_LEN = 4;
  const MAX_LEN = 6;
  const add = (v) => {
    if (busy || code.length >= MAX_LEN) return;
    setError(null);
    setCode((c) => [...c, v]);
  };
  const removeLast = () => { if (!busy) setCode((c) => c.slice(0, -1)); };

  const submit = async () => {
    if (code.length < MIN_LEN || busy) return;
    unlockAudio();
    setBusy(true);
    setError(null);
    try {
      const res = await api.chefLogin(code.join(""));
      onLoggedIn(res);
    } catch (err) {
      // 409 = this device's pairing was lost server-side (not a wrong
      // passcode) - recover by sending the screen back to reconnect instead
      // of showing a confusing "incorrect passcode" for something the user
      // can't fix by re-typing.
      if (err?.response?.status === 409) {
        onSessionLost();
        return;
      }
      setError(err?.response?.data?.detail || "Incorrect passcode");
      setCode([]);
    }
    setBusy(false);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (busy) return;
      if (e.key >= "0" && e.key <= "9") { e.preventDefault(); add(Number(e.key)); }
      else if (e.key === "Backspace") { e.preventDefault(); removeLast(); }
      else if (e.key === "Enter") { e.preventDefault(); if (code.length >= MIN_LEN) submit(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, busy]);

  const circleBtn =
    "w-16 h-16 rounded-full text-[18px] font-medium text-black/55 bg-white border border-black/[0.18] transition hover:border-black hover:text-black active:scale-[0.94]";

  return (
    <div className="flex flex-col items-center">
      <div className="text-[13px] font-semibold text-black/70 text-center mb-3">Unlock Kitchen Display with Passcode</div>
      <div className="h-px bg-black/10 w-full mb-6" />

      {/* Dots track how many digits are entered (4-6, variable length) rather
          than a fixed 4-slot bar - there's no way to know the right length
          upfront, so entry is confirmed explicitly via Enter, not a count. */}
      <div className="w-full mb-7 flex justify-center gap-2.5 bg-black/5 rounded-full py-4 px-4 min-h-[52px] items-center" data-testid="passcode-dots">
        {code.length === 0 ? (
          <span className="text-[12px] text-black/30">Enter passcode</span>
        ) : (
          Array.from({ length: code.length }).map((_, i) => (
            <span key={i} className="w-3.5 h-3.5 rounded-full transition-transform" style={{ background: RED, transform: "scale(1.15)" }} />
          ))
        )}
      </div>

      {error && <div className="text-[12.5px] font-semibold mb-4" style={{ color: "#C4001C" }}>{error}</div>}

      <div className="grid grid-cols-3 justify-items-center gap-y-6 gap-x-8">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => (
          <button key={v} data-testid={`passcode-key-${v}`} onClick={() => add(v)} disabled={busy} className={circleBtn}>
            {v}
          </button>
        ))}
        <button
          data-testid="passcode-backspace"
          onClick={removeLast}
          disabled={busy || code.length === 0}
          className="w-[64px] h-10 text-white flex items-center justify-center disabled:opacity-40"
          style={{ background: RED, clipPath: "polygon(15% 0, 100% 0, 100% 100%, 15% 100%, 0 50%)" }}
        >
          <Delete className="w-4 h-4" />
        </button>
        <button data-testid="passcode-key-0" onClick={() => add(0)} disabled={busy} className={circleBtn}>
          0
        </button>
        <button
          data-testid="passcode-submit"
          onClick={submit}
          disabled={busy || code.length < MIN_LEN}
          className="w-16 h-16 flex items-center justify-center disabled:opacity-40"
          style={{ color: code.length >= MIN_LEN ? RED : "rgba(17,17,17,0.4)" }}
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CornerDownLeft className="w-[26px] h-[26px]" />}
        </button>
      </div>
    </div>
  );
}

export default function Setup() {
  const { state, actions } = useKds();
  const navigate = useNavigate();
  // Fresh pairing -> connect, then station, then passcode. A chef logging
  // out mid-shift on an already-configured screen -> straight to passcode,
  // no need to re-pick the station every time someone's shift ends.
  const [stage, setStage] = useState(() => {
    if (!api.getDeviceToken()) return "connect";
    return state.connection.stationConfirmed ? "passcode" : "station";
  });
  const [connectedInfo, setConnectedInfo] = useState(null);
  const [pickedStation, setPickedStation] = useState(state.station);

  const handleConnected = (res) => {
    actions.setConnection({
      serverConnected: true,
      internet: true,
      posConnected: true,
      lastSync: "Just now",
      deviceToken: res.deviceToken,
      branchId: res.branchId,
      tenantId: res.tenantId,
      kitchenId: res.kitchenId,
      restaurant: res.restaurant,
      branch: res.branch,
      server: res.server,
      // This branch's real kitchens (billing Kitchen rows), not the demo
      // STATIONS list - see KdsController::pair()'s `stations` field.
      stations: res.stations || [],
    });
    actions.refresh();
    setConnectedInfo(res);
    setStage("station");
  };

  const handleStationPicked = (st) => {
    setPickedStation(st);
    actions.setStation(st);
    actions.setConnection({ stationConfirmed: true });
    setStage("passcode");
  };

  const handleLoggedIn = (res) => {
    actions.setChef({
      id: res.chefId,
      name: res.chefName,
      role: res.chefRole || "Staff",
      branch: state.connection.branch,
      avatar: res.chefAvatar,
    });
    actions.setPaired(true);
    toast.success(`Welcome, ${res.chefName}`);
    navigate("/");
  };

  const handleSessionLost = () => {
    api.setDeviceToken(null);
    actions.setConnection({ deviceToken: null, branchId: null, tenantId: null, kitchenId: null, stationConfirmed: false, serverConnected: false, posConnected: false });
    setConnectedInfo(null);
    toast.error("This screen's pairing was lost — please reconnect.");
    setStage("connect");
  };

  return (
    <PageShell showImage={stage === "passcode"}>
      {stage === "connect" && <ConnectStage onConnected={handleConnected} />}
      {stage === "station" && (
        <StationStage initial={pickedStation} stations={connectedInfo?.stations ?? state.connection.stations} onNext={handleStationPicked} />
      )}
      {stage === "passcode" && (
        <div className="bg-white/70 rounded-[20px] p-6">
          <PasscodeStage onLoggedIn={handleLoggedIn} onSessionLost={handleSessionLost} />
        </div>
      )}
      {(connectedInfo || stage !== "connect") && (
        <div className="text-[11px] text-black/40 text-center mt-4">
          {state.connection.restaurant} · {pickedStation}
        </div>
      )}
    </PageShell>
  );
}
