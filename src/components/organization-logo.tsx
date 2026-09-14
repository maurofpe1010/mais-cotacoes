"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

export function OrganizationLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const client = supabaseBrowser();
      const { data: membership } = await client.from("organization_members").select("organization_id").limit(1).single();
      if (!membership) return;
      const { data } = await client.from("organizations").select("logo_url").eq("id", membership.organization_id).single();
      setLogoUrl(data?.logo_url ?? null);
    })();
  }, []);
  return <img data-org-logo src={logoUrl ?? "/mais-corretora-logo.png"} alt="Mais Corretora" style={{ display: "block", width: "100%", maxHeight: 72, objectFit: "contain", objectPosition: "center", marginBottom: 14, background: "white", borderRadius: 8, padding: 7 }} />;
}
