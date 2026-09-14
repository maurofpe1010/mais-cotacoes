"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

type Item = { id: string; title: string; effective_from: string; plan: { name: string } | null };
type ItemQueryRow = Omit<Item, "plan"> & { plan: { name: string }[] | null };

export function PricingEditShortcuts() {
  const path = usePathname(); const [items, setItems] = useState<Item[]>([]);
  async function loadItems() {
    const { data } = await supabaseBrowser().from("pricing_tables").select("id,title,effective_from,plan:insurer_plans!pricing_tables_plan_id_fkey(name)").is("archived_at", null).order("effective_from", { ascending: false });
    setItems(((data ?? []) as unknown as ItemQueryRow[]).map((item) => ({ ...item, plan: item.plan?.[0] ?? null })));
  }
  useEffect(() => { if (path === "/dashboard/pricing") void loadItems(); }, [path]);
  async function archiveTable(item: Item) {
    if (!window.confirm(`Excluir a tabela “${item.title}”? Ela ficará arquivada e não será usada em novas cotações.`)) return;
    await supabaseBrowser().from("pricing_tables").update({ archived_at: new Date().toISOString(), is_active: false }).eq("id", item.id);
    await loadItems();
  }
  if (path !== "/dashboard/pricing" || items.length === 0) return null;
  return <section className="panel" style={{ marginTop: 20 }}><div className="panel-head"><h2>Administrar tabelas de preço</h2><span style={{ color: "#64748b", fontSize: 13 }}>Edite ou arquive uma tabela.</span></div><table><thead><tr><th>Tabela</th><th>Plano</th><th>Vigência</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><b>{item.title}</b></td><td>{item.plan?.name}</td><td>{new Date(`${item.effective_from}T12:00:00`).toLocaleDateString("pt-BR")}</td><td style={{ whiteSpace: "nowrap" }}><Link className="text-link" href={`/dashboard/pricing/edit?id=${item.id}`}>Editar</Link><button className="text-link" onClick={() => void archiveTable(item)} style={{ border: 0, background: "none", cursor: "pointer", color: "#b42318", marginLeft: 10 }}>Excluir</button></td></tr>)}</tbody></table></section>;
}
