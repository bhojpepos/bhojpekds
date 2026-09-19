import React from "react";
import { useKds } from "@/state/kdsState";

const Group = ({ title, tokens, testId, accent }) => (
  <div className="flex-1 min-w-[180px]" data-testid={testId}>
    <div
      className="font-head font-extrabold tracking-[0.18em] text-xs sm:text-sm mb-3"
      style={{ color: accent }}
    >
      {title}
    </div>
    <div className="flex flex-wrap gap-3">
      {tokens.length === 0 ? (
        <span className="text-white/40 text-lg">—</span>
      ) : (
        tokens.map((t) => (
          <span
            key={t}
            className="font-head font-extrabold text-white bg-white/10 rounded-md px-4 py-2 text-3xl sm:text-5xl tabular-nums border-2"
            style={{ borderColor: accent }}
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
  const cooking = state.orders.filter((o) => o.status === "cooking").map((o) => o.kot);
  const ready = state.orders.filter((o) => o.status === "ready").map((o) => o.kot);

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
      <div className="flex flex-wrap gap-8">
        <Group title="COOKING" tokens={cooking} testId="token-group-cooking" accent={state.settings.colors.cooking} />
        <Group title="READY — PLEASE COLLECT" tokens={ready} testId="token-group-ready" accent={state.settings.colors.ready} />
      </div>
    </div>
  );
};
