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


# ============================================================
# Iteration 3: print queue, station handoff, rush, shift stats
# ============================================================

def test_pos_order_auto_queues_print_job_with_ticket_lines():
    # reset print queue by hitting demo/reset so we know newest job is ours
    requests.post(f"{API}/demo/reset", timeout=30)
    o = requests.post(f"{API}/pos/orders", json={
        "type": "dine-in", "table": "Table 9", "station": "Tandoor",
        "items": [{"qty": 2, "name": "TEST_TicketDish", "note": "Spicy"}],
    }).json()
    time.sleep(0.3)
    jobs = requests.get(f"{API}/print/jobs", params={"status": "queued"}).json()
    assert jobs, "no queued print jobs"
    # newest first -> our order should be first
    job = next((j for j in jobs if j["kot"] == o["kot"]), None)
    assert job, f"no queued job for kot {o['kot']}"
    assert job["station"] == "Tandoor"
    assert job["status"] == "queued"
    assert isinstance(job["lines"], list) and len(job["lines"]) > 0
    joined = "\n".join(job["lines"])
    assert "BhojPe" in joined
    assert f"KOT / TOKEN  {o['kot']}" in joined or f"KOT / TOKEN {o['kot']}" in joined
    assert "STATION: Tandoor" in joined
    assert "2 x TEST_TicketDish" in joined


def test_pos_orders_random_also_queues_print():
    before = requests.get(f"{API}/print/jobs").json()
    r = requests.post(f"{API}/pos/orders/random", timeout=15)
    assert r.status_code == 200
    o = r.json()
    time.sleep(0.3)
    after = requests.get(f"{API}/print/jobs").json()
    assert len(after) == len(before) + 1
    assert after[0]["kot"] == o["kot"]


def test_print_jobs_filter_and_manual_reprint():
    o = _new_order()
    r = requests.post(f"{API}/print/kot/{o['id']}", timeout=15)
    assert r.status_code == 200
    job = r.json()
    assert job["reason"] == "Manual reprint"
    assert job["status"] == "queued"
    assert job["kot"] == o["kot"]
    # ?status=queued filter
    queued = requests.get(f"{API}/print/jobs", params={"status": "queued"}).json()
    assert all(j["status"] == "queued" for j in queued)


def test_print_job_ack_and_retry_flow():
    o = _new_order()
    j = requests.post(f"{API}/print/kot/{o['id']}").json()
    jid = j["id"]
    # ack
    r = requests.post(f"{API}/print/jobs/{jid}/ack")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "printed"
    assert d["printedAt"]
    # retry -> back to queued
    r = requests.post(f"{API}/print/jobs/{jid}/retry")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "queued"
    assert d["printedAt"] is None


def test_print_job_unknown_id_404():
    r = requests.post(f"{API}/print/jobs/507f1f77bcf86cd799439011/ack")
    assert r.status_code == 404
    r = requests.post(f"{API}/print/jobs/not-an-id/retry")
    assert r.status_code == 404


def test_manual_print_unknown_order_404():
    r = requests.post(f"{API}/print/kot/507f1f77bcf86cd799439011")
    assert r.status_code == 404


# ---------- station handoff ----------
def test_station_handoff_moves_and_records_and_queues_print():
    o = requests.post(f"{API}/pos/orders", json={
        "type": "dine-in", "station": "Bakery",
        "items": [{"qty": 1, "name": "TEST_HandoffDish"}],
    }).json()
    oid = o["id"]
    before_jobs = requests.get(f"{API}/print/jobs").json()

    r = requests.patch(f"{API}/orders/{oid}/station",
                       json={"station": "Tandoor", "reason": "wrong station"})
    assert r.status_code == 200
    d = r.json()
    assert d["station"] == "Tandoor"
    assert d["handoffs"] and d["handoffs"][-1]["from"] == "Bakery"
    assert d["handoffs"][-1]["to"] == "Tandoor"
    assert d["handoffs"][-1]["reason"] == "wrong station"

    # print job auto-queued with handoff reason
    time.sleep(0.3)
    after_jobs = requests.get(f"{API}/print/jobs").json()
    assert len(after_jobs) >= len(before_jobs) + 1
    hj = next((j for j in after_jobs if j["kot"] == o["kot"] and j.get("reason", "").startswith("Handoff")), None)
    assert hj is not None, "no handoff reprint queued"
    assert hj["station"] == "Tandoor"
    assert "Bakery -> Tandoor" in hj["reason"]


