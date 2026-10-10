import React from "react";
import { TokenScreenPreview } from "@/components/TokenScreenPreview";
import { Header } from "@/components/Header";

export default function TokenScreenPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#2C2C2C]" data-testid="token-screen-page">
      <Header />
      <div className="flex-1 p-4 sm:p-8 flex items-center">
        <TokenScreenPreview />
      </div>
    </div>
  );
}
