import asyncio
import hmac
import logging
import os
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import httpx
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, BackgroundTasks, Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware

from models import (
    AvailabilityUpdate,
    ConfigUpdate,
    ItemDoneUpdate,
    KdsConfig,
    MenuItem,
    Order,
    OrderCreate,
    OrderItem,
    PairRequest,
    PrintJob,
    PriorityUpdate,
    StationUpdate,
    StatusUpdate,
    now_iso,
)
from printer import build_escpos, probe_printer, send_to_printer
from email_service import send_email, shift_recap_html

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

# Real billing backend (Laravel) this shared, multi-tenant KDS deployment
# pairs against - see Phase 1 of the KDS<->billing integration plan.
BILLING_API_BASE_URL = os.environ.get("BILLING_API_BASE_URL", "http://localhost:8000").rstrip("/")

app = FastAPI(title="BhojPe Server")
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

STATIONS = ["Main Kitchen", "Tandoor", "Chinese", "Bakery", "Dessert", "Bar", "Pizza"]

SEED_MENU = [
    ("Paneer Tikka", "Tandoor", True),
    ("Butter Naan", "Tandoor", True),
    ("Dal Makhani", "Main Kitchen", True),
    ("Chicken Biryani", "Main Kitchen", False),
    ("Tandoori Roti", "Tandoor", True),
    ("Veg Hakka Noodles", "Chinese", True),
    ("Manchurian", "Chinese", True),
    ("Farmhouse Pizza", "Pizza", True),
    ("Cold Coffee", "Bar", True),
    ("Masala Dosa", "Main Kitchen", True),
    ("Veg Burger", "Main Kitchen", True),
    ("French Fries", "Main Kitchen", True),
]

STATUS_FLOW = ["new", "cooking", "ready", "completed"]
STAMP = {"cooking": "startedAt", "ready": "readyAt", "completed": "completedAt"}


# ---------------- realtime hub ----------------
class Hub:
    """Branch-scoped broadcast hub.

    This backend serves every paired restaurant/branch from one shared process
    (see Phase 0 of the KDS<->billing integration plan), so a client's branch
    must be known before we can safely fan events out to it. Real pairing
    (Phase 1) hasn't landed on the frontend yet, so `branch_id` is optional on
    both connect and broadcast today: a client that connects without one is
    treated as "unscoped" (demo/local use, receives everything, exactly like
    before this change), and a broadcast with no branch_id (existing
    demo-seeded data has none) still goes to everyone. Once Phase 1 wires real
    pairing through, both sides will carry a real branch_id and scoping kicks
    in automatically with no further change needed here.
    """

    def __init__(self):
        self.clients: dict[WebSocket, Optional[str]] = {}

    async def connect(self, ws: WebSocket, branch_id: Optional[str] = None):
        await ws.accept()
        self.clients[ws] = branch_id

    def disconnect(self, ws: WebSocket):
        self.clients.pop(ws, None)

    async def broadcast(self, event: str, payload, branch_id: Optional[str] = None):
        dead = []
        for ws, client_branch in list(self.clients.items()):
            # Unscoped payload (no branch_id, e.g. demo-seeded data or a global
            # system event) -> send to everyone, scoped clients included.
            # Scoped payload -> only send to the matching branch's clients; an
            # unscoped/unpaired client (client_branch is None) does NOT receive
            # other branches' real data.
            if branch_id is not None and client_branch != branch_id:
                continue
            try:
                await ws.send_json({"event": event, "payload": payload})
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


hub = Hub()


def order_out(doc) -> dict:
    return Order.from_mongo(doc).model_dump()


