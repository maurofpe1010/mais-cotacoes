"use client";

import { FormEvent, useEffect, useState } from "react";
import { firstRelation } from "@/lib/quote-title";
import { supabaseBrowser } from "@/lib/supabase";

type Insurer = { id: string; legal_name: string; trade_name: string | null; registration_number: string | null; logo_url: string | null; created_at: string };
type Plan = { id: string; insurer_id: string; product_id: string; name: string; observations: string | null; discount_percent: number; iof_percent: number; discount_min_lives: number | null; plan_code: string | null; accommodation: string; copay_description: string | null; logo_url: string | null; insurer: { legal_name: string; trade_name: string | null } | null; product: { name: string } | null };
type PlanQueryRow = Omit<Plan, "insurer" | "product"> & {
  insurer: NonNullable<Plan["insurer"]>[] | null;
  product: NonNullable<Plan["product"]>[] | null;
};
const acceptedImages = ["image/png", "image/jpeg", "image/webp"];
const accommodations = [{ value: "apartment", label: "Apartamento" }, { value: "ward", label: "Enfermaria" }, { value: "not_applicable", label: "Não se aplica" }];

export default function PlansPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [section, setSection] = useState<"insurer" | "plan" | null>(null);
  const [editingInsurer, setEditingInsurer] = useState<Insurer | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [legalName, setLegalName] = useState(""); const [tradeName, setTradeName] = useState(""); const [registration, setRegistration] = useState("");
  const [insurerId, setInsurerId] = useState(""); const [productName, setProductName] = useState(""); const [planName, setPlanName] = useState(""); const [planCode, setPlanCode] = useState(""); const [accommodation, setAccommodation] = useState("apartment"); const [copay, setCopay] = useState("");
  const [iof, setIof] = useState("0");
  const [observations, setObservations] = useState(""); const [discount, setDiscount] = useState("0"); const [minimumLives, setMinimumLives] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");

  async function loadData() {
    const client = supabaseBrowser();
    const { data: memberships } = await client.from("organization_members").select("organization_id").limit(1);
    const orgId = memberships?.[0]?.organization_id;
    if (!orgId) { setError("Cadastre a organização antes de administrar o catálogo."); return; }
    setOrganizationId(orgId);
    const [{ data: insurerRows, error: insurersError }, { data: planRows, error: plansError }] = await Promise.all([
      client.from("insurers").select("id,legal_name,trade_name,registration_number,logo_url,created_at").is("archived_at", null).order("legal_name"),
      client.from("insurer_plans").select("id,insurer_id,product_id,name,observations,discount_percent,discount_min_lives,iof_percent,plan_code,accommodation,copay_description,logo_url,insurer:insurers!insurer_plans_insurer_id_fkey(legal_name,trade_name),product:insurer_products!insurer_plans_product_id_fkey(name)").is("archived_at", null).order("name"),
    ]);
    if (insurersError || plansError) { setError(insurersError?.message ?? plansError?.message ?? "Não foi possível carregar o catálogo."); return; }
    const normalizedPlans = ((planRows ?? []) as unknown as PlanQueryRow[]).map((plan) => ({
      ...plan,
      insurer: firstRelation(plan.insurer) ?? null,
      product: firstRelation(plan.product) ?? null,
    }));
    setInsurers((insurerRows ?? []) as Insurer[]); setPlans(normalizedPlans);
  }
  useEffect(() => { void loadData(); }, []);
  useEffect(() => {
    const editFromCatalog = (event: Event) => {
      const planId = (event as CustomEvent<string>).detail;
      const plan = plans.find(item => item.id === planId);
      if (plan) editPlan(plan);
    };
    window.addEventListener("mais-cotacoes:edit-plan", editFromCatalog);
    return () => window.removeEventListener("mais-cotacoes:edit-plan", editFromCatalog);
  }, [plans]);

  function reset() { setSection(null); setEditingInsurer(null); setEditingPlan(null); setLegalName(""); setTradeName(""); setRegistration(""); setInsurerId(""); setProductName(""); setPlanName(""); setPlanCode(""); setAccommodation("apartment"); setCopay(""); setObservations(""); setIof("0"); setDiscount("0"); setMinimumLives(""); setLogoFile(null); setError(""); }
  function newInsurer() { reset(); setSection("insurer"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function editInsurer(item: Insurer) { reset(); setSection("insurer"); setEditingInsurer(item); setLegalName(item.legal_name); setTradeName(item.trade_name ?? ""); setRegistration(item.registration_number ?? ""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function newPlan() { reset(); setSection("plan"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function editPlan(item: Plan) { reset(); setSection("plan"); setEditingPlan(item); setInsurerId(item.insurer_id); setProductName(item.product?.name ?? ""); setPlanName(item.name); setPlanCode(item.plan_code ?? ""); setAccommodation(item.accommodation); setCopay(item.copay_description ?? ""); setObservations(item.observations ?? ""); setIof(String(item.iof_percent ?? 0)); setDiscount(String(item.discount_percent ?? 0)); setMinimumLives(item.discount_min_lives ? String(item.discount_min_lives) : ""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function archivePlan(item: Plan) { if (!window.confirm(`Excluir o plano “${item.name}”? Ele ficará arquivado e deixará de aparecer nas novas cotações.`)) return; const { error: archiveError } = await supabaseBrowser().from("insurer_plans").update({ archived_at: new Date().toISOString(), active: false }).eq("id", item.id); if (archiveError) { setError(archiveError.message); return; } void loadData(); }
  async function archiveInsurer(item: Insurer) { if (!window.confirm(`Excluir a operadora “${item.trade_name ?? item.legal_name}” e arquivar seus planos? Os registros já utilizados permanecerão preservados.`)) return; const client = supabaseBrowser(); const timestamp = new Date().toISOString(); const { error: plansError } = await client.from("insurer_plans").update({ archived_at: timestamp, active: false }).eq("insurer_id", item.id); if (plansError) { setError(plansError.message); return; } const { error: insurerError } = await client.from("insurers").update({ archived_at: timestamp }).eq("id", item.id); if (insurerError) { setError(insurerError.message); return; } void loadData(); }

  async function uploadLogo(folder: string) {
    if (!logoFile || !organizationId) return null;
    if (!acceptedImages.includes(logoFile.type) || logoFile.size > 5 * 1024 * 1024) throw new Error("Use uma imagem PNG, JPEG ou WebP de até 5 MB.");
    const path = `${organizationId}/logos/${folder}/${crypto.randomUUID()}-${logoFile.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const client = supabaseBrowser();
    const { error: uploadError } = await client.storage.from("mais-cotacoes-assets").upload(path, logoFile, { contentType: logoFile.type, upsert: false });
    if (uploadError) throw new Error(`Não foi possível enviar o logo: ${uploadError.message}`);
    return client.storage.from("mais-cotacoes-assets").getPublicUrl(path).data.publicUrl;
  }

  async function saveInsurer(event: FormEvent) {
    event.preventDefault(); if (!organizationId) return; setSaving(true); setError("");
    try {
      const logoUrl = await uploadLogo("operadoras");
      const values = { legal_name: legalName, trade_name: tradeName || null, registration_number: registration || null, ...(logoUrl ? { logo_url: logoUrl } : {}) };
      const query = editingInsurer ? supabaseBrowser().from("insurers").update(values).eq("id", editingInsurer.id) : supabaseBrowser().from("insurers").insert({ organization_id: organizationId, ...values });
      const { error: saveError } = await query;
      if (saveError) throw new Error(saveError.message);
      reset(); void loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar a operadora."); }
    finally { setSaving(false); }
  }

  async function savePlan(event: FormEvent) {
    event.preventDefault(); if (!organizationId || !insurerId) return; setSaving(true); setError("");
    try {
      const iofRate = Number(iof || 0);
      if (!Number.isFinite(iofRate) || iofRate < 0 || iofRate > 100) throw new Error("Informe um IOF entre 0 e 100%.");
      const percent = Number(discount || 0), minimum = Number(minimumLives);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100 || (percent > 0 && (!Number.isInteger(minimum) || minimum < 1))) throw new Error("Informe um desconto entre 0 e 100% e uma quantidade mínima inteira de pessoas.");
      const client = supabaseBrowser(); let productId = editingPlan?.product_id;
      if (!editingPlan) {
        const { data: existing } = await client.from("insurer_products").select("id").eq("insurer_id", insurerId).eq("name", productName).is("archived_at", null).limit(1);
        productId = existing?.[0]?.id;
        if (!productId) {
          const { data: product, error: productError } = await client.from("insurer_products").insert({ organization_id: organizationId, insurer_id: insurerId, name: productName, coverage: "health" }).select("id").single();
          if (productError || !product) throw new Error(productError?.message ?? "Não foi possível criar o produto.");
          productId = product.id;
        }
      }
      const logoUrl = await uploadLogo("planos");
      const values = { iof_percent: iofRate, observations: observations.trim() || null, discount_percent: percent, discount_min_lives: percent > 0 ? minimum : null, name: planName, plan_code: planCode || null, accommodation, copay_description: copay || null, ...(logoUrl ? { logo_url: logoUrl } : {}) };
      const query = editingPlan ? client.from("insurer_plans").update(values).eq("id", editingPlan.id) : client.from("insurer_plans").insert({ organization_id: organizationId, insurer_id: insurerId, product_id: productId!, ...values });
      const { error: saveError } = await query;
      if (saveError) throw new Error(saveError.message);
      reset(); void loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar o plano."); }
    finally { setSaving(false); }
  }

  return <><header className="topbar"><div><div className="eyebrow">Catálogo</div><h1>Operadoras e planos</h1></div><div style={{ display: "flex", gap: 10 }}><button className="primary" onClick={newPlan}>+ Novo plano</button><button className="primary" onClick={newInsurer}>+ Nova operadora</button></div></header>{section === "insurer" && <section className="panel" style={{ maxWidth: 760, marginBottom: 20 }}><div className="panel-head"><h2>{editingInsurer ? "Editar operadora" : "Cadastrar operadora"}</h2><button className="text-link" onClick={reset} style={{ border: 0, background: "none", cursor: "pointer" }}>Cancelar</button></div><form onSubmit={saveInsurer}><div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}><label className="field">Razão social<input value={legalName} onChange={e => setLegalName(e.target.value)} required /></label><label className="field">Nome comercial<input value={tradeName} onChange={e => setTradeName(e.target.value)} /></label><label className="field">Registro ANS<input value={registration} onChange={e => setRegistration(e.target.value)} /></label><label className="field">Logo <span style={{ fontWeight: 400, color: "#64748b" }}>(opcional)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setLogoFile(e.target.files?.[0] ?? null)} /></label></div>{error && <p className="error">{error}</p>}<button className="primary" disabled={saving}>{saving ? "Salvando…" : "Salvar operadora"}</button></form></section>}{section === "plan" && <section className="panel" style={{ maxWidth: 760, marginBottom: 20 }}><div className="panel-head"><h2>{editingPlan ? "Editar plano" : "Cadastrar plano"}</h2><button className="text-link" onClick={reset} style={{ border: 0, background: "none", cursor: "pointer" }}>Cancelar</button></div><form onSubmit={savePlan}><div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}><label className="field">Operadora<select value={insurerId} onChange={e => setInsurerId(e.target.value)} disabled={Boolean(editingPlan)} required style={{ border: "1px solid #ccd6dd", borderRadius: 8, padding: 12, background: "white" }}><option value="">Selecione</option>{insurers.map(item => <option key={item.id} value={item.id}>{item.trade_name ?? item.legal_name}</option>)}</select></label><label className="field">Produto<input value={productName} onChange={e => setProductName(e.target.value)} disabled={Boolean(editingPlan)} required placeholder="Ex.: Linha Premium" /></label><label className="field">Nome do plano<input value={planName} onChange={e => setPlanName(e.target.value)} required placeholder="Ex.: Premium 500" /></label><label className="field">Código do plano<input value={planCode} onChange={e => setPlanCode(e.target.value)} /></label><label className="field">Acomodação<select value={accommodation} onChange={e => setAccommodation(e.target.value)} style={{ border: "1px solid #ccd6dd", borderRadius: 8, padding: 12, background: "white" }}>{accommodations.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="field">Coparticipação<input value={copay} onChange={e => setCopay(e.target.value)} placeholder="Ex.: 30% para consultas" /></label><label className="field" style={{ gridColumn: "1 / -1" }}>Observações do plano<textarea value={observations} onChange={e => setObservations(e.target.value)} maxLength={1500} placeholder="Informações e condições que aparecerão na cotação." rows={3} style={{ width: "100%", padding: 10, border: "1px solid #ccd6dd", borderRadius: 8, font: "inherit" }} /></label><label className="field">IOF (%) — somente empresarial<input type="number" min="0" max="100" step="0.01" value={iof} onChange={e => setIof(e.target.value)} /><small style={{ color: "#64748b" }}>Somado à mensalidade após os descontos nas cotações empresariais. Use 0 se não houver.</small></label><label className="field">Desconto (%)<input type="number" min="0" max="100" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} /></label><label className="field">A partir de quantas pessoas?<input type="number" min="1" step="1" required={Number(discount) > 0} disabled={Number(discount) <= 0} value={minimumLives} onChange={e => setMinimumLives(e.target.value)} placeholder="Ex.: 3" /></label><p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12, color: "#64748b" }}>Ao atingir o mínimo, o desconto vale para todas as pessoas da cotação. Use 0% para desativar.</p><label className="field">Logo do plano <span style={{ fontWeight: 400, color: "#64748b" }}>(opcional)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setLogoFile(e.target.files?.[0] ?? null)} /></label></div>{error && <p className="error">{error}</p>}<button className="primary" disabled={saving || (!editingPlan && insurers.length === 0)}>{saving ? "Salvando…" : "Salvar plano"}</button>{!editingPlan && insurers.length === 0 && <p className="error">Cadastre uma operadora antes de criar um plano.</p>}</form></section>}<section className="panel" style={{ marginBottom: 20 }}><div className="panel-head"><h2>Operadoras cadastradas</h2><span style={{ color: "#64748b", fontSize: 13 }}>{insurers.length} operadora(s)</span></div>{insurers.length === 0 ? <p style={{ color: "#64748b" }}>Nenhuma operadora cadastrada.</p> : <table><thead><tr><th>Operadora</th><th>Registro ANS</th><th>Logo</th><th></th></tr></thead><tbody>{insurers.map(item => <tr key={item.id}><td><b>{item.trade_name ?? item.legal_name}</b></td><td>{item.registration_number ?? "—"}</td><td>{item.logo_url ? <img src={item.logo_url} alt="Logo" style={{ height: 28, maxWidth: 80, objectFit: "contain" }} /> : "—"}</td><td><button className="text-link" onClick={() => editInsurer(item)} style={{ border: 0, background: "none", cursor: "pointer" }}>Editar</button></td></tr>)}</tbody></table>}</section><section className="panel"><div className="panel-head"><h2>Planos cadastrados</h2><span style={{ color: "#64748b", fontSize: 13 }}>{plans.length} plano(s)</span></div>{plans.length === 0 ? <p style={{ color: "#64748b" }}>Nenhum plano cadastrado.</p> : <table><thead><tr><th>Plano</th><th>Operadora</th><th>Acomodação</th><th>Logo</th><th></th></tr></thead><tbody>{plans.map(item => <tr key={item.id}><td><b>{item.name}</b><br /><small style={{ color: "#64748b" }}>{item.product?.name} {item.plan_code ? `• ${item.plan_code}` : ""}</small></td><td>{item.insurer?.trade_name ?? item.insurer?.legal_name}</td><td>{accommodations.find(option => option.value === item.accommodation)?.label ?? item.accommodation}</td><td>{item.logo_url ? <img src={item.logo_url} alt="Logo" style={{ height: 28, maxWidth: 80, objectFit: "contain" }} /> : "—"}</td><td><button className="text-link" onClick={() => editPlan(item)} style={{ border: 0, background: "none", cursor: "pointer" }}>Editar</button></td></tr>)}</tbody></table>}</section></>;
}
