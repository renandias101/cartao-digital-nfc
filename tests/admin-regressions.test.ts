import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { removerArquivosEmLotes, type StorageFolder } from "../src/lib/card/storage-cleanup";
import { classifyTotpFactors } from "../src/lib/auth/mfa-factors";
import { normalizarPagina, totalDePaginas } from "../src/lib/pagination";
import { resolverSiteUrl } from "../src/lib/env";

test("usa automaticamente o domínio público no deploy e preserva domínio explícito", () => {
  assert.equal(resolverSiteUrl("http://localhost:3000", "cartao.exemplo.com"), "https://cartao.exemplo.com");
  assert.equal(resolverSiteUrl(undefined, "projeto.vercel.app"), "https://projeto.vercel.app");
  assert.equal(resolverSiteUrl("https://meudominio.com/", "projeto.vercel.app"), "https://meudominio.com");
  assert.equal(resolverSiteUrl("http://localhost:3000", undefined), "http://localhost:3000");
});

test("a listagem inicial não depende de uma migration ainda não aplicada", () => {
  const fonte = readFileSync(new URL("../src/lib/admin/clients.ts", import.meta.url), "utf8");
  assert.doesNotMatch(fonte, /\.rpc\("admin_count_clients"/);
  assert.match(fonte, /p_limit: 1,[\s\S]*p_offset: 0/);
});

test("normaliza páginas inválidas e calcula páginas acima de 100 registros", () => {
  for (const valor of ["-1", "0", "1.5", "Infinity", "NaN", undefined]) {
    assert.equal(normalizarPagina(valor), 1);
  }
  assert.equal(normalizarPagina("6"), 6);
  assert.equal(totalDePaginas(101, 20), 6);
  assert.equal(totalDePaginas(0, 20), 1);
});

test("remove mais de 100 imagens buscando sempre o primeiro lote restante", async () => {
  const arquivos = Array.from({ length: 205 }, (_, i) => `imagem-${String(i).padStart(3, "0")}.webp`);
  const offsets: number[] = [];
  const resultado = await removerArquivosEmLotes({
    list: async (_path, options) => {
      offsets.push(options.offset);
      return { data: arquivos.slice(0, options.limit).map((name) => ({ name })), error: null };
    },
    remove: async (paths) => {
      arquivos.splice(0, paths.length);
      return { error: null };
    },
  }, "cliente");
  assert.deepEqual(resultado, { ok: true, removidas: 205 });
  assert.deepEqual(offsets, [0, 0, 0, 0]);
});

test("interrompe em erro e permite repetir a limpeza sem pular imagens", async () => {
  const arquivos = Array.from({ length: 120 }, (_, i) => `imagem-${i}.webp`);
  let falhar = true;
  const storage: StorageFolder = {
    list: async (_path, options) => ({
      data: arquivos.slice(0, options.limit).map((name) => ({ name })), error: null,
    }),
    remove: async (paths: string[]) => {
      if (falhar) { falhar = false; return { error: new Error("falha simulada") }; }
      arquivos.splice(0, paths.length);
      return { error: null };
    },
  };
  const primeira = await removerArquivosEmLotes(storage, "cliente");
  assert.equal(primeira.ok, false);
  assert.equal(arquivos.length, 120);
  const segunda = await removerArquivosEmLotes(storage, "cliente");
  assert.deepEqual(segunda, { ok: true, removidas: 120 });
  assert.equal(arquivos.length, 0);
});

test("pedido de senha só é concluído depois do sucesso no provedor de autenticação", () => {
  const source = readFileSync(new URL("../src/lib/admin/password-reset-requests.ts", import.meta.url), "utf8");
  const claim = source.indexOf('supabase.rpc("admin_claim_password_reset"');
  const authUpdate = source.indexOf("admin.auth.admin.updateUserById");
  const completion = source.indexOf('supabase.rpc("admin_complete_password_reset"');
  assert.ok(claim >= 0 && authUpdate > claim && completion > authUpdate);
  assert.match(source, /if \(authError\)[\s\S]*pedido continua pendente/);
  assert.match(source, /if \(completionError\)[\s\S]*pedido continua pendente/);
  assert.match(source, /admin_release_password_reset_claim/g);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:newPassword|new_password)/);
});

test("recuperação envia somente hashes para registrar a tentativa", () => {
  const source = readFileSync(new URL("../src/lib/auth/password-recovery.ts", import.meta.url), "utf8");
  assert.match(source, /usernameHash = createHash\("sha256"\)/);
  assert.match(source, /p_username_hash: usernameHash/);
});

test("MFA prioriza fator verificado e identifica cadastros TOTP incompletos", () => {
  const factors = classifyTotpFactors([
    { id: "phone", factor_type: "phone", status: "unverified" },
    { id: "old-a", factor_type: "totp", status: "unverified" },
    { id: "verified", factor_type: "totp", status: "verified" },
    { id: "old-b", factor_type: "totp", status: "unverified" },
  ]);
  assert.deepEqual(factors, { verifiedId: "verified", unverifiedIds: ["old-a", "old-b"] });
});

test("tela MFA limpa somente fatores incompletos e oferece saída segura", () => {
  const source = readFileSync(new URL("../src/app/mfa/mfa-form.tsx", import.meta.url), "utf8");
  assert.match(source, /data\.all/);
  assert.match(source, /mfa\.unenroll\(\{ factorId: unverifiedId \}\)/);
  assert.match(source, /preparationRef\.current/);
  assert.match(source, /auth\.signOut\(\)/);
  assert.match(source, /Gerar um novo QR Code/);
});

test("recuperação pública usa a mesma mensagem para conta válida, inexistente ou inativa", () => {
  const source = readFileSync(new URL("../src/lib/auth/password-recovery.ts", import.meta.url), "utf8");
  assert.match(source, /Se o usuário estiver ativo, a administração foi avisada/);
  assert.doesNotMatch(source, /conta (?:existe|inexistente|inativa)/i);
});

test("Next impede cache otimizado da rota privada e permite a arte estática do login", () => {
  const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.doesNotMatch(config, /pathname: ["']\/api\/card-image["']/);
  assert.match(config, /pathname: ["']\/images\/login-reference-renan\.webp["']/);
  assert.doesNotMatch(config, /localPatterns:[\s\S]*pathname:\s*["']\/\*\*/);

  const card = readFileSync(new URL("../src/components/digital-card.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(card, /<Image src=\{content\.(?:banner|profilePhoto)\}/);
  assert.match(card, /<img src=\{content\.banner\}/);
  assert.match(card, /<img src=\{content\.profilePhoto\}/);

  const imageField = readFileSync(new URL("../src/app/painel/editor/image-field.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(imageField, /from ["']next\/image["']/);
  assert.match(imageField, /<img[\s\S]*?src=\{valor\}/);

  const buttonView = readFileSync(new URL("../src/app/[username]/button-view.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(buttonView, /from ["']next\/image["']/);
  assert.match(buttonView, /<img src=\{button\.icon\}/);
});
