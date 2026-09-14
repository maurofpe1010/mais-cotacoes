"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

const accepted = ["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv"];

export default function ImportPricingPage() {
  return <Suspense fallback={<p className="muted-text">Carregando importação…</p>}><ImportPricingContent /></Suspense>;
}

function ImportPricingContent() {
  const params = useSearchParams();
  const insurerId = params.get("insurer");
  const planId = params.get("plan");
  const [org, setOrg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void supabaseBrowser().from("organization_members").select("organization_id").limit(1)
      .then(({ data }) => setOrg(data?.[0]?.organization_id ?? null));
  }, []);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || !org) return;
    setSaving(true); setError("");
    if (!accepted.includes(file.type) || file.size > 20 * 1024 * 1024) {
      setError("Envie PDF, Excel ou CSV de até 20 MB."); setSaving(false); return;
    }
    const client = supabaseBrowser();
    const path = `${org}/tabelas-importadas/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error: uploadError } = await client.storage.from("mais-cotacoes-documents").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { setError(uploadError.message); setSaving(false); return; }
    const { error: insertError } = await client.from("pricing_imports").insert({ organization_id: org, insurer_id: insurerId, plan_id: planId, object_path: path, source_file_name: file.name, mime_type: file.type });
    if (insertError) { setError(insertError.message); setSaving(false); return; }
    setMessage("Arquivo enviado e vinculado ao cadastro selecionado."); setFile(null); setSaving(false);
  }

  return <>
    <div className="eyebrow">Precificação</div><h1>Importar tabela</h1>
    <section className="panel" style={{ maxWidth: 760 }}><h2>{planId ? "Tabela deste plano" : insurerId ? "Tabela desta operadora" : "Tabela de preço"}</h2>
      <p style={{ color: "#64748b" }}>O arquivo será salvo de forma privada e vinculado automaticamente ao cadastro de origem.</p>
      <form onSubmit={upload}><label className="field">PDF, Excel ou CSV<input type="file" accept="application/pdf,.xlsx,.xls,.csv,text/csv" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        {error && <p className="error">{error}</p>}{message && <p className="notice">{message}</p>}
        <button className="primary" disabled={saving || !org}>{saving ? "Enviando…" : "Enviar tabela"}</button>
      </form>
    </section>
  </>;
}
