import asyncio
import logging
import os
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware

from models import (
    AvailabilityUpdate,
    ItemDoneUpdate,
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

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
    def __init__(self):
        self.clients: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.clients:
            self.clients.remove(ws)

    async def broadcast(self, event: str, payload):
        dead = []
        for ws in list(self.clients):
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
    def o(kot, typ, status, age_min, station, items, table=None, refNo=None, priority="normal", note=None):
        created = datetime.now(timezone.utc).timestamp() - age_min * 60
        started = None
        ready = None
        completed = None
        if status in ("cooking", "ready", "completed"):
            started = created + 60
        if status in ("ready", "completed"):
            ready = created + age_min * 30
        if status == "completed":
            completed = created + age_min * 45
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
    ]


async def seed(force: bool = False):
    if force:
        await db.orders.delete_many({})
        await db.menu.delete_many({})
        await db.counters.delete_many({})
        await db.print_jobs.delete_many({})
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
    return {
        "ok": True,
        "deviceId": "KDS-7F42A9",
        "restaurant": "BhojPe Cafe",
        "branch": "Main Branch",
        "server": "BhojPe Server",
        "stations": STATIONS,
        "syncCode": body.syncCode,
        "posCode": body.posCode,
        "lastSync": now_iso(),
    }


@api_router.get("/orders")
async def list_orders(station: Optional[str] = None):
    q = {"station": station} if station else {}
    docs = await db.orders.find(q).sort("kot", -1).to_list(500)
    return [order_out(d) for d in docs]


@api_router.post("/pos/orders")
async def pos_create_order(body: OrderCreate):
    """POS creates an order -> becomes a KOT on the KDS (and queues a printer ticket)."""
    kot = await next_kot()
    order = Order(kot=kot, **body.model_dump())
    res = await db.orders.insert_one(order.to_mongo())
    doc = await db.orders.find_one({"_id": res.inserted_id})
    out = order_out(doc)
    await hub.broadcast("order.created", out)
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


async def _queue_print(order: dict, copies: int = 1, reason: Optional[str] = None):
    job = PrintJob(
        orderId=order["id"],
        kot=order["kot"],
        station=order["station"],
        copies=copies,
        lines=ticket_lines(order),
        reason=reason,
    )
    res = await db.print_jobs.insert_one(job.to_mongo())
    doc = await db.print_jobs.find_one({"_id": res.inserted_id})
    out = PrintJob.from_mongo(doc).model_dump()
    await hub.broadcast("print.queued", out)
    return out


async def _get_order(order_id: str):
    if not ObjectId.is_valid(order_id):
        raise HTTPException(404, "Order not found")
    doc = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not doc:
        raise HTTPException(404, "Order not found")
    return doc


@api_router.patch("/orders/{order_id}/status")
async def set_status(order_id: str, body: StatusUpdate):
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
    await hub.broadcast("order.updated", out)
    return out


@api_router.patch("/orders/{order_id}/priority")
async def set_priority(order_id: str, body: PriorityUpdate):
    doc = await _get_order(order_id)
    await db.orders.update_one({"_id": doc["_id"]}, {"$set": {"priority": body.priority}})
    out = order_out(await db.orders.find_one({"_id": doc["_id"]}))
    await hub.broadcast("order.updated", out)
    return out


@api_router.patch("/orders/{order_id}/items/{index}")
async def set_item_done(order_id: str, index: int, body: ItemDoneUpdate):
    doc = await _get_order(order_id)
    if index < 0 or index >= len(doc.get("items", [])):
        raise HTTPException(404, "Item not found")
    await db.orders.update_one({"_id": doc["_id"]}, {"$set": {f"items.{index}.done": body.done}})
    out = order_out(await db.orders.find_one({"_id": doc["_id"]}))
    await hub.broadcast("order.updated", out)
    return out


@api_router.delete("/orders/{order_id}")
async def clear_order(order_id: str):
    doc = await _get_order(order_id)
    await db.orders.delete_one({"_id": doc["_id"]})
    await hub.broadcast("order.removed", {"id": str(doc["_id"])})
    return {"ok": True, "id": str(doc["_id"])}


@api_router.patch("/orders/{order_id}/station")
async def handoff_station(order_id: str, body: StationUpdate):
    doc = await _get_order(order_id)
    prev = doc.get("station")
    if body.station == prev:
        return order_out(doc)
    entry = {"from": prev, "to": body.station, "at": now_iso(), "reason": body.reason}
    await db.orders.update_one(
        {"_id": doc["_id"]}, {"$set": {"station": body.station}, "$push": {"handoffs": entry}}
    )
    out = order_out(await db.orders.find_one({"_id": doc["_id"]}))
    await hub.broadcast("order.updated", out)
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
    await hub.broadcast("print.updated", out)
    return out


@api_router.post("/print/jobs/{job_id}/retry")
async def retry_print_job(job_id: str):
    doc = await _job(job_id)
    await db.print_jobs.update_one(
        {"_id": doc["_id"]}, {"$set": {"status": "queued", "printedAt": None}}
    )
    out = PrintJob.from_mongo(await db.print_jobs.find_one({"_id": doc["_id"]})).model_dump()
    await hub.broadcast("print.updated", out)
    return out


@api_router.get("/stats/rush")
async def rush_status():
    """Live 'how far behind is the kitchen' indicator."""
    target = 600  # 10 min service target from order creation to ready
    active = await db.orders.find({"status": {"$in": ["new", "cooking"]}}).to_list(1000)
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
    for d in await db.orders.find({}).to_list(1000):
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
async def shift_summary(hours: int = 12):
    since = datetime.now(timezone.utc).timestamp() - hours * 3600
    docs = []
    for d in await db.orders.find({}).to_list(2000):
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
async def list_menu():
    docs = await db.menu.find({}).to_list(500)
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
    await hub.broadcast("menu.updated", out)
    return {**out, "syncedToPOS": True, "syncedAt": now_iso()}


@api_router.get("/stats/prep-time")
async def prep_time():
    """Average cooking time (start -> ready) per station, plus pending load."""
    docs = await db.orders.find({"startedAt": {"$ne": None}, "readyAt": {"$ne": None}}).to_list(1000)
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

    active = await db.orders.find({"status": {"$in": ["new", "cooking"]}}).to_list(1000)
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
    await hub.broadcast("order.updated", out)
    return out


@app.websocket("/api/ws")
async def ws_endpoint(ws: WebSocket):
    await hub.connect(ws)
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
