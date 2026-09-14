import { cleanQuoteTitle } from "./quote-title";

export type PdfPlan = {
  id: string; name: string; logo_url: string | null; main_hospitals: string | null;
  copay_description: string | null;
  insurer: { trade_name: string | null; legal_name: string | null; logo_url: string | null } | null;
};
export type PdfRow = { label: string; lives: number; prices: Record<string, { ward: number | null; apartment: number | null }> };
export type PdfOption = { plan: PdfPlan; showWard: boolean; showApartment: boolean };
export type PdfInput = {
  clientName: string; whatsapp: string; code: string; mode: string;
  brokerLogo: string | null; options: PdfOption[]; rows: PdfRow[];
};
type Column = { plan: PdfPlan; value: "ward" | "apartment"; accommodation: string; total: number };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[ch]!);
}
function insurerName(plan: PdfPlan) { return plan.insurer?.trade_name || plan.insurer?.legal_name || "Operadora não informada"; }
function image(url: string | null | undefined, name: string, className: string) {
  if (!url || !/^(https?:\/\/|\/(?!\/)|data:image\/(png|jpeg|webp);base64,)/i.test(url)) return "";
  return `<img class="${className}" src="${escapeHtml(url)}" alt="${escapeHtml(name)}">`;
}
function copay(value: string | null) {
  if (!value?.trim() || /sem\s+coparticipa/i.test(value)) return "Sem coparticipação";
  return /total/i.test(value) ? "Copart. total" : "Copart. parcial";
}
export function groupedColumns(options: PdfOption[], rows: PdfRow[]): [string, Column[]][] {
  const groups = new Map<string, Column[]>();
  for (const { plan, showWard, showApartment } of options) {
    const name = insurerName(plan);
    const columns = groups.get(name) ?? [];
    for (const value of ["ward", "apartment"] as const) {
      if (!(value === "ward" ? showWard : showApartment)) continue;
      columns.push({ plan, value, accommodation: value === "ward" ? "Enfermaria" : "Apartamento", total: rows.reduce((sum, row) => sum + (row.prices[plan.id]?.[value] ?? 0), 0) });
    }
    if (columns.length) groups.set(name, columns);
  }
  const minimum = (columns: Column[]) => Math.min(...columns.map(column => column.total));
  return [...groups.entries()].sort((a, b) => minimum(a[1]) - minimum(b[1]) || a[0].localeCompare(b[0], "pt-BR"))
    .map(([name, columns]) => [name, columns.sort((a, b) => a.total - b.total || a.plan.name.localeCompare(b.plan.name, "pt-BR"))]);
}
export function buildQuotePdf(input: PdfInput): string {
  const groups = groupedColumns(input.options, input.rows);
  const allColumns = groups.flatMap(([, columns]) => columns);
  const broker = image(input.brokerLogo, "MAIS Consultoria", "broker-logo");
  const clientName = cleanQuoteTitle(input.clientName) || "Cliente não informado";
  const ages = input.rows.map(row => `${row.label} (${row.lives} vida${row.lives === 1 ? "" : "s"})`).join(" · ");
  const contact = "Nome: Mauro Fernando Melo - MAIS Consultoria de planos de saúde Recife - WhatsApp (81) 98237-8786";
  const valuePages: string[] = [];
  // Continue on another landscape page instead of silently omitting columns after ten.
  for (let offset = 0; offset < allColumns.length; offset += 10) {
    const columns = allColumns.slice(offset, offset + 10);
    const row = (label: string, render: (column: Column) => string, className = "") => `<tr class="${className}"><th scope="row">${label}</th>${columns.map(column => `<td>${render(column)}</td>`).join("")}</tr>`;
    const table = `<table class="comparison"><colgroup><col style="width:14%">${columns.map(() => `<col style="width:${86 / columns.length}%">`).join("")}</colgroup><tbody>` +
      row("Operadora", ({ plan }) => image(plan.logo_url || plan.insurer?.logo_url, insurerName(plan), "plan-logo") || escapeHtml(insurerName(plan)), "logos") +
      row("Produto", ({ plan }) => `<b>${escapeHtml(plan.name)}</b>`) +
      row("Acomodação", ({ accommodation }) => accommodation) +
      row("Coparticipação", ({ plan }) => escapeHtml(copay(plan.copay_description))) +
      input.rows.map(band => row(`${escapeHtml(band.label)} (${band.lives})`, ({ plan, value }) => money.format(band.prices[plan.id]?.[value] ?? 0))).join("") +
      row("TOTAL", ({ total }) => money.format(total), "total") + `</tbody></table>`;
    valuePages.push(`<section class="sheet values-page">${broker}<header class="pdf-header"><h1>Comparativo de valores de planos de saúde</h1><p class="customer">Titular: ${escapeHtml(clientName)} &nbsp; | &nbsp; WhatsApp: ${escapeHtml(input.whatsapp || "Não informado")}</p><p class="ages">${escapeHtml(ages)}</p><p class="details">Cotação ${escapeHtml(input.code)} &nbsp; | &nbsp; Modalidade: ${escapeHtml(input.mode)}</p></header><div class="values-content"><p class="eyebrow">PLANOS ORGANIZADOS POR OPERADORA${offset ? " · CONTINUAÇÃO" : ""}</p>${table}<p class="disclaimer">Somos representantes autorizados pelas operadoras de planos. Intermediamos a contratação e os valores e informações podem mudar a qualquer momento sem aviso prévio.</p><p class="pdf-contact">${contact}</p></div></section>`);
  }
  const networkPages: string[] = [];
  for (let offset = 0; offset < groups.length; offset += 4) {
    const cards = groups.slice(offset, offset + 4).map(([name, columns]) => {
      const first = columns[0].plan;
      const entries = columns.map(({ plan, accommodation }) => `<div class="network-plan"><h3>${escapeHtml(plan.name)} | ${accommodation}</h3>${plan.main_hospitals?.trim() ? `<p>${escapeHtml(plan.main_hospitals).replace(/\r?\n/g, "<br>")}</p>` : `<p class="blank-hospitals">Hospitais: <span></span></p>`}</div>`).join("");
      return `<article class="operator-card"><header class="operator-heading">${image(first.insurer?.logo_url || first.logo_url, name, "operator-logo")}<h2>${escapeHtml(name)}</h2></header>${entries}</article>`;
    }).join("");
    networkPages.push(`<section class="sheet network-page">${broker}<header class="pdf-header"><h1>Principais Credenciados</h1><p class="customer">Rede de atendimento por operadora e plano</p></header><div class="network-grid">${cards}</div></section>`);
  }
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comparativo de valores de planos de saúde - ${escapeHtml(clientName)}</title><style>
@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;color:#142b48;font-family:Arial,sans-serif;font-size:9pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{position:relative;min-height:192mm;padding:8mm 2mm 4mm;break-after:page}.sheet:last-child{break-after:auto}.broker-logo{position:absolute;top:0;left:2mm;width:30mm;height:13.5mm;object-fit:contain;object-position:left top}.pdf-header{text-align:center;border-bottom:1.5pt solid #1469cb;padding-bottom:6mm}h1{font-size:22pt;line-height:1.15;margin:0 32mm 6mm;font-weight:700}.customer{font-size:11pt;line-height:1.4;margin:0 32mm 5mm}.ages{font-size:9pt;line-height:1.6;max-width:210mm;margin:0 auto 5mm;color:#52677e}.details{font-size:8pt;color:#52677e;margin:0}.values-content{margin-top:9mm}.eyebrow{font-size:8pt;font-weight:700;color:#1469cb;margin:0 0 3mm}.comparison{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.2pt}.comparison th,.comparison td{border:.4pt solid #d8e2ed;padding:2.6mm 1mm;text-align:center;vertical-align:middle;overflow-wrap:anywhere}.comparison th{text-align:left;font-weight:700}.comparison tr:nth-child(odd){background:#f3f7fb}.comparison .logos{background:white}.plan-logo{display:block;margin:auto;width:18mm;height:8mm;object-fit:contain}.comparison .total{background:#1469cb;color:white;font-weight:700}.total td{white-space:nowrap}.disclaimer{font-size:7.5pt;line-height:1.4;color:#52677e;text-align:center;margin:5mm 0 3mm}.pdf-contact{text-align:center;font-size:8pt;line-height:1.4;font-weight:700;margin:0}.network-grid{display:grid;grid-template-columns:1fr 1fr;gap:6mm 10mm;margin-top:10mm;align-items:stretch}.operator-card{border:.5pt solid #d8e2ed;border-radius:3mm;background:#f3f7fb;padding:4mm;min-height:60mm;break-inside:avoid}.operator-heading{display:flex;align-items:center;gap:5mm;border-bottom:.5pt solid #d8e2ed;padding-bottom:3mm;margin-bottom:3mm}.operator-logo{width:18mm;height:8mm;object-fit:contain;object-position:left center}.operator-heading h2{font-size:11pt;margin:0}.network-plan{break-inside:avoid;padding:1mm 0 2mm}.network-plan+.network-plan{border-top:.5pt solid #d8e2ed}.network-plan h3{font-size:9pt;margin:0 0 2mm}.network-plan p{font-size:7.2pt;line-height:1.5;margin:0;overflow-wrap:anywhere}.blank-hospitals{display:flex;gap:3mm;color:#52677e}.blank-hospitals span{flex:1;border-bottom:.5pt solid #d8e2ed}.network-page .pdf-header{padding-bottom:5mm}.network-page .customer{margin-bottom:0}tr{break-inside:avoid}
</style></head><body>${valuePages.join("")}${networkPages.join("")}</body></html>`;
}

export async function printQuoteDocument(printWindow: Window, html: string): Promise<void> {
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  const images = Array.from(printWindow.document.images);
  await Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise<void>(resolve => {
    const timer = window.setTimeout(resolve, 8000);
    const done = () => { window.clearTimeout(timer); resolve(); };
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  })));
  await printWindow.document.fonts.ready;
  if (!printWindow.closed) { printWindow.focus(); printWindow.print(); }
}
