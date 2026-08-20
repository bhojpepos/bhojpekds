import React from "react";
import { useKds } from "@/state/kdsState";
import { Undo2, X } from "lucide-react";

export const UndoBar = () => {
  const { undoItem, actions } = useKds();
  if (!undoItem) return null;
  return (
    <div
      data-testid="undo-bar"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-[#2C2C2C] text-white rounded-md px-4 py-2.5 border border-white/10"
    >
      <span className="text-sm font-semibold">
        KOT #{undoItem.kot} → {undoItem.to.toUpperCase()}
      </span>
      <button
        data-testid="undo-btn"
        onClick={actions.undoLast}
        className="min-h-[44px] px-3 rounded-md bg-[#FF3131] font-bold text-sm flex items-center gap-1.5"
      >
        <Undo2 className="w-4 h-4" /> UNDO
      </button>
      <button data-testid="undo-dismiss-btn" onClick={actions.clearUndo} className="p-2 opacity-60 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
