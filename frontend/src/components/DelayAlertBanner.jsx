import React from "react";
import { useKds } from "@/state/kdsState";
import { AlarmClock } from "lucide-react";

export const DelayAlertBanner = () => {
  const { overdueAlert, state } = useKds();
  if (!overdueAlert) return null;
  return (
    <div
      data-testid="delay-alert-banner"
      className="flex items-center gap-3 px-4 py-2.5 bg-[#FF3131] text-white shrink-0"
    >
      <AlarmClock className="w-5 h-5 blink-soft" />
      <span className="font-head font-extrabold tracking-wider text-sm sm:text-base">
        ORDER OVERDUE · KOT #{overdueAlert.kot}
      </span>
      <span className="text-xs sm:text-sm font-semibold opacity-90">
        past {state.settings.slaMinutes} min at {overdueAlert.station}
        {overdueAlert.count > 1 ? ` · ${overdueAlert.count} orders crossed` : ""}
      </span>
    </div>
  );
};
