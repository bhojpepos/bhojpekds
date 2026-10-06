import React from "react";
import { BedDouble } from "lucide-react";
import dineIn from "@/assets/dinein-cutlery.png";
import pickupBag from "@/assets/pickup-bag.png";
import deliveryBike from "@/assets/delivery-bike.png";

// Bhojpe POS wale hi order-type icons (bhojpe-poss/src/components/common/
// DineInIcon / PickupIcon / DeliveryIcon — same PNGs, CSS mask se currentColor
// me rang). Room service = bed icon.
const MASK = { "dine-in": dineIn, takeaway: pickupBag, pickup: pickupBag, delivery: deliveryBike };

export function OrderTypeIcon({ type, size = 16, className = "", style = {} }) {
  if (type === "room-service") return <BedDouble className={className} style={{ width: size, height: size, ...style }} />;
  const src = MASK[type] || dineIn;
  return (
    <span
      role="img"
      aria-label={type}
      className={className}
      style={{
        display: "inline-block", width: size, height: size, flexShrink: 0, backgroundColor: "currentColor",
        WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskPosition: "center", maskPosition: "center",
        WebkitMaskSize: "contain", maskSize: "contain",
        ...style,
      }}
    />
  );
}
