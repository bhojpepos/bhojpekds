import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useKds } from "@/state/kdsState";
import * as api from "@/services/apiService";
import { unlockAudio } from "@/services/soundService";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowRight, KeyRound, Link2, CornerDownLeft, RefreshCw, ChefHat } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { light as BP } from '../theme/tokens'

// Login / pairing screen ka accent = main button blue #228BE6 (pehle laal tha).
const ACCENT = BP.button.primaryBg;
const BLACK = "#111111";

// Same gradient + pill language as bhojpe-poss's ConnectPage.jsx/LoginPage.jsx
// (Connect Restaurant / Unlock with Passcode) — this screen mirrors that same
// two-stage shape (connect, then passcode), plus a bhojpekds-specific middle
// stage (pick which kitchen station this screen is for). The passcode stage
// additionally mirrors LoginPage.jsx's left-illustration/right-form split.
/* Chef header card — login screen ke left me (light border) */
const ChefHeaderCard = ({ restaurant, station }) => (
  <div className="w-full max-w-[400px] rounded-[24px] border border-[#E9ECEF] bg-white/80 px-8 py-10 text-center" data-testid="chef-login-header">
    <span className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: "#E7F5FF", color: ACCENT }}>
      <ChefHat className="w-10 h-10" strokeWidth={1.7} />
    </span>
    <div className="text-[12px] font-bold text-black/40 tracking-[0.2em] uppercase mb-1.5">Kitchen Display</div>
    <div className="text-[28px] font-extrabold leading-tight tracking-tight text-[#111111]">Chef Login</div>
    <div className="text-[13.5px] text-black/55 mt-1.5">Unlock Kitchen Display with Passcode</div>
    {(restaurant || station) && (
      <div className="mt-6 pt-5 border-t border-[#F1F3F5] grid grid-cols-2 gap-3 text-left">
        <div className="rounded-xl bg-[#F8F9FA] px-3.5 py-2.5 min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-black/40">Restaurant</div>
          <div className="text-[13.5px] font-bold text-[#111111] truncate">{restaurant || "—"}</div>
        </div>
        <div className="rounded-xl bg-[#F8F9FA] px-3.5 py-2.5 min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-black/40">Station</div>
          <div className="text-[13.5px] font-bold text-[#111111] truncate">{station || "—"}</div>
        </div>
      </div>
    )}
  </div>
);

