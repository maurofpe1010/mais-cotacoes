"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { buildQuotePdf, printQuoteDocument } from "@/lib/quote-pdf";
import { cleanQuoteTitle, firstRelation } from "@/lib/quote-title";

type Quote = { id: string; quote_number: number | null; title: string | null; created_at: string };
type Plan = {
  id: string;
  name: string;
  accommodation: string | null;
  copay_description: string | null;
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
function copayLabel(value: string | null) {
  const text = value?.trim();
  if (!text || /sem\s+coparticipa/i.test(text)) return "Sem coparticipação";
  if (/total/i.test(text)) return "Coparticipação total";
  return "Coparticipação parcial";
}
const modeLabel: Record<string, string> = { individual: "Individual", adhesion: "Adesão", corporate: "Empresarial" };

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
  const [pdfHtml, setPdfHtml] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const pdfFrame = useRef<HTMLIFrameElement>(null);
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
          .select("id, name, accommodation, copay_description, logo_url, main_hospitals, insurer:insurers(trade_name, legal_name, logo_url)")
          .eq("active", true)
          .order("name"),
      ]);

      if (quotesResponse.data) setQuotes(quotesResponse.data as Quote[]);
      if (plansResponse.data) setPlans((plansResponse.data as unknown as (Omit<Plan, "insurer"> & { insurer: Plan["insurer"] | NonNullable<Plan["insurer"]>[] })[]).map(plan => ({ ...plan, insurer: firstRelation(plan.insurer) ?? null })));
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
    showWard: results.some((row) => row.prices[plan.id]?.ward != null),
    showApartment: results.some((row) => row.prices[plan.id]?.apartment != null),
  })).filter((item) => item.showWard || item.showApartment), [results, selectedPlans]);

  function togglePlan(planId: string) {
    setResults([]);
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

  async function generatePdfLandscape() {
    const quote = quotes.find(item => item.id === quoteId);
    if (!quote || !visiblePlans.length) return;
    setMessage("");
    setPdfLoading(true);
    setPdfReady(false);
    try {
      const client = supabaseBrowser();
      const [membershipResponse, quoteResponse] = await Promise.all([
        client.from("organization_members").select("organization_id").limit(1).single(),
        client.from("quotes").select("contracting_mode,lead:crm_leads!quotes_lead_id_fkey(primary_contact:crm_contacts!crm_leads_primary_contact_id_fkey(full_name,phone))").eq("id", quoteId).single(),
      ]);
      if (quoteResponse.error) throw new Error(quoteResponse.error.message);
      const organization = membershipResponse.data?.organization_id
        ? (await client.from("organizations").select("logo_url").eq("id", membershipResponse.data.organization_id).maybeSingle()).data
        : null;
      type Contact = { full_name?: string; phone?: string };
      type Lead = { primary_contact?: Contact | Contact[] | null };
      const details = quoteResponse.data as unknown as { contracting_mode?: string; lead?: Lead | Lead[] | null };
      const contact = firstRelation(firstRelation(details.lead)?.primary_contact);
      const html = buildQuotePdf({
        clientName: contact?.full_name || quote.title || "Cliente não informado",
        whatsapp: contact?.phone || "Não informado",
        code: quoteCode(quote), mode: modeLabel[details.contracting_mode ?? ""] || details.contracting_mode || "Não informada",
        brokerLogo: organization?.logo_url || document.querySelector("[data-org-logo]")?.getAttribute("src") || "/mais-corretora-logo.png",
        options: visiblePlans, rows: results,
      });
      setPdfHtml(html);
    } catch (error) {
      setMessage(`Não foi possível gerar o PDF: ${error instanceof Error ? error.message : "Verifique a conexão e tente novamente."}`);
    } finally {
      setPdfLoading(false);
    }
  }

  async function generateValues() {
    setMessage("");
    setResults([]);
    if (!quoteId) return setMessage("Selecione uma cotação antes de gerar os valores.");
    if (!selectedPlanIds.length) return setMessage("Selecione pelo menos um plano nos cards.");

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
          <select value={quoteId} onChange={(event) => { setQuoteId(event.target.value); setResults([]); }} style={{ padding: 11, borderRadius: 8, border: "1px solid #aebfca", fontSize: 16 }}>
            <option value="">Selecione</option>
            {quotes.map((quote) => <option key={quote.id} value={quote.id}>Cotação {quoteCode(quote)} — {cleanQuoteTitle(quote.title) || "Sem título"}</option>)}
          </select>
        </label>

        <h2 style={{ margin: "28px 0 12px" }}>Planos para comparar</h2>
        <p style={{ color: "#52636e", marginTop: 0 }}>Selecione os planos que deseja comparar. {selectedPlanIds.length} selecionado(s).</p>
        {loading ? <p>Carregando planos...</p> : plansByInsurer.map(([insurer, insurerPlans]) => (
          <section key={insurer} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 17, color: "#244766", marginBottom: 12 }}>{insurer}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
              {insurerPlans.map(plan => {
                const selected = selectedPlanIds.includes(plan.id);
                return <label key={plan.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 18, border: `2px solid ${selected ? "#1769c2" : "#dce4e8"}`, borderRadius: 12, background: selected ? "#edf5ff" : "#fff", cursor: "pointer" }}>
                  <input type="checkbox" checked={selected} onChange={() => togglePlan(plan.id)} style={{ width: 20, height: 20, accentColor: "#1769c2", flexShrink: 0 }} />
                  <span style={{ display: "grid", gap: 7 }}>
                    {(plan.logo_url || plan.insurer?.logo_url) && <img src={plan.logo_url || plan.insurer?.logo_url || ""} alt="" style={{ width: 85, height: 30, objectFit: "contain", objectPosition: "left" }} />}
                    <strong style={{ fontSize: 18, color: "#142b48" }}>{plan.name}</strong>
                    {plan.accommodation && <span style={{ color: "#52636e", fontSize: 13 }}>{plan.accommodation}</span>}
                    <span style={{ color: "#52636e", fontSize: 12 }}>{copayLabel(plan.copay_description)}</span>
                  </span>
                </label>;
              })}
            </div>
          </section>
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
            <div className="copay-summary" style={{ display: "flex", gap: 8, padding: "8px 10px", border: "1px solid #dce4e8", borderBottom: 0, background: "#f8fbff", fontSize: 12 }}><b>Coparticipação:</b>{visiblePlans.map(({ plan }) => <span key={plan.id}>{plan.name}: <b>{copayLabel(plan.copay_description)}</b></span>)}</div>
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
            <button onClick={generatePdfLandscape} disabled={pdfLoading} className="secondary">{pdfLoading ? "Preparando PDF..." : "Salvar PDF"}</button>
            <button onClick={sendWhatsApp} className="primary">Enviar pelo WhatsApp</button>
          </div>
          {message && <p role="alert" style={{ color: "#a33b25" }}>{message}</p>}
        </section>
      )}
      {pdfHtml && <div role="dialog" aria-modal="true" aria-label="Prévia da proposta" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#142b48aa", padding: "3vh 3vw", display: "flex" }}>
        <section style={{ background: "white", borderRadius: 14, width: "100%", display: "flex", flexDirection: "column", padding: 16, gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div><strong>Proposta pronta</strong><p style={{ margin: "4px 0", fontSize: 14 }}>No computador: clique em Salvar PDF. Na janela de impressão, selecione o destino “Salvar como PDF” e clique em Salvar.</p></div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="primary" disabled={!pdfReady} onClick={() => {
                const target = window.open("", "_blank");
                if (!target) {
                  setMessage("Permita a abertura da página da cotação no navegador para salvar somente a proposta.");
                  return;
                }
                const standalone = pdfHtml.replace("</head>", `<style>.print-actions{padding:12px;background:#fff;position:sticky;top:0;text-align:center}.print-actions button{padding:12px 20px;font:700 16px Arial;cursor:pointer}@media print{.print-actions{display:none!important}}</style></head>`)
                  .replace("<body>", `<body><div class="print-actions"><button onclick="window.print()">Salvar PDF</button></div>`);
                void printQuoteDocument(target, standalone).catch(() => {
                  setMessage("A cotação foi aberta em uma página separada. Use o botão de impressão nessa página.");
                });
              }}>{pdfReady ? "Salvar PDF" : "Carregando prévia..."}</button>
              <button className="secondary" onClick={() => setPdfHtml("")}>Fechar</button>
            </div>
          </div>
          {message && <p role="alert" style={{ color: "#a33b25", margin: 0 }}>{message}</p>}
          <iframe ref={pdfFrame} title="Prévia da proposta em PDF" srcDoc={pdfHtml} onLoad={() => setPdfReady(true)} style={{ flex: 1, width: "100%", border: "1px solid #dce4e8", background: "white" }} />
        </section>
      </div>}
    </main>
  );
}
