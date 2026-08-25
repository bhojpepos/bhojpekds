// Mock order service. Swap these functions with real BhojPe API/WebSocket calls later.

export const STATIONS = [
  "Main Kitchen",
  "Tandoor",
  "Chinese",
  "Bakery",
  "Dessert",
  "Bar",
  "Pizza",
];

export const MENU_ITEMS = [
  { id: "m1", name: "Paneer Tikka", station: "Tandoor", available: true },
  { id: "m2", name: "Butter Naan", station: "Tandoor", available: true },
  { id: "m3", name: "Dal Makhani", station: "Main Kitchen", available: true },
  { id: "m4", name: "Chicken Biryani", station: "Main Kitchen", available: false },
  { id: "m5", name: "Tandoori Roti", station: "Tandoor", available: true },
  { id: "m6", name: "Veg Hakka Noodles", station: "Chinese", available: true },
  { id: "m7", name: "Manchurian", station: "Chinese", available: true },
  { id: "m8", name: "Farmhouse Pizza", station: "Pizza", available: true },
  { id: "m9", name: "Cold Coffee", station: "Bar", available: true },
  { id: "m10", name: "Masala Dosa", station: "Main Kitchen", available: true },
  { id: "m11", name: "Veg Burger", station: "Main Kitchen", available: true },
  { id: "m12", name: "French Fries", station: "Main Kitchen", available: true },
];

const NOTES = ["Extra Spicy", "No Butter", "Less Oil", "Jain", "No Onion", null, null];
const ORDER_NOTES = ["Serve together", "Priority table", "Pack separately", null, null];

const now = () => Date.now();

const mk = (kot, type, opts) => ({
  id: `kot-${kot}`,
  kot,
  type,
  table: opts.table || null,
  refNo: opts.refNo || null,
  status: opts.status,
  priority: opts.priority || "normal",
  station: opts.station || "Main Kitchen",
  createdAt: now() - (opts.ageSec || 0) * 1000,
  note: opts.note || null,
  items: opts.items,
});

const it = (qty, name, note = null) => ({ qty, name, note });

export function seedOrders() {
  return [
    mk(1024, "dine-in", {
      table: "Table 12",
      status: "new",
      ageSec: 138,
      station: "Main Kitchen",
      note: "Serve together",
      items: [it(2, "Paneer Tikka", "Extra Spicy"), it(1, "Butter Naan", "No Butter"), it(1, "Dal Makhani")],
    }),
    mk(1025, "takeaway", {
      status: "new",
      ageSec: 45,
      priority: "high",
      station: "Main Kitchen",
      items: [it(1, "Veg Burger"), it(2, "French Fries")],
    }),
    mk(1026, "delivery", {
      refNo: "#D184",
      status: "new",
      ageSec: 322,
      station: "Chinese",
      items: [it(2, "Veg Hakka Noodles", "Less Oil"), it(1, "Manchurian")],
    }),
    mk(1027, "dine-in", {
      table: "Table 4",
      status: "cooking",
      ageSec: 410,
      station: "Tandoor",
      items: [it(3, "Tandoori Roti"), it(1, "Dal Makhani", "Jain")],
    }),
    mk(1028, "dine-in", {
      table: "Table 9",
      status: "cooking",
      ageSec: 588,
      priority: "urgent",
      station: "Main Kitchen",
      note: "Guest waiting at counter",
      items: [it(1, "Masala Dosa"), it(2, "Cold Coffee")],
    }),
    mk(1029, "takeaway", {
      status: "cooking",
      ageSec: 751,
      station: "Pizza",
      items: [it(2, "Farmhouse Pizza", "Extra cheese")],
    }),
    mk(1030, "pickup", {
      refNo: "#P77",
      status: "cooking",
      ageSec: 96,
      station: "Main Kitchen",
      items: [it(1, "Veg Burger", "No Onion"), it(1, "Cold Coffee")],
    }),
    mk(1018, "dine-in", {
      table: "Table 2",
      status: "ready",
      ageSec: 640,
      station: "Main Kitchen",
      items: [it(2, "Masala Dosa")],
    }),
    mk(1022, "takeaway", {
      status: "ready",
      ageSec: 300,
      station: "Tandoor",
      items: [it(4, "Butter Naan"), it(1, "Paneer Tikka")],
    }),
    mk(1019, "delivery", {
      refNo: "#D171",
      status: "completed",
      ageSec: 900,
      station: "Main Kitchen",
      items: [it(1, "Dal Makhani"), it(2, "Tandoori Roti")],
    }),
    mk(1020, "dine-in", {
      table: "Table 7",
      status: "completed",
      ageSec: 1180,
      station: "Chinese",
      items: [it(1, "Veg Hakka Noodles")],
    }),
    mk(1021, "takeaway", {
      status: "completed",
      ageSec: 1320,
      station: "Bakery",
      items: [it(2, "French Fries")],
    }),
    mk(1031, "dine-in", {
      table: "Table 15",
      status: "completed",
      ageSec: 1500,
      station: "Main Kitchen",
      items: [it(1, "Veg Burger")],
    }),
    mk(1032, "pickup", {
      refNo: "#P81",
      status: "completed",
      ageSec: 1700,
      station: "Bar",
      items: [it(3, "Cold Coffee")],
    }),
    mk(1033, "dine-in", {
      table: "Table 6",
      status: "new",
      ageSec: 12,
      station: "Main Kitchen",
      items: [it(1, "Masala Dosa"), it(1, "Cold Coffee")],
    }),
  ];
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function generateKot(nextKot, station) {
  const types = ["dine-in", "takeaway", "delivery", "pickup"];
  const type = pick(types);
  const pool = MENU_ITEMS.filter((m) => m.available);
  const count = 1 + Math.floor(Math.random() * 3);
  const items = [];
  for (let i = 0; i < count; i++) {
    const m = pick(pool);
    if (items.some((x) => x.name === m.name)) continue;
    items.push(it(1 + Math.floor(Math.random() * 3), m.name, pick(NOTES)));
  }
  return mk(nextKot, type, {
    table: type === "dine-in" ? `Table ${1 + Math.floor(Math.random() * 20)}` : null,
    refNo: type === "delivery" ? `#D${180 + Math.floor(Math.random() * 90)}` : type === "pickup" ? `#P${60 + Math.floor(Math.random() * 40)}` : null,
    status: "new",
    ageSec: 0,
    station: station || "Main Kitchen",
    note: pick(ORDER_NOTES),
    items: items.length ? items : [it(1, "Dal Makhani")],
  });
}

export const NEXT_STATUS = { new: "cooking", cooking: "ready", ready: "completed" };
export const ACTION_LABEL = {
  new: "START COOKING",
  cooking: "MARK READY",
  ready: "COMPLETE ORDER",
  completed: "DONE",
};
export const STATUS_ORDER = ["new", "cooking", "ready", "completed"];
export const STATUS_LABEL = { new: "NEW", cooking: "COOKING", ready: "READY", completed: "COMPLETED" };
