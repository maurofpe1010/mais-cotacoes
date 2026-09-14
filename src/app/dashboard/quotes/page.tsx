"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type CrmLead = { id: string; title: string; lead_kind: "individual" | "adhesion" | "corporate"; stage: string; primary_contact: { full_name: string } | null };
type Quote = { id: string; quote_number: number; title: string; contracting_mode: string; status: string; created_at: string; lead: { title: string } | null };
type CrmLeadQueryRow = Omit<CrmLead, "primary_contact"> & { primary_contact: { full_name: string }[] | null };
type QuoteQueryRow = Omit<Quote, "lead"> & { lead: { title: string }[] | null };
const labels = { individual: "Individual", adhesion: "Adesão", corporate: "Empresarial" };
function quoteCode(quote: Quote) { const date = new Date(quote.created_at); return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(quote.quote_number).padStart(3, "0")}`; }

export default function QuotesPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [leadId, setLeadId] = useState("");
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [showForm, setShowForm] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    const client = supabaseBrowser();
    const { data: memberships } = await client.from("organization_members").select("organization_id").limit(1);
    const orgId = memberships?.[0]?.organization_id;
    if (!orgId) { setError("Cadastre a organização antes de criar cotações."); return; }
    setOrganizationId(orgId);
    const [{ data: leadRows, error: leadsError }, { data: quoteRows, error: quotesError }] = await Promise.all([
      client.from("crm_leads").select("id,title,lead_kind,stage,primary_contact:crm_contacts!crm_leads_primary_contact_id_fkey(full_name)").is("archived_at", null).not("stage", "in", "(won,lost,archived)").order("created_at", { ascending: false }),
      client.from("quotes").select("id,quote_number,title,contracting_mode,status,created_at,lead:crm_leads!quotes_lead_id_fkey(title)").is("archived_at", null).order("created_at", { ascending: false }),
    ]);
    if (leadsError || quotesError) { setError(leadsError?.message ?? quotesError?.message ?? "Não foi possível carregar os dados."); return; }
    const normalizedLeads = ((leadRows ?? []) as unknown as CrmLeadQueryRow[]).map((lead) => ({ ...lead, primary_contact: lead.primary_contact?.[0] ?? null }));
    const normalizedQuotes = ((quoteRows ?? []) as unknown as QuoteQueryRow[]).map((quote) => ({ ...quote, lead: quote.lead?.[0] ?? null }));
    setLeads(normalizedLeads); setQuotes(normalizedQuotes);
  }
  useEffect(() => { void loadData(); }, []);

  function selectLead(id: string) {
    setLeadId(id);
    const lead = leads.find((item) => item.id === id);
    setTitle(lead ? `Cotação — ${lead.primary_contact?.full_name ?? lead.title}` : "");
  }

  async function createQuote(event: FormEvent) {
    event.preventDefault();
    if (!organizationId || !leadId) return;
    setSaving(true); setError("");
    const client = supabaseBrowser(); const lead = leads.find((item) => item.id === leadId);
    if (!lead) { setError("Selecione uma oportunidade válida."); setSaving(false); return; }
    const { data: quote, error: quoteError } = await client.from("quotes").insert({ organization_id: organizationId, lead_id: leadId, title, contracting_mode: lead.lead_kind, valid_until: validUntil || null }).select("id,quote_number").single();
    if (quoteError || !quote) { setError(quoteError?.message ?? "Não foi possível criar a cotação."); setSaving(false); return; }
    await client.from("crm_leads").update({ stage: "quoting" }).eq("id", leadId);
    await client.from("crm_activities").insert({ organization_id: organizationId, lead_id: leadId, activity_type: "status_change", subject: "Cotação criada", body: `Cotação ${quote.quote_number} criada pelo aplicativo.` });
    window.location.href = `/dashboard/quotes/members?quoteId=${quote.id}`;
  }

  async function deleteQuote(quote: Quote) {
    if (!window.confirm(`Excluir a cotação “${quote.title}”? Ela ficará arquivada e poderá ser recuperada futuramente.`)) return;
    const { error: deleteError } = await supabaseBrowser().from("quotes").update({ archived_at: new Date().toISOString() }).eq("id", quote.id);
    if (deleteError) { setError(deleteError.message); return; }
    void loadData();
  }

  return <>
    <header className="topbar"><div><div className="eyebrow">Cotações</div><h1>Nova cotação</h1></div><a className="primary" href="#new-quote-form">+ Nova cotação</a></header>
    {showForm && <section id="new-quote-form" className="panel quote-form-panel" style={{ maxWidth: 760, marginBottom: 20 }}><h2>1. Selecione o cliente</h2><p style={{ color: "#64748b", fontSize: 13 }}>Escolha um prospect do CRM. Em seguida, você incluirá as idades e selecionará os planos.</p><form onSubmit={createQuote}>
      <label className="field">Cliente / prospect do CRM<select value={leadId} onChange={(event) => selectLead(event.target.value)} required style={{ border: "1px solid #ccd6dd", borderRadius: 8, padding: 12, background: "white" }}><option value="">Selecione um prospect</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.primary_contact?.full_name ?? lead.title} — {labels[lead.lead_kind]}</option>)}</select></label>
      <label className="field">Título da cotação<input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Ex.: Cotação de plano de saúde" /></label>
      <label className="field">Validade <span style={{ fontWeight: 400, color: "#64748b" }}>(opcional)</span><input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>
      {error && <p className="error">{error}</p>}<button className="primary" disabled={saving || leads.length === 0}>{saving ? "Criando…" : "Continuar para as idades"}</button>
      {leads.length === 0 && <p className="error">Cadastre pelo menos um prospect no CRM antes de criar a cotação.</p>}
    </form></section>}
    <section className="panel"><div className="panel-head"><h2>Cotações criadas</h2><span style={{ color: "#64748b", fontSize: 13 }}>{quotes.length} cotação(ões)</span></div>
      {error && !showForm && <p className="error">{error}</p>}
      {quotes.length === 0 ? <p style={{ color: "#64748b" }}>Ainda não há cotações criadas.</p> : <table><thead><tr><th>Nº</th><th>Cotação</th><th>Modalidade</th><th>Status</th><th>Criação</th><th></th></tr></thead><tbody>{quotes.map((quote) => <tr key={quote.id}><td>{quoteCode(quote)}</td><td><b>{quote.title}</b><br /><small style={{ color: "#64748b" }}>{quote.lead?.title}</small></td><td>{labels[quote.contracting_mode as keyof typeof labels] ?? quote.contracting_mode}</td><td><span className="badge blue">{quote.status}</span></td><td>{new Date(quote.created_at).toLocaleDateString("pt-BR")}</td><td style={{ whiteSpace: "nowrap" }}><a className="text-link" href={`/dashboard/quotes/members?quoteId=${quote.id}`}>Continuar</a><button className="text-link" onClick={() => void deleteQuote(quote)} style={{ border: 0, background: "none", cursor: "pointer", marginLeft: 10, color: "#b42318" }}>Excluir</button></td></tr>)}</tbody></table>}
    </section>
  </>;
}
