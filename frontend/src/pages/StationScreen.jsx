import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useKds, ageOf, ageLevel } from "@/state/kdsState";
import { STATIONS, STATUS_ORDER, STATUS_LABEL } from "@/services/mockOrderService";
import { StatusColumn } from "@/components/StatusColumn";
import { ArrowLeft } from "lucide-react";

const slug = (s) => s.replace(/\s+/g, "-").toLowerCase();

export default function StationScreen() {
  const { stationSlug } = useParams();
  const { state, now } = useKds();
  const station = STATIONS.find((s) => slug(s) === stationSlug) || STATIONS[0];

  const orders = useMemo(
    () => state.orders.filter((o) => o.station === station && o.status !== "completed"),
    [state.orders, station]
  );
  const overdue = orders.filter((o) => ageLevel(ageOf(o, now).seconds, state.settings.slaMinutes * 60) === "delayed").length;

  return (
    <div className="kds-scope mode-tv h-screen flex flex-col bg-[#F7F7F7] overflow-hidden" data-testid="station-screen">
      <header className="bg-[#2C2C2C] text-white px-4 sm:px-6 py-3 flex items-center gap-4 shrink-0">
        <Link to="/" data-testid="station-back-link" className="min-h-[44px] px-3 rounded-md bg-white/10 flex items-center gap-2 text-sm font-bold">
          <ArrowLeft className="w-4 h-4" /> KDS
        </Link>
        <div className="min-w-0">
          <div className="font-head font-extrabold text-lg sm:text-2xl leading-tight" data-testid="station-name">
            {station}
          </div>
          <div className="text-xs opacity-60 font-semibold">Station screen · only this station's dishes</div>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm font-bold">
          <span data-testid="station-active-count" className="rounded-md bg-white/10 px-3 py-1.5">{orders.length} active</span>
          <span
            data-testid="station-overdue-count"
            className="rounded-md px-3 py-1.5"
            style={{ background: overdue ? "#FF3131" : "rgba(255,255,255,0.1)" }}
          >
            {overdue} overdue
          </span>
        </div>
      </header>

      <div className="flex gap-2 px-4 py-2 bg-white border-b border-[#E5E7EB] overflow-x-auto thin-scroll shrink-0">
        {STATIONS.map((s) => (
          <Link
            key={s}
            to={`/station/${slug(s)}`}
            data-testid={`station-link-${slug(s)}`}
            className={`shrink-0 min-h-[44px] px-3.5 rounded-md text-sm font-bold border flex items-center ${
              s === station ? "bg-[#FF3131] text-white border-[#FF3131]" : "bg-white border-[#E5E7EB] text-[#2C2C2C]"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <main className="flex-1 min-h-0 p-3 sm:p-5">
        <div className="grid h-full min-h-0 gap-4 grid-cols-1 md:grid-cols-3">
          {STATUS_ORDER.filter((s) => s !== "completed").map((st) => (
            <StatusColumn key={st} status={st} orders={orders.filter((o) => o.status === st)} />
          ))}
        </div>
      </main>
    </div>
  );
}

export const StationLabels = STATUS_LABEL;
