"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type Contact = { id: string; full_name: string; email: string | null; phone: string | null };
type Lead = { id: string; title: string; lead_kind: string; stage: string; created_at: string; primary_contact: Contact | null };
const modes = [{ value: "individual", label: "Individual" }, { value: "adhesion", label: "Adesão" }, { value: "corporate", label: "Empresarial" }];

export default function CrmPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState("individual");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function loadLeads() {
    const client = supabaseBrowser();
    const { data: memberships } = await client.from("organization_members").select("organization_id").limit(1);
    const orgId = memberships?.[0]?.organization_id;
    if (!orgId) { setError("Nenhuma organização foi encontrada para esta conta."); return; }
    setOrganizationId(orgId);
    const { data, error: queryError } = await client.from("crm_leads")
      .select("id,title,lead_kind,stage,created_at,primary_contact:crm_contacts!crm_leads_primary_contact_id_fkey(id,full_name,email,phone)")
      .is("archived_at", null).order("created_at", { ascending: false });
    if (queryError) { setError(queryError.message); return; }
    setLeads((data ?? []) as Lead[]);
  }

  useEffect(() => { void loadLeads(); }, []);

  function resetForm() {
    setName(""); setEmail(""); setPhone(""); setMode("individual");
    setEditingLead(null); setShowForm(false); setError("");
  }

  function startEdit(lead: Lead) {
    setEditingLead(lead);
    setName(lead.primary_contact?.full_name ?? "");
    setEmail(lead.primary_contact?.email ?? "");
    setPhone(lead.primary_contact?.phone ?? "");
    setMode(lead.lead_kind); setShowForm(true); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteLead(lead: Lead) {
    if (!window.confirm(`Excluir o prospect “${lead.primary_contact?.full_name ?? lead.title}”? A oportunidade ficará arquivada, sem apagar seu histórico.`)) return;
    const { error: deleteError } = await supabaseBrowser().from("crm_leads").update({ archived_at: new Date().toISOString(), stage: "archived" }).eq("id", lead.id);
    if (deleteError) { setError(deleteError.message); return; }
    void loadLeads();
  }

  async function saveLead(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    setSaving(true); setError("");
    const client = supabaseBrowser();

    if (editingLead) {
      if (editingLead.primary_contact) {
        const { error: contactError } = await client.from("crm_contacts")
          .update({ full_name: name, email: email || null, phone: phone || null })
          .eq("id", editingLead.primary_contact.id);
        if (contactError) { setError(contactError.message); setSaving(false); return; }
      }
      const { error: leadError } = await client.from("crm_leads")
        .update({ title: `Cotação — ${name}`, lead_kind: mode }).eq("id", editingLead.id);
      if (leadError) { setError(leadError.message); setSaving(false); return; }
    } else {
      let contactId: string | null = null;
      if (email) {
        const { data: existingContact } = await client.from("crm_contacts").select("id")
          .eq("organization_id", organizationId).eq("email", email).is("archived_at", null).limit(1);
        contactId = existingContact?.[0]?.id ?? null;
      }
      if (!contactId) {
        const { data: contact, error: contactError } = await client.from("crm_contacts").insert({
          organization_id: organizationId, full_name: name, email: email || null, phone: phone || null, person_type: "prospect",
        }).select("id").single();
        if (contactError || !contact) { setError(contactError?.message ?? "Não foi possível criar o contato."); setSaving(false); return; }
        contactId = contact.id;
      }
      const { error: leadError } = await client.from("crm_leads").insert({
        organization_id: organizationId, title: `Cotação — ${name}`, lead_kind: mode, primary_contact_id: contactId, source: "Aplicativo",
      });
      if (leadError) { setError(leadError.message); setSaving(false); return; }
    }

    setSaving(false); resetForm(); void loadLeads();
  }

  return <>
    <header className="topbar"><div><div className="eyebrow">CRM</div><h1>Oportunidades</h1></div><button className="primary" onClick={() => { resetForm(); setShowForm(true); }}>+ Novo prospect</button></header>
    {showForm && <section className="panel" style={{ marginBottom: 20, maxWidth: 750 }}>
      <div className="panel-head"><h2>{editingLead ? "Editar prospect" : "Novo prospect"}</h2><button type="button" className="secondary" onClick={resetForm}>Cancelar</button></div>
      <form onSubmit={saveLead}><div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}>
        <label className="field">Nome completo<input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Nome do prospect" /></label>
        <label className="field">Modalidade<select value={mode} onChange={(event) => setMode(event.target.value)} style={{ border: "1px solid #ccd6dd", borderRadius: 8, padding: 12, background: "white" }}>{modes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="field">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@email.com" /></label>
        <label className="field">Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(00) 00000-0000" /></label>
      </div>{error && <p className="error">{error}</p>}<button className="primary" disabled={saving}>{saving ? "Salvando…" : editingLead ? "Salvar alterações" : "Salvar prospect"}</button></form>
    </section>}
    <section className="panel"><div className="panel-head"><h2>Todos os prospects</h2><span style={{ color: "#64748b", fontSize: 13 }}>{leads.length} oportunidade(s)</span></div>
      {error && !showForm && <p className="error">{error}</p>}
      {leads.length === 0 ? <p style={{ color: "#64748b" }}>Nenhum prospect cadastrado ainda. Clique em “Novo prospect” para começar.</p> : <table><thead><tr><th>Prospect</th><th>Modalidade</th><th>Etapa</th><th>Entrada</th><th></th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id}><td><b>{lead.primary_contact?.full_name ?? lead.title}</b><br /><small style={{ color: "#64748b" }}>{lead.title}</small></td><td>{modes.find((item) => item.value === lead.lead_kind)?.label ?? lead.lead_kind}</td><td><span className="badge blue">{lead.stage}</span></td><td>{new Date(lead.created_at).toLocaleDateString("pt-BR")}</td><td style={{ whiteSpace: "nowrap" }}><button type="button" className="secondary" onClick={() => startEdit(lead)}>Editar</button><button type="button" className="text-link" onClick={() => void deleteLead(lead)} style={{ border: 0, background: "none", cursor: "pointer", color: "#b42318", marginLeft: 8 }}>Excluir</button></td></tr>)}</tbody></table>}
    </section>
  </>;
}
