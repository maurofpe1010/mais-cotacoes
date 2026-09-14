import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ connected: false, reason: "Variáveis de configuração ausentes." }, { status: 500 });
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
    });

    return NextResponse.json({
      connected: response.ok,
      status: response.status,
      reason: response.ok ? "Conexão com Supabase confirmada." : "O Supabase recusou a chave ou a URL.",
    }, { status: response.ok ? 200 : 502 });
  } catch {
    return NextResponse.json({ connected: false, reason: "Não foi possível alcançar o Supabase." }, { status: 502 });
  }
}
