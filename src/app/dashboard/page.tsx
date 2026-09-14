"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

type Lead = { id: string; title: string; lead_kind: string; stage: string; created_at: string; primary_contact: { full_name: string } | null };
type FollowUp = { id: string; title: string; due_at: string };
type Overview = { open: number; quoting: number; proposals: number; conversion: number };
const modeLabel: Record<string, string> = { individual: "Individual", adhesion: "Adesão", corporate: "Empresarial" };
const stageLabel: Record<string, string> = { new: "Novo", qualified: "Qualificado", quoting: "Em cotação", proposal_sent: "Proposta enviada", negotiation: "Negociação", won: "Ganho", lost: "Perdido" };

function Onboarding({ onCreated }: { onCreated: () => void }) {
  const [legalName, setLegalName] = useState(""); const [tradeName, setTradeName] = useState(""); const [taxId, setTaxId] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  async function createOrganization(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); const { error: rpcError } = await supabaseBrowser().rpc("create_organization_with_owner", { p_legal_name: legalName, p_trade_name: tradeName || null, p_tax_id: taxId || null }); if (rpcError) { setError(rpcError.message); setSaving(false); return; } onCreated(); }
  return <section className="panel" style={{ maxWidth: 650 }}><div className="eyebrow">Configuração inicial</div><h1>Cadastre sua corretora</h1><p style={{ color: "#64748b", lineHeight: 1.5 }}>Este cadastro cria sua organização e define sua conta como proprietária.</p><form onSubmit={createOrganization}><label className="field">Razão social<input value={legalName} onChange={(event) => setLegalName(event.target.value)} required /></label><label className="field">Nome fantasia<input value={tradeName} onChange={(event) => setTradeName(event.target.value)} /></label><label className="field">CNPJ <span style={{ fontWeight: 400, color: "#64748b" }}>(opcional)</span><input value={taxId} onChange={(event) => setTaxId(event.target.value)} /></label>{error && <p className="error">{error}</p>}<button className="primary" disabled={saving}>{saving ? "Criando…" : "Criar organização"}</button></form></section>;
}

function Dashboard() {
  const [overview, setOverview] = useState<Overview>({ open: 0, quoting: 0, proposals: 0, conversion: 0 });
  const [leads, setLeads] = useState<Lead[]>([]); const [followUps, setFollowUps] = useState<FollowUp[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { void (async () => {
    const client = supabaseBrowser();
    const [leadResult, proposalResult, followUpResult] = await Promise.all([
      client.from("crm_leads").select("id,title,lead_kind,stage,created_at,primary_contact:crm_contacts!crm_leads_primary_contact_id_fkey(full_name)").is("archived_at", null).order("created_at", { ascending: false }),
      client.from("proposals").select("id,status"),
      client.from("crm_follow_ups").select("id,title,due_at").eq("status", "open").order("due_at").limit(5),
    ]);
    const allLeads = (leadResult.data ?? []) as Lead[];
    const active = allLeads.filter((lead) => !["won", "lost", "archived"].includes(lead.stage));
    const closed = allLeads.filter((lead) => ["won", "lost"].includes(lead.stage));
    setOverview({ open: active.length, quoting: allLeads.filter((lead) => lead.stage === "quoting").length, proposals: (proposalResult.data ?? []).filter((proposal) => ["sent", "viewed"].includes(proposal.status)).length, conversion: closed.length ? Math.round(allLeads.filter((lead) => lead.stage === "won").length / closed.length * 100) : 0 });
    setLeads(allLeads.slice(0, 5)); setFollowUps((followUpResult.data ?? []) as FollowUp[]); setLoading(false);
  })(); }, []);
  return <><header className="topbar"><div><div className="eyebrow">Visão geral</div><h1>Painel comercial</h1></div><a className="primary" href="/dashboard/quotes#new-quote-form">+ Nova cotação</a></header><section className="metrics premium-metrics"><div className="metric premium-metric"><p>Oportunidades abertas</p><strong>{overview.open}</strong><small>Prospects em andamento</small></div><div className="metric premium-metric"><p>Em cotação</p><strong>{overview.quoting}</strong><small>Comparações em preparação</small></div><div className="metric premium-metric"><p>Propostas enviadas</p><strong>{overview.proposals}</strong><small>Enviadas ou visualizadas</small></div><div className="metric premium-metric"><p>Conversão</p><strong>{overview.conversion}%</strong><small className="up">Negócios ganhos</small></div></section><section className="grid premium-dashboard-grid"><article className="panel dashboard-panel"><div className="panel-head"><h2>Oportunidades recentes</h2><a className="text-link" href="/dashboard/crm">Ver CRM</a></div>{loading ? <p className="muted-text">Carregando dados reais…</p> : leads.length === 0 ? <p className="muted-text">Nenhuma oportunidade cadastrada ainda.</p> : <div className="dashboard-list">{leads.map((lead) => <div className="dashboard-list-row" key={lead.id}><div><b>{lead.primary_contact?.full_name ?? lead.title}</b><span>{modeLabel[lead.lead_kind] ?? lead.lead_kind}</span></div><span className="badge blue">{stageLabel[lead.stage] ?? lead.stage}</span></div>)}</div>}</article><article className="panel dashboard-panel"><div className="panel-head"><h2>Próximos follow-ups</h2><a className="text-link" href="/dashboard/crm">Agenda</a></div>{loading ? <p className="muted-text">Carregando agenda…</p> : followUps.length === 0 ? <p className="muted-text">Nenhum follow-up agendado.</p> : followUps.map((followUp) => <div className="task" key={followUp.id}><i className="dot" /><div><b>{followUp.title}</b><p>{new Date(followUp.due_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p></div></div>)}</article></section></>;
}

export default function DashboardPage() {
  const router = useRouter(); const [ready, setReady] = useState(false); const [hasOrganization, setHasOrganization] = useState(false);
  async function loadOrganization() { const client = supabaseBrowser(); const { data: { user } } = await client.auth.getUser(); if (!user) { router.replace("/login"); return; } const { data } = await client.from("organization_members").select("organization_id").limit(1); setHasOrganization(Boolean(data?.length)); setReady(true); }
  useEffect(() => { void loadOrganization(); }, []);
  if (!ready) return <p className="muted-text">Carregando sua organização…</p>;
  return hasOrganization ? <Dashboard /> : <Onboarding onCreated={() => void loadOrganization()} />;
}
