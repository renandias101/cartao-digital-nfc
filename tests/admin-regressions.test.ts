import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { removerArquivosEmLotes, type StorageFolder } from "../src/lib/card/storage-cleanup";
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
  const authUpdate = source.indexOf("admin.auth.admin.updateUserById");
  const completion = source.indexOf('supabase.rpc("admin_complete_password_reset"');
  assert.ok(authUpdate >= 0 && completion > authUpdate);
  assert.match(source, /if \(authError\)[\s\S]*pedido continua pendente/);
  assert.match(source, /if \(completionError\)[\s\S]*pedido continua pendente/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:newPassword|new_password)/);
});

test("recuperação pública usa a mesma mensagem para conta válida, inexistente ou inativa", () => {
  const source = readFileSync(new URL("../src/lib/auth/password-recovery.ts", import.meta.url), "utf8");
  assert.match(source, /Se o usuário estiver ativo, a administração foi avisada/);
  assert.doesNotMatch(source, /conta (?:existe|inexistente|inativa)/i);
});

test("Next permite a rota privada e a arte estática do login", () => {
  const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /pathname: ["']\/api\/card-image["']/);
  assert.match(config, /pathname: ["']\/images\/login-reference-renan\.webp["']/);
  assert.doesNotMatch(config, /localPatterns:[\s\S]*pathname:\s*["']\/\*\*/);
});
