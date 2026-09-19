import React from "react";
import { useKds, hasConnectedDevice } from "@/state/kdsState";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { StatusLine } from "@/components/ConnectionStatus";
import { User, Bell, Palette, LogOut, ChefHat, ChevronDown } from "lucide-react";

const initials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

const ChefAvatar = ({ chef, className }) =>
  chef.avatar ? (
    <img src={chef.avatar} alt={chef.name} className={className} />
  ) : (
    <div className={`${className} bg-[#FF3131] text-white flex items-center justify-center font-bold text-sm`}>
      {initials(chef.name)}
    </div>
  );

// Touch-friendly row size for every item in this menu — taller (56px) than
// the shadcn dropdown default (mouse-oriented, ~32px), since this runs on a
// kitchen tablet/TV touchscreen, not a desktop with a pointer.
const ITEM_CLASS = "min-h-[56px] px-4 text-base gap-3";

export const ChefProfile = () => {
  const { state, actions } = useKds();
  const navigate = useNavigate();
  const chef = state.chef;
  const posConnected = hasConnectedDevice(state.devices, "desktop_pos");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="chef-profile-btn"
          className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white pl-1.5 pr-2.5 min-h-[56px] hover:bg-[#F7F7F7]"
        >
          <ChefAvatar chef={chef} className="w-10 h-10 rounded-md object-cover" />
          <span className="hidden md:block text-left leading-tight">
            <span className="block text-sm font-bold">{chef.name}</span>
            <span className="block text-[11px] opacity-60 font-medium">{chef.role}</span>
          </span>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-white">
        <DropdownMenuLabel className="px-4 py-3">
          <div className="text-base font-bold">{chef.name}</div>
          <div className="text-sm opacity-60">
            {chef.role} · {state.station}
          </div>
          <div className="text-sm opacity-60">{chef.branch}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Server/POS connection — moved here from the header (the small
            "Server: Connected" / "POS: Connected" chips only ever showed on
            very wide screens anyway); one place to check it now. */}
        <div className="px-4 py-1">
          <StatusLine label="Server" ok={state.connection.serverConnected} testId="profile-status-server" />
          <StatusLine label="POS" ok={posConnected} testId="profile-status-pos" />
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem data-testid="profile-menu-profile" className={ITEM_CLASS} onClick={() => navigate("/settings/profile")}>
          <User className="w-5 h-5" /> Profile
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-testid="profile-menu-station" className={ITEM_CLASS}>
            <ChefHat className="w-5 h-5" /> Kitchen Station
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="bg-white">
            {(state.connection.stations ?? []).map((s) => (
              <DropdownMenuItem key={s} data-testid={`station-opt-${s.replace(/\s+/g, "-").toLowerCase()}`} className={ITEM_CLASS} onClick={() => actions.setStation(s)}>
                {s} {state.station === s ? "✓" : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem data-testid="profile-menu-notifications" className={ITEM_CLASS} onClick={() => navigate("/settings/sound")}>
          <Bell className="w-5 h-5" /> Notification Settings
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="profile-menu-theme" className={ITEM_CLASS} onClick={() => navigate("/settings/colors")}>
          <Palette className="w-5 h-5" /> Theme
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="profile-menu-logout"
          className={`${ITEM_CLASS} text-[#FF3131]`}
          onClick={() => {
            // Ends THIS chef's shift only - the screen stays paired to the
            // branch (matches bhojpe-poss: logging out never re-asks for the
            // Sync Code, only "Change branch" does). Setup.jsx sees the
            // device token is still set and jumps straight back to the
            // passcode stage for the next chef.
            actions.setChef({ id: null, name: "", role: "", branch: "", avatar: null });
            actions.setPaired(false);
            navigate("/setup");
          }}
        >
          <LogOut className="w-5 h-5" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
