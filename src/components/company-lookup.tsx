"use client";
import { useEffect, useState } from "react";
import { Company, normalizeCnpj, validCnpj } from "@/lib/company";
import { supabaseBrowser } from "@/lib/supabase";
export function CompanyLookup({ onChange }: { onChange: (company: Company | null) => void }) {
  const [cnpj, setCnpj] = useState(""); const [company, setCompany] = useState<Company | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [attempt, setAttempt] = useState(0);
  const normalized = normalizeCnpj(cnpj);
  useEffect(() => {
    setCompany(null); onChange(null); setError(""); setLoading(false);
    if (!normalized) return;
    if (!validCnpj(normalized)) { if (normalized.length >= 14) setError("CNPJ inválido. Confira o número informado."); return; }
    const controller = new AbortController(); let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await supabaseBrowser().auth.getSession();
        if (cancelled) return;
        const response = await fetch(`/api/company?cnpj=${encodeURIComponent(normalized)}`, { headers: { Authorization: `Bearer ${data.session?.access_token || ""}` }, signal: controller.signal });
        const result = await response.json(); if (cancelled) return;
        if (!response.ok) throw new Error(result.error || "Não foi possível consultar o CNPJ.");
        setCompany(result); onChange(result);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Consulta indisponível."); }
      finally { if (!cancelled) setLoading(false); }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [normalized, attempt, onChange]);
  return <section style={{ background: "#f5f9fd", border: "1px solid #dbe6f0", borderRadius: 10, padding: 14, marginBottom: 18 }}>
    <label className="field">CNPJ da empresa<input value={cnpj} required maxLength={18} placeholder="00.000.000/0000-00" autoComplete="off" onChange={e => { setCnpj(e.target.value); setCompany(null); onChange(null); }} /></label>
    {loading && <p role="status">Consultando dados da empresa...</p>}
    {error && <p role="alert" className="error">{error} <button type="button" className="text-link" onClick={() => setAttempt(n => n+1)}>Tentar novamente</button></p>}
    {company && <><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, fontSize: 13 }}>
      {[["Razão social", company.name], ["MEI", company.mei === null ? "Não informado" : company.mei ? "Sim" : "Não"], ["Porte (ME/EPP)", company.size || "Não informado"], ["Natureza jurídica (LTDA etc.)", company.legalNature || "Não informada"], ["Município / UF", [company.city,company.state].filter(Boolean).join(" / ") || "Não informado"], ["Situação cadastral", company.status]].map(([label,value]) => <div key={label}><span style={{ color: "#64748b", display: "block" }}>{label}</span><strong>{value}</strong></div>)}
    </div>{company.active === false && <p className="error">A empresa não consta como ativa na base consultada.</p>}<p style={{ fontSize: 11, color: "#64748b", marginBottom: 0 }}>{company.source}. Consulta em {new Date(company.consultedAt).toLocaleString("pt-BR")}. A base pública pode ter defasagem.</p></>}
  </section>;
}
