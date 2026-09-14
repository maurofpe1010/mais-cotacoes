"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

type Plan = { id: string; name: string; main_hospitals: string | null; insurer: { trade_name: string | null; legal_name: string | null } | null };

export function PlanHospitalsManager() {
  const pathname = usePathname(); const [plans, setPlans] = useState<Plan[]>([]); const [editing, setEditing] = useState<string | null>(null); const [value, setValue] = useState(""); const [message, setMessage] = useState("");
  async function loadPlans() { const { data, error } = await supabaseBrowser().from("insurer_plans").select("id,name,main_hospitals,insurer:insurers(trade_name,legal_name)").is("archived_at", null).order("name"); if (error) { setMessage("Para cadastrar hospitais, execute primeiro o arquivo SQL 013 no Supabase."); return; } setPlans((data ?? []) as unknown as Plan[]); }
  useEffect(() => { if (pathname === "/dashboard/plans") void loadPlans(); }, [pathname]);
  async function save(plan: Plan) { const { error } = await supabaseBrowser().from("insurer_plans").update({ main_hospitals: value || null }).eq("id", plan.id); if (error) { setMessage(error.message); return; } setEditing(null); setMessage("Hospitais salvos."); void loadPlans(); }
  if (pathname !== "/dashboard/plans" || (plans.length === 0 && !message)) return null;
  return <section className="panel" style={{ marginTop: 20 }}><div className="panel-head"><div><h2>Principais hospitais por plano</h2><p style={{ color: "#64748b", fontSize: 13, margin: "5px 0 0" }}>Essas informações serão exibidas na segunda página do PDF.</p></div></div>{message && <p className={message === "Hospitais salvos." ? "notice" : "error"}>{message}</p>}{plans.map((plan) => <div key={plan.id} style={{ borderTop: "1px solid #e5eaf0", padding: "14px 0" }}><b>{plan.insurer?.trade_name ?? plan.insurer?.legal_name} — {plan.name}</b>{editing === plan.id ? <><textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder="Ex.: Hospital A, Hospital B, Hospital C" style={{ width: "100%", minHeight: 82, marginTop: 10, padding: 10, border: "1px solid #ccd6dd", borderRadius: 8, font: "inherit" }} /><div style={{ display: "flex", gap: 10, marginTop: 8 }}><button className="primary" onClick={() => void save(plan)}>Salvar hospitais</button><button className="secondary" onClick={() => setEditing(null)}>Cancelar</button></div></> : <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", marginTop: 7 }}><span style={{ color: "#64748b", whiteSpace: "pre-line" }}>{plan.main_hospitals || "Nenhum hospital informado."}</span><button className="text-link" onClick={() => { setEditing(plan.id); setValue(plan.main_hospitals ?? ""); }} style={{ border: 0, background: "none", cursor: "pointer" }}>Editar hospitais</button></div>}</div>)}</section>;
}
