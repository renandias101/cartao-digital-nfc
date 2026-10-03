/**
 * Cria o usuário administrador real no projeto Supabase (PRD §3.1, §60).
 *
 * Script isolado, fora do bundle do Next — não importa nada de `src/lib`
 * porque `server-only` só é entendido pelo bundler do Next, não pelo Node
 * puro. Usa `@supabase/supabase-js` diretamente com a chave secreta.
 *
 * Pré-requisito: as migrations já aplicadas no projeto (as três em
 * supabase/migrations/, na ordem). Sem elas, `private.admins` não existe e
 * este script falha ao inserir.
 *
 * Uso:
 *   node --env-file=.env.local scripts/create-admin.mjs
 *
 * Lê de `.env.local`: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
 * ADMIN_USERNAME, ADMIN_PASSWORD.
 *
 * Idempotente: se o admin já existir (mesmo e-mail sintético), atualiza a
 * senha em vez de duplicar.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const USERNAME = process.env.ADMIN_USERNAME;
const PASSWORD = process.env.ADMIN_PASSWORD;

for (const [nome, valor] of Object.entries({ URL, SECRET, USERNAME, PASSWORD })) {
  if (!valor) {
    console.error(`Faltando variável: ${nome}. Rode com --env-file=.env.local.`);
    process.exit(1);
  }
}

const usernameNormalizado = USERNAME.trim().toLowerCase();
const email = `${usernameNormalizado}@internal.cartao.local`;

const admin = createClient(URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`Verificando se o schema está pronto (private.admins)…`);
const { error: erroSchema } = await admin
  .from("reserved_usernames")
  .select("username")
  .limit(1);
if (erroSchema) {
  console.error(
    "Não consegui ler 'reserved_usernames'. As migrations já foram aplicadas neste projeto?",
  );
  console.error(`Detalhe: ${erroSchema.message}`);
  process.exit(1);
}

console.log(`Procurando usuário existente com e-mail ${email}…`);
const { data: existentes, error: erroLista } = await admin.auth.admin.listUsers();
if (erroLista) {
  console.error(`Erro ao listar usuários: ${erroLista.message}`);
  process.exit(1);
}

const existente = existentes.users.find((u) => u.email === email);

let userId;
if (existente) {
  console.log(`Usuário já existe (${existente.id}). Atualizando senha…`);
  const { data, error } = await admin.auth.admin.updateUserById(existente.id, {
    password: PASSWORD,
  });
  if (error) {
    console.error(`Erro ao atualizar senha: ${error.message}`);
    process.exit(1);
  }
  userId = data.user.id;
} else {
  console.log("Criando usuário novo…");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) {
    console.error(`Erro ao criar usuário: ${error.message}`);
    process.exit(1);
  }
  userId = data.user.id;
}

console.log(`Registrando ${userId} como administrador…`);
const { error: erroAdmins } = await admin.rpc("upsert_admin", {
  p_user_id: userId,
  p_username: usernameNormalizado,
});

if (erroAdmins) {
  console.error(`Erro ao gravar em private.admins: ${erroAdmins.message}`);
  console.error("Rode manualmente no SQL Editor, se necessário:");
  console.error(
    `  select public.upsert_admin('${userId}', '${usernameNormalizado}');`,
  );
  process.exit(1);
}

console.log(`\nAdministrador pronto: usuário "${usernameNormalizado}", id ${userId}.`);
