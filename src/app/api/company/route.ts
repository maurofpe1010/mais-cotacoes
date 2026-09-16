import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { companyFromResponse, normalizeCnpj, validCnpj } from "@/lib/company";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const cnpj = normalizeCnpj(request.nextUrl.searchParams.get("cnpj") || "");
  if (!validCnpj(cnpj)) return NextResponse.json({ error: "CNPJ inválido. Confira os caracteres e os dígitos verificadores." }, { status: 400 });
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return NextResponse.json({ error: "Entre no aplicativo para consultar o CNPJ." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Consulta indisponível." }, { status: 503 });
  try {
    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data.user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
    if (!/^\d{14}$/.test(cnpj)) return NextResponse.json({ error: "Este provedor ainda não oferece consulta de CNPJ alfanumérico. Consulte o comprovante oficial." }, { status: 422 });
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: AbortSignal.timeout(10000), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: response.status === 404 ? "CNPJ não encontrado na base pública. Confira o número ou tente novamente mais tarde." : response.status === 429 ? "Limite de consultas atingido. Aguarde e tente novamente." : "A consulta está temporariamente indisponível. Tente novamente." }, { status: response.status === 404 ? 404 : 503 });
    const raw = await response.json();
    if (normalizeCnpj(String(raw.cnpj ?? "")) !== cnpj || typeof raw.razao_social !== "string" || !raw.razao_social.trim()) return NextResponse.json({ error: "A fonte retornou dados incompletos. Tente novamente." }, { status: 502 });
    return NextResponse.json(companyFromResponse(raw, cnpj), { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Não foi possível concluir a consulta. Verifique a conexão e tente novamente." }, { status: 503 }); }
}
