"""BhojPe KDS backend regression tests (iteration 2)."""
import asyncio
import json
import os
import time

import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to reading frontend/.env because backend tests need public url
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except FileNotFoundError:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL missing"

API = f"{BASE_URL}/api"
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"


@pytest.fixture(scope="module", autouse=True)
def reset_seed():
    # ensure a known seeded state
    r = requests.post(f"{API}/demo/reset", timeout=30)
    assert r.status_code == 200
    yield


# ---------- health / meta ----------
def test_health():
    r = requests.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("server") == "connected"
    assert d.get("pos") == "connected"


def test_pair():
    r = requests.post(f"{API}/pair", json={"syncCode": "BHP-8F42-K91", "posCode": "POS-7F42A9"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["server"] == "BhojPe Server"
    assert isinstance(d["stations"], list) and len(d["stations"]) >= 5


# ---------- orders (seed) ----------
def test_list_orders_seeded():
    r = requests.get(f"{API}/orders", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) >= 10
    sample = data[0]
    # No ObjectId leakage
    assert "_id" not in sample
    assert isinstance(sample["id"], str) and len(sample["id"]) == 24
    assert isinstance(sample["kot"], int)
    # ISO createdAt
    assert "T" in sample["createdAt"]


def test_menu_seeded_and_chicken_biryani_unavailable():
    r = requests.get(f"{API}/menu", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 12
    cb = [m for m in data if m["name"] == "Chicken Biryani"]
    assert cb and cb[0]["available"] is False


# ---------- POS create ----------
def test_pos_create_random_increments_kot():
    before = requests.get(f"{API}/orders").json()
    max_kot_before = max(o["kot"] for o in before)
    r = requests.post(f"{API}/pos/orders/random", timeout=15)
    assert r.status_code == 200
    o = r.json()
    assert o["kot"] > max_kot_before
    assert o["status"] == "new"


def test_pos_create_explicit():
    body = {
        "type": "dine-in",
        "table": "Table 3",
        "station": "Main Kitchen",
        "items": [{"qty": 1, "name": "TEST_Explicit Dish"}],
    }
    r = requests.post(f"{API}/pos/orders", json=body, timeout=15)
    assert r.status_code == 200
    o = r.json()
    assert o["table"] == "Table 3"
    assert o["items"][0]["name"] == "TEST_Explicit Dish"


# ---------- status transitions ----------
def _new_order():
    r = requests.post(f"{API}/pos/orders", json={
        "type": "takeaway", "station": "Tandoor",
        "items": [{"qty": 1, "name": "TEST_Status"}]
    })
    return r.json()


def test_status_stamps_and_recall_clears():
    o = _new_order()
    oid = o["id"]

    r = requests.patch(f"{API}/orders/{oid}/status", json={"status": "cooking"})
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "cooking" and d["startedAt"]

    r = requests.patch(f"{API}/orders/{oid}/status", json={"status": "ready"})
    d = r.json()
    assert d["status"] == "ready" and d["readyAt"]

    r = requests.patch(f"{API}/orders/{oid}/status", json={"status": "completed"})
    d = r.json()
    assert d["status"] == "completed" and d["completedAt"]

    # RECALL: completed -> cooking should clear readyAt + completedAt
    r = requests.patch(f"{API}/orders/{oid}/status", json={"status": "cooking"})
    d = r.json()
    assert d["status"] == "cooking"
    assert d["readyAt"] is None
    assert d["completedAt"] is None


def test_status_invalid_400():
    o = _new_order()
    r = requests.patch(f"{API}/orders/{o['id']}/status", json={"status": "banana"})
    assert r.status_code == 400


def test_status_unknown_id_404():
    r = requests.patch(f"{API}/orders/507f1f77bcf86cd799439011/status", json={"status": "cooking"})
    assert r.status_code == 404


def test_status_bad_objectid_404():
    r = requests.patch(f"{API}/orders/not-an-id/status", json={"status": "cooking"})
    assert r.status_code == 404


# ---------- item tick ----------
def test_item_toggle_and_out_of_range():
    o = requests.post(f"{API}/pos/orders", json={
        "type": "dine-in", "station": "Tandoor",
        "items": [{"qty": 1, "name": "TEST_A"}, {"qty": 2, "name": "TEST_B"}]
    }).json()
    oid = o["id"]
    r = requests.patch(f"{API}/orders/{oid}/items/0", json={"done": True})
    assert r.status_code == 200
    assert r.json()["items"][0]["done"] is True

    r = requests.patch(f"{API}/orders/{oid}/items/0", json={"done": False})
    assert r.json()["items"][0]["done"] is False

    r = requests.patch(f"{API}/orders/{oid}/items/9", json={"done": True})
    assert r.status_code == 404


# ---------- priority / delete / menu / demo ----------
def test_priority_update():
    o = _new_order()
    r = requests.patch(f"{API}/orders/{o['id']}/priority", json={"priority": "urgent"})
    assert r.status_code == 200
    assert r.json()["priority"] == "urgent"


def test_delete_order():
    o = _new_order()
    r = requests.delete(f"{API}/orders/{o['id']}")
    assert r.status_code == 200
    # verify gone
    all_ids = [x["id"] for x in requests.get(f"{API}/orders").json()]
    assert o["id"] not in all_ids


def test_menu_patch_returns_syncedToPOS():
    menu = requests.get(f"{API}/menu").json()
    item = menu[0]
    r = requests.patch(f"{API}/menu/{item['id']}", json={"available": not item["available"]})
    assert r.status_code == 200
    d = r.json()
    assert d.get("syncedToPOS") is True
    assert d["available"] == (not item["available"])
    # restore
    requests.patch(f"{API}/menu/{item['id']}", json={"available": item["available"]})


def test_demo_delay_marks_urgent_and_ages():
    o = _new_order()
    r = requests.post(f"{API}/demo/delay/{o['id']}")
    assert r.status_code == 200
    d = r.json()
    assert d["priority"] == "urgent"
    # created should be ~16 minutes ago
    from datetime import datetime, timezone
    created = datetime.fromisoformat(d["createdAt"])
    age_min = (datetime.now(timezone.utc) - created).total_seconds() / 60
    assert 15 <= age_min <= 17


# ---------- prep time stats ----------
def test_prep_time_updates_after_cook_to_ready():
    stats0 = requests.get(f"{API}/stats/prep-time").json()
    assert "stations" in stats0

    o = requests.post(f"{API}/pos/orders", json={
        "type": "dine-in", "station": "Bar",
        "items": [{"qty": 1, "name": "TEST_Prep"}]
    }).json()
    requests.patch(f"{API}/orders/{o['id']}/status", json={"status": "cooking"})
    time.sleep(1.2)
    requests.patch(f"{API}/orders/{o['id']}/status", json={"status": "ready"})

    stats1 = requests.get(f"{API}/stats/prep-time").json()
    bar_row = [r for r in stats1["stations"] if r["station"] == "Bar"]
    assert bar_row and bar_row[0]["completedCount"] >= 1
    assert bar_row[0]["avgSeconds"] is not None
    assert stats1["overallAvgSeconds"] is not None


# ---------- websocket ----------
@pytest.mark.asyncio
async def test_ws_receives_order_created():
    received = []
    async with websockets.connect(
        WS_URL, open_timeout=30,
        additional_headers={"Origin": BASE_URL},
    ) as ws:
        # trigger event AFTER connection is established
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: requests.post(f"{API}/pos/orders/random", timeout=15)
        )
        # collect up to 5s worth of messages
        end = time.time() + 6
        while time.time() < end:
            try:
                remaining = max(0.1, end - time.time())
                msg = await asyncio.wait_for(ws.recv(), timeout=remaining)
                received.append(json.loads(msg))
                if any(m.get("event") == "order.created" for m in received):
                    break
            except asyncio.TimeoutError:
                break
    events = [m.get("event") for m in received]
    assert "order.created" in events, f"got events={events}"
