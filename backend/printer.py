"""ESC/POS network printer driver (raw TCP, port 9100 by default)."""
import asyncio
from typing import List, Optional

ESC = b"\x1b"
GS = b"\x1d"


def build_escpos(lines: List[str], copies: int = 1) -> bytes:
    out = bytearray()
    for _ in range(max(1, copies)):
        out += ESC + b"@"                     # init
        out += ESC + b"a" + b"\x01"           # center
        out += ESC + b"!" + b"\x38"           # double width/height, bold
        out += lines[0].encode("cp437", "replace") + b"\n" if lines else b""
        out += ESC + b"!" + b"\x30"
        if len(lines) > 1:
            out += lines[1].encode("cp437", "replace") + b"\n"
        out += ESC + b"!" + b"\x00"           # normal
        out += ESC + b"a" + b"\x00"           # left
        for line in lines[2:]:
            out += ESC + b"E" + b"\x01"       # bold on
            out += line.encode("cp437", "replace") + b"\n"
            out += ESC + b"E" + b"\x00"
        out += b"\n\n\n"
        out += GS + b"V" + b"\x42" + b"\x00"  # partial cut
    return bytes(out)


async def probe_printer(host: str, port: int, timeout: float = 4.0) -> Optional[str]:
    """TCP reachability probe without sending any print data."""
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=timeout)
        writer.close()
        try:
            await asyncio.wait_for(writer.wait_closed(), timeout=timeout)
        except asyncio.TimeoutError:
            pass
        return None
    except asyncio.TimeoutError:
        return f"No response from {host}:{port}"
    except OSError as e:
        return f"{host}:{port} unreachable ({e.__class__.__name__})"


async def send_to_printer(host: str, port: int, payload: bytes, timeout: float = 5.0) -> Optional[str]:
    """Returns None on success, or an error string."""
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=timeout)
        writer.write(payload)
        await asyncio.wait_for(writer.drain(), timeout=timeout)
        writer.close()
        try:
            await asyncio.wait_for(writer.wait_closed(), timeout=timeout)
        except asyncio.TimeoutError:
            pass
        return None
    except asyncio.TimeoutError:
        return f"Printer {host}:{port} timed out"
    except OSError as e:
        return f"Printer {host}:{port} unreachable ({e.__class__.__name__})"
    except Exception as e:  # pragma: no cover
        return f"Printer error: {e}"
