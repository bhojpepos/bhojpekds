import React from "react";
import { Search, X } from "lucide-react";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "cooking", label: "Cooking" },
  { id: "ready", label: "Ready" },
  { id: "delayed", label: "Delayed" },
  { id: "dine-in", label: "Dine-in" },
  { id: "takeaway", label: "Takeaway" },
  { id: "delivery", label: "Delivery" },
];

// stations: real per-branch kitchens (state.connection.stations, from
// pairing — see kdsState.js/Setup.jsx). stationFilter: "all" or a station
// name; onStationFilterChange(value) flips state.settings.stationFilterOn +
// state.station, the same fields the Kitchen Station settings tab already
// uses — this is just a faster, always-visible way to reach the same filter.
export const FilterBar = ({ filter, setFilter, query, setQuery, stations = [], stationFilter = "all", onStationFilterChange }) => (
  <div className="flex flex-col lg:flex-row gap-2 lg:items-center px-3 sm:px-5 py-2.5 bg-white border-b border-[#E5E7EB]">
    <div className="flex gap-2 overflow-x-auto thin-scroll pb-1 lg:pb-0">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          data-testid={`filter-${f.id}`}
          onClick={() => setFilter(f.id)}
          className={`shrink-0 min-h-[44px] px-3.5 rounded-md text-sm font-bold border transition-colors ${
            filter === f.id
              ? "bg-[#FF3131] text-white border-[#FF3131]"
              : "bg-white text-[#2C2C2C] border-[#E5E7EB] hover:bg-[#F7F7F7]"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>

    {stations.length > 0 && (
      <select
        data-testid="station-filter-select"
        value={stationFilter}
        onChange={(e) => onStationFilterChange?.(e.target.value)}
        className="shrink-0 min-h-[44px] px-3 rounded-md border border-[#E5E7EB] bg-white text-sm font-bold text-[#2C2C2C] outline-none focus:border-[#FF3131]"
      >
        <option value="all">All Stations</option>
        {stations.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    )}

    <div className="relative lg:ml-auto lg:w-80">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
      <input
        data-testid="kds-search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search KOT / Table / Token"
        className="w-full min-h-[44px] pl-9 pr-9 rounded-md border border-[#E5E7EB] bg-white outline-none focus:border-[#FF3131] text-sm"
      />
      {query && (
        <button
          data-testid="clear-search-btn"
          onClick={() => setQuery("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5"
        >
          <X className="w-4 h-4 opacity-50" />
        </button>
      )}
    </div>
  </div>
);
