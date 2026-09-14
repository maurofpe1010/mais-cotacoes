"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

const acceptedImages = ["image/png", "image/jpeg", "image/webp"];

export default function SettingsPage() {
  const [organizationId, setOrganizationId] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { void (async () => {
    const client = supabaseBrowser();
    const { data: membership } = await client.from("organization_members").select("organization_id").limit(1).single();
    if (!membership) { setMessage("Não foi possível localizar a corretora."); return; }
    setOrganizationId(membership.organization_id);
    const { data, error } = await client.from("organizations").select("logo_url,pdf_contact_name,whatsapp").eq("id", membership.organization_id).single();
    if (error) { setMessage("Para ativar a identidade visual e os dados do PDF, execute os arquivos SQL 012 e 013 no Supabase."); return; }
    setLogoUrl(data?.logo_url ?? null);
    if (data?.logo_url) window.localStorage.setItem("mais-cotacoes-logo", data.logo_url);
    setContactName(data?.pdf_contact_name ?? "");
    setWhatsapp(data?.whatsapp ?? "");
  })(); }, []);

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !organizationId) return;
    if (!acceptedImages.includes(file.type) || file.size > 5 * 1024 * 1024) { setMessage("Use uma imagem PNG, JPEG ou WebP de até 5 MB."); return; }
    setSaving(true); setMessage("");
    const client = supabaseBrowser();
    const path = `${organizationId}/logos/corretora/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error: uploadError } = await client.storage.from("mais-cotacoes-assets").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { setMessage(`Não foi possível enviar a logo: ${uploadError.message}`); setSaving(false); return; }
    const publicUrl = client.storage.from("mais-cotacoes-assets").getPublicUrl(path).data.publicUrl;
    const { error: saveError } = await client.from("organizations").update({ logo_url: publicUrl }).eq("id", organizationId);
    if (saveError) { setMessage(`A imagem foi enviada, mas não foi possível vinculá-la: ${saveError.message}`); setSaving(false); return; }
    setLogoUrl(publicUrl); window.localStorage.setItem("mais-cotacoes-logo", publicUrl); setSaving(false); setMessage("Logo atualizada. Ela aparecerá no sistema, na abertura e nos próximos PDFs.");
  }

  async function savePdfContact() {
    if (!organizationId) return;
    setSaving(true); setMessage("");
    const { error } = await supabaseBrowser().from("organizations").update({ pdf_contact_name: contactName || null, whatsapp: whatsapp || null }).eq("id", organizationId);
    setSaving(false);
    setMessage(error ? `Não foi possível salvar: ${error.message}` : "Dados do PDF atualizados.");
  }

  return <><div className="eyebrow">Configurações</div><h1>Identidade visual</h1><section className="panel" style={{ maxWidth: 720 }}><h2>Logo da corretora</h2><p style={{ color: "#64748b" }}>Envie a logo que deverá aparecer no painel e no PDF das cotações.</p>{logoUrl && <img src={logoUrl} alt="Logo atual" style={{ width: 230, maxHeight: 110, objectFit: "contain", display: "block", margin: "18px 0", border: "1px solid #e5eaf0", borderRadius: 8, padding: 8 }} />}<label className="field">Arquivo da logo<input type="file" accept="image/png,image/jpeg,image/webp" disabled={saving} onChange={(event) => void uploadLogo(event)} /></label><hr style={{ border: 0, borderTop: "1px solid #e5eaf0", margin: "26px 0" }} /><h2>Dados exibidos no PDF</h2><label className="field">Seu nome<input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Ex.: Mauro Fernando Filho" /></label><label className="field">WhatsApp<input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="Ex.: (00) 00000-0000" /></label><button className="primary" disabled={saving} onClick={() => void savePdfContact()}>Salvar dados do PDF</button>{message && <p className={message.startsWith("Não") || message.startsWith("Para") ? "error" : "notice"}>{message}</p>}</section></>;
}
