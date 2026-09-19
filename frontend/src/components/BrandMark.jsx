import React, { useEffect, useState } from "react";
import { fetchBrandLogo, getCachedBrandLogo } from "@/services/apiService";

export const useBrandLogo = () => {
  const [url, setUrl] = useState(() => getCachedBrandLogo());
  useEffect(() => {
    fetchBrandLogo()
      .then((u) => u && setUrl(u))
      .catch(() => {});
  }, []);
  return url;
};

// Super-admin's platform logo everywhere it's used; falls back to the "B"
// mark only until the network call resolves or if no logo is set yet.
// `tone`: 'brand' (default) keeps the logo's own colors / red-square "B" —
// for a white/light background. 'light' inverts the real logo to white and
// swaps the "B" fallback to a white badge — for a colored/dark bar. 'dark'
// flattens the real logo to solid black and swaps the "B" fallback to a
// black badge — for a white bar that needs a dark mark instead of the
// brand-red one.
export const BrandMark = ({ size = 40, className = "", tone = "brand" }) => {
  const url = useBrandLogo();
  const filter = tone === "light" ? "brightness-0 invert" : tone === "dark" ? "brightness-0" : "";
  if (url) {
    return (
      <img
        src={url}
        alt="BhojPe"
        className={`object-contain shrink-0 ${filter} ${className}`}
        style={{ height: size, width: "auto", maxWidth: size * 3 }}
      />
    );
  }
  const badgeStyle =
    tone === "light" ? "bg-white text-[#FF5252]"
    : tone === "dark" ? "bg-[#1A1A1A] text-white"
    : "bg-[#FF5252] text-white";
  return (
    <div
      className={`rounded-md font-head font-extrabold flex items-center justify-center shrink-0 ${badgeStyle} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      B
    </div>
  );
};
