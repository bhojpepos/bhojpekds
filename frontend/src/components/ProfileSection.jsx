import React from "react";
import { useNavigate } from "react-router-dom";
import { useKds } from "@/state/kdsState";
import { LogOut } from "lucide-react";

const Row = ({ label, children, testId }) => (
  <div className="flex items-center gap-3 justify-between bg-white border border-[#E5E7EB] rounded-md p-3" data-testid={testId}>
    <div className="text-sm font-bold">{label}</div>
    {children}
  </div>
);

// The chef-profile summary + logout — used both as its own full page
// (/settings/profile) and inside the header's quick-access right drawer.
export const ProfileSection = () => {
  const { state, actions } = useKds();
  const navigate = useNavigate();

  return (
    <div className="space-y-3" data-testid="profile-section">
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
      <button
        data-testid="settings-logout-btn"
        onClick={() => { actions.setPaired(false); navigate("/setup"); }}
        className="w-full min-h-[48px] rounded-md text-sm font-bold px-3 border bg-white text-[#FF3131] border-[#FECACA] hover:bg-[#FEF2F2]"
      >
        <span className="flex items-center justify-center gap-2"><LogOut className="w-4 h-4" /> Logout</span>
      </button>
    </div>
  );
};
