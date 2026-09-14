"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type Quote = { id: string; quote_number: number; title: string; created_at: string };
type Member = { id: string; full_name_snapshot: string | null; birth_date: string; member_role: string };
const roles = { holder: "Titular", spouse: "Cônjuge", child: "Filho(a)", dependent: "Dependente" };
function quoteCode(quote: Quote) { const date = new Date(quote.created_at); return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(quote.quote_number).padStart(3, "0")}`; }

export default function QuoteMembersPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteId, setQuoteId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState(""); const [birth, setBirth] = useState(""); const [age, setAge] = useState(""); const [role, setRole] = useState("holder");
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [error, setError] = useState("");

  async function loadMembers(id = quoteId) {
    if (!id) return;
    const { data, error: queryError } = await supabaseBrowser().from("quote_members").select("id,full_name_snapshot,birth_date,member_role").eq("quote_id", id).eq("is_active", true).order("created_at");
    if (queryError) { setError(queryError.message); return; }
    setMembers((data ?? []) as Member[]);
  }

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("quoteId") ?? "";
    setQuoteId(fromUrl);
    void supabaseBrowser().from("quotes").select("id,quote_number,title,created_at").is("archived_at", null).then(({ data }) => setQuotes((data ?? []) as Quote[]));
    if (fromUrl) void loadMembers(fromUrl);
  }, []);
  useEffect(() => { if (quoteId) void loadMembers(quoteId); }, [quoteId]);

  function resetMemberForm() {
    setName(""); setBirth(""); setAge(""); setRole("holder"); setEditingMember(null);
  }

  function startEdit(member: Member) {
    setEditingMember(member); setName(member.full_name_snapshot ?? ""); setBirth(member.birth_date); setAge(""); setRole(member.member_role); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveMember(event: FormEvent) {
    event.preventDefault(); setError("");
    let date = birth;
    if (!date && age) date = `${new Date().getFullYear() - Number(age)}-01-01`;
    if (!quoteId) { setError("Selecione uma cotação."); return; }
    if (!date) { setError("Informe a idade ou a data de nascimento."); return; }
    const values = { full_name_snapshot: name || null, birth_date: date, member_role: role };
    const { error: saveError } = editingMember
      ? await supabaseBrowser().from("quote_members").update(values).eq("id", editingMember.id)
      : await supabaseBrowser().from("quote_members").insert({ quote_id: quoteId, ...values });
    if (saveError) { setError(saveError.message); return; }
    resetMemberForm(); void loadMembers();
  }

  async function deleteMember(member: Member) {
    if (!window.confirm(`Excluir ${member.full_name_snapshot || "esta vida"} da cotação?`)) return;
    const { error: deleteError } = await supabaseBrowser().from("quote_members").update({ is_active: false }).eq("id", member.id);
    if (deleteError) { setError(deleteError.message); return; }
    void loadMembers();
  }

  return <>
    <div className="eyebrow">Cotações</div><h1>2. Informe as idades</h1>
    <section className="panel" style={{ maxWidth: 760 }}>
      <label className="field">Cotação<select value={quoteId} onChange={(event) => { setQuoteId(event.target.value); setMembers([]); }}><option value="">Selecione</option>{quotes.map((quote) => <option key={quote.id} value={quote.id}>Cotação {quoteCode(quote)} — {quote.title}</option>)}</select></label>
      {quoteId && <form onSubmit={saveMember}>
        <p style={{ color: "#64748b", fontSize: 13 }}>{editingMember ? "Altere os dados necessários e salve." : "O nome é opcional. Informe somente a idade ou a data de nascimento de cada vida."}</p>
        <label className="field">Nome <span style={{ fontWeight: 400, color: "#64748b" }}>(opcional)</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}>
          <label className="field">Idade<input type="number" min="0" max="120" value={age} onChange={(event) => { setAge(event.target.value); if (event.target.value) setBirth(""); }} /></label>
          <label className="field">Data de nascimento<input type="date" value={birth} onChange={(event) => { setBirth(event.target.value); if (event.target.value) setAge(""); }} /></label>
        </div>
        <label className="field">Tipo<select value={role} onChange={(event) => setRole(event.target.value)}><option value="holder">Titular</option><option value="spouse">Cônjuge</option><option value="child">Filho(a)</option><option value="dependent">Dependente</option></select></label>
        {error && <p className="error">{error}</p>}<button className="primary">{editingMember ? "Salvar alteração" : "Adicionar vida"}</button>{editingMember && <button type="button" className="secondary" onClick={resetMemberForm} style={{ marginLeft: 10 }}>Cancelar</button>}
      </form>}
    </section>
    {quoteId && <section className="panel" style={{ marginTop: 20, maxWidth: 760 }}><div className="panel-head"><h2>Vidas incluídas</h2><span style={{ color: "#64748b", fontSize: 13 }}>{members.length} vida(s)</span></div>
      {members.length === 0 ? <p style={{ color: "#64748b" }}>Adicione ao menos uma vida para continuar.</p> : <table><thead><tr><th>Nome</th><th>Tipo</th><th>Nascimento</th><th></th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td>{member.full_name_snapshot || "Sem nome"}</td><td>{roles[member.member_role as keyof typeof roles] ?? member.member_role}</td><td>{new Date(`${member.birth_date}T12:00:00`).toLocaleDateString("pt-BR")}</td><td style={{ whiteSpace: "nowrap" }}><button className="text-link" onClick={() => startEdit(member)} style={{ border: 0, background: "none", cursor: "pointer" }}>Editar</button><button className="text-link" onClick={() => void deleteMember(member)} style={{ border: 0, background: "none", cursor: "pointer", color: "#b42318", marginLeft: 8 }}>Excluir</button></td></tr>)}</tbody></table>}
      <div style={{ marginTop: 20, display: "flex", gap: 12 }}><a className="secondary" href="/dashboard/quotes">Voltar</a>{members.length > 0 && <a className="primary" href={`/dashboard/quotes/result?quoteId=${quoteId}`}>Continuar para os planos</a>}</div>
    </section>}
  </>;
}
