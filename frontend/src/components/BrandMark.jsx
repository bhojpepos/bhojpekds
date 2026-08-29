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
export const BrandMark = ({ size = 40, className = "" }) => {
  const url = useBrandLogo();
  if (url) {
    return (
      <img
        src={url}
        alt="BhojPe"
        className={`object-contain shrink-0 ${className}`}
        style={{ height: size, width: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-md bg-[#FF5252] text-white font-head font-extrabold flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      B
    </div>
  );
};
