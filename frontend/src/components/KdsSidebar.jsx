import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { SETTINGS_SECTIONS } from "@/pages/SettingsSectionPage";
import { LayoutGrid, X } from "lucide-react";

// POS-style slide-out sidebar — opened from the hamburger icon in Header.jsx
// (before the logo, same placement as bhojpe-poss). Lists every Settings
// section as its own nav item; each now opens its own full page
// (/settings/:id, see SettingsSectionPage.jsx) instead of a tab inside a
// small drawer.
export const KdsSidebar = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  if (!open) return null;

  const go = (path) => {
    navigate(path);
    onClose();
  };

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
        className="fixed top-0 left-0 bottom-0 w-72 bg-white z-[1201] flex flex-col shadow-xl"
        data-testid="kds-sidebar"
      >
        <div className="px-4 py-3 flex items-center gap-3 border-b border-[#E5E7EB] shrink-0">
          <BrandMark size={36} tone="dark" />
          <span className="font-head font-extrabold text-[#1A1A1A]">BhojPe KDS</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F7F7F7] flex items-center justify-center text-[#2C2C2C]"
            data-testid="kds-sidebar-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll py-2">
          <button
            type="button"
            data-testid="kds-sidebar-board"
            onClick={() => go("/")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-left ${
              location.pathname === "/" ? "bg-[#FEF2F2] text-[#FF3131]" : "text-[#2C2C2C] hover:bg-[#F7F7F7]"
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> Kitchen Board
          </button>

          <div className="mt-2 px-4 pb-1 text-[10px] font-bold uppercase tracking-widest opacity-45">Settings</div>
          {SETTINGS_SECTIONS.map(({ id, label, Icon }) => {
            const active = location.pathname === `/settings/${id}`;
            return (
              <button
                key={id}
                type="button"
                data-testid={`kds-sidebar-${id}`}
                onClick={() => go(`/settings/${id}`)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-left ${
                  active ? "bg-[#FEF2F2] text-[#FF3131]" : "text-[#2C2C2C] hover:bg-[#F7F7F7]"
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
