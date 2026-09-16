export type Company = { cnpj: string; name: string; tradeName: string; size: string; legalNature: string; mei: boolean | null; city: string; state: string; status: string; active: boolean | null; source: string; consultedAt: string };
export function normalizeCnpj(value: string) { return value.toUpperCase().replace(/[.\/\s-]/g, ""); }
export function validCnpj(value: string) {
  const cnpj = normalizeCnpj(value);
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj) || /^(.)\1+$/.test(cnpj)) return false;
  const digit = (base: string) => { let weight = 2, sum = 0; for (let i = base.length - 1; i >= 0; i--) { sum += (base.charCodeAt(i) - 48) * weight; weight = weight === 9 ? 2 : weight + 1; } const remainder = sum % 11; return remainder < 2 ? "0" : String(11 - remainder); };
  return cnpj[12] === digit(cnpj.slice(0,12)) && cnpj[13] === digit(cnpj.slice(0,13));
}
export function companyFromResponse(data: Record<string, unknown>, cnpj: string): Company {
  const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const statusCode = data.situacao_cadastral;
  return { cnpj, name: text(data.razao_social), tradeName: text(data.nome_fantasia), size: text(data.porte), legalNature: text(data.natureza_juridica), mei: typeof data.opcao_pelo_mei === "boolean" ? data.opcao_pelo_mei : null, city: text(data.municipio), state: text(data.uf), status: text(data.descricao_situacao_cadastral) || "Não informada", active: typeof statusCode === "number" ? statusCode === 2 : null, source: "Dados públicos da Receita Federal via BrasilAPI/Minha Receita", consultedAt: new Date().toISOString() };
}