def test_station_handoff_same_station_noop():
    o = requests.post(f"{API}/pos/orders", json={
        "type": "dine-in", "station": "Pizza",
        "items": [{"qty": 1, "name": "TEST_NoOpHandoff"}],
    }).json()
    r = requests.patch(f"{API}/orders/{o['id']}/station", json={"station": "Pizza"})
    assert r.status_code == 200
    d = r.json()
    # no handoff entry added
    assert not d.get("handoffs")


def test_station_handoff_unknown_order_404():
    r = requests.patch(f"{API}/orders/507f1f77bcf86cd799439011/station",
                       json={"station": "Tandoor"})
    assert r.status_code == 404


# ---------- rush stats ----------
def test_rush_stats_shape_and_escalation():
    r = requests.get(f"{API}/stats/rush")
    assert r.status_code == 200
    d = r.json()
    for k in ("level", "activeCount", "delayedCount", "behindSeconds",
              "oldestSeconds", "ordersLastHour", "targetSeconds"):
        assert k in d
    assert d["targetSeconds"] == 600
    assert d["level"] in ("on-track", "busy", "rush")

    # age several active orders to force rush
    active = [o for o in requests.get(f"{API}/orders").json()
              if o["status"] in ("new", "cooking")]
    assert len(active) >= 4
    for o in active[:5]:
        requests.post(f"{API}/demo/delay/{o['id']}")
    d2 = requests.get(f"{API}/stats/rush").json()
    assert d2["delayedCount"] >= 4
    assert d2["level"] == "rush"


# ---------- shift summary ----------
def test_shift_summary_shape_and_updates():
    # baseline
    r = requests.get(f"{API}/stats/shift", params={"hours": 24})
    assert r.status_code == 200
    d = r.json()
    for k in ("hours", "ordersTotal", "ordersServed", "itemsServed",
              "avgPrepSeconds", "byType", "byStation", "slowestDishes", "topDishes"):
        assert k in d
    assert d["hours"] == 24
    assert len(d["slowestDishes"]) <= 5
    assert len(d["topDishes"]) <= 5

    # 6h window returns hours=6
    r6 = requests.get(f"{API}/stats/shift", params={"hours": 6}).json()
    assert r6["hours"] == 6

    # after cook->ready, ordersServed grows
    before = requests.get(f"{API}/stats/shift", params={"hours": 24}).json()["ordersServed"]
    o = requests.post(f"{API}/pos/orders", json={
        "type": "takeaway", "station": "Bar",
        "items": [{"qty": 1, "name": "TEST_ShiftDish"}],
    }).json()
    requests.patch(f"{API}/orders/{o['id']}/status", json={"status": "cooking"})
    time.sleep(1.1)
    requests.patch(f"{API}/orders/{o['id']}/status", json={"status": "ready"})
    after = requests.get(f"{API}/stats/shift", params={"hours": 24}).json()
    assert after["ordersServed"] >= before + 1
    # slowestDishes sorted desc
    slow = after["slowestDishes"]
    if len(slow) >= 2:
        assert slow[0]["avgSeconds"] >= slow[1]["avgSeconds"]


# ---------- demo reset clears print jobs ----------
def test_demo_reset_clears_print_jobs():
    # queue something
    o = _new_order()
    requests.post(f"{API}/print/kot/{o['id']}")
    assert len(requests.get(f"{API}/print/jobs").json()) > 0
    r = requests.post(f"{API}/demo/reset")
    assert r.status_code == 200
    time.sleep(0.3)
    jobs = requests.get(f"{API}/print/jobs").json()
    assert jobs == [] or all(j.get("kot") for j in jobs) is not None
    # explicitly assert empty
    assert jobs == []


