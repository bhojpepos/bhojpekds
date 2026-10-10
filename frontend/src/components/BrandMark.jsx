import React, { useEffect, useState } from "react";
import { fetchBrandLogo, getCachedBrandLogo } from "@/services/apiService";

export const useBrandLogo = () => {
  const [url, setUrl] = useState(() => getCachedBrandLogo());
  useEffect(() => {
    fetchBrandLogo()
      .then((u) => setUrl(u || null))
      .catch(() => {});
  }, []);
  return url;
};

// Super-admin's KDS logo (falls back to the platform logo) — nothing else. Renders
// nothing until the logo URL is known (cached after first load).
// `tone`: 'brand' (default) keeps the logo's own colors; 'light' inverts it
// to white (colored/dark bar); 'dark' flattens it to solid black.
// `color`: paint the whole logo in one solid colour. Done with a CSS filter
// (solid black → target colour), NOT a CSS mask: the logo is served from
// billing's origin and masks need CORS, filters don't. Add new colours here
// (values from the standard hex → CSS-filter solver).
const COLOR_FILTERS = {
  "#228BE6": "brightness(0) saturate(100%) invert(40%) sepia(90%) saturate(911%) hue-rotate(180deg) brightness(95%) contrast(90%)",
};

export const BrandMark = ({ size = 40, className = "", tone = "brand", color = null }) => {
  const url = useBrandLogo();
  const filter = tone === "light" ? "brightness-0 invert" : tone === "dark" ? "brightness-0" : "";
  const colorFilter = color ? COLOR_FILTERS[String(color).toUpperCase()] : null;
  if (url && colorFilter) {
    return (
      <img
        src={url}
        alt="BhojPe"
        className={`object-contain shrink-0 ${className}`}
        style={{ height: size, width: "auto", maxWidth: size * 3, filter: colorFilter }}
      />
    );
  }
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
  // No other mark — only the super-admin logo is ever shown.
  return null;
};
