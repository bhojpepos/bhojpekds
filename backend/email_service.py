"""Managed Resend email sending (Emergent integration proxy) + shift recap template."""
import ipaddress
import logging
import os
import re
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()
logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Failed to send email")
    except Exception as e:
        logger.error(f"Email send error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email")


def _fmt(seconds) -> str:
    if not seconds:
        return "-"
    m, s = divmod(int(seconds), 60)
    return f"{m}m {s:02d}s" if m else f"{s}s"


def shift_recap_html(summary: dict, branch: str, station: str) -> str:
    """Server-side template only — no caller-supplied markup (G4)."""
    def row(label, value):
        return (f'<tr><td style="padding:6px 0;font-size:14px;color:#555">{escape(str(label))}</td>'
                f'<td style="padding:6px 0;font-size:14px;font-weight:700;text-align:right">{escape(str(value))}</td></tr>')

    slow = "".join(row(d["name"], _fmt(d["avgSeconds"])) for d in summary.get("slowestDishes", [])) or row("Not enough data", "-")
    top = "".join(row(d["name"], f'{d["qty"]} sold') for d in summary.get("topDishes", [])) or row("No orders", "-")
    stations = "".join(row(k, v) for k, v in (summary.get("byStation") or {}).items()) or row("No orders", "-")

    return f"""<table role="presentation" width="100%" style="background:#f7f7f7;padding:24px">
<tr><td align="center">
<table role="presentation" width="600" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:6px">
  <tr><td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;font-family:Arial,sans-serif">
    <div style="font-size:20px;font-weight:800;color:#2c2c2c">{escape(EMAIL_FROM_NAME)}</div>
    <div style="font-size:13px;color:#888">Shift recap &middot; {escape(branch)} &middot; {escape(station)} &middot; last {int(summary.get("hours", 12))}h</div>
  </td></tr>
  <tr><td style="padding:20px 24px;font-family:Arial,sans-serif">
    <table width="100%" role="presentation">
      {row("Orders served", summary.get("ordersServed", 0))}
      {row("Orders received", summary.get("ordersTotal", 0))}
      {row("Items served", summary.get("itemsServed", 0))}
      {row("Average prep time", _fmt(summary.get("avgPrepSeconds")))}
    </table>
    <div style="margin:18px 0 6px;font-size:12px;font-weight:700;letter-spacing:1px;color:#888">SLOWEST DISHES</div>
    <table width="100%" role="presentation">{slow}</table>
    <div style="margin:18px 0 6px;font-size:12px;font-weight:700;letter-spacing:1px;color:#888">MOST ORDERED</div>
    <table width="100%" role="presentation">{top}</table>
    <div style="margin:18px 0 6px;font-size:12px;font-weight:700;letter-spacing:1px;color:#888">BY STATION</div>
    <table width="100%" role="presentation">{stations}</table>
  </td></tr>
  <tr><td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:12px;color:#888">
    Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.
  </td></tr>
</table>
</td></tr></table>"""
