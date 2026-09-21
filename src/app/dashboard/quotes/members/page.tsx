"use client";
import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { cleanQuoteTitle } from "@/lib/quote-title";

type Quote = {
  id: string;
  quote_number: number;
  title: string;
  created_at: string;
  contracting_mode: string;
  company_cnpj: string | null;
  company_legal_name: string | null;
  company_trade_name: string | null;
  company_size: string | null;
  company_legal_nature: string | null;
  company_city: string | null;
  company_state: string | null;
};
type Member = {
  id: string;
  full_name_snapshot: string | null;
  birth_date: string;
  member_role: string;
};
type Company = {
  cnpj: string;
  legalName: string;
  tradeName: string;
  size: string;
  legalNature: string;
  city: string;
  state: string;
};
const emptyCompany: Company = {
  cnpj: "",
  legalName: "",
  tradeName: "",
  size: "",
  legalNature: "",
  city: "",
  state: "",
};
const roles = {
  holder: "Titular",
  spouse: "Cônjuge",
  child: "Filho(a)",
  dependent: "Dependente",
};
function quoteCode(q: Quote) {
  const d = new Date(q.created_at);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(q.quote_number).padStart(3, "0")}`;
}
function maskCnpj(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export default function QuoteMembersPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]),
    [quoteId, setQuoteId] = useState(""),
    [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState(""),
    [birth, setBirth] = useState(""),
    [age, setAge] = useState(""),
    [role, setRole] = useState("holder"),
    [editing, setEditing] = useState<Member | null>(null);
  const [company, setCompany] = useState<Company>(emptyCompany),
    [consulting, setConsulting] = useState(false),
    [savingCompany, setSavingCompany] = useState(false),
    [companySaved, setCompanySaved] = useState(false),
    [error, setError] = useState("");
  const selectedQuote = quotes.find((q) => q.id === quoteId);
  async function loadMembers(id = quoteId) {
    if (!id) return;
    const { data, error: e } = await supabaseBrowser()
      .from("quote_members")
      .select("id,full_name_snapshot,birth_date,member_role")
      .eq("quote_id", id)
      .eq("is_active", true)
      .order("created_at");
    if (e) return setError(e.message);
    setMembers((data ?? []) as Member[]);
  }
  function setQuoteCompany(q?: Quote) {
    setCompanySaved(Boolean(q?.company_cnpj));
    setCompany(
      q
        ? {
            cnpj: maskCnpj(q.company_cnpj ?? ""),
            legalName: q.company_legal_name ?? "",
            tradeName: q.company_trade_name ?? "",
            size: q.company_size ?? "",
            legalNature: q.company_legal_nature ?? "",
            city: q.company_city ?? "",
            state: q.company_state ?? "",
          }
        : emptyCompany,
    );
  }
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("quoteId") ?? "";
    setQuoteId(id);
    void supabaseBrowser()
      .from("quotes")
      .select(
        "id,quote_number,title,created_at,contracting_mode,company_cnpj,company_legal_name,company_trade_name,company_size,company_legal_nature,company_city,company_state",
      )
      .is("archived_at", null)
      .then(({ data }) => {
        const list = (data ?? []) as Quote[];
        setQuotes(list);
        setQuoteCompany(list.find((q) => q.id === id));
      });
    if (id) void loadMembers(id);
  }, []);
  async function consultCnpj() {
    const value = company.cnpj.replace(/\D/g, "");
    setError("");
    setCompanySaved(false);
    if (value.length !== 14) return setError("Informe um CNPJ completo.");
    setConsulting(true);
    try {
      const response = await fetch(`/api/cnpj/${value}`),
        data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCompany({ ...data, cnpj: maskCnpj(data.cnpj) });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível consultar o CNPJ.",
      );
    } finally {
      setConsulting(false);
    }
  }
  async function saveCompany() {
    if (!quoteId || !company.legalName)
      return setError("Consulte um CNPJ válido antes de continuar.");
    setSavingCompany(true);
    const { error: e } = await supabaseBrowser()
      .from("quotes")
      .update({
        company_cnpj: company.cnpj.replace(/\D/g, ""),
        company_legal_name: company.legalName,
        company_trade_name: company.tradeName || null,
        company_size: company.size || null,
        company_legal_nature: company.legalNature || null,
        company_city: company.city || null,
        company_state: company.state || null,
      })
      .eq("id", quoteId);
    setSavingCompany(false);
    if (e) return setError(e.message);
    setCompanySaved(true);
  }
  function reset() {
    setName("");
    setBirth("");
    setAge("");
    setRole("holder");
    setEditing(null);
  }
  async function saveMember(e: FormEvent) {
    e.preventDefault();
    setError("");
    let date = birth;
    if (!date && age) date = `${new Date().getFullYear() - Number(age)}-01-01`;
    if (!quoteId) return setError("Selecione uma cotação.");
    if (!date) return setError("Informe a idade ou a data de nascimento.");
    const values = {
      full_name_snapshot: name || null,
      birth_date: date,
      member_role: role,
    };
    const result = editing
      ? await supabaseBrowser()
          .from("quote_members")
          .update(values)
          .eq("id", editing.id)
      : await supabaseBrowser()
          .from("quote_members")
          .insert({ quote_id: quoteId, ...values });
    if (result.error) return setError(result.error.message);
    reset();
    void loadMembers();
  }
  async function remove(member: Member) {
    if (
      !confirm(
        `Excluir ${member.full_name_snapshot || "esta vida"} da cotação?`,
      )
    )
      return;
    const { error: e } = await supabaseBrowser()
      .from("quote_members")
      .update({ is_active: false })
      .eq("id", member.id);
    if (e) return setError(e.message);
    void loadMembers();
  }
  return (
    <>
      <div className="eyebrow">Cotações</div>
      <h1>2. Dados da cotação e vidas</h1>
      <section className="panel members-panel">
        <label className="field">
          Cotação
          <select
            value={quoteId}
            onChange={(e) => {
              setQuoteId(e.target.value);
              setMembers([]);
              setQuoteCompany(quotes.find((q) => q.id === e.target.value));
            }}
          >
            <option value="">Selecione</option>
            {quotes.map((q) => (
              <option key={q.id} value={q.id}>
                Cotação {quoteCode(q)} — {cleanQuoteTitle(q.title)}
              </option>
            ))}
          </select>
        </label>
        {selectedQuote?.contracting_mode === "corporate" && (
          <div className="company-card">
            <h2>Empresa contratante</h2>
            <p>Informe o CNPJ para preencher os dados oficiais disponíveis.</p>
            <div className="company-cnpj-row">
              <label className="field">
                CNPJ
                <input
                  inputMode="numeric"
                  value={company.cnpj}
                  onChange={(e) => {
                    setCompany({
                      ...emptyCompany,
                      cnpj: maskCnpj(e.target.value),
                    });
                    setCompanySaved(false);
                  }}
                  placeholder="00.000.000/0000-00"
                />
              </label>
              <button
                type="button"
                className="secondary"
                onClick={() => void consultCnpj()}
                disabled={consulting}
              >
                {consulting ? "Consultando…" : "Consultar CNPJ"}
              </button>
            </div>
            {company.legalName && (
              <>
                <div className="company-data-grid">
                  <span>
                    <b>Razão social</b>
                    {company.legalName}
                  </span>
                  <span>
                    <b>Nome fantasia</b>
                    {company.tradeName || "Não informado"}
                  </span>
                  <span>
                    <b>Porte/classificação</b>
                    {company.size || "Não informado"}
                  </span>
                  <span>
                    <b>Natureza jurídica</b>
                    {company.legalNature || "Não informada"}
                  </span>
                  <span>
                    <b>Município/UF</b>
                    {company.city || "Não informado"}
                    {company.state ? `/${company.state}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={() => void saveCompany()}
                  disabled={savingCompany}
                >
                  {savingCompany
                    ? "Salvando…"
                    : companySaved
                      ? "Dados salvos"
                      : "Confirmar dados da empresa"}
                </button>
              </>
            )}
          </div>
        )}
        {quoteId && (
          <form onSubmit={saveMember}>
            <p className="muted-text">
              O nome é opcional. Informe a idade ou a data de nascimento de cada
              vida.
            </p>
            <label className="field">
              Nome <span>(opcional)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="two-fields">
              <label className="field">
                Idade
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={age}
                  onChange={(e) => {
                    setAge(e.target.value);
                    if (e.target.value) setBirth("");
                  }}
                />
              </label>
              <label className="field">
                Data de nascimento
                <input
                  type="date"
                  value={birth}
                  onChange={(e) => {
                    setBirth(e.target.value);
                    if (e.target.value) setAge("");
                  }}
                />
              </label>
            </div>
            <label className="field">
              Tipo
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {Object.entries(roles).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {error && <p className="error">{error}</p>}
            <button className="primary">
              {editing ? "Salvar alteração" : "Adicionar vida"}
            </button>
            {editing && (
              <button type="button" className="secondary" onClick={reset}>
                Cancelar
              </button>
            )}
          </form>
        )}
      </section>
      {quoteId && (
        <section className="panel members-panel">
          <div className="panel-head">
            <h2>Vidas incluídas</h2>
            <span>{members.length} vida(s)</span>
          </div>
          {members.length === 0 ? (
            <p>Adicione ao menos uma vida para continuar.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Nascimento</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.full_name_snapshot || "Sem nome"}</td>
                    <td>
                      {roles[m.member_role as keyof typeof roles] ??
                        m.member_role}
                    </td>
                    <td>
                      {new Date(`${m.birth_date}T12:00:00`).toLocaleDateString(
                        "pt-BR",
                      )}
                    </td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => {
                          setEditing(m);
                          setName(m.full_name_snapshot ?? "");
                          setBirth(m.birth_date);
                          setRole(m.member_role);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="text-link delete-link"
                        onClick={() => void remove(m)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="actions">
            <a className="secondary" href="/dashboard/quotes">
              Voltar
            </a>
            {members.length > 0 &&
              (selectedQuote?.contracting_mode !== "corporate" ||
                companySaved) && (
                <a
                  className="primary"
                  href={`/dashboard/quotes/result?quoteId=${quoteId}`}
                >
                  Continuar para os planos
                </a>
              )}
          </div>
        </section>
      )}
    </>
  );
}
