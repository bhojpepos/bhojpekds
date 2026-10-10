import React, { useState } from "react";
import { KdsSidebar } from "@/components/KdsSidebar";
import { BrandMark, useBrandLogo } from "@/components/BrandMark";
import { Menu } from "lucide-react";

// Shared on every KDS screen (2026-10-08). With `onOpenSidebar` the parent
// owns the sidebar (KDS board); without it the header opens its own.
// `showMenu={false}` on Setup (unpaired — nothing to navigate to yet).
export const Header = ({ onOpenSidebar, showMenu = true }) => {
  const logo = useBrandLogo();
  const [ownSidebar, setOwnSidebar] = useState(false);
  const openSidebar = onOpenSidebar || (() => setOwnSidebar(true));

  // Petpooja-style bar (2026-10-08): menu · centred Bhojpe logo + title ·
  // (right side empty). Sound + Chef menu removed — Sound lives in Settings,
  // Logout moved to the sidebar. Station/clock, Items, Prep Insights, Shift Summary,
  // fullscreen and the Online pill removed — Items/Insights/Shift live in the
  // sidebar, connection status is in the board footer.
  return (
    <header
      className="px-3 sm:px-5 h-[68px] grid grid-cols-[1fr_auto_1fr] items-center gap-3 shrink-0 text-[#1A1A1A] bg-white border-b border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06)]"
    >
      <div className="flex items-center gap-3 min-w-0">
        {showMenu ? <button
          data-testid="sidebar-toggle-btn"
          onClick={openSidebar}
          className="h-10 w-10 rounded-md hover:bg-[#F7F7F7] flex items-center justify-center text-[#2C2C2C] shrink-0"
        >
          <Menu className="w-6 h-6" />
        </button> : null}
      </div>

      <div className="flex items-center justify-center gap-3 min-w-0" data-testid="header-brand">
        <BrandMark size={58} color="#228BE6" />
        <span className="hidden sm:inline text-[#228BE6] text-xl lg:text-2xl whitespace-nowrap">
          {logo ? <span className="opacity-50 font-bold mr-2.5">-</span> : null}<span className="kds-wordmark">Kitchen Display System</span>
        </span>
      </div>

      <div />
      {!onOpenSidebar && showMenu ? <KdsSidebar open={ownSidebar} onClose={() => setOwnSidebar(false)} /> : null}
    </header>
  );
};
