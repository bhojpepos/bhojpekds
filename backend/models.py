from datetime import datetime, timezone
from typing import Annotated, List, Optional

from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def _to_str_id(v):
    if isinstance(v, ObjectId):
        return str(v)
    return v


PyObjectId = Annotated[str, BeforeValidator(_to_str_id)]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    def to_mongo(self) -> dict:
        doc = self.model_dump(by_alias=True, exclude_none=True)
        doc.pop("_id", None)
        return doc

    @classmethod
    def from_mongo(cls, doc: dict):
        if doc is None:
            return None
        return cls.model_validate(doc)


class OrderItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    qty: int = 1
    name: str
    note: Optional[str] = None
    done: bool = False


# Same vocabulary as billing's orders.source / print_rules.order_source enum
# (see billing/database/migrations/2026_08_30_100002_add_source_to_orders_table.php)
# — kept identical on purpose so the two systems never drift into separate
# mappings. online_swiggy/online_zomato are accepted but won't appear in real
# data yet: no aggregator webhook integration exists anywhere in billing today.
ORDER_SOURCES = (
    "pos_dinein",
    "pos_pickup",
    "pos_delivery",
    "captain_app",
    "online_swiggy",
    "online_zomato",
    "online_website",
    "kiosk",
)


class Order(BaseDocument):
    kot: int
    type: str = "dine-in"          # dine-in | takeaway | delivery | pickup
    table: Optional[str] = None
    refNo: Optional[str] = None
    status: str = "new"            # new | cooking | ready | completed
    priority: str = "normal"       # normal | high | urgent
    station: str = "Main Kitchen"
    note: Optional[str] = None
    items: List[OrderItem] = []
    handoffs: List[dict] = []
    createdAt: str = Field(default_factory=now_iso)
    startedAt: Optional[str] = None
    readyAt: Optional[str] = None
    completedAt: Optional[str] = None

    # --- multi-tenant / billing-integration fields (Phase 0) ---
    branchId: Optional[str] = None
    tenantId: Optional[str] = None
    source: Optional[str] = None            # one of ORDER_SOURCES
    createdByName: Optional[str] = None     # e.g. "Captain Rahul", set for captain_app orders
    billingOrderId: Optional[str] = None
    billingOrderItemIds: List[str] = []
    kitchenId: Optional[str] = None         # billing Kitchen id, needed for status push-back


class MenuItem(BaseDocument):
    name: str
    station: str = "Main Kitchen"
    available: bool = True

    # --- multi-tenant / billing-integration fields (Phase 0) ---
    branchId: Optional[str] = None
    billingItemId: Optional[str] = None


class OrderCreate(BaseModel):
    type: str = "dine-in"
    table: Optional[str] = None
    refNo: Optional[str] = None
    station: str = "Main Kitchen"
    priority: str = "normal"
    note: Optional[str] = None
    items: List[OrderItem] = []

    # --- multi-tenant / billing-integration fields (Phase 0) ---
    # Present when the order is pushed in from billing (Phase 2); absent for
    # locally-created demo orders, which keep using next_kot()/DEMO branch scoping.
    branchId: Optional[str] = None
    tenantId: Optional[str] = None
    kot: Optional[int] = None               # billing's real per-branch-per-day KOT number, if provided
    source: Optional[str] = None
    createdByName: Optional[str] = None
    billingOrderId: Optional[str] = None
    billingOrderItemIds: List[str] = []
    kitchenId: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str


class PriorityUpdate(BaseModel):
    priority: str


class ItemDoneUpdate(BaseModel):
    done: bool


class AvailabilityUpdate(BaseModel):
    available: bool


class PrintJob(BaseDocument):
    orderId: str
    kot: int
    station: str
    status: str = "queued"          # queued | printed | failed
    copies: int = 1
    lines: List[str] = []
    createdAt: str = Field(default_factory=now_iso)
    printedAt: Optional[str] = None
    reason: Optional[str] = None
    branchId: Optional[str] = None


class StationUpdate(BaseModel):
    station: str
    reason: Optional[str] = None


class KdsConfig(BaseDocument):
    printerHost: Optional[str] = None
    printerPort: int = 9100
    printerEnabled: bool = False
    recapEmail: Optional[str] = None
    slaMinutes: int = 10
    lastRecapAt: Optional[str] = None


class ConfigUpdate(BaseModel):
    printerHost: Optional[str] = None
    printerPort: Optional[int] = None
    printerEnabled: Optional[bool] = None
    recapEmail: Optional[str] = None
    slaMinutes: Optional[int] = None


class PairRequest(BaseModel):
    syncCode: str
    # Short-lived (5 min) Pair Code the owner generates from bhojpe-poss's
    # Connected Devices screen - required alongside syncCode, see
    # KdsController::pair()'s docblock for why pairing needs both.
    pairCode: str
    # Stable per-browser id (frontend generates + persists this once) so
    # re-pairing the same physical screen updates billing's Device row
    # instead of creating a duplicate one each time.
    deviceIdentifier: Optional[str] = None
    deviceName: Optional[str] = None
