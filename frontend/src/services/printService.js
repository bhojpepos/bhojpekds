// Sends an 80mm kitchen ticket to the browser/OS print pipeline (kitchen printer).
export function printTicket(job) {
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) return false;
  const body = job.lines.map((l) => `<div>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`).join("");
  w.document.write(`<!doctype html><html><head><title>KOT ${job.kot}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: "Courier New", monospace; font-size: 13px; font-weight: 700; line-height: 1.45; width: 72mm; }
  div:first-child { font-size: 20px; text-align: center; margin-bottom: 4px; }
  div:nth-child(2) { font-size: 22px; text-align: center; margin-bottom: 6px; }
</style></head><body>${body}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
  setTimeout(() => w.close(), 800);
  return true;
}
