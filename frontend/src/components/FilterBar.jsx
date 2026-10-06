import React from "react";
import { Search, X } from "lucide-react";
import { light as BP } from '../theme/tokens'

const FILTERS = [
  { id: "all", label: "All" },
  { id: "dine-in", label: "Dine In" },
  { id: "takeaway", label: "Pick Up" },
  { id: "delivery", label: "Delivery" },
  { id: "delayed", label: "Delayed" },
  // Hotel guest QR orders (order_type='room_service' in billing) — lets one
  // shared screen isolate just room orders instead of needing a second
  // physical device, when the hotel and restaurant share a branch.
  { id: "room-service", label: "Room Service" },
];

// stations: real per-branch kitchens (state.connection.stations, from
// pairing — see kdsState.js/Setup.jsx). stationFilter: "all" or a station
// name; onStationFilterChange(value) flips state.settings.stationFilterOn +
// state.station, the same fields the Kitchen Station settings tab already
// uses — this is just a faster, always-visible way to reach the same filter.
export const FilterBar = ({ filter, setFilter, query, setQuery, counts = {}, stations = [], stationFilter = "all", onStationFilterChange }) => (
  <div className="flex flex-col lg:flex-row gap-2 lg:items-center px-3 sm:px-4 py-2.5 bg-white border-b border-[#EEF0F2]">
    <div className="flex gap-2 overflow-x-auto thin-scroll pb-1 lg:pb-0">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          data-testid={`filter-${f.id}`}
          onClick={() => setFilter(f.id)}
          className={`shrink-0 h-[40px] px-4 rounded-xl text-[14.5px] font-bold inline-flex items-center gap-2 transition-colors ${
            filter === f.id
              ? "bg-[var(--bp-button-primary-bg)] text-white"
              : "bg-[#F1F3F5] text-[#212529] hover:bg-[#E9ECEF]"
          }`}
        >
          {f.label}
          {counts[f.id] != null && (
            <span className={`text-[12px] font-bold ${filter === f.id ? "text-white/85" : "text-[#868E96]"}`}>{counts[f.id]}</span>
          )}
        </button>
      ))}
    </div>

    {stations.length > 0 && (
      <select
        data-testid="station-filter-select"
        value={stationFilter}
        onChange={(e) => onStationFilterChange?.(e.target.value)}
        className="shrink-0 h-[40px] px-3 rounded-xl border border-[#E9ECEF] bg-white text-sm font-bold text-[#212529] outline-none focus:border-[#228BE6]"
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
        placeholder="KOT / table search…"
        className="w-full h-[40px] pl-9 pr-9 rounded-xl border border-[#E9ECEF] bg-white outline-none focus:border-[#228BE6] text-sm"
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
