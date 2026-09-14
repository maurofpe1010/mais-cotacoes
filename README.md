# MAIS COTAÇÕES

Aplicativo web para CRM e cotação de planos, conectado ao projeto Supabase já estruturado.

## Primeiro uso

1. Copie `.env.local.example` para `.env.local`.
2. No Supabase, abra **Project Settings → API** e copie a URL do projeto e a chave **Publishable** para esse arquivo.
3. Instale as dependências com `pnpm install` e execute `pnpm dev`.

O primeiro login criará automaticamente o perfil. A etapa seguinte do app criará a organização da corretora através da função `create_organization_with_owner` já instalada no banco.

Nunca coloque a chave `service_role` no aplicativo.
