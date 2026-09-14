"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type Quote = { id: string; quote_number: number | null; title: string | null; created_at: string };
type Plan = {
  id: string;
  name: string;
  accommodation: string | null;
  logo_url: string | null;
  main_hospitals: string | null;
  insurer: { trade_name: string | null; legal_name: string | null; logo_url: string | null } | null;
};
type PricingRule = {
  pricing_table_id: string;
  age_from: number;
  age_to: number | null;
  ward_monthly_price: number | null;
  apartment_monthly_price: number | null;
};
type QuoteMember = { full_name_snapshot: string | null; birth_date: string };
type PriceCell = { ward: number | null; apartment: number | null };
type CalculatedRow = { label: string; lives: number; prices: Record<string, PriceCell> };
const ageBands = [
  { label: "0 a 18 anos", from: 0, to: 18 }, { label: "19 a 23 anos", from: 19, to: 23 },
  { label: "24 a 28 anos", from: 24, to: 28 }, { label: "29 a 33 anos", from: 29, to: 33 },
  { label: "34 a 38 anos", from: 34, to: 38 }, { label: "39 a 43 anos", from: 39, to: 43 },
  { label: "44 a 48 anos", from: 44, to: 48 }, { label: "49 a 53 anos", from: 49, to: 53 },
  { label: "54 a 58 anos", from: 54, to: 58 }, { label: "59 anos ou +", from: 59, to: 120 },
];
const preferredPlanOrder = ["REC1", "REC2", "BLACK", "INF"];
function planOrder(plan: Plan) {
  const name = plan.name.trim().toUpperCase();
  const position = preferredPlanOrder.findIndex((item) => name === item || name.startsWith(item));
  return position === -1 ? 99 : position;
}
function quoteCode(quote: Quote) {
  const date = new Date(quote.created_at);
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `${yearMonth}${String(quote.quote_number ?? 0).padStart(3, "0")}`;
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character); }

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function QuoteResultPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [quoteId, setQuoteId] = useState("");
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [results, setResults] = useState<CalculatedRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => supabaseBrowser(), []);

  useEffect(() => {
    async function load() {
      const [quotesResponse, plansResponse] = await Promise.all([
        supabase
          .from("quotes")
          .select("id, quote_number, title, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("insurer_plans")
          .select("id, name, accommodation, logo_url, main_hospitals, insurer:insurers(trade_name, legal_name, logo_url)")
          .eq("active", true)
          .order("name"),
      ]);

      if (quotesResponse.data) setQuotes(quotesResponse.data as Quote[]);
      if (plansResponse.data) setPlans(plansResponse.data as unknown as Plan[]);
      const quoteFromUrl = new URLSearchParams(window.location.search).get("quoteId");
      if (quoteFromUrl) setQuoteId(quoteFromUrl);
      setLoading(false);
    }
    void load();
  }, [supabase]);

  const plansByInsurer = useMemo(() => {
    const groups = new Map<string, Plan[]>();
    plans.forEach((plan) => {
      const insurer = plan.insurer?.trade_name || plan.insurer?.legal_name || "Operadora não informada";
      groups.set(insurer, [...(groups.get(insurer) ?? []), plan]);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([insurer, insurerPlans]) => [insurer, [...insurerPlans].sort((a, b) => planOrder(a) - planOrder(b) || a.name.localeCompare(b.name, "pt-BR"))] as [string, Plan[]]);
  }, [plans]);

  const selectedPlans = useMemo(
    () => plans.filter((plan) => selectedPlanIds.includes(plan.id)).sort((a, b) => planOrder(a) - planOrder(b) || a.name.localeCompare(b.name, "pt-BR")),
    [plans, selectedPlanIds],
  );

  const visiblePlans = useMemo(() => selectedPlans.map((plan) => ({
    plan,
    showWard: results.some((row) => row.prices[plan.id]?.ward !== null),
    showApartment: results.some((row) => row.prices[plan.id]?.apartment !== null),
  })).filter((item) => item.showWard || item.showApartment), [results, selectedPlans]);

  function togglePlan(planId: string) {
    setSelectedPlanIds((current) =>
      current.includes(planId) ? current.filter((id) => id !== planId) : [...current, planId],
    );
  }

  function totalsForPlan(planId: string) {
    return {
      ward: results.reduce((total, row) => total + (row.prices[planId]?.ward ?? 0), 0),
      apartment: results.reduce((total, row) => total + (row.prices[planId]?.apartment ?? 0), 0),
    };
  }

  function sendWhatsApp() {
    const text = [
      "*MAIS COTAÇÕES — Comparativo de planos*",
      `Vidas cotadas: ${results.reduce((total, row) => total + row.lives, 0)}`,
      "",
      ...visiblePlans.flatMap(({ plan, showWard, showApartment }) => {
        const total = totalsForPlan(plan.id);
        const insurer = plan.insurer?.trade_name || plan.insurer?.legal_name || "Operadora";
        return [`*${insurer} — ${plan.name}*`, ...(showWard ? [`Enfermaria: ${currency.format(total.ward)}`] : []), ...(showApartment ? [`Apartamento: ${currency.format(total.apartment)}`] : []), ""];
      }),
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function generatePdf() {
    const table = document.getElementById("quote-results");
    if (!table) return;
    const client = supabaseBrowser();
    const { data: membership } = await client.from("organization_members").select("organization_id").limit(1).single();
    const { data: organization } = membership ? await client.from("organizations").select("logo_url,pdf_contact_name,whatsapp").eq("id", membership.organization_id).single() : { data: null };
    const printWindow = window.open("", "_blank");
    if (!printWindow) { setMessage("Não foi possível abrir a impressão. Permita pop-ups para gerar o PDF."); return; }
    const logoUrl = organization?.logo_url || document.querySelector("[data-org-logo]")?.getAttribute("src");
    const logo = logoUrl ? `<img src="${logoUrl}" alt="Logo da corretora" style="max-width:220px;max-height:80px;object-fit:contain;display:block;margin-bottom:14px" />` : "";
    const contact = [organization?.pdf_contact_name, organization?.whatsapp].filter(Boolean).map((item) => escapeHtml(item!)).join(" &nbsp; | &nbsp; ");
    const hospitals = visiblePlans.filter(({ plan }) => plan.main_hospitals?.trim()).map(({ plan }) => `<article class="network-plan">${plan.logo_url || plan.insurer?.logo_url ? `<img class="plan-logo" src="${plan.logo_url || plan.insurer?.logo_url}" alt="${escapeHtml(plan.name)}" />` : `<h3>${escapeHtml(plan.name)}</h3>`}<h3>${escapeHtml(plan.insurer?.trade_name || plan.insurer?.legal_name || "Operadora")} — ${escapeHtml(plan.name)}</h3><p>${escapeHtml(plan.main_hospitals ?? "").replace(/\n/g, "<br />")}</p></article>`).join("");
    const hospitalsPage = hospitals ? `<section class="network-page"><h2>Principais hospitais por plano</h2>${hospitals}</section>` : "";
    printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><title>Comparativo de planos</title><style>body{font-family:Arial,sans-serif;color:#17212f;padding:28px}h2{margin:0 0 8px}h3{font-size:14px;margin:8px 0}p{color:#52636e}.plan-logo{width:120px!important;height:48px!important;object-fit:contain!important;display:block;margin:0 auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:9px;border:1px solid #dce4e8}th{background:#edf4ff}button{display:none}.mobile-quote-cards,.mobile-quote-cards + div{display:none!important}.network-page{page-break-before:always;margin-top:30px}.network-plan{border:1px solid #dce4e8;border-radius:8px;padding:14px;margin:14px 0;page-break-inside:avoid}.pdf-contact{margin-top:18px;padding-top:12px;border-top:1px solid #dce4e8;font-size:13px;color:#334155}</style></head><body>${logo}<h2>MAIS COTAÇÕES</h2><p>Comparativo de planos</p>${table.outerHTML}${contact ? `<div class="pdf-contact">${contact}</div>` : ""}${hospitalsPage}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 350);
  }

  async function generateValues() {
    setMessage("");
    setResults([]);
    if (!quoteId) return setMessage("Selecione uma cotação antes de gerar os valores.");
    if (!selectedPlanIds.length) return setMessage("Abra uma operadora e selecione pelo menos um plano.");

    const [{ data: members, error: membersError }, { data: tables, error: tablesError }] = await Promise.all([
      supabase.from("quote_members").select("birth_date").eq("quote_id", quoteId).eq("is_active", true),
      supabase
        .from("pricing_tables")
        .select("id, plan_id")
        .in("plan_id", selectedPlanIds)
        .eq("is_active", true)
        .is("archived_at", null),
    ]);
    if (membersError || tablesError) return setMessage(membersError?.message ?? tablesError?.message ?? "Não foi possível carregar as vidas ou tabelas de preço.");
    if (!members?.length) return setMessage("Esta cotação ainda não possui vidas cadastradas.");

    const tableIds = (tables ?? []).map((table) => table.id);
    const { data: rules, error: rulesError } = tableIds.length
      ? await supabase
          .from("pricing_table_rules")
          .select("pricing_table_id, age_from, age_to, ward_monthly_price, apartment_monthly_price")
          .in("pricing_table_id", tableIds)
      : { data: [] as PricingRule[], error: null };
    if (rulesError) return setMessage(`Não foi possível carregar os valores das faixas: ${rulesError.message}`);

    const now = new Date();
    const memberPrices = (members as QuoteMember[]).map((member) => {
      const birth = new Date(`${member.birth_date}T12:00:00`);
      let age = now.getFullYear() - birth.getFullYear();
      if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1;
      const prices: Record<string, PriceCell> = {};
      selectedPlanIds.forEach((planId) => {
        const planTableIds = (tables ?? []).filter((table) => table.plan_id === planId).map((table) => table.id);
        const rule = ((rules ?? []) as PricingRule[]).find((item) => planTableIds.includes(item.pricing_table_id) && age >= item.age_from && (item.age_to === null || age <= item.age_to));
        prices[planId] = {
          ward: rule?.ward_monthly_price === null || rule?.ward_monthly_price === undefined ? null : Number(rule.ward_monthly_price),
          apartment: rule?.apartment_monthly_price === null || rule?.apartment_monthly_price === undefined ? null : Number(rule.apartment_monthly_price),
        };
      });
      return { age, prices };
    });

    const calculated = ageBands.map((band) => {
      const bandMembers = memberPrices.filter((member) => member.age >= band.from && member.age <= band.to);
      const prices: Record<string, PriceCell> = {};
      selectedPlanIds.forEach((planId) => {
        prices[planId] = bandMembers.reduce<PriceCell>((total, member) => ({
          ward: total.ward === null && member.prices[planId].ward === null ? null : (total.ward ?? 0) + (member.prices[planId].ward ?? 0),
          apartment: total.apartment === null && member.prices[planId].apartment === null ? null : (total.apartment ?? 0) + (member.prices[planId].apartment ?? 0),
        }), { ward: null, apartment: null });
      });
      return { label: band.label, lives: bandMembers.length, prices };
    }).filter((band) => band.lives > 0);

    setResults(calculated);
    window.setTimeout(() => document.getElementById("quote-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    if (!calculated.some((row) => Object.values(row.prices).some((price) => price.ward !== null || price.apartment !== null))) {
      setMessage("Os planos foram selecionados, mas ainda não há valores ativos para as faixas etárias desta cotação.");
    }
  }

  return (
    <main>
      <a href={`/dashboard/quotes/members${quoteId ? `?quoteId=${quoteId}` : ""}`} style={{ color: "#1769c2", fontWeight: 700, textDecoration: "none" }}>← Voltar</a>
      <p style={{ color: "#1769c2", fontWeight: 800, letterSpacing: 1, marginTop: 28 }}>COTAÇÕES</p>
      <h1 style={{ fontSize: 38, marginTop: 0 }}>Selecionar planos e gerar valores</h1>

      <section style={{ background: "white", border: "1px solid #dce4e8", borderRadius: 16, padding: 26, maxWidth: 1100 }}>
        <label style={{ display: "grid", gap: 8, fontWeight: 700 }}>
          Cotação
          <select value={quoteId} onChange={(event) => setQuoteId(event.target.value)} style={{ padding: 11, borderRadius: 8, border: "1px solid #aebfca", fontSize: 16 }}>
            <option value="">Selecione</option>
            {quotes.map((quote) => <option key={quote.id} value={quote.id}>Cotação {quoteCode(quote)} — {quote.title || "Sem título"}</option>)}
          </select>
        </label>

        <h2 style={{ margin: "28px 0 12px" }}>Planos para comparar</h2>
        <p style={{ color: "#52636e", marginTop: 0 }}>Clique no nome da operadora para abrir os planos disponíveis.</p>
        {loading ? <p>Carregando operadoras...</p> : plansByInsurer.map(([insurer, insurerPlans]) => (
          <details key={insurer} style={{ border: "1px solid #dce4e8", borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
            <summary style={{ cursor: "pointer", padding: "16px 18px", fontWeight: 800, fontSize: 18, display: "flex", justifyContent: "space-between", background: "#f6fbfa" }}>
              <span>{insurer}</span><span style={{ color: "#52636e", fontSize: 14 }}>{insurerPlans.length} plano(s)</span>
            </summary>
            <div style={{ padding: "8px 18px 16px", display: "grid", gap: 10 }}>
              {insurerPlans.map((plan) => (
                <label key={plan.id} style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={selectedPlanIds.includes(plan.id)} onChange={() => togglePlan(plan.id)} />
                  <span>{plan.name}{plan.accommodation ? ` — ${plan.accommodation}` : ""}</span>
                </label>
              ))}
            </div>
          </details>
        ))}
        {!loading && !plans.length && <p>Nenhum plano ativo foi encontrado.</p>}

        <button onClick={() => void generateValues()} style={{ marginTop: 20, border: 0, borderRadius: 8, background: "#1769c2", color: "white", padding: "14px 20px", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>Gerar valores</button>
        {message && <p style={{ color: "#a33b25", fontWeight: 600 }}>{message}</p>}
      </section>

      {results.length > 0 && visiblePlans.length > 0 && (
        <section id="quote-results" style={{ background: "white", border: "1px solid #dce4e8", borderRadius: 16, padding: 26, maxWidth: 1400, marginTop: 24 }}>
          <h2 style={{ marginTop: 0 }}>Planilha comparativa de valores</h2>
          <p style={{ color: "#52636e", marginTop: -4 }}>Cada linha representa uma faixa etária e o total das vidas nela incluídas.</p>
          <div style={{ overflowX: "auto" }}>
            <table className="desktop-quote-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: Math.max(780, 260 + visiblePlans.reduce((total, item) => total + (item.showWard ? 1 : 0) + (item.showApartment ? 1 : 0), 0) * 115) }}>
              <thead>
                <tr style={{ background: "#edf4ff" }}><th rowSpan={2} style={{ textAlign: "left", padding: 10, verticalAlign: "bottom" }}>Faixa etária</th><th rowSpan={2} style={{ textAlign: "center", padding: 10, verticalAlign: "bottom" }}>Vidas</th>{visiblePlans.map(({ plan, showWard, showApartment }) => <th key={plan.id} colSpan={(showWard ? 1 : 0) + (showApartment ? 1 : 0)} style={{ textAlign: "center", padding: 10, borderLeft: "1px solid #dce4e8" }}>{plan.logo_url || plan.insurer?.logo_url ? <img className="plan-logo" src={plan.logo_url || plan.insurer?.logo_url || ""} alt={plan.name} /> : null}<span style={{ display: "block", fontWeight: 800, marginTop: 4 }}>{plan.name}</span></th>)}</tr>
                <tr style={{ background: "#edf4ff" }}>{visiblePlans.map(({ plan, showWard, showApartment }) => <Fragment key={plan.id}>{showWard && <th style={{ textAlign: "right", padding: 10, borderLeft: "1px solid #dce4e8" }}>Enfermaria</th>}{showApartment && <th style={{ textAlign: "right", padding: 10 }}>Apartamento</th>}</Fragment>)}</tr>
              </thead>
              <tbody>
                {results.map((row, rowIndex) => <tr key={`${row.label}-${rowIndex}`} style={{ borderTop: "1px solid #e4eaed" }}><td style={{ padding: 10, fontWeight: 700 }}>{row.label}</td><td style={{ padding: 10, textAlign: "center" }}>{row.lives}</td>{visiblePlans.map(({ plan, showWard, showApartment }) => <Fragment key={plan.id}>{showWard && <td style={{ padding: 10, textAlign: "right", borderLeft: "1px solid #eef1f4" }}>{currency.format(row.prices[plan.id]?.ward ?? 0)}</td>}{showApartment && <td style={{ padding: 10, textAlign: "right" }}>{currency.format(row.prices[plan.id]?.apartment ?? 0)}</td>}</Fragment>)}</tr>)}
                <tr style={{ borderTop: "2px solid #7ba7e4", background: "#f4f8ff", fontWeight: 800 }}><td colSpan={2} style={{ padding: 10 }}>Total mensal</td>{visiblePlans.map(({ plan, showWard, showApartment }) => { const total = totalsForPlan(plan.id); return <Fragment key={plan.id}>{showWard && <td style={{ padding: 10, textAlign: "right", borderLeft: "1px solid #dce4e8" }}>{currency.format(total.ward)}</td>}{showApartment && <td style={{ padding: 10, textAlign: "right" }}>{currency.format(total.apartment)}</td>}</Fragment>; })}</tr>
              </tbody>
            </table>
          </div>
          <div className="mobile-quote-cards">
            {visiblePlans.map(({ plan, showWard, showApartment }) => { const total = totalsForPlan(plan.id); return <article key={plan.id} className="mobile-quote-card"><div className="mobile-plan-heading">{plan.logo_url || plan.insurer?.logo_url ? <img className="plan-logo" src={plan.logo_url || plan.insurer?.logo_url || ""} alt={plan.name} /> : null}<b>{plan.name}</b></div>{results.map((row) => <div className="mobile-band-row" key={row.label}><b>{row.label} <span>{row.lives} vida(s)</span></b>{showWard && <span>Enfermaria: {currency.format(row.prices[plan.id]?.ward ?? 0)}</span>}{showApartment && <span>Apartamento: {currency.format(row.prices[plan.id]?.apartment ?? 0)}</span>}</div>)}<div className="mobile-total-row"><b>Total mensal</b>{showWard && <span>Enfermaria: {currency.format(total.ward)}</span>}{showApartment && <span>Apartamento: {currency.format(total.apartment)}</span>}</div></article>; })}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
            <a className="secondary" href={`/dashboard/quotes/members?quoteId=${quoteId}`}>Editar cotação</a>
            <button onClick={generatePdf} className="secondary">Gerar PDF</button>
            <button onClick={sendWhatsApp} className="primary">Enviar pelo WhatsApp</button>
          </div>
        </section>
      )}
    </main>
  );
}
