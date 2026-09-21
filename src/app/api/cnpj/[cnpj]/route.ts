import { NextResponse } from "next/server";

function digits(value: string) { return value.replace(/\D/g, ""); }
function validCnpj(value: string) {
  const cnpj = digits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const check = (length: number) => {
    let sum = 0; let weight = length - 7;
    for (let index = 0; index < length; index += 1) { sum += Number(cnpj[index]) * weight--; if (weight < 2) weight = 9; }
    return (sum % 11 < 2 ? 0 : 11 - sum % 11) === Number(cnpj[length]);
  };
  return check(12) && check(13);
}

export async function GET(_request: Request, context: { params: Promise<{ cnpj: string }> }) {
  const cnpj = digits((await context.params).cnpj);
  if (!validCnpj(cnpj)) return NextResponse.json({ error: "CNPJ inválido." }, { status: 400 });
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { next: { revalidate: 86400 } });
    if (!response.ok) return NextResponse.json({ error: response.status === 404 ? "CNPJ não encontrado." : "Consulta de CNPJ indisponível." }, { status: response.status === 404 ? 404 : 502 });
    const data = await response.json();
    return NextResponse.json({ cnpj, legalName: data.razao_social || "", tradeName: data.nome_fantasia || "", size: data.opcao_pelo_mei ? "MEI" : data.descricao_porte || data.porte || "", legalNature: data.natureza_juridica || "", city: data.municipio || "", state: data.uf || "" });
  } catch { return NextResponse.json({ error: "Não foi possível consultar o CNPJ agora." }, { status: 502 }); }
}
