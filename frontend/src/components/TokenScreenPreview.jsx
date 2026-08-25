import React from "react";
import { useKds } from "@/state/kdsState";

const Group = ({ title, tokens, testId }) => (
  <div className="flex-1 min-w-[180px]" data-testid={testId}>
    <div className="text-[#FF3131] font-head font-extrabold tracking-[0.18em] text-xs sm:text-sm mb-3">{title}</div>
    <div className="flex flex-wrap gap-3">
      {tokens.length === 0 ? (
        <span className="text-white/40 text-lg">—</span>
      ) : (
        tokens.map((t) => (
          <span
            key={t}
            className="font-head font-extrabold text-white bg-white/10 border border-white/15 rounded-md px-4 py-2 text-3xl sm:text-5xl tabular-nums"
          >
            {t}
          </span>
        ))
      )}
    </div>
  </div>
);

export const TokenScreenPreview = ({ compact = false }) => {
  const { state } = useKds();
  const ready = state.orders.filter((o) => o.status === "ready");
  const by = (types) => ready.filter((o) => types.includes(o.type)).map((o) => o.kot);

  return (
    <div
      data-testid="token-screen-preview"
      className={`bg-[#2C2C2C] rounded-md ${compact ? "p-5" : "p-8 sm:p-14"} w-full`}
    >
      <div className="flex items-baseline justify-between mb-6">
        <span className="font-head font-extrabold text-white text-xl sm:text-3xl">
          Bhoj<span className="text-[#FF3131]">Pe</span>
        </span>
        <span className="text-white/40 text-xs tracking-widest uppercase">{state.connection.branch}</span>
      </div>
      <div className="font-head font-extrabold text-white tracking-tight text-3xl sm:text-6xl">ORDER READY</div>
      <div className="text-white/60 mt-2 text-sm sm:text-lg">Please collect your order at the counter</div>
      <div className="h-px bg-white/10 my-6" />
      <div className="flex flex-wrap gap-8">
        <Group title="DINE-IN" tokens={by(["dine-in"])} testId="token-group-dinein" />
        <Group title="TAKEAWAY" tokens={by(["takeaway"])} testId="token-group-takeaway" />
        <Group title="DELIVERY / PICKUP" tokens={by(["delivery", "pickup"])} testId="token-group-delivery" />
      </div>
    </div>
  );
};
