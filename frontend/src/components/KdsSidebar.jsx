import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useKds } from "@/state/kdsState";
import { SETTINGS_SECTIONS } from "@/pages/SettingsSectionPage";
import { ChefHat, LayoutGrid, LogOut, X } from "lucide-react";

// POS-style slide-out sidebar — opened from the hamburger icon in Header.jsx.
// Redesign 2026-10-08: wider (340px), no logo/title, chef/station card, and the settings pages grouped into
// Kitchen / Reports / Setup / Account instead of one long list. Each item
// still opens its own full page (/settings/:id, see SettingsSectionPage.jsx).
const BLUE = "#228BE6";
const BLUE_SOFT = "#E7F5FF";

const GROUPS = [
  { label: "Kitchen", ids: ["station", "items", "stations", "token"] },
  { label: "Reports", ids: ["insights", "shift", "weekly", "recap", "audit"] },
  { label: "Setup", ids: ["general", "display", "colors", "sound", "notifications", "printer", "devices", "connection"] },
  { label: "Account", ids: ["profile"] },
];

const NavItem = ({ Icon, label, active, onClick, testId }) => (
  <button
    type="button"
    data-testid={testId}
    onClick={onClick}
    className="relative w-full flex items-center gap-3 h-11 px-3 rounded-lg text-[15px] font-semibold text-left transition-colors"
    style={{ background: active ? BLUE_SOFT : "transparent", color: active ? BLUE : "#343A40" }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#F8F9FA"; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
  >
    {active ? <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ background: BLUE }} /> : null}
    <Icon className="w-[18px] h-[18px] shrink-0" style={{ color: active ? BLUE : "#868E96" }} />
    <span className="truncate">{label}</span>
  </button>
);

export const KdsSidebar = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, actions } = useKds();

  if (!open) return null;

  const go = (path) => {
    navigate(path);
    onClose();
  };
  const byId = Object.fromEntries(SETTINGS_SECTIONS.map((s) => [s.id, s]));
  const grouped = new Set(GROUPS.flatMap((g) => g.ids));
  // Any section added later without a group still shows (under Setup).
  const extra = SETTINGS_SECTIONS.filter((s) => !grouped.has(s.id)).map((s) => s.id);
  const chefName = state?.chef?.name || "Chef";

  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar"
        onClick={onClose}
        className="fixed inset-0 bg-black/30 z-[1200]"
        data-testid="kds-sidebar-backdrop"
      />
      <div
        className="fixed top-0 left-0 bottom-0 w-[340px] max-w-[88vw] bg-white z-[1201] flex flex-col shadow-xl"
        data-testid="kds-sidebar"
      >
        {/* Chef on shift + station */}
        {/* No logo / title in the sidebar (2026-10-08) — chef card + close on top */}
        <div className="mx-4 mt-4 mb-1 p-3 rounded-xl flex items-center gap-3 shrink-0" style={{ background: "#F8F9FA", border: "1px solid #E9ECEF" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0" style={{ background: BLUE }}>
            {chefName.trim().charAt(0).toUpperCase() || "C"}
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-[#212529] truncate">{chefName}</div>
            <div className="text-[12.5px] text-[#868E96] truncate flex items-center gap-1">
              <ChefHat className="w-3.5 h-3.5 shrink-0" /> {state?.station || "Main Kitchen"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-9 h-9 rounded-lg border border-[#E9ECEF] bg-white hover:bg-[#F1F3F5] flex items-center justify-center text-[#343A40] shrink-0"
            data-testid="kds-sidebar-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll px-3 py-2">
          <NavItem Icon={LayoutGrid} label="Kitchen Board" active={location.pathname === "/"} onClick={() => go("/")} testId="kds-sidebar-board" />

          {GROUPS.map((g) => {
            const ids = g.label === "Setup" ? [...g.ids, ...extra] : g.ids;
            const items = ids.map((id) => byId[id]).filter(Boolean);
            if (!items.length) return null;
            return (
              <div key={g.label} className="mt-3">
                <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#ADB5BD]">{g.label}</div>
                {items.map(({ id, label, Icon }) => (
                  <NavItem key={id} Icon={Icon} label={label} active={location.pathname === `/settings/${id}`} onClick={() => go(`/settings/${id}`)} testId={`kds-sidebar-${id}`} />
                ))}
              </div>
            );
          })}
        </div>

        {/* Logout — ends this chef's shift only; the screen stays paired to the branch. */}
        <div className="shrink-0 p-3 border-t border-[#E9ECEF]">
          <button
            type="button"
            data-testid="kds-sidebar-logout"
            onClick={() => {
              actions.setChef({ id: null, name: "", role: "", branch: "", avatar: null });
              actions.setPaired(false);
              onClose();
              navigate("/setup");
            }}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-lg text-[15px] font-semibold text-[#E8590C] border border-[#FFC9C9] hover:bg-[#FFF4E6]"
          >
            <LogOut className="w-[18px] h-[18px]" /> Logout
          </button>
        </div>
      </div>
    </>
  );
};
