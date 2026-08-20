import React from "react";
import { STATIONS } from "@/services/mockOrderService";
import { useKds } from "@/state/kdsState";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { User, Bell, Palette, LogOut, ChefHat, ChevronDown } from "lucide-react";

export const ChefProfile = ({ onOpenSettings }) => {
  const { state, actions } = useKds();
  const navigate = useNavigate();
  const chef = state.chef;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="chef-profile-btn"
          className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white pl-1.5 pr-2.5 min-h-[48px] hover:bg-[#F7F7F7]"
        >
          <img src={chef.avatar} alt={chef.name} className="w-9 h-9 rounded-md object-cover" />
          <span className="hidden md:block text-left leading-tight">
            <span className="block text-sm font-bold">{chef.name}</span>
            <span className="block text-[11px] opacity-60 font-medium">{chef.role}</span>
          </span>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-white">
        <DropdownMenuLabel>
          <div className="text-sm font-bold">{chef.name}</div>
          <div className="text-xs opacity-60">
            {chef.role} · {state.station}
          </div>
          <div className="text-xs opacity-60">{chef.branch}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="profile-menu-profile" onClick={() => onOpenSettings("profile")}>
          <User className="w-4 h-4 mr-2" /> Profile
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-testid="profile-menu-station">
            <ChefHat className="w-4 h-4 mr-2" /> Kitchen Station
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="bg-white">
            {STATIONS.map((s) => (
              <DropdownMenuItem key={s} data-testid={`station-opt-${s.replace(/\s+/g, "-").toLowerCase()}`} onClick={() => actions.setStation(s)}>
                {s} {state.station === s ? "✓" : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem data-testid="profile-menu-notifications" onClick={() => onOpenSettings("sound")}>
          <Bell className="w-4 h-4 mr-2" /> Notification Settings
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="profile-menu-theme" onClick={() => onOpenSettings("colors")}>
          <Palette className="w-4 h-4 mr-2" /> Theme
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="profile-menu-logout"
          className="text-[#FF3131]"
          onClick={() => {
            actions.setPaired(false);
            navigate("/setup");
          }}
        >
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