# ---------- websocket print.queued ----------
@pytest.mark.asyncio
async def test_ws_receives_print_queued_on_pos_order():
    received = []
    async with websockets.connect(
        WS_URL, open_timeout=30,
        additional_headers={"Origin": BASE_URL},
    ) as ws:
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: requests.post(f"{API}/pos/orders/random", timeout=15)
        )
        end = time.time() + 6
        while time.time() < end:
            try:
                remaining = max(0.1, end - time.time())
                msg = await asyncio.wait_for(ws.recv(), timeout=remaining)
                received.append(json.loads(msg))
                if any(m.get("event") == "print.queued" for m in received):
                    break
            except asyncio.TimeoutError:
                break
    events = [m.get("event") for m in received]
    assert "print.queued" in events, f"got events={events}"



# ============================================================
# Iteration 5: config, printer, email recap, cron
# ============================================================
import socket

def _reset_config():
    requests.put(f"{API}/config", json={
        "printerHost": "", "printerPort": 9100,
        "printerEnabled": False, "recapEmail": "", "slaMinutes": 10,
    })


def test_config_get_default_shape_no_objectid():
    _reset_config()
    r = requests.get(f"{API}/config")
    assert r.status_code == 200
    d = r.json()
    for k in ("id", "printerHost", "printerPort", "printerEnabled", "recapEmail", "slaMinutes"):
        assert k in d
    assert "_id" not in d
    assert isinstance(d["id"], str)
    assert d["printerPort"] == 9100
    assert d["printerEnabled"] is False
    assert d["slaMinutes"] == 10


def test_config_put_partial_patch_and_ws_broadcast():
    _reset_config()
    r = requests.put(f"{API}/config", json={"slaMinutes": 15})
    assert r.status_code == 200
    d = r.json()
    assert d["slaMinutes"] == 15
    assert d["printerEnabled"] is False  # untouched

    r = requests.put(f"{API}/config", json={"printerHost": "192.168.1.50", "printerEnabled": True})
    d = r.json()
    assert d["printerHost"] == "192.168.1.50"
    assert d["printerEnabled"] is True
    assert d["slaMinutes"] == 15  # still

    # verify persistence
    d2 = requests.get(f"{API}/config").json()
    assert d2["slaMinutes"] == 15
    assert d2["printerHost"] == "192.168.1.50"
    _reset_config()


@pytest.mark.asyncio
async def test_ws_config_updated_broadcast():
    received = []
    async with websockets.connect(
        WS_URL, open_timeout=30, additional_headers={"Origin": BASE_URL},
    ) as ws:
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: requests.put(f"{API}/config", json={"slaMinutes": 12})
        )
        end = time.time() + 5
        while time.time() < end:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=max(0.1, end - time.time()))
                received.append(json.loads(msg))
                if any(m.get("event") == "config.updated" for m in received):
                    break
            except asyncio.TimeoutError:
                break
    events = [m.get("event") for m in received]
    assert "config.updated" in events, f"got events={events}"
    _reset_config()


def test_print_test_400_when_no_host_or_disabled():
    _reset_config()
    r = requests.post(f"{API}/print/test")
    assert r.status_code == 400
    # enable but no host
    requests.put(f"{API}/config", json={"printerEnabled": True, "printerHost": ""})
    r = requests.post(f"{API}/print/test")
    assert r.status_code == 400
    _reset_config()


def test_print_test_unreachable_host_returns_200_ok_false():
    # pick an unroutable RFC5737 address to guarantee timeout in <=6s
    requests.put(f"{API}/config", json={
        "printerHost": "192.0.2.123", "printerPort": 9100, "printerEnabled": True
    })
    t0 = time.time()
    r = requests.post(f"{API}/print/test", timeout=15)
    elapsed = time.time() - t0
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is False
    assert isinstance(d.get("error"), str) and "192.0.2.123" in d["error"]
    assert elapsed < 10, f"took {elapsed}s"
    _reset_config()