async def next_kot() -> int:
    doc = await db.counters.find_one_and_update(
        {"_id": "kot"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    return 1024 + int(doc["seq"]) - 1


# ---------------- seed ----------------
def seed_orders_payload():
    def o(kot, typ, status, age_min, station, items, table=None, refNo=None, priority="normal", note=None, prep_min=None):
        created = datetime.now(timezone.utc).timestamp() - age_min * 60
        started = None
        ready = None
        completed = None
        if status in ("cooking", "ready", "completed"):
            started = created + 60
        if status in ("ready", "completed"):
            ready = started + prep_min * 60 if prep_min else created + age_min * 30
        if status == "completed":
            completed = (ready + 120) if prep_min else created + age_min * 45
        iso = lambda t: datetime.fromtimestamp(t, timezone.utc).isoformat() if t else None
        return Order(
            kot=kot, type=typ, table=table, refNo=refNo, status=status, priority=priority,
            station=station, note=note, items=[OrderItem(**i) for i in items],
            createdAt=iso(created), startedAt=iso(started), readyAt=iso(ready), completedAt=iso(completed),
        ).to_mongo()

    return [
        o(1024, "dine-in", "new", 2.3, "Main Kitchen",
          [{"qty": 2, "name": "Paneer Tikka", "note": "Extra Spicy"}, {"qty": 1, "name": "Butter Naan", "note": "No Butter"}, {"qty": 1, "name": "Dal Makhani"}],
          table="Table 12", note="Serve together"),
        o(1025, "takeaway", "new", 0.8, "Main Kitchen",
          [{"qty": 1, "name": "Veg Burger"}, {"qty": 2, "name": "French Fries"}], priority="high"),
        o(1026, "delivery", "new", 5.4, "Chinese",
          [{"qty": 2, "name": "Veg Hakka Noodles", "note": "Less Oil"}, {"qty": 1, "name": "Manchurian"}], refNo="#D184"),
        o(1027, "dine-in", "cooking", 6.8, "Tandoor",
          [{"qty": 3, "name": "Tandoori Roti"}, {"qty": 1, "name": "Dal Makhani", "note": "Jain"}], table="Table 4"),
        o(1028, "dine-in", "cooking", 9.8, "Main Kitchen",
          [{"qty": 1, "name": "Masala Dosa"}, {"qty": 2, "name": "Cold Coffee"}], table="Table 9",
          priority="urgent", note="Guest waiting at counter"),
        o(1029, "takeaway", "cooking", 12.5, "Pizza",
          [{"qty": 2, "name": "Farmhouse Pizza", "note": "Extra cheese"}]),
        o(1030, "pickup", "cooking", 1.6, "Main Kitchen",
          [{"qty": 1, "name": "Veg Burger", "note": "No Onion"}, {"qty": 1, "name": "Cold Coffee"}], refNo="#P77"),
        o(1018, "dine-in", "ready", 10.6, "Main Kitchen", [{"qty": 2, "name": "Masala Dosa"}], table="Table 2"),
        o(1022, "takeaway", "ready", 5.0, "Tandoor", [{"qty": 4, "name": "Butter Naan"}, {"qty": 1, "name": "Paneer Tikka"}]),
        o(1019, "delivery", "completed", 15.0, "Main Kitchen", [{"qty": 1, "name": "Dal Makhani"}, {"qty": 2, "name": "Tandoori Roti"}], refNo="#D171"),
        o(1020, "dine-in", "completed", 19.6, "Chinese", [{"qty": 1, "name": "Veg Hakka Noodles"}], table="Table 7"),
        o(1021, "takeaway", "completed", 22.0, "Bakery", [{"qty": 2, "name": "French Fries"}]),
        o(1031, "dine-in", "completed", 25.0, "Main Kitchen", [{"qty": 1, "name": "Veg Burger"}], table="Table 15"),
        o(1032, "pickup", "completed", 28.3, "Bar", [{"qty": 3, "name": "Cold Coffee"}], refNo="#P81"),
        o(1033, "dine-in", "new", 0.2, "Main Kitchen", [{"qty": 1, "name": "Masala Dosa"}, {"qty": 1, "name": "Cold Coffee"}], table="Table 6"),
        # ---- last week (for week-over-week trends) ----
        o(990, "dine-in", "completed", 8 * 1440, "Tandoor", [{"qty": 2, "name": "Paneer Tikka"}, {"qty": 2, "name": "Butter Naan"}], table="Table 3", prep_min=6),
        o(991, "takeaway", "completed", 8 * 1440 + 90, "Main Kitchen", [{"qty": 1, "name": "Dal Makhani"}, {"qty": 2, "name": "Tandoori Roti"}], prep_min=9),
        o(992, "delivery", "completed", 9 * 1440, "Chinese", [{"qty": 2, "name": "Veg Hakka Noodles"}, {"qty": 1, "name": "Manchurian"}], refNo="#D090", prep_min=7),
        o(993, "dine-in", "completed", 9 * 1440 + 200, "Pizza", [{"qty": 2, "name": "Farmhouse Pizza"}], table="Table 8", prep_min=14),
        o(994, "takeaway", "completed", 10 * 1440, "Main Kitchen", [{"qty": 2, "name": "Masala Dosa"}, {"qty": 1, "name": "Cold Coffee"}], prep_min=5),
        o(995, "pickup", "completed", 10 * 1440 + 300, "Main Kitchen", [{"qty": 2, "name": "Veg Burger"}, {"qty": 3, "name": "French Fries"}], refNo="#P40", prep_min=8),
        o(996, "dine-in", "completed", 11 * 1440, "Tandoor", [{"qty": 3, "name": "Butter Naan"}, {"qty": 1, "name": "Dal Makhani"}], table="Table 1", prep_min=10),
    ]


async def seed(force: bool = False):
    if force:
        await db.orders.delete_many({})
        await db.menu.delete_many({})
        await db.counters.delete_many({})
        await db.print_jobs.delete_many({})
        await db.order_events.delete_many({})
    if await db.orders.count_documents({}) == 0:
        await db.orders.insert_many(seed_orders_payload())
        await db.counters.update_one({"_id": "kot"}, {"$set": {"seq": 10}}, upsert=True)
    if await db.menu.count_documents({}) == 0:
        await db.menu.insert_many(
            [MenuItem(name=n, station=s, available=a).to_mongo() for n, s, a in SEED_MENU]
        )


@app.on_event("startup")
async def on_start():
    await seed()


# ---------------- endpoints ----------------
@api_router.get("/")
async def root():
    return {"message": "BhojPe Server", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"server": "connected", "pos": "connected", "sync": "active", "time": now_iso()}


@api_router.post("/pair")
async def pair(body: PairRequest):
    """Pairs this browser/screen to a branch via billing's real branch sync
    code (the same code used for POS/Captain) PLUS a short-lived Pair Code
    the owner generates from bhojpe-poss - see KdsController::pair()'s
    docblock for why pairing needs both, not just one.

    This backend serves every paired restaurant/branch from one shared
    process, so pairing must resolve to a per-device token the caller keeps
    using (X-KDS-Device header, and ?device= on the WebSocket) rather than a
    single global "current tenant" - see get_branch_context() below. Billing
    creates a real `kds`-type Device row on pair and returns its id; that id
    IS the device token, so both systems share one device identity instead of
    bhojpekds inventing a second, disconnected one.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.post(
                f"{BILLING_API_BASE_URL}/api/v1/kds/pair",
                json={
                    "sync_code": body.syncCode,
                    "pair_code": body.pairCode,
                    "device_identifier": body.deviceIdentifier,
                    "device_name": body.deviceName or "Kitchen Display",
                },
            )
    except httpx.HTTPError:
        raise HTTPException(503, "Could not reach the BhojPe server. Check your connection and try again.")

    payload = resp.json()
    if resp.status_code != 200 or not payload.get("success", True):
        raise HTTPException(resp.status_code if resp.status_code >= 400 else 502, payload.get("message", "Pairing failed."))

    data = payload.get("data", payload)
    device_token = data["device_id"]
    pairing_doc = {
        "_id": device_token,
        "branchId": data["branch_id"],
        "tenantId": data["tenant_id"],
        "kitchenId": data.get("kitchen_id"),
        "branchName": data.get("branch_name"),
        "restaurantName": data.get("restaurant_name"),
        "stations": data.get("stations") or STATIONS,
        "pairedAt": now_iso(),
        # Kept so /api/staff and /api/login (both keyed off this pairing, not
        # a fresh code entry) can reuse it against billing's public
        # pos/branch-staff and auth/pos-login endpoints.
        "syncCode": body.syncCode,
    }
    await db.pairing.update_one({"_id": device_token}, {"$set": pairing_doc}, upsert=True)

    return {
        "ok": True,
        "deviceToken": device_token,
        "branchId": pairing_doc["branchId"],
        "tenantId": pairing_doc["tenantId"],
        "kitchenId": pairing_doc["kitchenId"],
        "restaurant": pairing_doc["restaurantName"],
        "branch": pairing_doc["branchName"],
        "server": "BhojPe Server",
        "stations": pairing_doc["stations"],
        "lastSync": pairing_doc["pairedAt"],
    }


async def get_branch_context(x_kds_device: Optional[str] = Header(None)) -> Optional[dict]:
    """Resolves the calling device's branch/tenant/kitchen from its paired
    device token (X-KDS-Device header). Returns None for an unpaired/legacy
    caller - endpoints that use this treat None as "unscoped" (local/demo use,
    matches pre-Phase-1 behavior), exactly like the Hub's own branch_id=None
    handling (see Hub's docstring in Phase 0).
    """
    if not x_kds_device:
        return None
    pairing = await db.pairing.find_one({"_id": x_kds_device})
    return pairing


async def require_pairing(x_kds_device: Optional[str] = Header(None)) -> dict:
    """Like get_branch_context, but for endpoints that make no sense unpaired
    (staff list, passcode login) - raises instead of silently returning None.

    Uses 409 (not 401) deliberately: billing's own passcode rejection also
    surfaces as a 401/422 from chef_login() below, and the frontend needs to
    tell "your pairing is stale, go reconnect" apart from "wrong passcode,
    try again" - conflating them under the same status code once made a
    stale/lost pairing look exactly like a wrong passcode with no way to
    recover except manually clearing browser storage.
    """
    pairing = await get_branch_context(x_kds_device)
    if not pairing:
        raise HTTPException(409, "This screen's pairing was lost. Please reconnect.")
    return pairing


@api_router.get("/staff")
async def list_staff(pairing: dict = Depends(require_pairing)):
    """Branch staff roster for the passcode login screen - proxies billing's
    public pos/branch-staff (same sync code this screen paired with).
    """
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.get(
                f"{BILLING_API_BASE_URL}/api/v1/pos/branch-staff",
                params={"sync_code": pairing["syncCode"]},
            )
    except httpx.HTTPError:
        raise HTTPException(503, "Could not reach the BhojPe server.")

    payload = resp.json()
    if resp.status_code != 200 or not payload.get("success", True):
        raise HTTPException(resp.status_code if resp.status_code >= 400 else 502, payload.get("message", "Could not load staff."))

    return payload.get("data", payload).get("staff", [])


@api_router.post("/login")
async def chef_login(body: dict, pairing: dict = Depends(require_pairing)):
    """Passcode-only shift login - proxies billing's auth/pos-login. On
    success, stores the chef's Sanctum token on this device's pairing doc
    (server.py, not the browser, needs it for Phase 2's status push-back
    calls to billing), and returns the chef's identity to the frontend.
    """
    passcode = (body or {}).get("passcode")
    if not passcode:
        raise HTTPException(400, "Passcode is required.")

    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.post(
                f"{BILLING_API_BASE_URL}/api/v1/auth/pos-login",
                json={"passcode": passcode},
            )
    except httpx.HTTPError:
        raise HTTPException(503, "Could not reach the BhojPe server.")

    payload = resp.json()
    if resp.status_code != 200 or not payload.get("success", True):
        raise HTTPException(resp.status_code if resp.status_code >= 400 else 401, payload.get("message", "Incorrect passcode."))

    data = payload.get("data", payload)
    user = data.get("user") or {}
    await db.pairing.update_one(
        {"_id": pairing["_id"]},
        {"$set": {
            "chefToken": data.get("token"),
            "chefId": user.get("id"),
            "chefName": user.get("name"),
            "chefRole": (user.get("role") or {}).get("name") if isinstance(user.get("role"), dict) else user.get("role"),
            "chefAvatar": user.get("avatar"),
            "loggedInAt": now_iso(),
        }},
    )

    return {
        "ok": True,
        "chefId": user.get("id"),
        "chefName": user.get("name"),
        "chefRole": (user.get("role") or {}).get("name") if isinstance(user.get("role"), dict) else user.get("role"),
        "chefAvatar": user.get("avatar"),
    }


def _branch_filter(ctx: Optional[dict], extra: Optional[dict] = None) -> dict:
    """Scopes a Mongo query by the caller's paired branch.

    Paired caller -> only that branch's data. Unpaired/legacy caller -> only
    unscoped data (branchId absent/None, i.e. demo-seeded docs) - never all
    branches unfiltered, so an unauthenticated caller can't see a real paired
    restaurant's orders. Mirrors Hub.broadcast's scoping rule (Phase 0).
    """
    q = dict(extra or {})
    q["branchId"] = ctx["branchId"] if ctx else None
    return q


@api_router.get("/orders")
async def list_orders(station: Optional[str] = None, ctx: Optional[dict] = Depends(get_branch_context)):
    q = _branch_filter(ctx, {"station": station} if station else None)
    docs = await db.orders.find(q).sort("kot", -1).to_list(500)
    return [order_out(d) for d in docs]


@api_router.post("/pos/orders")
async def pos_create_order(body: OrderCreate):
    """POS creates an order -> becomes a KOT on the KDS (and queues a printer ticket).

    If `body.kot` is set (order pushed in from billing, carrying billing's real
    per-branch-per-day KOT number), that number is used as-is instead of
    generating a local one, so the same KOT number shows on the printed bill,
    the KDS, and the Token Screen. Locally-created demo/random orders have no
    `kot` and keep using next_kot().
    """
    payload = body.model_dump()
    kot = payload.pop("kot", None) or await next_kot()
    order = Order(kot=kot, **payload)
    res = await db.orders.insert_one(order.to_mongo())
    doc = await db.orders.find_one({"_id": res.inserted_id})
    out = order_out(doc)
    await hub.broadcast("order.created", out, branch_id=out.get("branchId"))
    await _queue_print(out)
    return out


@api_router.post("/pos/orders/random")
async def pos_create_random(station: Optional[str] = None):
    menu = [MenuItem.from_mongo(d) for d in await db.menu.find({"available": True}).to_list(100)]
    typ = random.choice(["dine-in", "takeaway", "delivery", "pickup"])
    picked = random.sample(menu, k=min(len(menu), random.randint(1, 3)))
    body = OrderCreate(
        type=typ,
        table=f"Table {random.randint(1, 20)}" if typ == "dine-in" else None,
        refNo=f"#D{random.randint(180, 269)}" if typ == "delivery" else (f"#P{random.randint(60, 99)}" if typ == "pickup" else None),
        station=station or random.choice(STATIONS),
        note=random.choice(["Serve together", "Pack separately", None, None]),
        items=[OrderItem(qty=random.randint(1, 3), name=m.name, note=random.choice(["Extra Spicy", "No Onion", "Less Oil", None, None])) for m in picked],
    )
    return await pos_create_order(body)


def ticket_lines(order: dict) -> List[str]:
    lines = [
        "BhojPe",
        f"KOT / TOKEN  {order['kot']}",
        f"{order['type'].upper()}  {order.get('table') or order.get('refNo') or ''}".strip(),
        f"STATION: {order['station']}",
        "-" * 32,
    ]
    for i in order.get("items", []):
        lines.append(f"{i['qty']} x {i['name']}")
        if i.get("note"):
            lines.append(f"   >> {i['note']}")
    lines.append("-" * 32)
    if order.get("note"):
        lines.append(f"NOTE: {order['note']}")
    if order.get("priority") and order["priority"] != "normal":
        lines.append(f"** {order['priority'].upper()} **")
    lines.append(f"PRINTED: {now_iso()[11:19]} UTC")
    return lines


ACTION_LABELS = {
    "cooking": "started cooking",
    "ready": "marked ready",
    "completed": "completed order",
    "new": "recalled to new",
}


async def log_event(order: dict, action: str, actor: Optional[str], detail: Optional[str] = None):
    entry = {
        "orderId": order["id"],
        "kot": order["kot"],
        "action": action,
        "detail": detail,
        "actor": (actor or "Kitchen Device").strip()[:60],
        "station": order.get("station"),
        "at": now_iso(),
    }
    res = await db.order_events.insert_one(dict(entry))
    entry["id"] = str(res.inserted_id)
    await hub.broadcast("audit.logged", entry, branch_id=order.get("branchId"))
    return entry


async def get_config() -> KdsConfig:
    doc = await db.config.find_one({"key": "kds"})
    if not doc:
        cfg = KdsConfig()
        await db.config.insert_one({**cfg.to_mongo(), "key": "kds"})
        return cfg
    return KdsConfig.from_mongo(doc)


async def _queue_print(order: dict, copies: int = 1, reason: Optional[str] = None):
    cfg = await get_config()
    job = PrintJob(
        orderId=order["id"],
        kot=order["kot"],
        station=order["station"],
        copies=copies,
        lines=ticket_lines(order),
        reason=reason,
        branchId=order.get("branchId"),
    )
    res = await db.print_jobs.insert_one(job.to_mongo())
    job_id = res.inserted_id

    # Real network printer: try the hardware immediately, keep the job queued on failure.
    if cfg.printerEnabled and cfg.printerHost:
        err = await send_to_printer(cfg.printerHost, cfg.printerPort, build_escpos(job.lines, copies))
        await db.print_jobs.update_one(
            {"_id": job_id},
            {"$set": {"status": "failed" if err else "printed",
                      "printedAt": None if err else now_iso(),
                      "reason": err or reason}},
        )

    out = PrintJob.from_mongo(await db.print_jobs.find_one({"_id": job_id})).model_dump()
    await hub.broadcast("print.queued", out, branch_id=out.get("branchId"))
    return out


async def _get_order(order_id: str):
    if not ObjectId.is_valid(order_id):
        raise HTTPException(404, "Order not found")
    doc = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not doc:
        raise HTTPException(404, "Order not found")
    return doc


@api_router.patch("/orders/{order_id}/status")
async def set_status(order_id: str, body: StatusUpdate, x_actor: Optional[str] = Header(None)):
    if body.status not in STATUS_FLOW:
        raise HTTPException(400, "Invalid status")
    doc = await _get_order(order_id)
    update = {"status": body.status}
    if body.status in STAMP:
        update[STAMP[body.status]] = now_iso()
    # moving backwards (recall) clears later stamps
    idx = STATUS_FLOW.index(body.status)
    for st in STATUS_FLOW[idx + 1:]:
        if st in STAMP:
            update[STAMP[st]] = None
    await db.orders.update_one({"_id": doc["_id"]}, {"$set": update})
    out = order_out(await db.orders.find_one({"_id": doc["_id"]}))
    await hub.broadcast("order.updated", out, branch_id=out.get("branchId"))
    backwards = STATUS_FLOW.index(body.status) < STATUS_FLOW.index(doc.get("status", "new"))
    await log_event(
        out,
        "recall" if backwards else f"status.{body.status}",
        x_actor,
        f"{doc.get('status')} -> {body.status}" if backwards else ACTION_LABELS.get(body.status),
    )
    return out


@api_router.patch("/orders/{order_id}/priority")
async def set_priority(order_id: str, body: PriorityUpdate, x_actor: Optional[str] = Header(None)):
    doc = await _get_order(order_id)
    await db.orders.update_one({"_id": doc["_id"]}, {"$set": {"priority": body.priority}})
    out = order_out(await db.orders.find_one({"_id": doc["_id"]}))
    await hub.broadcast("order.updated", out, branch_id=out.get("branchId"))
    await log_event(out, "priority", x_actor, f"set {body.priority}")
    return out


@api_router.patch("/orders/{order_id}/items/{index}")
async def set_item_done(order_id: str, index: int, body: ItemDoneUpdate, x_actor: Optional[str] = Header(None)):
    doc = await _get_order(order_id)
    if index < 0 or index >= len(doc.get("items", [])):
        raise HTTPException(404, "Item not found")
    await db.orders.update_one({"_id": doc["_id"]}, {"$set": {f"items.{index}.done": body.done}})
    out = order_out(await db.orders.find_one({"_id": doc["_id"]}))
    await hub.broadcast("order.updated", out, branch_id=out.get("branchId"))
    name = doc["items"][index].get("name")
    await log_event(out, "item", x_actor, f"{'ticked' if body.done else 'unticked'} {name}")
    return out


@api_router.delete("/orders/{order_id}")
async def clear_order(order_id: str):
    doc = await _get_order(order_id)
    await db.orders.delete_one({"_id": doc["_id"]})
    await hub.broadcast("order.removed", {"id": str(doc["_id"])}, branch_id=doc.get("branchId"))
    return {"ok": True, "id": str(doc["_id"])}


@api_router.patch("/orders/{order_id}/station")
async def handoff_station(order_id: str, body: StationUpdate, x_actor: Optional[str] = Header(None)):
    doc = await _get_order(order_id)
    prev = doc.get("station")
    if body.station == prev:
        return order_out(doc)
    entry = {"from": prev, "to": body.station, "at": now_iso(), "reason": body.reason}
    await db.orders.update_one(
        {"_id": doc["_id"]}, {"$set": {"station": body.station}, "$push": {"handoffs": entry}}
    )
    out = order_out(await db.orders.find_one({"_id": doc["_id"]}))
    await hub.broadcast("order.updated", out, branch_id=out.get("branchId"))
    await log_event(out, "handoff", x_actor, f"{prev} -> {body.station}")
    await _queue_print(out, reason=f"Handoff {prev} -> {body.station}")
    return out


@api_router.post("/print/kot/{order_id}")
async def print_kot(order_id: str, copies: int = 1):
    doc = await _get_order(order_id)
    return await _queue_print(order_out(doc), copies=copies, reason="Manual reprint")


@api_router.get("/print/jobs")
async def list_print_jobs(limit: int = 40, status: Optional[str] = None):
    q = {"status": status} if status else {}
    docs = await db.print_jobs.find(q).sort("_id", -1).to_list(limit)
    return [PrintJob.from_mongo(d).model_dump() for d in docs]


async def _job(job_id: str):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(404, "Print job not found")
    doc = await db.print_jobs.find_one({"_id": ObjectId(job_id)})
    if not doc:
        raise HTTPException(404, "Print job not found")
    return doc


@api_router.post("/print/jobs/{job_id}/ack")
async def ack_print_job(job_id: str):
    doc = await _job(job_id)
    await db.print_jobs.update_one(
        {"_id": doc["_id"]}, {"$set": {"status": "printed", "printedAt": now_iso()}}
    )
    out = PrintJob.from_mongo(await db.print_jobs.find_one({"_id": doc["_id"]})).model_dump()
    await hub.broadcast("print.updated", out, branch_id=out.get("branchId"))
    return out


@api_router.post("/print/jobs/{job_id}/retry")
async def retry_print_job(job_id: str):
    doc = await _job(job_id)
    cfg = await get_config()
    update = {"status": "queued", "printedAt": None}
    if cfg.printerEnabled and cfg.printerHost:
        err = await send_to_printer(
            cfg.printerHost, cfg.printerPort, build_escpos(doc.get("lines", []), doc.get("copies", 1))
        )
        update = {"status": "failed" if err else "printed",
                  "printedAt": None if err else now_iso(),
                  "reason": err or doc.get("reason")}
    await db.print_jobs.update_one({"_id": doc["_id"]}, {"$set": update})
    out = PrintJob.from_mongo(await db.print_jobs.find_one({"_id": doc["_id"]})).model_dump()
    await hub.broadcast("print.updated", out, branch_id=out.get("branchId"))
    return out


@api_router.get("/orders/{order_id}/events")
async def order_events(order_id: str):
    await _get_order(order_id)
    docs = await db.order_events.find({"orderId": order_id}).sort("_id", 1).to_list(200)
    return [{**{k: v for k, v in d.items() if k != "_id"}, "id": str(d["_id"])} for d in docs]


@api_router.get("/audit")
async def audit_trail(limit: int = 100, kot: Optional[int] = None, actor: Optional[str] = None):
    q = {}
    if kot is not None:
        q["kot"] = kot
    if actor:
        q["actor"] = actor
    docs = await db.order_events.find(q).sort("_id", -1).to_list(min(limit, 300))
    return [{**{k: v for k, v in d.items() if k != "_id"}, "id": str(d["_id"])} for d in docs]


@api_router.get("/stats/weekly")
async def weekly_trends(ctx: Optional[dict] = Depends(get_branch_context)):
    """This week vs last week average prep time per dish."""
    nowts = datetime.now(timezone.utc).timestamp()
    week = 7 * 24 * 3600
    buckets = {"this": {}, "last": {}}
    days = {}

    for d in await db.orders.find(_branch_filter(ctx)).to_list(5000):
        try:
            created = datetime.fromisoformat(d["createdAt"])
        except Exception:
            continue
        age = nowts - created.timestamp()
        if age > 2 * week:
            continue
        key = "this" if age <= week else "last"
        if key == "this":
            day = created.date().isoformat()
            days[day] = days.get(day, 0) + 1
        prep = None
        if d.get("startedAt") and d.get("readyAt"):
            try:
                prep = (datetime.fromisoformat(d["readyAt"]) - datetime.fromisoformat(d["startedAt"])).total_seconds()
            except Exception:
                prep = None
        for i in d.get("items", []):
            e = buckets[key].setdefault(i["name"], {"qty": 0, "total": 0.0, "count": 0})
            e["qty"] += i.get("qty", 1)
            if prep and prep > 0:
                e["total"] += prep
                e["count"] += 1

    def avg(b, name):
        e = b.get(name)
        return round(e["total"] / e["count"]) if e and e["count"] else None

    dishes = []
    for name in sorted(set(buckets["this"]) | set(buckets["last"])):
        this_avg, last_avg = avg(buckets["this"], name), avg(buckets["last"], name)
        dishes.append({
            "name": name,
            "thisWeekAvgSeconds": this_avg,
            "lastWeekAvgSeconds": last_avg,
            "deltaSeconds": (this_avg - last_avg) if (this_avg and last_avg) else None,
            "thisWeekQty": buckets["this"].get(name, {}).get("qty", 0),
            "lastWeekQty": buckets["last"].get(name, {}).get("qty", 0),
        })

    slowing = sorted([d for d in dishes if d["deltaSeconds"]], key=lambda x: -x["deltaSeconds"])[:5]
    improving = sorted([d for d in dishes if d["deltaSeconds"]], key=lambda x: x["deltaSeconds"])[:5]
    return {
        "dishes": sorted(dishes, key=lambda x: -(x["thisWeekAvgSeconds"] or 0)),
        "slowingDown": slowing,
        "speedingUp": improving,
        "ordersPerDay": [{"day": k, "count": v} for k, v in sorted(days.items())],
        "generatedAt": now_iso(),
    }


@api_router.get("/printer/status")
async def printer_status():
    cfg = await get_config()
    if not cfg.printerHost:
        return {"configured": False, "enabled": cfg.printerEnabled, "reachable": False, "error": "No printer host set"}
    err = await probe_printer(cfg.printerHost, cfg.printerPort)
    queued = await db.print_jobs.count_documents({"status": {"$in": ["queued", "failed"]}})
    return {
        "configured": True,
        "enabled": cfg.printerEnabled,
        "host": cfg.printerHost,
        "port": cfg.printerPort,
        "reachable": err is None,
        "error": err,
        "pendingJobs": queued,
    }


@api_router.post("/reports/test-email")
async def test_email():
    """Sends a short setup-confirmation email to the configured recipient only."""
    cfg = await get_config()
    if not cfg.recapEmail:
        return {"ok": False, "reason": "No recap email configured"}
    html = (
        '<table role="presentation" width="100%" style="background:#f7f7f7;padding:24px"><tr><td align="center">'
        '<table role="presentation" width="600" style="background:#fff;border:1px solid #e5e7eb;border-radius:6px">'
        '<tr><td style="padding:24px;font-family:Arial,sans-serif">'
        '<div style="font-size:20px;font-weight:800;color:#2c2c2c">BhojPe KDS</div>'
        '<div style="font-size:14px;color:#555;margin-top:8px">Your kitchen display is now set up to email the '
        'shift recap to this address every night at 23:30 IST.</div>'
        '<div style="font-size:12px;color:#888;margin-top:16px">We never ask for your password or card details by email.</div>'
        "</td></tr></table></td></tr></table>"
    )
    email_id = await send_email(to=cfg.recapEmail, subject="BhojPe KDS — recap email confirmed", html=html)
    return {"ok": True, "emailId": email_id, "to": cfg.recapEmail}


@api_router.get("/config")
async def read_config():
    return (await get_config()).model_dump()


@api_router.put("/config")
async def update_config(body: ConfigUpdate):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if patch:
        await db.config.update_one({"key": "kds"}, {"$set": patch}, upsert=True)
    cfg = (await get_config()).model_dump()
    await hub.broadcast("config.updated", cfg)
    return cfg


@api_router.post("/print/test")
async def print_test():
    cfg = await get_config()
    if not (cfg.printerEnabled and cfg.printerHost):
        raise HTTPException(400, "Configure a printer host and enable the printer first")
    lines = ["BhojPe", "PRINTER TEST", f"HOST: {cfg.printerHost}:{cfg.printerPort}", "-" * 32,
             "If you can read this, the", "kitchen printer is wired up.", f"AT: {now_iso()[11:19]} UTC"]
    err = await send_to_printer(cfg.printerHost, cfg.printerPort, build_escpos(lines))
    return {"ok": err is None, "error": err, "host": cfg.printerHost, "port": cfg.printerPort}


async def _send_recap(hours: int = 12):
    cfg = await get_config()
    if not cfg.recapEmail:
        logger.warning("Shift recap skipped: no recipient configured")
        return {"ok": False, "reason": "No recap email configured"}
    summary = await shift_summary(hours)
    html = shift_recap_html(summary, "Main Branch", "All Stations")
    email_id = await send_email(
        to=cfg.recapEmail,
        subject=f"Kitchen shift recap — {summary['ordersServed']} orders served",
        html=html,
    )
    await db.config.update_one({"key": "kds"}, {"$set": {"lastRecapAt": now_iso()}}, upsert=True)
    return {"ok": True, "emailId": email_id, "to": cfg.recapEmail}


@api_router.post("/reports/shift-recap/send")
async def send_shift_recap(hours: int = 12):
    """Recipient comes from server-side config only — never from the caller."""
    return await _send_recap(hours)


@api_router.post("/cron/shift-recap")
async def cron_shift_recap(
    background: BackgroundTasks,
    authorization: Optional[str] = Header(None),
    x_webhook_id: Optional[str] = Header(None),
):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ["WEBHOOK_CRON_SECRET"]
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not token or not hmac.compare_digest(token, secret):
        raise HTTPException(401, "Unauthorized")
    run_id = x_webhook_id or now_iso()
    existing = await db.cron_runs.find_one({"runId": run_id})
    if existing:
        return {"ok": True, "duplicate": True, "runId": run_id}
    await db.cron_runs.insert_one({"runId": run_id, "job": "shift-recap", "at": now_iso()})
    background.add_task(_send_recap, 12)
    return {"ok": True, "accepted": True, "runId": run_id}


@api_router.get("/stats/rush")
async def rush_status(ctx: Optional[dict] = Depends(get_branch_context)):
    """Live 'how far behind is the kitchen' indicator."""
    target = 600  # 10 min service target from order creation to ready
    active = await db.orders.find(_branch_filter(ctx, {"status": {"$in": ["new", "cooking"]}})).to_list(1000)
    nowts = datetime.now(timezone.utc)
    ages = []
    for d in active:
        try:
            ages.append((nowts - datetime.fromisoformat(d["createdAt"])).total_seconds())
        except Exception:
            continue
    delayed = [a for a in ages if a >= target]
    behind = max(0, round((sum(ages) / len(ages)) - target)) if ages else 0

    hour_ago = nowts.timestamp() - 3600
    recent = 0
    for d in await db.orders.find(_branch_filter(ctx)).to_list(1000):
        try:
            if datetime.fromisoformat(d["createdAt"]).timestamp() >= hour_ago:
                recent += 1
        except Exception:
            continue

    if len(delayed) >= 4 or behind > 240:
        level = "rush"
    elif len(delayed) >= 1 or len(active) >= 8:
        level = "busy"
    else:
        level = "on-track"

    return {
        "level": level,
        "activeCount": len(active),
        "delayedCount": len(delayed),
        "behindSeconds": behind,
        "oldestSeconds": round(max(ages)) if ages else 0,
        "ordersLastHour": recent,
        "targetSeconds": target,
        "generatedAt": now_iso(),
    }


@api_router.get("/stats/shift")
async def shift_summary(hours: int = 12, ctx: Optional[dict] = Depends(get_branch_context)):
    since = datetime.now(timezone.utc).timestamp() - hours * 3600
    docs = []
    for d in await db.orders.find(_branch_filter(ctx)).to_list(2000):
        try:
            if datetime.fromisoformat(d["createdAt"]).timestamp() >= since:
                docs.append(d)
        except Exception:
            continue

    served = [d for d in docs if d.get("status") == "completed" or d.get("readyAt")]
    by_type, by_station, dish = {}, {}, {}
    preps = []
    for d in docs:
        by_type[d["type"]] = by_type.get(d["type"], 0) + 1
        by_station[d["station"]] = by_station.get(d["station"], 0) + 1
        prep = None
        if d.get("startedAt") and d.get("readyAt"):
            try:
                prep = (datetime.fromisoformat(d["readyAt"]) - datetime.fromisoformat(d["startedAt"])).total_seconds()
            except Exception:
                prep = None
        if prep and prep > 0:
            preps.append(prep)
        for i in d.get("items", []):
            e = dish.setdefault(i["name"], {"qty": 0, "total": 0.0, "count": 0})
            e["qty"] += i.get("qty", 1)
            if prep and prep > 0:
                e["total"] += prep
                e["count"] += 1

    dishes = [
        {
            "name": n,
            "qty": e["qty"],
            "avgSeconds": round(e["total"] / e["count"]) if e["count"] else None,
        }
        for n, e in dish.items()
    ]
    slowest = sorted([d for d in dishes if d["avgSeconds"]], key=lambda x: -x["avgSeconds"])[:5]
    top = sorted(dishes, key=lambda x: -x["qty"])[:5]

    return {
        "hours": hours,
        "ordersTotal": len(docs),
        "ordersServed": len(served),
        "itemsServed": sum(i.get("qty", 1) for d in docs for i in d.get("items", [])),
        "avgPrepSeconds": round(sum(preps) / len(preps)) if preps else None,
        "byType": by_type,
        "byStation": by_station,
        "slowestDishes": slowest,
        "topDishes": top,
        "generatedAt": now_iso(),
    }


@api_router.get("/menu")
async def list_menu(ctx: Optional[dict] = Depends(get_branch_context)):
    # Real paired branches have no menu data yet until Phase 5 (mirroring
    # billing's catalog per-branch) lands - this legitimately returns empty
    # for them today, same as /orders would for a branch with no orders yet.
    docs = await db.menu.find(_branch_filter(ctx)).to_list(500)
    return [MenuItem.from_mongo(d).model_dump() for d in docs]


@api_router.patch("/menu/{item_id}")
async def set_availability(item_id: str, body: AvailabilityUpdate):
    if not ObjectId.is_valid(item_id):
        raise HTTPException(404, "Item not found")
    doc = await db.menu.find_one({"_id": ObjectId(item_id)})
    if not doc:
        raise HTTPException(404, "Item not found")
    await db.menu.update_one({"_id": doc["_id"]}, {"$set": {"available": body.available}})
    out = MenuItem.from_mongo(await db.menu.find_one({"_id": doc["_id"]})).model_dump()
    await hub.broadcast("menu.updated", out, branch_id=out.get("branchId"))
    return {**out, "syncedToPOS": True, "syncedAt": now_iso()}


@api_router.get("/stats/prep-time")
async def prep_time(ctx: Optional[dict] = Depends(get_branch_context)):
    """Average cooking time (start -> ready) per station, plus pending load."""
    docs = await db.orders.find(_branch_filter(ctx, {"startedAt": {"$ne": None}, "readyAt": {"$ne": None}})).to_list(1000)
    by = {}
    for d in docs:
        try:
            secs = (
                datetime.fromisoformat(d["readyAt"]) - datetime.fromisoformat(d["startedAt"])
            ).total_seconds()
        except Exception:
            continue
        if secs <= 0:
            continue
        b = by.setdefault(d.get("station", "Main Kitchen"), {"total": 0.0, "count": 0, "slowest": 0.0})
        b["total"] += secs
        b["count"] += 1
        b["slowest"] = max(b["slowest"], secs)

    active = await db.orders.find(_branch_filter(ctx, {"status": {"$in": ["new", "cooking"]}})).to_list(1000)
    load = {}
    for d in active:
        load[d.get("station", "Main Kitchen")] = load.get(d.get("station", "Main Kitchen"), 0) + 1

    stations = sorted(set(list(by.keys()) + list(load.keys())))
    rows = []
    for st in stations:
        b = by.get(st)
        rows.append({
            "station": st,
            "avgSeconds": round(b["total"] / b["count"]) if b else None,
            "slowestSeconds": round(b["slowest"]) if b else None,
            "completedCount": b["count"] if b else 0,
            "activeCount": load.get(st, 0),
        })
    overall = [r["avgSeconds"] for r in rows if r["avgSeconds"]]
    return {
        "stations": rows,
        "overallAvgSeconds": round(sum(overall) / len(overall)) if overall else None,
        "generatedAt": now_iso(),
    }


@api_router.post("/demo/reset")
async def demo_reset():
    await seed(force=True)
    await hub.broadcast("data.reset", {"at": now_iso()})
    return {"ok": True}


@api_router.post("/demo/delay/{order_id}")
async def demo_delay(order_id: str):
    doc = await _get_order(order_id)
    created = datetime.now(timezone.utc).timestamp() - 16 * 60
    await db.orders.update_one(
        {"_id": doc["_id"]},
        {"$set": {"createdAt": datetime.fromtimestamp(created, timezone.utc).isoformat(), "priority": "urgent"}},
    )
    out = order_out(await db.orders.find_one({"_id": doc["_id"]}))
    await hub.broadcast("order.updated", out, branch_id=out.get("branchId"))
    return out


@app.websocket("/api/ws")
async def ws_endpoint(ws: WebSocket, device: Optional[str] = None, branch_id: Optional[str] = None):
    # `device` (the paired device token) is the real, secure way to scope a
    # connection - the server resolves branch_id itself rather than trusting
    # a client-supplied value. `branch_id` remains as a fallback for local/
    # demo use without pairing (native browser WebSocket can't set custom
    # headers, so query params are the only option here, unlike HTTP calls
    # which use X-KDS-Device - see get_branch_context()).
    resolved_branch_id = branch_id
    if device:
        pairing = await db.pairing.find_one({"_id": device})
        if pairing:
            resolved_branch_id = pairing["branchId"]
    await hub.connect(ws, resolved_branch_id)
    try:
        while True:
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=25)
            except asyncio.TimeoutError:
                await ws.send_json({"event": "ping", "payload": now_iso()})
    except WebSocketDisconnect:
        hub.disconnect(ws)
    except Exception:
        hub.disconnect(ws)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
