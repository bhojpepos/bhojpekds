import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { KdsProvider } from "@/state/kdsState";
import Setup from "@/pages/Setup";
import KDS from "@/pages/KDS";
import TokenScreenPage from "@/pages/TokenScreenPage";

export default function App() {
  return (
    <KdsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<KDS />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/token" element={<TokenScreenPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-center" />
    </KdsProvider>
  );
}
