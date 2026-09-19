import React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PrepInsights } from "@/components/PrepInsights";
import { ShiftSummary } from "@/components/KitchenOps";

const CONTENT = {
  insights: { title: "Prep Insights", Body: PrepInsights },
  shift: { title: "Shift Summary", Body: ShiftSummary },
};

// Lightweight right-side drawer for a quick glance at one section, opened
// directly from a header icon — Prep Insights / Shift Summary only. Profile
// is reached only via the ChefProfile avatar dropdown (a dedicated header
// icon for it duplicated that same section — removed). Items needs the full
// screen (its own page, /settings/items) and Sound is a plain on/off toggle
// in the header itself, so neither goes through here either.
export const QuickDrawer = ({ section, onClose }) => {
  const entry = section ? CONTENT[section] : null;

  return (
    <Sheet open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="bg-[#F7F7F7] w-full sm:max-w-[420px] p-0 flex flex-col" data-testid="quick-drawer">
        <SheetHeader className="px-4 py-3 bg-white border-b border-[#E5E7EB]">
          <SheetTitle className="font-head font-extrabold">{entry?.title}</SheetTitle>
          <SheetDescription className="sr-only">{entry?.title}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto thin-scroll p-4">
          {entry && <entry.Body />}
        </div>
      </SheetContent>
    </Sheet>
  );
};
