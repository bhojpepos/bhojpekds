import React from "react";
import { TokenScreenPreview } from "@/components/TokenScreenPreview";

export default function TokenScreenPage() {
  return (
    <div className="min-h-screen bg-[#2C2C2C] p-4 sm:p-8 flex items-center" data-testid="token-screen-page">
      <TokenScreenPreview />
    </div>
  );
}