def test_pos_order_with_unreachable_printer_marks_failed_and_retry_stays_failed():
    requests.post(f"{API}/demo/reset", timeout=30)
    requests.put(f"{API}/config", json={
        "printerHost": "192.0.2.123", "printerPort": 9100, "printerEnabled": True
    })
    t0 = time.time()
    r = requests.post(f"{API}/pos/orders/random", timeout=20)
    assert r.status_code == 200
    o = r.json()
    assert time.time() - t0 < 15
    time.sleep(0.3)
    jobs = requests.get(f"{API}/print/jobs").json()
    job = next((j for j in jobs if j["kot"] == o["kot"]), None)
    assert job is not None, "job missing"
    assert job["status"] == "failed"
    assert isinstance(job.get("reason"), str) and "192.0.2.123" in job["reason"]

    # retry -> still failed, reason still mentions host
    r = requests.post(f"{API}/print/jobs/{job['id']}/retry", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "failed"
    assert "192.0.2.123" in d["reason"]
    _reset_config()


def test_pos_order_with_printer_disabled_stays_queued():
    _reset_config()
    requests.post(f"{API}/demo/reset", timeout=30)
    r = requests.post(f"{API}/pos/orders/random")
    o = r.json()
    time.sleep(0.3)
    jobs = requests.get(f"{API}/print/jobs").json()
    job = next((j for j in jobs if j["kot"] == o["kot"]), None)
    assert job and job["status"] == "queued"


def test_escpos_payload_shape():
    from importlib import import_module
    import sys
    sys.path.insert(0, "/app/backend")
    printer = import_module("printer")
    payload = printer.build_escpos(["BhojPe", "KOT / TOKEN  9999", "STATION: Tandoor", "1 x TEST"])
    # ESC @ init
    assert payload.startswith(b"\x1b@") or b"\x1b@" in payload[:8]
    # Contains the strings
    assert b"BhojPe" in payload
    assert b"KOT / TOKEN  9999" in payload
    assert b"STATION: Tandoor" in payload
    assert b"1 x TEST" in payload
    # cut command GS V B
    assert b"\x1dV" in payload
    # copies>1 repeats
    p2 = printer.build_escpos(["A", "B", "C"], copies=2)
    assert p2.count(b"\x1b@") == 2


# ---------- cron auth ----------
def test_cron_no_auth_returns_401():
    r = requests.post(f"{API}/cron/shift-recap", timeout=10)
    assert r.status_code == 401


def test_cron_wrong_bearer_returns_401():
    r = requests.post(f"{API}/cron/shift-recap",
                      headers={"Authorization": "Bearer wrong-secret"}, timeout=10)
    assert r.status_code == 401


def test_cron_correct_bearer_and_idempotency():
    secret = "bhojpe_kds_cron_7f42a9_c41d8e2b9a6f4d15"
    webhook_id = f"TEST_cron_{int(time.time() * 1000)}"
    t0 = time.time()
    r = requests.post(f"{API}/cron/shift-recap",
                      headers={"Authorization": f"Bearer {secret}", "X-Webhook-Id": webhook_id},
                      timeout=10)
    elapsed = time.time() - t0
    assert 200 <= r.status_code < 300, r.text
    assert elapsed < 5, f"cron took {elapsed}s"
    d = r.json()
    assert d.get("accepted") is True

    # repeat -> duplicate true
    r2 = requests.post(f"{API}/cron/shift-recap",
                       headers={"Authorization": f"Bearer {secret}", "X-Webhook-Id": webhook_id},
                       timeout=10)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2.get("duplicate") is True


# ---------- email recap ----------
def test_shift_recap_no_recipient_returns_ok_false():
    _reset_config()
    r = requests.post(f"{API}/reports/shift-recap/send", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is False
    assert "reason" in d


def test_shift_recap_sends_to_delivered_and_stamps_lastRecapAt():
    requests.put(f"{API}/config", json={"recapEmail": "delivered@resend.dev"})
    r = requests.post(f"{API}/reports/shift-recap/send", timeout=45)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d.get("emailId")
    cfg = requests.get(f"{API}/config").json()
    assert cfg.get("lastRecapAt")
    _reset_config()
