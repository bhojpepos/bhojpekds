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


class MenuItem(BaseDocument):
    name: str
    station: str = "Main Kitchen"
    available: bool = True


class OrderCreate(BaseModel):
    type: str = "dine-in"
    table: Optional[str] = None
    refNo: Optional[str] = None
    station: str = "Main Kitchen"
    priority: str = "normal"
    note: Optional[str] = None
    items: List[OrderItem] = []


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


class StationUpdate(BaseModel):
    station: str
    reason: Optional[str] = None


class PairRequest(BaseModel):
    syncCode: Optional[str] = None
    posCode: Optional[str] = None