const PageShell = ({ children, showImage, aside = null }) => (
  <div
    className="min-h-screen w-full flex flex-col"
    style={{ background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #E7F5FF 100%)" }}
  >
    <header className="h-16 flex items-center px-4 sm:px-8 shrink-0">
      <div className="flex items-center gap-3">
        <BrandMark size={36} />
      </div>
    </header>
    {showImage ? (
      <main className="flex-1 flex">
        {/* Left: chef header card (light border) — pehle chef ki illustration thi */}
        <div className="hidden md:flex flex-1 items-center justify-center px-8">
          {aside}
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
          style={{ background: ACCENT }}
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
        <button data-testid="connect-sync-btn" type="submit" disabled={busy} className={pillButtonClass} style={{ background: ACCENT }}>
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
  const list = stations ?? [];
  return (
    <>
      <div className="text-[12px] font-bold text-black/40 tracking-[0.2em] uppercase mb-1.5">Terminal Setup</div>
      <div className="text-[28px] font-extrabold leading-tight tracking-tight mb-1">Select Kitchen Station</div>
      <div className="text-[13px] text-black/55 mb-6">Which station is this screen for?</div>
      {list.length === 0 ? (
        <div className="text-[13px] text-black/55 mb-8 rounded-lg border border-black/10 bg-black/[0.03] p-4">
          No kitchen stations are configured for this branch yet. Add kitchens from the
          billing admin panel, then reconnect this screen — a real station name is
          required so orders route correctly.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-8">
          {list.map((st) => (
            <button
              key={st}
              data-testid={`setup-station-${st.replace(/\s+/g, "-").toLowerCase()}`}
              onClick={() => { unlockAudio(); setStation(st); }}
              className="h-11 px-4 rounded-full text-sm font-bold border transition"
              style={
                station === st
                  ? { background: ACCENT, borderColor: ACCENT, color: "#fff" }
                  : { background: "#e5e6e1", borderColor: "transparent", color: BLACK }
              }
            >
              {st}
            </button>
          ))}
        </div>
      )}
      <button
        data-testid="station-continue-btn"
        onClick={() => onNext(station)}
        disabled={!station}
        className={pillButtonClass}
        style={{ background: ACCENT, opacity: station ? 1 : 0.4 }}
      >
        Continue <ArrowRight className="w-4 h-4" />
      </button>
    </>
  );
}

/* ── Stage 3: Passcode login ──────────────────────────────────────────── */
function PasscodeStage({ branchLabel, placeLabel, onLoggedIn, onSessionLost, onChangeBranch }) {
  const [code, setCode] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmChangeBranch, setConfirmChangeBranch] = useState(false);

  // Bhojpe POS jaisa hi: fixed 4-digit passcode, 4 khaane; Enter (button /
  // keyboard) se login — 4th digit par apne aap submit nahi hota.
  const MIN_LEN = 4;
  const MAX_LEN = 4;
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
    "w-14 h-14 rounded-full text-[17px] font-medium text-black/55 bg-white border border-black/[0.18] transition hover:bg-[#f9fafb] hover:border-black hover:text-black active:scale-[0.94] disabled:text-black/20 disabled:bg-[#fafafa] disabled:border-black/[0.08]";

  return (
    <div className="flex flex-col items-center">
      {/* Chhoti screen par (left card chhupa) chef header yahin */}
      <div className="md:hidden flex flex-col items-center text-center mb-5">
        <span className="w-14 h-14 rounded-full flex items-center justify-center mb-2.5" style={{ background: "#E7F5FF", color: ACCENT }}>
          <ChefHat className="w-7 h-7" strokeWidth={1.8} />
        </span>
        <div className="text-[20px] font-extrabold tracking-tight text-[#111111]">Chef Login</div>
        {placeLabel ? <div className="mt-2 text-[11.5px] font-semibold text-[#495057] bg-black/5 rounded-full px-3 py-1">{placeLabel}</div> : null}
      </div>
      <div className="hidden md:block text-[13px] font-semibold text-black/70 text-center mb-3">Enter your 4-digit passcode</div>
      <div className="hidden md:block h-px bg-black/10 w-full mb-6" />

      {/* 4-digit display — Bhojpe POS jaisa grey pill, 4 barabar khaane */}
      <div className="w-full mb-6 grid grid-cols-4 place-items-center bg-black/5 rounded-full py-4 px-4" data-testid="passcode-dots">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-3.5 h-3.5 rounded-full transition-all"
            style={code[i] !== undefined
              ? { background: ACCENT, border: `1.2px solid ${ACCENT}`, transform: "scale(1.15)" }
              : { background: "transparent", border: "1.2px solid rgba(0,0,0,0.3)" }}
          />
        ))}
      </div>

      {error && <div className="text-[12.5px] font-semibold mb-4" style={{ color: "#C4001C" }}>{error}</div>}

      <div className="grid grid-cols-3 justify-items-center gap-y-[18px] gap-x-2 w-full">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => (
          <button key={v} data-testid={`passcode-key-${v}`} onClick={() => add(v)} disabled={busy} className={circleBtn}>
            {v}
          </button>
        ))}
        <button
          data-testid="passcode-backspace"
          onClick={removeLast}
          disabled={busy || code.length === 0}
          className="w-[60px] h-10 self-center text-white flex items-center justify-center disabled:opacity-40 active:scale-[0.94] transition"
          style={{ background: ACCENT, clipPath: "polygon(15% 0, 100% 0, 100% 100%, 15% 100%, 0 50%)" }}
        >
          <span className="text-[14px] font-black leading-none ml-2.5">✕</span>
        </button>
        <button data-testid="passcode-key-0" onClick={() => add(0)} disabled={busy} className={circleBtn}>
          0
        </button>
        <button
          data-testid="passcode-submit"
          onClick={submit}
          disabled={busy || code.length < MIN_LEN}
          className="w-14 h-14 flex items-center justify-center disabled:opacity-40 hover:scale-[1.08] active:scale-[0.94] transition"
          style={{ color: code.length >= MIN_LEN ? ACCENT : "rgba(17,17,17,0.4)" }}
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CornerDownLeft className="w-[26px] h-[26px]" />}
        </button>
      </div>

      {onChangeBranch && (
        <button
          type="button"
          data-testid="change-branch-btn"
          onClick={() => setConfirmChangeBranch(true)}
          disabled={busy}
          className="mt-6 flex items-center gap-1.5 text-[12px] font-semibold text-black/45 hover:text-black/70 transition disabled:opacity-40"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Change Branch{branchLabel ? ` (${branchLabel})` : ""}
        </button>
      )}

      <AlertDialog open={confirmChangeBranch} onOpenChange={setConfirmChangeBranch}>
        <AlertDialogContent className="bg-white" data-testid="change-branch-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Change branch on this screen?</AlertDialogTitle>
            <AlertDialogDescription>
              This screen will disconnect from {branchLabel || "the current branch"} — you&apos;ll
              need a fresh Sync Code and POS Pair Code to connect it to a different branch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="change-branch-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="change-branch-confirm-btn"
              onClick={onChangeBranch}
              className="bg-bp-brand-primary hover:bg-[#e02b2b]"
            >
              Disconnect &amp; Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    actions.setConnection({ deviceToken: null, branchId: null, tenantId: null, kitchenId: null, stationConfirmed: false, serverConnected: false });
    setConnectedInfo(null);
    toast.error("This screen's pairing was lost — please reconnect.");
    setStage("connect");
  };

  // Deliberate, user-initiated version of handleSessionLost above — same
  // reset, just a neutral toast instead of an error one. Re-pairing (the
  // Connect stage this lands on) reuses the same device_identifier this
  // browser already has, so it updates this screen's existing pairing to
  // the new branch rather than creating a duplicate.
  const handleChangeBranch = () => {
    api.setDeviceToken(null);
    actions.setConnection({ deviceToken: null, branchId: null, tenantId: null, kitchenId: null, stationConfirmed: false, serverConnected: false });
    setConnectedInfo(null);
    setPickedStation(null);
    toast.success("Disconnected — connect this screen to a different branch.");
    setStage("connect");
  };

  return (
    <PageShell showImage={stage === "passcode"} aside={<ChefHeaderCard restaurant={state.connection.restaurant} station={pickedStation} />}>
      {stage === "connect" && <ConnectStage onConnected={handleConnected} />}
      {stage === "station" && (
        <StationStage initial={pickedStation} stations={connectedInfo?.stations ?? state.connection.stations} onNext={handleStationPicked} />
      )}
      {stage === "passcode" && (
        <div className="w-full max-w-[320px] mx-auto">
          <PasscodeStage
            branchLabel={state.connection.branch || state.connection.restaurant}
            placeLabel={[state.connection.restaurant, pickedStation].filter(Boolean).join(" · ")}
            onLoggedIn={handleLoggedIn}
            onSessionLost={handleSessionLost}
            onChangeBranch={handleChangeBranch}
          />
        </div>
      )}
      {(connectedInfo || stage === "station") && (
        <div className="text-[11px] text-black/40 text-center mt-4">
          {state.connection.restaurant} · {pickedStation}
        </div>
      )}
    </PageShell>
  );
}
