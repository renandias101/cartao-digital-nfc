/**
 * Testes de isolamento e RLS.
 *
 * Roda as migrations reais num Postgres em WASM (PGlite) sobre um shim da
 * superfície do Supabase, assume a identidade de cada papel e verifica quem
 * alcança o quê.
 *
 * O requisito que estes testes existem para provar é o PRD §42: alterar id,
 * parâmetro ou requisição não pode dar acesso ao dado de outro cliente.
 *
 * Executar com: npm run test:rls
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

const AQUI = dirname(fileURLToPath(import.meta.url));

const CLIENTE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENTE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VENCIDO = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CANCELADO = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const ABANDONADO = "ffffffff-ffff-4fff-8fff-ffffffffffff";

let passou = 0;
let falhou = 0;
const falhas = [];

function verificar(nome, condicao, detalhe = "") {
  if (condicao) {
    passou++;
    console.log(`  ok    ${nome}`);
  } else {
    falhou++;
    falhas.push(nome);
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

function secao(titulo) {
  console.log(`\n${titulo}`);
}

/** Executa SQL assumindo um papel e uma identidade, e desfaz tudo ao final. */
async function comoPapel(db, papel, sub, sql) {
  const claims = sub ? JSON.stringify({ sub, role: papel }) : null;
  const preparo = [
    "begin",
    `set local role ${papel}`,
    claims ? `set local "request.jwt.claims" = '${claims}'` : null,
  ]
    .filter(Boolean)
    .join(";\n");

  try {
    const resultados = await db.exec(`${preparo};\n${sql};`);
    await db.exec("rollback");
    return { ok: true, resultado: resultados.at(-1) };
  } catch (erro) {
    try {
      await db.exec("rollback");
    } catch {
      // transação já abortada
    }
    return { ok: false, erro: String(erro.message ?? erro) };
  }
}

/** Conta linhas visíveis para um papel numa consulta. */
async function linhas(db, papel, sub, sql) {
  const r = await comoPapel(db, papel, sub, sql);
  return r.ok ? r.resultado.rows : null;
}

/**
 * Como `comoPapel`, mas CONFIRMA a transação em vez de desfazê-la.
 *
 * Usar quando o próprio efeito da operação precisa sobreviver para uma
 * consulta seguinte enxergar (auditoria gravada, segunda chamada observando
 * o resultado da primeira, exclusão real). `SET ROLE`/`SET` sem `LOCAL` são
 * de sessão, não de transação — por isso o `RESET` explícito no fim, para não
 * vazar o papel assumido para o resto da suíte.
 */
async function comoPapelConfirmando(db, papel, sub, sql) {
  const claims = sub ? JSON.stringify({ sub, role: papel }) : null;
  try {
    await db.exec(`set role ${papel}`);
    if (claims) await db.exec(`set "request.jwt.claims" = '${claims}'`);
    const resultados = await db.exec(`${sql};`);
    return { ok: true, resultado: resultados.at(-1) };
  } catch (erro) {
    return { ok: false, erro: String(erro.message ?? erro) };
  } finally {
    await db.exec("reset role");
    if (claims) await db.exec(`reset "request.jwt.claims"`);
  }
}

async function principal() {
  console.log("Subindo Postgres em WASM e aplicando as migrations…");
  const db = await PGlite.create();

  const versao = (await db.query("select version()")).rows[0].version;
  console.log(`  ${versao.split(",")[0]}`);

  // Shim + migrations, na ordem.
  await db.exec(readFileSync(join(AQUI, "supabase-shim.sql"), "utf8"));
  const migracoes = [
    "20260929120000_schema_inicial.sql",
    "20260929120100_rls_e_privilegios.sql",
    "20260929130000_autenticacao.sql",
    "20260930100000_vencimento_e_renovacao.sql",
    "20260930110000_painel_administrativo.sql",
    "20260930120000_estrutura_do_cartao.sql",
    "20260930130000_sistema_de_botoes.sql",
    "20260930140000_ocultar_botoes_desativados.sql",
    "20260930150000_pagina_publica.sql",
    // 20260930160000_upload_de_imagens.sql fica fora: referencia
    // storage.objects/storage.foldername, que não existem no PGlite puro
    // (D50) — verificado por script real contra o projeto, não aqui.
    "20260930170000_painel_do_cliente.sql",
    "20260930180000_normalizar_username_pagina_publica.sql",
    "20260930190000_username_exists_cobre_cliente_excluido.sql",
    "20261003150000_card_profession.sql",
    "20261003190000_card_accent_color.sql",
  ];
  for (const m of migracoes) {
    await db.exec(readFileSync(join(AQUI, "..", "migrations", m), "utf8"));
    console.log(`  aplicada: ${m}`);
  }

  // -------------------------------------------------------------------------
  // Massa de teste. Inserida como superusuário, que ignora RLS de propósito —
  // é o equivalente ao papel de serviço.
  // -------------------------------------------------------------------------
  await db.exec(`
    insert into auth.users (id, email) values
      ('${CLIENTE_A}', 'a@interno'), ('${CLIENTE_B}', 'b@interno'),
      ('${ADMIN}', 'admin@interno'), ('${VENCIDO}', 'v@interno'),
      ('${CANCELADO}', 'c@interno'), ('${ABANDONADO}', 'x@interno');

    insert into private.admins (user_id, username) values ('${ADMIN}', 'admin-teste');

    insert into public.clients (id, username, full_name, package_months, expires_at, cancelled_at) values
      ('${CLIENTE_A}', 'cliente-a', 'Cliente A', 12, now() + interval '100 days', null),
      ('${CLIENTE_B}', 'cliente-b', 'Cliente B', 6,  now() + interval '50 days',  null),
      ('${ADMIN}',     'admin-user','Dono',       12, now() + interval '999 days', null),
      ('${VENCIDO}',   'vencido',   'Vencido',    3,  now() - interval '2 days',   null),
      ('${CANCELADO}', 'cancelado', 'Cancelado',  3,  now() + interval '30 days',  now()),
      ('${ABANDONADO}','abandonado','Abandonado', 3,  now() - interval '40 days',  null);

    insert into public.card_drafts (client_id, content) values
      ('${CLIENTE_A}', '{"buttons": [], "nome": "RASCUNHO SECRETO DE A"}'),
      ('${CLIENTE_B}', '{"buttons": [], "nome": "RASCUNHO SECRETO DE B"}');

    insert into public.card_published (client_id, content) values
      ('${CLIENTE_A}', '{"buttons": [], "nome": "A publicado", "displayName": "A", "backgroundColor": "#ffffff", "buttonColor": "#000000"}'),
      ('${CLIENTE_B}', '{"buttons": [], "nome": "B publicado", "displayName": "B", "backgroundColor": "#ffffff", "buttonColor": "#000000"}'),
      ('${VENCIDO}',   '{"buttons": [], "nome": "Vencido publicado", "displayName": "V", "backgroundColor": "#ffffff", "buttonColor": "#000000"}'),
      ('${CANCELADO}', '{"buttons": [], "nome": "Cancelado publicado", "displayName": "C", "backgroundColor": "#ffffff", "buttonColor": "#000000"}'),
      ('${ABANDONADO}','{"buttons": [], "nome": "Abandonado publicado", "displayName": "X", "backgroundColor": "#ffffff", "buttonColor": "#000000"}');

    insert into public.client_notes (client_id, notes) values
      ('${CLIENTE_A}', 'OBSERVACAO INTERNA SOBRE A'),
      ('${CLIENTE_B}', 'OBSERVACAO INTERNA SOBRE B');

    insert into public.admin_audit_log (action, client_id, client_username, client_full_name, actor_id)
    values ('client_created', '${CLIENTE_A}', 'cliente-a', 'Cliente A', '${ADMIN}');
  `);
  console.log("  massa de teste inserida");

  // =========================================================================
  secao("1. Status derivado (PRD §21 a §27)");
  // =========================================================================
  const st = async (u) =>
    (
      await db.query(
        `select public.effective_status(expires_at, cancelled_at) as s
         from public.clients where username = $1`,
        [u],
      )
    ).rows[0].s;

  verificar("cliente em dia => active", (await st("cliente-a")) === "active");
  verificar("2 dias vencido => expired", (await st("vencido")) === "expired");
  verificar(
    "40 dias vencido => cancelled automaticamente",
    (await st("abandonado")) === "cancelled",
  );
  verificar(
    "cancelado manualmente vence a data futura",
    (await st("cancelado")) === "cancelled",
  );

  const limite = await db.query(`
    select
      public.effective_status(now() - interval '14 days', null) as d14,
      public.effective_status(now() - interval '16 days', null) as d16
  `);
  verificar("14 dias vencido ainda é expired", limite.rows[0].d14 === "expired");
  verificar("16 dias vencido já é cancelled", limite.rows[0].d16 === "cancelled");

  // =========================================================================
  secao("2. Visitante (anon) não alcança tabela nenhuma");
  // =========================================================================
  for (const t of [
    "clients",
    "card_drafts",
    "card_published",
    "client_notes",
    "admin_audit_log",
    "reserved_usernames",
  ]) {
    const r = await comoPapel(db, "anon", null, `select * from public.${t}`);
    verificar(
      `anon bloqueado em ${t}`,
      !r.ok && /permission denied/i.test(r.erro),
      r.ok ? "LEU A TABELA" : r.erro,
    );
  }

  const admins = await comoPapel(db, "anon", null, "select * from private.admins");
  verificar(
    "anon bloqueado em private.admins",
    !admins.ok,
    admins.ok ? "LEU A TABELA" : "",
  );

  // =========================================================================
  secao("3. Acesso público pela função (PRD §24, §27, §49, §50, §62)");
  // =========================================================================
  const cartao = async (papel, u) => {
    const r = await comoPapel(
      db,
      papel,
      null,
      `select public.get_public_card('${u}') as c`,
    );
    return r.ok ? r.resultado.rows[0].c : `ERRO: ${r.erro}`;
  };

  const aPublico = await cartao("anon", "cliente-a");
  verificar(
    "cartão de cliente ativo é entregue",
    aPublico && aPublico.nome === "A publicado",
    JSON.stringify(aPublico),
  );
  verificar(
    "cartão de cliente VENCIDO não é entregue",
    (await cartao("anon", "vencido")) === null,
  );
  verificar(
    "cartão de cliente CANCELADO não é entregue",
    (await cartao("anon", "cancelado")) === null,
  );
  verificar(
    "cartão de cliente auto-cancelado não é entregue",
    (await cartao("anon", "abandonado")) === null,
  );
  verificar(
    "usuário inexistente não é entregue",
    (await cartao("anon", "nao-existe")) === null,
  );
  verificar(
    "cliente sem publicação não é entregue",
    (await cartao("anon", "admin-user")) === null,
  );
  verificar(
    "indisponível e inexistente são indistinguíveis",
    (await cartao("anon", "vencido")) === (await cartao("anon", "nao-existe")),
  );
  verificar(
    "função pública nunca devolve rascunho",
    JSON.stringify(aPublico).includes("RASCUNHO") === false,
  );

  // =========================================================================
  secao("4. Isolamento entre clientes (PRD §42)");
  // =========================================================================
  const aVeClients = await linhas(
    db,
    "authenticated",
    CLIENTE_A,
    "select username from public.clients order by username",
  );
  verificar(
    "cliente A vê só a própria linha em clients",
    aVeClients?.length === 1 && aVeClients[0].username === "cliente-a",
    JSON.stringify(aVeClients),
  );

  const aVeDrafts = await linhas(
    db,
    "authenticated",
    CLIENTE_A,
    "select content->>'nome' as n from public.card_drafts",
  );
  verificar(
    "cliente A vê só o próprio rascunho",
    aVeDrafts?.length === 1 && aVeDrafts[0].n === "RASCUNHO SECRETO DE A",
    JSON.stringify(aVeDrafts),
  );

  const aVePub = await linhas(
    db,
    "authenticated",
    CLIENTE_A,
    "select content->>'nome' as n from public.card_published",
  );
  verificar(
    "cliente A vê só a própria versão publicada",
    aVePub?.length === 1 && aVePub[0].n === "A publicado",
    JSON.stringify(aVePub),
  );

  // Tentativa explícita de alcançar o dado do outro informando o id dele.
  const aForcaB = await linhas(
    db,
    "authenticated",
    CLIENTE_A,
    `select content from public.card_drafts where client_id = '${CLIENTE_B}'`,
  );
  verificar(
    "cliente A informando o id de B recebe zero linhas",
    aForcaB?.length === 0,
    JSON.stringify(aForcaB),
  );

  const aForcaUsername = await linhas(
    db,
    "authenticated",
    CLIENTE_A,
    "select * from public.clients where username = 'cliente-b'",
  );
  verificar(
    "cliente A buscando B por username recebe zero linhas",
    aForcaUsername?.length === 0,
  );

  // =========================================================================
  secao("5. Dados administrativos invisíveis ao cliente (PRD §39, §40)");
  // =========================================================================
  const aVeNotas = await linhas(
    db,
    "authenticated",
    CLIENTE_A,
    "select notes from public.client_notes",
  );
  verificar(
    "cliente não lê observação interna, nem a própria",
    aVeNotas?.length === 0,
    JSON.stringify(aVeNotas),
  );

  const aVeLog = await linhas(
    db,
    "authenticated",
    CLIENTE_A,
    "select action from public.admin_audit_log",
  );
  verificar("cliente não lê histórico administrativo", aVeLog?.length === 0);

  const aVeReservados = await linhas(
    db,
    "authenticated",
    CLIENTE_A,
    "select username from public.reserved_usernames",
  );
  verificar("cliente não lê lista de reservados", aVeReservados?.length === 0);

  const aVeAdmins = await comoPapel(
    db,
    "authenticated",
    CLIENTE_A,
    "select * from private.admins",
  );
  verificar("cliente não alcança private.admins", !aVeAdmins.ok);

  // =========================================================================
  secao("6. Cliente não escreve o que não pode (PRD §9)");
  // =========================================================================
  const aMudaVencimento = await comoPapel(
    db,
    "authenticated",
    CLIENTE_A,
    `update public.clients set expires_at = now() + interval '9999 days'
     where id = '${CLIENTE_A}' returning username`,
  );
  verificar(
    "cliente não estende o próprio vencimento",
    !aMudaVencimento.ok || aMudaVencimento.resultado.rows.length === 0,
    aMudaVencimento.ok ? "UPDATE PASSOU" : aMudaVencimento.erro,
  );

  const aMudaUsername = await comoPapel(
    db,
    "authenticated",
    CLIENTE_A,
    `update public.clients set username = 'outro-nome' where id = '${CLIENTE_A}'
     returning username`,
  );
  verificar(
    "cliente não altera o próprio nome de usuário",
    !aMudaUsername.ok || aMudaUsername.resultado.rows.length === 0,
  );

  const aPublicaDireto = await comoPapel(
    db,
    "authenticated",
    CLIENTE_A,
    `update public.card_published set content = '{"buttons":[],"nome":"FORJADO"}'
     where client_id = '${CLIENTE_A}' returning content`,
  );
  verificar(
    "cliente não escreve direto na versão publicada",
    !aPublicaDireto.ok || aPublicaDireto.resultado.rows.length === 0,
    aPublicaDireto.ok ? "UPDATE PASSOU" : aPublicaDireto.erro,
  );

  const aApagaB = await comoPapel(
    db,
    "authenticated",
    CLIENTE_A,
    `delete from public.clients where id = '${CLIENTE_B}' returning username`,
  );
  verificar(
    "cliente não exclui outro cliente",
    !aApagaB.ok || aApagaB.resultado.rows.length === 0,
  );

  const aCriaCliente = await comoPapel(
    db,
    "authenticated",
    CLIENTE_A,
    `insert into public.clients (id, username, full_name, package_months, expires_at)
     values ('${CLIENTE_A}', 'novo-invasor', 'X', 3, now()) returning username`,
  );
  verificar(
    "cliente não cria cliente",
    !aCriaCliente.ok && /row-level security/i.test(aCriaCliente.erro),
    aCriaCliente.ok ? "INSERT PASSOU" : aCriaCliente.erro,
  );

  const aForjaLog = await comoPapel(
    db,
    "authenticated",
    CLIENTE_A,
    `insert into public.admin_audit_log (action, client_username)
     values ('renewed', 'cliente-a') returning id`,
  );
  verificar(
    "cliente não forja registro no histórico",
    !aForjaLog.ok && /row-level security/i.test(aForjaLog.erro),
  );

  // =========================================================================
  secao("7. Administrador enxerga e opera");
  // =========================================================================
  const adminVeTudo = await linhas(
    db,
    "authenticated",
    ADMIN,
    "select username from public.clients",
  );
  verificar(
    "admin vê todos os clientes",
    adminVeTudo?.length === 6,
    `viu ${adminVeTudo?.length}`,
  );

  const adminVeNotas = await linhas(
    db,
    "authenticated",
    ADMIN,
    "select notes from public.client_notes",
  );
  verificar("admin lê observações internas", adminVeNotas?.length === 2);

  const adminVeLog = await linhas(
    db,
    "authenticated",
    ADMIN,
    "select action from public.admin_audit_log",
  );
  verificar("admin lê histórico", adminVeLog?.length === 1);

  const adminRenova = await comoPapel(
    db,
    "authenticated",
    ADMIN,
    `update public.clients set expires_at = now() + interval '90 days',
       cancelled_at = null, last_renewed_at = now()
     where username = 'vencido' returning username`,
  );
  verificar(
    "admin renova cliente",
    adminRenova.ok && adminRenova.resultado.rows.length === 1,
    adminRenova.erro ?? "",
  );

  const adminVeRascunhos = await linhas(
    db,
    "authenticated",
    ADMIN,
    "select client_id from public.card_drafts",
  );
  verificar(
    "admin vê rascunhos (necessário para §35 visualizar cartão)",
    adminVeRascunhos?.length === 2,
  );

  // =========================================================================
  secao("8. Regras de integridade");
  // =========================================================================
  const reservado = await db
    .exec(
      `insert into public.clients (id, username, full_name, package_months, expires_at)
       values ('${CLIENTE_A}', 'admin', 'X', 3, now())`,
    )
    .then(() => null)
    .catch((e) => String(e.message));
  verificar(
    "nome reservado é recusado pelo banco",
    reservado !== null && /reservado/i.test(reservado),
    reservado ?? "INSERT PASSOU",
  );

  const slugRuim = async (u) =>
    db
      .exec(
        `insert into public.clients (id, username, full_name, package_months, expires_at)
         values ('${CLIENTE_A}', '${u}', 'X', 3, now())`,
      )
      .then(() => false)
      .catch(() => true);
  verificar("slug com maiúscula recusado", await slugRuim("Cliente"));
  verificar("slug com hífen duplo recusado", await slugRuim("a--b"));
  verificar("slug terminando em hífen recusado", await slugRuim("abc-"));
  verificar("slug curto recusado", await slugRuim("ab"));
  verificar("slug com ponto recusado", await slugRuim("a.b"));

  const pacoteRuim = await db
    .exec(
      `insert into public.clients (id, username, full_name, package_months, expires_at)
       values ('${CLIENTE_A}', 'pacote-ruim', 'X', 5, now())`,
    )
    .then(() => false)
    .catch(() => true);
  verificar("pacote fora de 3/6/12 recusado", pacoteRuim);

  // Formato de botão válido (etapa 8) para não confundir "excede o limite"
  // com "botão malformado" — cada elemento aqui já passaria em
  // validate_button sozinho.
  const botaoValido = (i) => ({
    id: String(i),
    type: "pix",
    enabled: true,
    key: `chave-${i}`,
  });

  const onzeBotoes = JSON.stringify({
    buttons: Array.from({ length: 11 }, (_, i) => botaoValido(i)),
  });
  const excedeBotoes = await db
    .exec(
      `update public.card_drafts set content = '${onzeBotoes}'
       where client_id = '${CLIENTE_A}'`,
    )
    .then(() => false)
    .catch(() => true);
  verificar("11 botões recusados pelo banco (PRD §11)", excedeBotoes);

  const dezBotoes = JSON.stringify({
    buttons: Array.from({ length: 10 }, (_, i) => botaoValido(i)),
  });
  const aceitaDez = await db
    .exec(
      `update public.card_drafts set content = '${dezBotoes}'
       where client_id = '${CLIENTE_A}'`,
    )
    .then(() => true)
    .catch(() => false);
  verificar("10 botões aceitos", aceitaDez);

  const doisCartoes = await db
    .exec(
      `insert into public.card_drafts (client_id, content)
       values ('${CLIENTE_A}', '{"buttons":[]}')`,
    )
    .then(() => false)
    .catch(() => true);
  verificar("segundo rascunho para o mesmo cliente recusado (PRD §7)", doisCartoes);

  // =========================================================================
  secao("9. Exclusão de cliente (PRD §34, §50 e decisão P2)");
  // =========================================================================
  await db.exec(`delete from public.clients where username = 'cliente-b'`);

  const bReservado = await db.query(
    "select reason from public.reserved_usernames where username = 'cliente-b'",
  );
  verificar(
    "slug de cliente excluído fica reservado",
    bReservado.rows[0]?.reason === "deleted_client",
    JSON.stringify(bReservado.rows),
  );

  const reusaSlug = await db
    .exec(
      `insert into public.clients (id, username, full_name, package_months, expires_at)
       values ('${CLIENTE_B}', 'cliente-b', 'Outra pessoa', 3, now() + interval '30 days')`,
    )
    .then(() => false)
    .catch(() => true);
  verificar("slug excluído não pode ser reutilizado", reusaSlug);

  const sobrasB = await db.query(`
    select
      (select count(*) from public.card_drafts where client_id = '${CLIENTE_B}') as rascunhos,
      (select count(*) from public.card_published where client_id = '${CLIENTE_B}') as publicados,
      (select count(*) from public.client_notes where client_id = '${CLIENTE_B}') as notas
  `);
  const s = sobrasB.rows[0];
  verificar(
    "exclusão remove cartão, publicação e observações em cascata",
    Number(s.rascunhos) === 0 && Number(s.publicados) === 0 && Number(s.notas) === 0,
    JSON.stringify(s),
  );

  const logSobrevive = await db.query(
    "select client_username, client_id from public.admin_audit_log where client_username = 'cliente-a'",
  );
  verificar(
    "histórico administrativo sobrevive com snapshot do cliente",
    logSobrevive.rows.length === 1 &&
      logSobrevive.rows[0].client_username === "cliente-a",
  );

  await db.exec(`delete from public.clients where username = 'cliente-a'`);
  const logAposExclusao = await db.query(
    "select action, client_id from public.admin_audit_log where client_username = 'cliente-a' order by id",
  );
  // Duas entradas agora, de propósito: a original ('client_created', criada
  // antes da exclusão) sobrevive com client_id anulado pela FK, e o gatilho
  // de exclusão (etapa 5) acrescenta uma segunda ('deleted'). As duas ficam
  // com client_id nulo — nenhuma referencia uma linha que não existe mais.
  verificar(
    "registro de auditoria não é apagado junto com o cliente (conflito C2)",
    logAposExclusao.rows.length === 2 &&
      logAposExclusao.rows.every((r) => r.client_id === null) &&
      logAposExclusao.rows.some((r) => r.action === "client_created") &&
      logAposExclusao.rows.some((r) => r.action === "deleted"),
    JSON.stringify(logAposExclusao.rows),
  );

  const cartaoExcluido = await comoPapel(
    db,
    "anon",
    null,
    "select public.get_public_card('cliente-a') as c",
  );
  verificar(
    "URL de cliente excluído não entrega cartão (PRD §50)",
    cartaoExcluido.ok && cartaoExcluido.resultado.rows[0].c === null,
  );

  // =========================================================================
  secao("10. Resolução de identidade de login (cliente e admin)");
  // =========================================================================
  const asServico = async (sql, params = []) => {
    const r = await comoPapel(
      db,
      "service_role",
      null,
      params.length
        ? sql.replace(/\$1/g, `'${params[0]}'`).replace(/\$2/g, params[1]).replace(/\$3/g, params[2])
        : sql,
    );
    return r;
  };

  // 'cliente-a' e 'cliente-b' já foram excluídos na seção 9 — usa 'vencido',
  // que continua existindo neste ponto.
  const idCliente = await asServico(
    "select * from public.resolve_login_identity('vencido')",
  );
  verificar(
    "resolve identidade de cliente por username",
    idCliente.ok &&
      idCliente.resultado.rows[0]?.user_id === VENCIDO &&
      idCliente.resultado.rows[0]?.email === "vencido@internal.cartao.local",
    JSON.stringify(idCliente.ok ? idCliente.resultado.rows : idCliente.erro),
  );

  const idAdmin = await asServico(
    "select * from public.resolve_login_identity('ADMIN-TESTE')",
  );
  verificar(
    "resolve identidade de admin por username (case-insensitive)",
    idAdmin.ok && idAdmin.resultado.rows[0]?.user_id === ADMIN,
    JSON.stringify(idAdmin.ok ? idAdmin.resultado.rows : idAdmin.erro),
  );

  const idInexistente = await asServico(
    "select * from public.resolve_login_identity('nao-existe-mesmo')",
  );
  verificar(
    "username inexistente devolve zero linhas",
    idInexistente.ok && idInexistente.resultado.rows.length === 0,
  );

  const identidadeNegadaParaCliente = await comoPapel(
    db,
    "authenticated",
    CLIENTE_A,
    "select * from public.resolve_login_identity('cliente-b')",
  );
  verificar(
    "cliente comum não pode chamar resolve_login_identity",
    !identidadeNegadaParaCliente.ok,
    identidadeNegadaParaCliente.ok ? "CHAMADA PASSOU" : "",
  );

  // =========================================================================
  secao("11. Bloqueio por tentativas de login (PRD §43)");
  // =========================================================================
  const semBloqueio = await asServico(
    "select public.check_login_lock('alvo-teste') as l",
  );
  verificar(
    "sem histórico, não há bloqueio",
    semBloqueio.ok && semBloqueio.resultado.rows[0].l === null,
  );

  // Acumulação real entre chamadas: usa db.exec direto (sem "comoPapel", que
  // sempre desfaz a transação — inútil aqui, onde o que se testa é justamente
  // o estado persistindo de uma chamada para a próxima).
  for (let i = 1; i <= 4; i++) {
    await db.exec(`select public.register_login_failure('acumula-teste', 5, 15)`);
  }
  const apos4 = await db.query(
    "select failed_count, locked_until from private.login_throttle where username = 'acumula-teste'",
  );
  verificar(
    "4 falhas seguidas: contador acumula, sem bloqueio ainda",
    apos4.rows[0]?.failed_count === 4 && apos4.rows[0]?.locked_until === null,
    JSON.stringify(apos4.rows),
  );

  const chamada5 = await db.query(
    "select * from public.register_login_failure('acumula-teste', 5, 15)",
  );
  verificar(
    "5ª falha aciona o bloqueio e zera o contador",
    chamada5.rows[0]?.failed_count === 0 && chamada5.rows[0]?.locked_until !== null,
    JSON.stringify(chamada5.rows),
  );

  await db.exec(`
    insert into private.login_throttle (username, failed_count, locked_until)
    values ('bloqueado-teste', 0, now() + interval '10 minutes')
    on conflict (username) do update set locked_until = now() + interval '10 minutes';
  `);
  const bloqueado = await asServico(
    "select public.check_login_lock('bloqueado-teste') as l",
  );
  verificar(
    "conta bloqueada é detectada por check_login_lock",
    bloqueado.ok && bloqueado.resultado.rows[0].l !== null,
  );

  await db.exec(`select public.register_login_success('acumula-teste')`);
  const apagouHistorico = await db.query(
    "select count(*)::int as n from private.login_throttle where username = 'acumula-teste'",
  );
  verificar(
    "login bem-sucedido apaga o histórico de falhas",
    apagouHistorico.rows[0].n === 0,
  );
  await db.exec(`delete from private.login_throttle`);

  const throttleNegadoParaCliente = await comoPapel(
    db,
    "authenticated",
    CLIENTE_A,
    "select public.register_login_success('cliente-a')",
  );
  verificar(
    "cliente comum não pode chamar funções de throttle",
    !throttleNegadoParaCliente.ok,
  );

  // =========================================================================
  secao("12. am_i_admin()");
  // =========================================================================
  const admEhAdmin = await comoPapel(
    db,
    "authenticated",
    ADMIN,
    "select public.am_i_admin() as v",
  );
  verificar("am_i_admin() é true para o admin", admEhAdmin.ok && admEhAdmin.resultado.rows[0].v === true);

  const clienteNaoEhAdmin = await comoPapel(
    db,
    "authenticated",
    CLIENTE_A,
    "select public.am_i_admin() as v",
  );
  verificar(
    "am_i_admin() é false para cliente comum",
    clienteNaoEhAdmin.ok && clienteNaoEhAdmin.resultado.rows[0].v === false,
  );

  const anonSemAdmin = await comoPapel(db, "anon", null, "select public.am_i_admin() as v");
  verificar("anon não pode chamar am_i_admin()", !anonSemAdmin.ok);

  const NOVO_ADMIN = "99999999-9999-4999-8999-999999999999";
  await db.exec(`insert into auth.users (id, email) values ('${NOVO_ADMIN}', 'novo@interno')`);
  await db.exec(`select public.upsert_admin('${NOVO_ADMIN}', 'Outro-Admin')`);
  const novoVirouAdmin = await comoPapel(
    db,
    "authenticated",
    NOVO_ADMIN,
    "select public.am_i_admin() as v",
  );
  verificar(
    "upsert_admin registra novo administrador (usado pelo script de criação)",
    novoVirouAdmin.ok && novoVirouAdmin.resultado.rows[0].v === true,
  );
  const upsertMinusculas = await db.query(
    "select username from private.admins where user_id = '${NOVO_ADMIN}'".replace(
      "${NOVO_ADMIN}",
      NOVO_ADMIN,
    ),
  );
  verificar(
    "upsert_admin normaliza o username para minúsculas",
    upsertMinusculas.rows[0]?.username === "outro-admin",
  );

  const upsertNegadoParaCliente = await comoPapel(
    db,
    "authenticated",
    CLIENTE_A,
    `select public.upsert_admin('${CLIENTE_A}', 'invasor')`,
  );
  verificar("cliente comum não pode chamar upsert_admin", !upsertNegadoParaCliente.ok);

  // =========================================================================
  secao("13. Paridade entre a regra de slug em TypeScript e no banco");
  // =========================================================================
  // =========================================================================
  // A regex de `src/lib/constants.ts` serve para feedback imediato na
  // interface; a do banco é a autoridade. Se as duas divergirem, a interface
  // aceita um nome que o banco recusa — ou pior, o contrário. Este teste falha
  // no momento em que uma das duas for alterada sozinha.
  const { USERNAME } = await import("../../src/lib/constants.ts");

  const candidatos = [
    "renan-dias", "abc", "a1b", "cliente-a", "joao-da-silva-2",
    "ab", "a", "", "Cliente", "a--b", "abc-", "-abc", "a.b", "a_b",
    "a b", "a/b", "rená", "ABC", "a-", "-", "--", "a---b",
    "a".repeat(32), "a".repeat(33), "0123456789",
  ];

  let divergencias = 0;
  for (const c of candidatos) {
    const ts =
      c.length >= USERNAME.minimo &&
      c.length <= USERNAME.maximo &&
      USERNAME.padrao.test(c);

    const sql = await db
      .query(
        `select ($1 ~ '^[a-z0-9]([a-z0-9]|-[a-z0-9])*$'
                 and length($1) between 3 and 32) as valido`,
        [c],
      )
      .then((r) => r.rows[0].valido);

    if (ts !== sql) {
      divergencias++;
      console.log(`  FALHA divergência em ${JSON.stringify(c)}: ts=${ts} sql=${sql}`);
    }
  }
  verificar(
    `regex TypeScript e banco concordam nos ${candidatos.length} casos`,
    divergencias === 0,
    `${divergencias} divergência(s)`,
  );

  // =========================================================================
  secao("14. compute_new_expiry — aritmética de vencimento (PRD §30, §31, P4)");
  // =========================================================================
  const novoVencimento = async (expiresAt, cancelledAt, months) =>
    (
      await db.query(
        `select public.compute_new_expiry($1::timestamptz, $2::timestamptz, $3::int) as v`,
        [expiresAt, cancelledAt, months],
      )
    ).rows[0].v;

  // Ativo: soma ao vencimento atual, com ajuste de fim de mês pelo próprio
  // Postgres (confirmado antes de escrever a função: 30/nov + 3 meses = 28/fev).
  // expires_at guardado é o INÍCIO do dia seguinte ao último dia válido, em
  // America/Belem — 30/11 às 00:00 Belem representa "vence no fim de 29/11".
  // `novoVencimento` devolve um objeto Date (driver do PGlite), não string —
  // `.toISOString()` para comparar, nunca `===` direto contra texto.
  const r1 = await novoVencimento("2026-11-30T03:00:00Z", null, 3);
  verificar(
    "ativo: 30/nov (fim de 29/nov) + 3 meses -> fim de 28/fev/2027",
    r1.toISOString() === "2027-03-01T03:00:00.000Z",
    r1.toISOString(),
  );

  // Vencido/cancelado: conta a partir de AGORA, não da data antiga (§31).
  // Janela generosa (não um dia fixo): 3 meses corridos variam entre ~89 e
  // ~92 dias dependendo de quais meses caem no meio, e o "+1 dia" da
  // convenção de fim de dia soma mais um. O que importa provar aqui é que
  // conta de agora, não da data de 2020 — não replicar o calendário exato.
  const r2 = await novoVencimento("2020-01-01T03:00:00Z", null, 3);
  const agora = new Date();
  const diffDias = (r2 - agora) / 86400000;
  verificar(
    "vencido há muito tempo: novo vencimento conta a partir de agora, não da data antiga",
    diffDias > 85 && diffDias < 95,
    `${diffDias.toFixed(2)} dias a partir de agora`,
  );

  // Cancelado também conta a partir de agora, mesmo com expires_at no futuro.
  const r3 = await novoVencimento("2030-01-01T03:00:00Z", "2026-01-01T00:00:00Z", 6);
  const diffDias3 = (r3 - agora) / 86400000;
  verificar(
    "cancelado: conta a partir de agora mesmo com expires_at futuro",
    diffDias3 > 175 && diffDias3 < 190,
    `${diffDias3.toFixed(2)} dias a partir de agora`,
  );

  // Fronteira: o último microssegundo do dia válido ainda é 'active'.
  const fronteira = await db.query(`
    select public.effective_status(
      (timestamptz '2026-11-30T03:00:00Z') - interval '1 microsecond', null
    ) as s
  `);
  verificar(
    "1 microssegundo antes do vencimento ainda é 'active'",
    fronteira.rows[0].s === "active",
  );

  // =========================================================================
  secao("15. renew_client (PRD §29, §30, §31, §64)");
  // =========================================================================
  const RENOVAR_ATIVO = "10000000-0000-4000-8000-000000000001";
  const RENOVAR_VENCIDO = "10000000-0000-4000-8000-000000000002";

  await db.exec(`
    insert into auth.users (id, email) values
      ('${RENOVAR_ATIVO}', 'ra@interno'), ('${RENOVAR_VENCIDO}', 'rv@interno');
    insert into public.clients (id, username, full_name, package_months, expires_at, cancelled_at) values
      ('${RENOVAR_ATIVO}', 'renovar-ativo', 'Renovar Ativo', 3, timestamptz '2026-11-30T03:00:00Z', null),
      ('${RENOVAR_VENCIDO}', 'renovar-vencido', 'Renovar Vencido', 3, now() - interval '5 days', null);
  `);

  const invalidoMeses = await comoPapel(
    db,
    "authenticated",
    ADMIN,
    `select * from public.renew_client('${RENOVAR_ATIVO}', 5)`,
  );
  verificar(
    "renovar com pacote fora de 3/6/12 é recusado",
    !invalidoMeses.ok,
    invalidoMeses.ok ? "PASSOU" : invalidoMeses.erro,
  );

  // A partir daqui os efeitos precisam SOBREVIVER (a consulta ao histórico
  // logo abaixo é uma chamada separada) — `comoPapelConfirmando`, não
  // `comoPapel` (que desfaz tudo de propósito, para os testes negativos).
  const renovadoAtivo = await comoPapelConfirmando(
    db,
    "authenticated",
    ADMIN,
    `select * from public.renew_client('${RENOVAR_ATIVO}', 3)`,
  );
  verificar(
    "renova cliente ativo: soma ao vencimento atual, atualiza pacote",
    renovadoAtivo.ok &&
      renovadoAtivo.resultado.rows[0]?.expires_at.toISOString().startsWith("2027-03-01") &&
      renovadoAtivo.resultado.rows[0]?.package_months === 3,
    JSON.stringify(renovadoAtivo.ok ? renovadoAtivo.resultado.rows[0] : renovadoAtivo.erro),
  );

  const renovadoVencido = await comoPapelConfirmando(
    db,
    "authenticated",
    ADMIN,
    `select * from public.renew_client('${RENOVAR_VENCIDO}', 6)`,
  );
  const diasRenovadoVencido = renovadoVencido.ok
    ? (renovadoVencido.resultado.rows[0].expires_at - agora) / 86400000
    : null;
  verificar(
    "renova cliente vencido: conta a partir de agora e volta para ativo",
    renovadoVencido.ok && diasRenovadoVencido > 175 && diasRenovadoVencido < 190,
    JSON.stringify(renovadoVencido.ok ? renovadoVencido.resultado.rows[0] : renovadoVencido.erro),
  );

  const logRenovacao = await db.query(
    "select detail from public.admin_audit_log where action = 'renewed' and client_username = 'renovar-ativo'",
  );
  verificar(
    "renovação registrada no histórico com detalhe",
    logRenovacao.rows.length === 1 && logRenovacao.rows[0].detail?.months === 3,
    JSON.stringify(logRenovacao.rows),
  );

  const clienteNaoRenova = await comoPapel(
    db,
    "authenticated",
    CLIENTE_A,
    `select * from public.renew_client('${RENOVAR_ATIVO}', 3)`,
  );
  verificar(
    "cliente comum não consegue renovar (RLS, sem duplicar checagem admin)",
    !clienteNaoRenova.ok,
    clienteNaoRenova.ok ? "PASSOU" : clienteNaoRenova.erro,
  );

  const renovaInexistente = await comoPapel(
    db,
    "authenticated",
    ADMIN,
    `select * from public.renew_client('00000000-0000-0000-0000-000000000000', 3)`,
  );
  verificar("renovar cliente inexistente falha com erro claro", !renovaInexistente.ok);

  // =========================================================================
  secao("16. cancel_client (PRD §33, decisão P3)");
  // =========================================================================
  const CANCELAR_TESTE = "10000000-0000-4000-8000-000000000003";
  await db.exec(`
    insert into auth.users (id, email) values ('${CANCELAR_TESTE}', 'ct@interno');
    insert into public.clients (id, username, full_name, package_months, expires_at) values
      ('${CANCELAR_TESTE}', 'cancelar-teste', 'Cancelar Teste', 3, now() + interval '60 days');
  `);

  const antesDoCancelamento = await db.query(
    "select expires_at from public.clients where id = $1",
    [CANCELAR_TESTE],
  );

  const cancelado1 = await comoPapelConfirmando(
    db,
    "authenticated",
    ADMIN,
    `select * from public.cancel_client('${CANCELAR_TESTE}')`,
  );
  verificar(
    "cancela cliente ativo, preserva expires_at",
    // Duas leituras por caminhos diferentes (db.query vs. db.exec) sempre
    // devolvem instâncias de Date distintas — comparar getTime(), nunca `===`.
    cancelado1.ok &&
      cancelado1.resultado.rows[0].expires_at.getTime() ===
        antesDoCancelamento.rows[0].expires_at.getTime() &&
      cancelado1.resultado.rows[0].cancelled_at !== null,
    JSON.stringify(cancelado1.ok ? cancelado1.resultado.rows[0] : cancelado1.erro),
  );

  const primeiraDataCancelamento = cancelado1.resultado?.rows[0]?.cancelled_at;
  const cancelado2 = await comoPapelConfirmando(
    db,
    "authenticated",
    ADMIN,
    `select * from public.cancel_client('${CANCELAR_TESTE}')`,
  );
  verificar(
    "cancelar duas vezes é idempotente: não sobrescreve a data original",
    cancelado2.ok &&
      cancelado2.resultado.rows[0].cancelled_at.getTime() === primeiraDataCancelamento.getTime(),
    JSON.stringify(cancelado2.ok ? cancelado2.resultado.rows[0] : cancelado2.erro),
  );

  const logCancelamento = await db.query(
    "select detail from public.admin_audit_log where action = 'cancelled' and client_username = 'cancelar-teste'",
  );
  verificar(
    "cancelamento registrado no histórico (1 vez, não 2)",
    logCancelamento.rows.length === 1,
    JSON.stringify(logCancelamento.rows),
  );

  const clienteNaoCancela = await comoPapel(
    db,
    "authenticated",
    RENOVAR_ATIVO,
    `select * from public.cancel_client('${RENOVAR_ATIVO}')`,
  );
  verificar("cliente comum não consegue se autocancelar", !clienteNaoCancela.ok);

  // =========================================================================
  secao("17. delete_client (PRD §33, §34, critério de aceite §66)");
  // =========================================================================
  const EXCLUIR_ATIVO = "10000000-0000-4000-8000-000000000004";
  await db.exec(`
    insert into auth.users (id, email) values ('${EXCLUIR_ATIVO}', 'ea@interno');
    insert into public.clients (id, username, full_name, package_months, expires_at) values
      ('${EXCLUIR_ATIVO}', 'excluir-ativo', 'Excluir Ativo', 3, now() + interval '30 days');
  `);

  const excluirAtivoNegado = await comoPapel(
    db,
    "authenticated",
    ADMIN,
    `select public.delete_client('${EXCLUIR_ATIVO}')`,
  );
  verificar(
    "excluir cliente ATIVO é recusado, mesmo pelo admin",
    !excluirAtivoNegado.ok,
    excluirAtivoNegado.ok ? "PASSOU" : excluirAtivoNegado.erro,
  );

  // Defesa em profundidade: um DELETE cru (sem passar pela função) também é
  // barrado, porque a regra está na própria política de RLS.
  const deleteCruNegado = await comoPapel(
    db,
    "authenticated",
    ADMIN,
    `delete from public.clients where id = '${EXCLUIR_ATIVO}' returning username`,
  );
  verificar(
    "DELETE cru em cliente ATIVO também é barrado pela política (não só pela função)",
    !deleteCruNegado.ok || deleteCruNegado.resultado.rows.length === 0,
    deleteCruNegado.ok ? JSON.stringify(deleteCruNegado.resultado.rows) : deleteCruNegado.erro,
  );

  await db.exec(`update public.clients set cancelled_at = now() where id = '${EXCLUIR_ATIVO}'`);
  // Precisa persistir: a consulta ao histórico logo abaixo é uma chamada
  // separada, e ela só encontra o registro se a exclusão foi confirmada.
  const excluirCanceladoOk = await comoPapelConfirmando(
    db,
    "authenticated",
    ADMIN,
    `select public.delete_client('${EXCLUIR_ATIVO}')`,
  );
  verificar(
    "excluir cliente CANCELADO funciona",
    excluirCanceladoOk.ok,
    excluirCanceladoOk.ok ? "" : excluirCanceladoOk.erro,
  );

  const logExclusao = await db.query(
    "select client_id, client_username, actor_id from public.admin_audit_log where action = 'deleted' and client_username = 'excluir-ativo'",
  );
  verificar(
    "exclusão via delete_client registrada automaticamente pelo gatilho",
    logExclusao.rows.length === 1 && logExclusao.rows[0].client_id === null,
    JSON.stringify(logExclusao.rows),
  );

  // O gatilho cobre também uma exclusão que NÃO passa por delete_client —
  // por exemplo, um DELETE direto que a política já permitiu por estar
  // cancelado (simula alguém apagando pelo painel do Supabase).
  const EXCLUIR_VIA_TRIGGER = "10000000-0000-4000-8000-000000000005";
  await db.exec(`
    insert into auth.users (id, email) values ('${EXCLUIR_VIA_TRIGGER}', 'evt@interno');
    insert into public.clients (id, username, full_name, package_months, expires_at, cancelled_at) values
      ('${EXCLUIR_VIA_TRIGGER}', 'excluir-via-trigger', 'Via Trigger', 3, now() - interval '20 days', now());
  `);
  await comoPapelConfirmando(
    db,
    "authenticated",
    ADMIN,
    `delete from public.clients where id = '${EXCLUIR_VIA_TRIGGER}'`,
  );
  const logViaTrigger = await db.query(
    "select client_username from public.admin_audit_log where action = 'deleted' and client_username = 'excluir-via-trigger'",
  );
  verificar(
    "gatilho registra exclusão mesmo sem passar por delete_client()",
    logViaTrigger.rows.length === 1,
    JSON.stringify(logViaTrigger.rows),
  );

  const clienteNaoExclui = await comoPapel(
    db,
    "authenticated",
    RENOVAR_VENCIDO,
    `select public.delete_client('${RENOVAR_VENCIDO}')`,
  );
  verificar("cliente comum não consegue se autoexcluir", !clienteNaoExclui.ok);

  // =========================================================================
  secao("18. clients_with_status (PRD §36, §37, §41 — leitura do painel)");
  // =========================================================================
  const VIEW_ATIVO = "20000000-0000-4000-8000-000000000001";
  const VIEW_VENCE_LOGO = "20000000-0000-4000-8000-000000000002";
  const VIEW_VENCIDO = "20000000-0000-4000-8000-000000000003";
  const VIEW_CANCELADO = "20000000-0000-4000-8000-000000000004";

  await db.exec(`
    insert into auth.users (id, email) values
      ('${VIEW_ATIVO}', 'va@interno'), ('${VIEW_VENCE_LOGO}', 'vvl@interno'),
      ('${VIEW_VENCIDO}', 'vv@interno'), ('${VIEW_CANCELADO}', 'vc@interno');
    insert into public.clients (id, username, full_name, package_months, expires_at, cancelled_at) values
      ('${VIEW_ATIVO}', 'view-ativo', 'View Ativo', 12, now() + interval '200 days', null),
      ('${VIEW_VENCE_LOGO}', 'view-vence-logo', 'View Vence Logo', 3, now() + interval '10 days', null),
      ('${VIEW_VENCIDO}', 'view-vencido', 'View Vencido', 3, now() - interval '3 days', null),
      ('${VIEW_CANCELADO}', 'view-cancelado', 'View Cancelado', 6, now() + interval '5 days', now());
  `);

  const statusPorPapel = await linhas(
    db,
    "authenticated",
    ADMIN,
    `select username, status, days_until_expiry from public.clients_with_status
     where username like 'view-%' order by username`,
  );
  verificar(
    "view calcula status e dias restantes corretamente para os 4 casos",
    statusPorPapel?.length === 4 &&
      statusPorPapel.find((r) => r.username === "view-ativo")?.status === "active" &&
      statusPorPapel.find((r) => r.username === "view-vence-logo")?.status === "active" &&
      statusPorPapel.find((r) => r.username === "view-vence-logo")?.days_until_expiry <= 10 &&
      statusPorPapel.find((r) => r.username === "view-vencido")?.status === "expired" &&
      statusPorPapel.find((r) => r.username === "view-vencido")?.days_until_expiry < 0 &&
      statusPorPapel.find((r) => r.username === "view-cancelado")?.status === "cancelled",
    JSON.stringify(statusPorPapel),
  );

  // Filtro "vence em até 15 dias" (PRD §36): reproduz exatamente a condição
  // que a listagem do painel usa via .eq/.lte no construtor de consultas.
  const venceEm15 = await linhas(
    db,
    "authenticated",
    ADMIN,
    `select username from public.clients_with_status
     where status = 'active' and days_until_expiry <= 15
     and username like 'view-%'`,
  );
  verificar(
    "filtro 'vence em até 15 dias' pega só o cliente certo",
    venceEm15?.length === 1 && venceEm15[0].username === "view-vence-logo",
    JSON.stringify(venceEm15),
  );

  // A view herda o RLS de `clients` por ser security_invoker: cliente comum
  // continua vendo só a própria linha, mesmo consultando a view.
  const clienteVeSoASi = await linhas(
    db,
    "authenticated",
    VIEW_ATIVO,
    `select username from public.clients_with_status where username like 'view-%'`,
  );
  verificar(
    "view respeita RLS: cliente comum vê só a própria linha",
    clienteVeSoASi?.length === 1 && clienteVeSoASi[0].username === "view-ativo",
    JSON.stringify(clienteVeSoASi),
  );

  const anonNaView = await comoPapel(
    db,
    "anon",
    null,
    `select * from public.clients_with_status limit 1`,
  );
  verificar("anon não alcança a view", !anonNaView.ok);

  // =========================================================================
  secao("19. list_clients_for_admin (PRD §36, §37, §38)");
  // =========================================================================
  const listar = async (papel, sub, status, maxDias, termo, limite, offset) => {
    const r = await comoPapel(
      db,
      papel,
      sub,
      `select username, total_count from public.list_clients_for_admin(
         ${status ? `'${status}'` : "null"},
         ${maxDias ?? "null"},
         ${termo ? `'${termo}'` : "null"},
         ${limite}, ${offset}
       )`,
    );
    return r;
  };

  const todosAtivos = await listar("authenticated", ADMIN, "active", null, null, 50, 0);
  verificar(
    "filtro status='active' traz só ativos, com total_count",
    todosAtivos.ok &&
      todosAtivos.resultado.rows.some((r) => r.username === "view-ativo") &&
      !todosAtivos.resultado.rows.some((r) => r.username === "view-vencido") &&
      typeof todosAtivos.resultado.rows[0]?.total_count === "number",
    JSON.stringify(todosAtivos.ok ? todosAtivos.resultado.rows : todosAtivos.erro),
  );

  const buscaPorNome = await listar("authenticated", ADMIN, null, null, "Vence Logo", 50, 0);
  verificar(
    "busca por nome (case-insensitive, parcial) encontra o cliente certo",
    buscaPorNome.ok &&
      buscaPorNome.resultado.rows.length === 1 &&
      buscaPorNome.resultado.rows[0].username === "view-vence-logo",
    JSON.stringify(buscaPorNome.ok ? buscaPorNome.resultado.rows : buscaPorNome.erro),
  );

  // Termo com caractere que teria significado especial num DSL de filtro
  // (vírgula, parênteses) — aqui é só valor, não deve quebrar nem vazar linha.
  const buscaComCaracteresEspeciais = await listar(
    "authenticated",
    ADMIN,
    null,
    null,
    "), or(true",
    50,
    0,
  );
  verificar(
    "termo com vírgula/parênteses não quebra a busca nem retorna tudo",
    buscaComCaracteresEspeciais.ok && buscaComCaracteresEspeciais.resultado.rows.length === 0,
    JSON.stringify(
      buscaComCaracteresEspeciais.ok
        ? buscaComCaracteresEspeciais.resultado.rows
        : buscaComCaracteresEspeciais.erro,
    ),
  );

  const paginaVazia = await listar("authenticated", ADMIN, null, null, null, 2, 9999);
  verificar(
    "offset além do total devolve página vazia, sem erro",
    paginaVazia.ok && paginaVazia.resultado.rows.length === 0,
  );

  const clienteNaListagem = await listar("authenticated", VIEW_ATIVO, null, null, null, 50, 0);
  verificar(
    "cliente comum chamando a listagem só vê a própria linha (RLS herdado)",
    clienteNaListagem.ok &&
      clienteNaListagem.resultado.rows.length === 1 &&
      clienteNaListagem.resultado.rows[0].username === "view-ativo",
    JSON.stringify(clienteNaListagem.ok ? clienteNaListagem.resultado.rows : clienteNaListagem.erro),
  );

  const anonNaListagem = await comoPapel(
    db,
    "anon",
    null,
    `select * from public.list_clients_for_admin()`,
  );
  verificar("anon não pode chamar list_clients_for_admin", !anonNaListagem.ok);

  // =========================================================================
  secao("20. validate_card_content — permissivo vs. completo (PRD §8, §9, §56)");
  // =========================================================================
  const validar = async (content, requireComplete) =>
    (
      await db.query("select public.validate_card_content($1::jsonb, $2::boolean) as v", [
        JSON.stringify(content),
        requireComplete,
      ])
    ).rows[0].v;

  verificar(
    "permissivo: objeto vazio de botões, sem mais nada, é válido (rascunho em branco)",
    (await validar({ buttons: [] }, false)) === true,
  );
  verificar(
    "permissivo: nome ausente é ok",
    (await validar({ buttons: [] }, false)) === true,
  );
  verificar(
    "permissivo: cor inválida É recusada mesmo em rascunho, se presente",
    (await validar({ buttons: [], backgroundColor: "azul" }, false)) === false,
  );
  verificar(
    "permissivo: cor hex de 3 dígitos é aceita",
    (await validar({ buttons: [], backgroundColor: "#fff" }, false)) === true,
  );
  verificar(
    "permissivo: cor hex de 6 dígitos é aceita",
    (await validar({ buttons: [], backgroundColor: "#a1b2c3" }, false)) === true,
  );
  verificar(
    "permissivo: nome com 61 caracteres é recusado",
    (await validar({ buttons: [], displayName: "a".repeat(61) }, false)) === false,
  );
  verificar(
    "permissivo: nome com 60 caracteres é aceito",
    (await validar({ buttons: [], displayName: "a".repeat(60) }, false)) === true,
  );
  verificar(
    "permissivo: descrição com 251 caracteres é recusada",
    (await validar({ buttons: [], description: "a".repeat(251) }, false)) === false,
  );
  verificar(
    "permissivo: profilePhoto que não é string é recusado",
    (await validar({ buttons: [], profilePhoto: 123 }, false)) === false,
  );

  const completo = {
    buttons: [],
    displayName: "Renan Dias",
    backgroundColor: "#ffffff",
    buttonColor: "#000000",
  };
  verificar("completo: com nome e cores válidos, passa", (await validar(completo, true)) === true);
  verificar(
    "completo: sem nome, falha (rascunho incompleto não publica)",
    (await validar({ ...completo, displayName: undefined }, true)) === false,
  );
  verificar(
    "completo: sem backgroundColor, falha",
    (await validar({ ...completo, backgroundColor: undefined }, true)) === false,
  );
  verificar(
    "completo: sem buttonColor, falha",
    (await validar({ ...completo, buttonColor: undefined }, true)) === false,
  );

  // =========================================================================
  secao("21. CHECK constraint aplicada de verdade nas tabelas");
  // =========================================================================
  // RENOVAR_ATIVO existe em `clients` desde a seção 15, mas nunca ganhou uma
  // linha em `card_drafts` — sem ela, o UPDATE abaixo afetaria zero linhas
  // (sucesso silencioso, mascarando a constraint). Cria a linha agora.
  await db.exec(`
    insert into public.card_drafts (client_id, content) values ('${RENOVAR_ATIVO}', '{"buttons": []}')
  `);

  const salvaRascunho = async (content) =>
    db
      .exec(
        `update public.card_drafts set content = '${JSON.stringify(content)}'
         where client_id = '${RENOVAR_ATIVO}'`,
      )
      .then((r) => r.at(-1).affectedRows > 0)
      .catch(() => false);

  verificar("CHECK recusa cor inválida gravada direto na tabela", !(await salvaRascunho({ buttons: [], backgroundColor: "not-a-color" })));
  verificar("CHECK aceita rascunho parcialmente preenchido", await salvaRascunho({ buttons: [], displayName: "Só o nome por enquanto" }));

  const publicaIncompleto = await db
    .exec(
      `insert into public.card_published (client_id, content) values
       ('${CANCELAR_TESTE}', '{"buttons": []}')`,
    )
    .then(() => true)
    .catch(() => false);
  verificar(
    "CHECK recusa publicado sem nome/cores, mesmo por INSERT direto",
    !publicaIncompleto,
  );

  // =========================================================================
  secao("22. publish_card e restore_draft (PRD §16, §17, §18)");
  // =========================================================================
  const PUB_CLIENTE = "10000000-0000-4000-8000-000000000006";
  await db.exec(`
    insert into auth.users (id, email) values ('${PUB_CLIENTE}', 'pub@interno');
    insert into public.clients (id, username, full_name, package_months, expires_at) values
      ('${PUB_CLIENTE}', 'publica-teste', 'Publica Teste', 3, now() + interval '90 days');
    insert into public.card_drafts (client_id, content) values
      ('${PUB_CLIENTE}', '{"buttons": []}');
  `);

  const publicarSemNome = await comoPapel(
    db,
    "authenticated",
    PUB_CLIENTE,
    "select public.publish_card()",
  );
  verificar(
    "publicar rascunho incompleto (sem nome/cores) é recusado",
    !publicarSemNome.ok,
    publicarSemNome.ok ? "PASSOU" : publicarSemNome.erro,
  );

  await db.exec(`
    update public.card_drafts set content = '{
      "buttons": [], "displayName": "Publica Teste",
      "backgroundColor": "#ffffff", "buttonColor": "#000000",
      "description": "Descrição de teste"
    }' where client_id = '${PUB_CLIENTE}';
  `);

  const primeiraPublicacao = await comoPapelConfirmando(
    db,
    "authenticated",
    PUB_CLIENTE,
    "select * from public.publish_card()",
  );
  verificar(
    "primeira publicação funciona e copia o conteúdo do rascunho",
    primeiraPublicacao.ok &&
      primeiraPublicacao.resultado.rows[0]?.content?.displayName === "Publica Teste",
    JSON.stringify(primeiraPublicacao.ok ? primeiraPublicacao.resultado.rows[0] : primeiraPublicacao.erro),
  );

  const cartaoPublico = await comoPapel(
    db,
    "anon",
    null,
    `select public.get_public_card('publica-teste') as c`,
  );
  verificar(
    "visitante já enxerga a versão recém-publicada",
    cartaoPublico.ok && cartaoPublico.resultado.rows[0].c?.displayName === "Publica Teste",
    JSON.stringify(cartaoPublico.ok ? cartaoPublico.resultado.rows[0] : cartaoPublico.erro),
  );

  // Edita o rascunho de novo (sem publicar) e confirma que o publicado NÃO mudou.
  await db.exec(`
    update public.card_drafts set content = '{
      "buttons": [], "displayName": "Nome Ainda Não Publicado",
      "backgroundColor": "#ffffff", "buttonColor": "#000000"
    }' where client_id = '${PUB_CLIENTE}';
  `);
  const publicoAntesDeRepublicar = await comoPapel(
    db,
    "anon",
    null,
    `select public.get_public_card('publica-teste') as c`,
  );
  verificar(
    "editar o rascunho não afeta o que está publicado (PRD §16)",
    publicoAntesDeRepublicar.ok &&
      publicoAntesDeRepublicar.resultado.rows[0].c?.displayName === "Publica Teste",
    JSON.stringify(publicoAntesDeRepublicar.resultado?.rows[0]),
  );

  // republica (segunda chamada = UPDATE, não INSERT, no upsert)
  const segundaPublicacao = await comoPapelConfirmando(
    db,
    "authenticated",
    PUB_CLIENTE,
    "select * from public.publish_card()",
  );
  verificar(
    "segunda publicação (upsert) atualiza o conteúdo publicado",
    segundaPublicacao.ok &&
      segundaPublicacao.resultado.rows[0]?.content?.displayName === "Nome Ainda Não Publicado",
    JSON.stringify(segundaPublicacao.ok ? segundaPublicacao.resultado.rows[0] : segundaPublicacao.erro),
  );

  // edita de novo o rascunho, sem publicar, e então restaura
  await db.exec(`
    update public.card_drafts set content = '{
      "buttons": [], "displayName": "Rascunho Perdido de Propósito",
      "backgroundColor": "#111111", "buttonColor": "#222222"
    }' where client_id = '${PUB_CLIENTE}';
  `);
  const restaurado = await comoPapelConfirmando(
    db,
    "authenticated",
    PUB_CLIENTE,
    "select * from public.restore_draft()",
  );
  verificar(
    "restore_draft traz de volta o conteúdo publicado, descartando a edição",
    restaurado.ok &&
      restaurado.resultado.rows[0]?.content?.displayName === "Nome Ainda Não Publicado",
    JSON.stringify(restaurado.ok ? restaurado.resultado.rows[0] : restaurado.erro),
  );

  const SEM_PUBLICACAO = "10000000-0000-4000-8000-000000000007";
  await db.exec(`
    insert into auth.users (id, email) values ('${SEM_PUBLICACAO}', 'sp@interno');
    insert into public.clients (id, username, full_name, package_months, expires_at) values
      ('${SEM_PUBLICACAO}', 'sem-publicacao', 'Sem Publicacao', 3, now() + interval '90 days');
    insert into public.card_drafts (client_id, content) values
      ('${SEM_PUBLICACAO}', '{"buttons": []}');
  `);
  const restaurarSemPublicar = await comoPapel(
    db,
    "authenticated",
    SEM_PUBLICACAO,
    "select public.restore_draft()",
  );
  verificar(
    "restaurar sem nunca ter publicado falha com erro claro",
    !restaurarSemPublicar.ok,
    restaurarSemPublicar.ok ? "PASSOU" : restaurarSemPublicar.erro,
  );

  const publicarOutroCliente = await comoPapel(
    db,
    "authenticated",
    CLIENTE_A,
    "select public.publish_card()",
  );
  verificar(
    "publish_card sem parâmetro só pode afetar o próprio rascunho, não o de outro",
    // CLIENTE_A foi excluído na seção 9 — sem clients/card_drafts, deve falhar,
    // nunca publicar em nome do PUB_CLIENTE ou de qualquer outro por engano.
    !publicarOutroCliente.ok,
  );

  const clienteNaoEscreveDireto = await comoPapel(
    db,
    "authenticated",
    PUB_CLIENTE,
    `update public.card_published set content = '{
       "buttons": [], "displayName": "Forjado",
       "backgroundColor": "#ffffff", "buttonColor": "#000000"
     }' where client_id = '${PUB_CLIENTE}' returning content`,
  );
  verificar(
    "cliente ainda não escreve direto em card_published, só via publish_card (D-decisão desta etapa)",
    !clienteNaoEscreveDireto.ok || clienteNaoEscreveDireto.resultado.rows.length === 0,
    clienteNaoEscreveDireto.ok ? "UPDATE PASSOU" : clienteNaoEscreveDireto.erro,
  );

  const anonSemPublicar = await comoPapel(db, "anon", null, "select public.publish_card()");
  verificar("anon não pode chamar publish_card", !anonSemPublicar.ok);
  const anonSemRestaurar = await comoPapel(db, "anon", null, "select public.restore_draft()");
  verificar("anon não pode chamar restore_draft", !anonSemRestaurar.ok);

  // =========================================================================
  secao("23. Paridade entre validarConteudoCartao (TS) e validate_card_content (SQL)");
  // =========================================================================
  const { validarConteudoCartao } = await import("../../src/lib/card/validation.ts");

  const casosCartao = [
    ...[{}, {profession: ""}, {profession: "   "}, {profession: "Desenvolvedor Web"},
      {profession: "a".repeat(60)}, {profession: "a".repeat(61)}, {profession: 123},
      {profession: null}, {profession: "😀".repeat(60)}, {professionColor: "#d4a853"},
      {professionColor: "#abc"}, {professionColor: "red"}, {professionColor: null},
      {professionColor: "url(https://example.com)"}, {accentColor: "#fab754"}, {accentColor: "#abc"},
      {accentColor: "red"}, {accentColor: null}, {accentColor: 7}, {accentColor: "#fab754; color: red"},
      {accentColor: "url(https://example.com)"}].map(extra => ({
        buttons: [], displayName: "Teste", backgroundColor: "#000000", buttonColor: "#ffffff", ...extra,
      })),
    { buttons: [] },
    { buttons: [], displayName: "Renan" },
    { buttons: [], displayName: "a".repeat(60) },
    { buttons: [], displayName: "a".repeat(61) },
    { buttons: [], description: "a".repeat(250) },
    { buttons: [], description: "a".repeat(251) },
    { buttons: [], backgroundColor: "#fff" },
    { buttons: [], backgroundColor: "#a1b2c3" },
    { buttons: [], backgroundColor: "azul" },
    { buttons: [], backgroundColor: "#gggggg" },
    { buttons: [], buttonColor: "#000" },
    { buttons: [], buttonColor: "sem-cerquilha" },
    {
      buttons: [],
      displayName: "Completo",
      backgroundColor: "#ffffff",
      buttonColor: "#000000",
    },
    {
      buttons: [],
      displayName: "Quase completo",
      backgroundColor: "#ffffff",
    },
  ];

  let divergenciasCartao = 0;
  for (const caso of casosCartao) {
    for (const requireComplete of [false, true]) {
      const ts = validarConteudoCartao(caso, requireComplete).valido;
      const sql = await db
        .query("select public.validate_card_content($1::jsonb, $2::boolean) and public.validate_card_profession($1::jsonb) and public.validate_card_accent_color($1::jsonb) as v", [
          JSON.stringify(caso),
          requireComplete,
        ])
        .then((r) => r.rows[0].v);

      if (ts !== sql) {
        divergenciasCartao++;
        console.log(
          `  FALHA divergência (requireComplete=${requireComplete}) em ${JSON.stringify(caso)}: ts=${ts} sql=${sql}`,
        );
      }
    }
  }
  verificar(
    `TypeScript e SQL concordam nos ${casosCartao.length * 2} casos (2 modos cada)`,
    divergenciasCartao === 0,
    `${divergenciasCartao} divergência(s)`,
  );

  // =========================================================================
  secao("24. validate_button — os 6 tipos (PRD §13, §46)");
  // =========================================================================
  const validarBotaoSql = async (btn) =>
    (await db.query("select public.validate_button($1::jsonb) as v", [JSON.stringify(btn)])).rows[0]
      .v;

  const base = { id: "b1", enabled: true };

  // Link (§13.1)
  verificar(
    "link válido: título + URL https",
    (await validarBotaoSql({ ...base, type: "link", title: "Site", url: "https://exemplo.com" })) === true,
  );
  verificar(
    "link com http (não só https) também é aceito",
    (await validarBotaoSql({ ...base, type: "link", title: "Site", url: "http://exemplo.com" })) === true,
  );
  verificar(
    "link sem título é recusado",
    (await validarBotaoSql({ ...base, type: "link", url: "https://exemplo.com" })) === false,
  );
  verificar(
    "link com javascript: é recusado (PRD §46)",
    (await validarBotaoSql({ ...base, type: "link", title: "X", url: "javascript:alert(1)" })) === false,
  );
  verificar(
    "link com data: é recusado",
    (await validarBotaoSql({ ...base, type: "link", title: "X", url: "data:text/html,<script>" })) === false,
  );
  verificar(
    "link sem URL é recusado",
    (await validarBotaoSql({ ...base, type: "link", title: "X" })) === false,
  );

  // Texto/Informação (§13.2)
  verificar(
    "texto válido: título + conteúdo",
    (await validarBotaoSql({ ...base, type: "text", title: "Horários", content: "Seg a sex, 9h-18h" })) === true,
  );
  verificar(
    "texto sem conteúdo é recusado",
    (await validarBotaoSql({ ...base, type: "text", title: "Horários" })) === false,
  );
  verificar(
    "texto com conteúdo de 1001 caracteres é recusado",
    (await validarBotaoSql({ ...base, type: "text", title: "X", content: "a".repeat(1001) })) === false,
  );
  verificar(
    "texto com conteúdo de 1000 caracteres é aceito",
    (await validarBotaoSql({ ...base, type: "text", title: "X", content: "a".repeat(1000) })) === true,
  );

  // Wi-Fi (§13.3) — sem título obrigatório
  verificar(
    "wifi válido: ssid + senha, sem título",
    (await validarBotaoSql({ ...base, type: "wifi", ssid: "MinhaRede", password: "12345678" })) === true,
  );
  verificar(
    "wifi sem ssid é recusado",
    (await validarBotaoSql({ ...base, type: "wifi", password: "12345678" })) === false,
  );
  verificar(
    "wifi sem senha é recusado (mas senha pode ser string vazia? não — exige presença)",
    (await validarBotaoSql({ ...base, type: "wifi", ssid: "MinhaRede" })) === false,
  );

  // PIX (§13.4) — chave é só texto, sem validar formato
  verificar(
    "pix válido: qualquer texto como chave (CPF, e-mail, aleatória...)",
    (await validarBotaoSql({ ...base, type: "pix", key: "11122233344" })) === true,
  );
  verificar(
    "pix com chave tipo e-mail também aceito, sem validação de formato",
    (await validarBotaoSql({ ...base, type: "pix", key: "isso-nem-parece-uma-chave-pix" })) === true,
  );
  verificar("pix sem chave é recusado", (await validarBotaoSql({ ...base, type: "pix" })) === false);

  // Telefone (§13.5)
  verificar(
    "telefone válido",
    (await validarBotaoSql({ ...base, type: "phone", number: "(96) 98123-3398" })) === true,
  );
  verificar("telefone sem número é recusado", (await validarBotaoSql({ ...base, type: "phone" })) === false);

  // Endereço (§13.6)
  verificar(
    "endereço válido",
    (await validarBotaoSql({ ...base, type: "address", address: "Rua Exemplo, 123" })) === true,
  );
  verificar(
    "endereço sem texto é recusado",
    (await validarBotaoSql({ ...base, type: "address" })) === false,
  );

  // Campos comuns
  verificar(
    "tipo desconhecido é recusado",
    (await validarBotaoSql({ ...base, type: "voo-espacial", numero: "1" })) === false,
  );
  verificar(
    "sem 'enabled' é recusado (não fica NULL — coalesce protege)",
    (await validarBotaoSql({ id: "b1", type: "pix", key: "x" })) === false,
  );
  verificar(
    "sem 'id' é recusado",
    (await validarBotaoSql({ enabled: true, type: "pix", key: "x" })) === false,
  );
  verificar(
    "título com 41 caracteres é recusado",
    (await validarBotaoSql({ ...base, type: "pix", key: "x", title: "a".repeat(41) })) === false,
  );
  verificar(
    "título com 40 caracteres é aceito",
    (await validarBotaoSql({ ...base, type: "pix", key: "x", title: "a".repeat(40) })) === true,
  );
  verificar(
    "icon que não é string é recusado",
    (await validarBotaoSql({ ...base, type: "pix", key: "x", icon: 123 })) === false,
  );
  verificar("array vazio de botões é válido", (await db.query("select public.validate_all_buttons('[]'::jsonb) as v")).rows[0].v === true);

  const clienteEditaBotaoInvalido = await comoPapel(
    db,
    "authenticated",
    PUB_CLIENTE,
    `update public.card_drafts set content = '{"buttons":[{"id":"x","type":"link","enabled":true,"title":"T","url":"javascript:alert(1)"}]}'
     where client_id = '${PUB_CLIENTE}'`,
  );
  verificar(
    "CHECK recusa botão com javascript: gravado direto na tabela",
    !clienteEditaBotaoInvalido.ok,
    clienteEditaBotaoInvalido.ok ? "PASSOU" : clienteEditaBotaoInvalido.erro,
  );

  // =========================================================================
  secao("25. Paridade entre validarBotao (TS) e validate_button (SQL)");
  // =========================================================================
  const { validarBotao } = await import("../../src/lib/card/buttons.ts");

  const casosBotao = [
    { id: "1", enabled: true, type: "link", title: "Site", url: "https://exemplo.com" },
    { id: "1", enabled: true, type: "link", title: "Site", url: "http://exemplo.com" },
    { id: "1", enabled: true, type: "link", title: "Site", url: "javascript:alert(1)" },
    { id: "1", enabled: true, type: "link", url: "https://exemplo.com" },
    { id: "1", enabled: true, type: "text", title: "Horário", content: "9h-18h" },
    { id: "1", enabled: true, type: "text", title: "Horário" },
    { id: "1", enabled: true, type: "wifi", ssid: "Rede", password: "12345678" },
    { id: "1", enabled: true, type: "wifi", ssid: "Rede" },
    { id: "1", enabled: true, type: "pix", key: "chave-qualquer" },
    { id: "1", enabled: true, type: "pix" },
    { id: "1", enabled: true, type: "phone", number: "96981233398" },
    { id: "1", enabled: true, type: "address", address: "Rua X, 1" },
    { id: "1", enabled: true, type: "pix", key: "x", title: "a".repeat(40) },
    { id: "1", enabled: true, type: "pix", key: "x", title: "a".repeat(41) },
  ];

  let divergenciasBotao = 0;
  for (const caso of casosBotao) {
    const ts = validarBotao(caso).valido;
    const sql = await db
      .query("select public.validate_button($1::jsonb) as v", [JSON.stringify(caso)])
      .then((r) => r.rows[0].v);
    if (ts !== sql) {
      divergenciasBotao++;
      console.log(`  FALHA divergência em ${JSON.stringify(caso)}: ts=${ts} sql=${sql}`);
    }
  }
  verificar(
    `TypeScript e SQL concordam nos ${casosBotao.length} casos de botão`,
    divergenciasBotao === 0,
    `${divergenciasBotao} divergência(s)`,
  );

  // =========================================================================
  secao("26. get_public_card oculta botões desativados (PRD §11)");
  // =========================================================================
  const BOTOES_CLIENTE = "10000000-0000-4000-8000-000000000008";
  await db.exec(`
    insert into auth.users (id, email) values ('${BOTOES_CLIENTE}', 'bc@interno');
    insert into public.clients (id, username, full_name, package_months, expires_at) values
      ('${BOTOES_CLIENTE}', 'botoes-teste', 'Botoes Teste', 3, now() + interval '90 days');
    insert into public.card_published (client_id, content) values
      ('${BOTOES_CLIENTE}', '{
        "displayName": "Botoes Teste", "backgroundColor": "#ffffff", "buttonColor": "#000000",
        "buttons": [
          {"id": "1", "enabled": true,  "type": "pix", "key": "um"},
          {"id": "2", "enabled": false, "type": "pix", "key": "dois-desativado"},
          {"id": "3", "enabled": true,  "type": "pix", "key": "tres"},
          {"id": "4", "enabled": false, "type": "pix", "key": "quatro-desativado"},
          {"id": "5", "enabled": true,  "type": "pix", "key": "cinco"}
        ]
      }');
  `);

  const cartaoComBotoes = await comoPapel(
    db,
    "anon",
    null,
    "select public.get_public_card('botoes-teste') as c",
  );
  const botoesRecebidos = cartaoComBotoes.resultado?.rows[0]?.c?.buttons ?? [];
  verificar(
    "visitante recebe só os 3 botões ativos, nunca os 2 desativados",
    cartaoComBotoes.ok &&
      botoesRecebidos.length === 3 &&
      botoesRecebidos.every((b) => b.enabled === true) &&
      !botoesRecebidos.some((b) => b.id === "2" || b.id === "4"),
    JSON.stringify(botoesRecebidos),
  );
  verificar(
    "a ordem original é preservada (1, 3, 5 — não embaralhada)",
    JSON.stringify(botoesRecebidos.map((b) => b.id)) === JSON.stringify(["1", "3", "5"]),
    JSON.stringify(botoesRecebidos.map((b) => b.id)),
  );

  await db.exec(`
    update public.card_published set content = jsonb_set(content, '{buttons}', '[]'::jsonb)
    where client_id = '${BOTOES_CLIENTE}'
  `);
  const semBotoes = await comoPapel(
    db,
    "anon",
    null,
    "select public.get_public_card('botoes-teste') as c",
  );
  verificar(
    "array de botões vazio não quebra a função",
    semBotoes.ok && Array.isArray(semBotoes.resultado.rows[0].c.buttons) &&
      semBotoes.resultado.rows[0].c.buttons.length === 0,
    JSON.stringify(semBotoes.resultado?.rows[0]?.c),
  );

  // =========================================================================
  secao("27. username_exists — distingue nunca-existiu de excluído (PRD §39, §40)");
  // =========================================================================
  const existe = async (u) =>
    (await comoPapel(db, "anon", null, `select public.username_exists('${u}') as v`)).resultado.rows[0]
      .v;

  verificar("cliente ativo: existe = true", (await existe("view-ativo")) === true);
  verificar("cliente vencido: existe = true (mas não diz o status)", (await existe("view-vencido")) === true);
  verificar("cliente cancelado: existe = true", (await existe("view-cancelado")) === true);
  verificar("username nunca usado: existe = false (404 real, PRD §39)", (await existe("nunca-existiu-mesmo")) === false);
  verificar(
    "username de cliente excluído: existe = true, via reserved_usernames (PRD §40 — página neutra, não 404)",
    (await existe("cliente-a")) === true,
  );
  verificar(
    "palavra reservada do sistema (não é cliente excluído): existe = false",
    (await existe("admin")) === false,
  );

  const authenticatedTambemChama = await comoPapel(
    db,
    "authenticated",
    ADMIN,
    "select public.username_exists('view-ativo') as v",
  );
  verificar("admin/cliente logado também pode checar existência", authenticatedTambemChama.ok);

  // =========================================================================
  secao("28. processarImagem — validação real por decodificação (PRD §10)");
  // =========================================================================
  // Não usa `db` — processamento de imagem é puro, sem banco. Fica aqui
  // mesmo assim para manter toda a suíte num só lugar (D50: a parte que
  // depende de RLS de Storage é verificada por script real à parte, já que
  // `storage.objects` não existe no PGlite).
  const sharpModulo = await import("sharp");
  const sharp = sharpModulo.default;
  const { processarImagem } = await import("../../src/lib/card/image-processing.ts");

  const pngTeste = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();

  const resultadoBanner = await processarImagem(pngTeste, "banner");
  verificar(
    "PNG 2000x1000 vira WebP com largura <= 1600 (limite do propósito 'banner')",
    resultadoBanner.ok && resultadoBanner.largura <= 1600,
    JSON.stringify(resultadoBanner),
  );

  const decodificado = resultadoBanner.ok ? await sharp(resultadoBanner.buffer).metadata() : null;
  verificar(
    "o buffer devolvido é webp de verdade e decodifica sem erro",
    decodificado?.format === "webp",
    JSON.stringify(decodificado),
  );

  const resultadoIcone = await processarImagem(pngTeste, "icon");
  verificar(
    "mesmo PNG como ícone respeita o limite menor (<=256px)",
    resultadoIcone.ok && resultadoIcone.largura <= 256,
    JSON.stringify(resultadoIcone),
  );

  const pngPequeno = await sharp({
    create: { width: 100, height: 50, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .png()
    .toBuffer();
  const resultadoSemAmpliar = await processarImagem(pngPequeno, "banner");
  verificar(
    "imagem menor que o limite não é ampliada (withoutEnlargement)",
    resultadoSemAmpliar.ok && resultadoSemAmpliar.largura === 100,
    JSON.stringify(resultadoSemAmpliar),
  );

  const textoDisfarcado = Buffer.from("isto nao e uma imagem, so texto puro");
  const resultadoTexto = await processarImagem(textoDisfarcado, "profile");
  verificar(
    "arquivo de texto disfarçado de imagem é rejeitado (decodificação real, não extensão)",
    resultadoTexto.ok === false,
    JSON.stringify(resultadoTexto),
  );

  const bufferVazio = Buffer.alloc(0);
  const resultadoVazio = await processarImagem(bufferVazio, "profile");
  verificar("buffer vazio é rejeitado sem lançar exceção", resultadoVazio.ok === false);

  // =========================================================================
  secao("29. Painel do cliente: escrita travada fora do status ATIVO (P5, PRD §22)");
  // =========================================================================
  const INATIVO_VENCIDO = "10000000-0000-4000-8000-000000000009";
  const INATIVO_CANCELADO = "10000000-0000-4000-8000-00000000000a";

  await db.exec(`
    insert into auth.users (id, email) values
      ('${INATIVO_VENCIDO}', 'iv@interno'), ('${INATIVO_CANCELADO}', 'ic@interno');
    insert into public.clients (id, username, full_name, package_months, expires_at, cancelled_at) values
      ('${INATIVO_VENCIDO}', 'painel-vencido', 'Painel Vencido', 3, now() - interval '5 days', null),
      ('${INATIVO_CANCELADO}', 'painel-cancelado', 'Painel Cancelado', 3, now() + interval '30 days', now());
    insert into public.card_drafts (client_id, content) values
      ('${INATIVO_VENCIDO}', '{"buttons": []}'),
      ('${INATIVO_CANCELADO}', '{"buttons": []}');
    insert into public.card_published (client_id, content) values
      ('${INATIVO_VENCIDO}', '{"buttons": [], "displayName": "Antigo", "backgroundColor": "#ffffff", "buttonColor": "#000000"}'),
      ('${INATIVO_CANCELADO}', '{"buttons": [], "displayName": "Antigo", "backgroundColor": "#ffffff", "buttonColor": "#000000"}');
  `);

  for (const [nome, id] of [
    ["vencido", INATIVO_VENCIDO],
    ["cancelado", INATIVO_CANCELADO],
  ]) {
    const tentaSalvar = await comoPapel(
      db,
      "authenticated",
      id,
      `update public.card_drafts set content = '{"buttons": [], "displayName": "Tentativa"}'
       where client_id = '${id}' returning content`,
    );
    verificar(
      `cliente ${nome}: não consegue salvar rascunho (0 linhas afetadas)`,
      tentaSalvar.ok && tentaSalvar.resultado.rows.length === 0,
      tentaSalvar.ok ? JSON.stringify(tentaSalvar.resultado.rows) : tentaSalvar.erro,
    );

    const tentaPublicar = await comoPapel(db, "authenticated", id, "select public.publish_card()");
    verificar(
      `cliente ${nome}: publish_card() recusa com mensagem clara`,
      !tentaPublicar.ok,
      tentaPublicar.ok ? "PASSOU" : tentaPublicar.erro,
    );

    const tentaRestaurar = await comoPapel(db, "authenticated", id, "select public.restore_draft()");
    verificar(
      `cliente ${nome}: restore_draft() também recusa`,
      !tentaRestaurar.ok,
      tentaRestaurar.ok ? "PASSOU" : tentaRestaurar.erro,
    );

    const aindaLe = await linhas(
      db,
      "authenticated",
      id,
      `select content from public.card_drafts where client_id = '${id}'`,
    );
    verificar(`cliente ${nome}: ainda consegue LER o próprio rascunho`, aindaLe?.length === 1);
  }

  // Cliente ativo (controle): confirma que a trava é só para inativos.
  const salvaComoAtivo = await comoPapelConfirmando(
    db,
    "authenticated",
    PUB_CLIENTE,
    `update public.card_drafts set content = '{"buttons": [], "displayName": "Publica Teste Editado", "backgroundColor": "#ffffff", "buttonColor": "#000000"}'
     where client_id = '${PUB_CLIENTE}' returning content`,
  );
  verificar(
    "cliente ATIVO continua conseguindo salvar rascunho normalmente",
    salvaComoAtivo.ok && salvaComoAtivo.resultado.rows.length === 1,
    salvaComoAtivo.ok ? "" : salvaComoAtivo.erro,
  );

  // =========================================================================
  secao("30. Operações de botão puras (PRD §11 — editor da etapa 12)");
  // =========================================================================
  const {
    adicionarBotao,
    inserirBotaoComId,
    editarBotao,
    removerBotao,
    duplicarBotao,
    alternarAtivo,
    reordenarBotoes,
    botoesVisiveis,
  } = await import("../../src/lib/card/buttons.ts");

  const vazio = { buttons: [] };

  const comUm = adicionarBotao(vazio, { type: "pix", enabled: true, key: "chave-1" });
  verificar(
    "adicionarBotao gera um id novo e acrescenta ao final",
    comUm.buttons.length === 1 && typeof comUm.buttons[0].id === "string" && comUm.buttons[0].id.length > 0,
  );

  const comIdEspecifico = inserirBotaoComId(vazio, {
    id: "id-fixo-123",
    type: "pix",
    enabled: true,
    key: "chave-2",
  });
  verificar(
    "inserirBotaoComId preserva o id informado (ao contrário de adicionarBotao)",
    comIdEspecifico.buttons[0]?.id === "id-fixo-123",
  );

  const dezBotoesConteudo = {
    buttons: Array.from({ length: 10 }, (_, i) => ({
      id: `b${i}`, type: "pix", enabled: true, key: `k${i}`,
    })),
  };
  let lancouAoExceder = false;
  try {
    adicionarBotao(dezBotoesConteudo, { type: "pix", enabled: true, key: "onze" });
  } catch {
    lancouAoExceder = true;
  }
  verificar("adicionarBotao recusa o 11º botão (limite do PRD §11)", lancouAoExceder);
  let inserirTambemRecusa = false;
  try {
    inserirBotaoComId(dezBotoesConteudo, { id: "extra", type: "pix", enabled: true, key: "x" });
  } catch {
    inserirTambemRecusa = true;
  }
  verificar("inserirBotaoComId também respeita o limite de 10", inserirTambemRecusa);

  const editado = editarBotao(comIdEspecifico, "id-fixo-123", { key: "chave-editada" });
  verificar(
    "editarBotao altera só o campo informado, no botão certo",
    editado.buttons[0]?.key === "chave-editada" && editado.buttons[0]?.type === "pix",
  );

  const removido = removerBotao(comIdEspecifico, "id-fixo-123");
  verificar("removerBotao tira o botão da lista", removido.buttons.length === 0);

  const duplicado = duplicarBotao(comIdEspecifico, "id-fixo-123");
  verificar(
    "duplicarBotao cria uma cópia logo após o original, com id diferente",
    duplicado.buttons.length === 2 &&
      duplicado.buttons[1]?.key === "chave-2" &&
      duplicado.buttons[1]?.id !== "id-fixo-123",
  );
  verificar(
    "duplicarBotao respeita o limite de 10 (não deixa passar de 10 duplicando)",
    (() => {
      try {
        duplicarBotao(dezBotoesConteudo, "b0");
        return false;
      } catch {
        return true;
      }
    })(),
  );

  const ligado = { buttons: [{ id: "x", type: "pix", enabled: true, key: "k" }] };
  const desligado = alternarAtivo(ligado, "x");
  verificar("alternarAtivo inverte enabled true -> false", desligado.buttons[0]?.enabled === false);
  const religado = alternarAtivo(desligado, "x");
  verificar("alternarAtivo inverte de volta false -> true", religado.buttons[0]?.enabled === true);

  const tresBotoes = {
    buttons: [
      { id: "a", type: "pix", enabled: true, key: "1" },
      { id: "b", type: "pix", enabled: true, key: "2" },
      { id: "c", type: "pix", enabled: true, key: "3" },
    ],
  };
  const reordenado = reordenarBotoes(tresBotoes, ["c", "a", "b"]);
  verificar(
    "reordenarBotoes aplica a nova ordem de ids",
    reordenado.buttons.map((b) => b.id).join(",") === "c,a,b",
  );

  const misturado = {
    buttons: [
      { id: "1", type: "pix", enabled: true, key: "k" },
      { id: "2", type: "pix", enabled: false, key: "k" },
      { id: "3", type: "pix", enabled: true, key: "k" },
    ],
  };
  const visiveis = botoesVisiveis(misturado);
  verificar(
    "botoesVisiveis devolve só os ativos, na ordem (usado na pré-visualização)",
    visiveis.length === 2 && visiveis.map((b) => b.id).join(",") === "1,3",
  );

  // =========================================================================
  secao("31. Modelos e duplicação sem dado pessoal (PRD §54, §55)");
  // =========================================================================
  const { CARD_TEMPLATES, aplicarModelo, duplicarConteudoSemDadosPessoais, botaoPlaceholder } =
    await import("../../src/lib/card/templates.ts");

  verificar("existe pelo menos um modelo no catálogo", CARD_TEMPLATES.length > 0);

  for (const modelo of CARD_TEMPLATES) {
    const aplicado = aplicarModelo(modelo);
    const validacaoBotoesModelo = (
      await Promise.all(
        aplicado.buttons.map((b) =>
          db.query("select public.validate_button($1::jsonb) as v", [JSON.stringify(b)]).then((r) => r.rows[0].v),
        ),
      )
    ).every(Boolean);
    verificar(
      `modelo "${modelo.name}": todos os botões de exemplo são válidos para o banco`,
      validacaoBotoesModelo,
    );
    verificar(
      `modelo "${modelo.name}": não tem displayName nem descrição (nome é sempre do cliente novo)`,
      !("displayName" in aplicado) && !("description" in aplicado),
    );
  }

  const idsUnicos = new Set(
    CARD_TEMPLATES.flatMap((m) => aplicarModelo(m).buttons.map((b) => b.id)),
  );
  const totalBotoes = CARD_TEMPLATES.reduce((n, m) => n + m.buttonTypes.length, 0);
  verificar(
    "cada aplicação de modelo gera ids novos (não reaproveita entre clientes)",
    idsUnicos.size === totalBotoes,
  );

  const original = {
    displayName: "Fulano de Tal",
    description: "Descrição pessoal do Fulano",
    profilePhoto: "https://storage.exemplo/foto-do-fulano.webp",
    banner: "https://storage.exemplo/banner-do-fulano.webp",
    backgroundColor: "#123456",
    buttonColor: "#654321",
    buttons: [
      { id: "1", enabled: true, type: "phone", number: "96999998888" },
      { id: "2", enabled: false, type: "pix", key: "cpf-real-do-fulano-000-000-000-00" },
      { id: "3", enabled: true, type: "address", address: "Rua Pessoal do Fulano, 42" },
      { id: "4", enabled: true, type: "wifi", ssid: "WifiDaCasaDoFulano", password: "senha-real-123" },
    ],
  };

  const conteudoDuplicado = duplicarConteudoSemDadosPessoais(original);

  verificar(
    "duplicação preserva cores (aparência)",
    conteudoDuplicado.backgroundColor === "#123456" && conteudoDuplicado.buttonColor === "#654321",
  );
  verificar(
    "duplicação preserva quantidade, tipo, ordem e enabled dos botões",
    conteudoDuplicado.buttons.length === 4 &&
      conteudoDuplicado.buttons.map((b) => `${b.type}:${b.enabled}`).join(",") ===
        "phone:true,pix:false,address:true,wifi:true",
  );
  verificar(
    "duplicação NÃO tem displayName/description/profilePhoto/banner do original",
    !("displayName" in conteudoDuplicado) &&
      !("description" in conteudoDuplicado) &&
      !("profilePhoto" in conteudoDuplicado) &&
      !("banner" in conteudoDuplicado),
  );

  const jsonDuplicado = JSON.stringify(conteudoDuplicado);
  verificar(
    "nenhum dado pessoal do original (telefone, CPF, SSID, senha, endereço) aparece no resultado",
    !jsonDuplicado.includes("96999998888") &&
      !jsonDuplicado.includes("cpf-real-do-fulano") &&
      !jsonDuplicado.includes("Rua Pessoal do Fulano") &&
      !jsonDuplicado.includes("WifiDaCasaDoFulano") &&
      !jsonDuplicado.includes("senha-real-123"),
    jsonDuplicado,
  );
  verificar(
    "ids dos botões duplicados são diferentes dos originais",
    conteudoDuplicado.buttons.every((b, i) => b.id !== original.buttons[i]?.id),
  );

  const validacaoBotoesDuplicados = (
    await Promise.all(
      conteudoDuplicado.buttons.map((b) =>
        db.query("select public.validate_button($1::jsonb) as v", [JSON.stringify(b)]).then((r) => r.rows[0].v),
      ),
    )
  ).every(Boolean);
  verificar("todos os botões duplicados (com placeholder) passam na validação do banco", validacaoBotoesDuplicados);

  const placeholderDesconhecido = (() => {
    try {
      botaoPlaceholder("tipo-invalido", "x", true);
      return false;
    } catch {
      return true;
    }
  })();
  verificar(
    "botaoPlaceholder com tipo desconhecido lança erro em vez de devolver botão quebrado",
    placeholderDesconhecido,
  );

  // =========================================================================
  secao("32. get_public_card normaliza maiúsculas/minúsculas (auditoria etapa 15)");
  // =========================================================================
  const CASE_CLIENTE = "10000000-0000-4000-8000-00000000000b";
  await db.exec(`
    insert into auth.users (id, email) values ('${CASE_CLIENTE}', 'case@interno');
    insert into public.clients (id, username, full_name, package_months, expires_at) values
      ('${CASE_CLIENTE}', 'case-teste', 'Case Teste', 3, now() + interval '90 days');
    insert into public.card_published (client_id, content) values
      ('${CASE_CLIENTE}', '{"displayName": "Case Teste", "backgroundColor": "#fff", "buttonColor": "#000", "buttons": []}');
  `);

  const cartaoMaiusculo = await comoPapel(
    db,
    "anon",
    null,
    "select public.get_public_card('CASE-TESTE') as c",
  );
  verificar(
    "cliente ativo com username lowercase é encontrado mesmo com URL em maiúsculas",
    cartaoMaiusculo.ok && cartaoMaiusculo.resultado.rows[0].c?.displayName === "Case Teste",
    JSON.stringify(cartaoMaiusculo.resultado?.rows[0]),
  );

  const existeMaiusculo = await comoPapel(
    db,
    "anon",
    null,
    "select public.username_exists('CASE-TESTE') as v",
  );
  verificar(
    "username_exists também confirma (consistente com get_public_card)",
    existeMaiusculo.ok && existeMaiusculo.resultado.rows[0].v === true,
  );

  secao("33. Nicho / profissão: persistência, publicação e isolamento");
  // A fixture de case acima só criava a versão publicada.
  await db.exec(`insert into public.card_drafts (client_id, content)
    select client_id, content from public.card_published where client_id = '${CASE_CLIENTE}'`);
  const professionDraft = await comoPapel(db, "authenticated", CASE_CLIENTE, `
    update public.card_drafts set content = content || '{"profession":"Desenvolvedor Web","professionColor":"#d4a853"}'::jsonb
    where client_id = '${CASE_CLIENTE}';
    select public.get_public_card('case-teste') as card;
  `);
  verificar("profissão do rascunho não vaza ao público", professionDraft.ok && !professionDraft.resultado.rows[0].card.profession);

  const professionPublished = await comoPapel(db, "authenticated", CASE_CLIENTE, `
    update public.card_drafts set content = content || '{"profession":"Desenvolvedor Web","professionColor":"#d4a853"}'::jsonb
    where client_id = '${CASE_CLIENTE}';
    select public.publish_card();
    select public.get_public_card('case-teste') as card;
  `);
  verificar("publicação entrega profissão e cor pela função pública", professionPublished.ok &&
    professionPublished.resultado.rows[0].card.profession === "Desenvolvedor Web" &&
    professionPublished.resultado.rows[0].card.professionColor === "#d4a853");

  const professionRestored = await comoPapel(db, "authenticated", CASE_CLIENTE, `
    update public.card_drafts set content = content || '{"profession":"Designer","professionColor":"#abc"}'::jsonb
    where client_id = '${CASE_CLIENTE}';
    select public.publish_card();
    update public.card_drafts set content = content || '{"profession":"Consultor"}'::jsonb
    where client_id = '${CASE_CLIENTE}';
    select public.restore_draft();
    select content from public.card_drafts where client_id = '${CASE_CLIENTE}';
  `);
  verificar("restaurar recupera profissão e cor publicadas", professionRestored.ok &&
    professionRestored.resultado.rows[0].content.profession === "Designer" &&
    professionRestored.resultado.rows[0].content.professionColor === "#abc");

  const invalidProfession = await comoPapel(db, "authenticated", CASE_CLIENTE, `
    update public.card_drafts set content = content || jsonb_build_object('profession', repeat('a',61))
    where client_id = '${CASE_CLIENTE}';
  `);
  verificar("banco rejeita profissão com mais de 60 caracteres", !invalidProfession.ok);
  const invalidProfessionColor = await comoPapel(db, "authenticated", CASE_CLIENTE, `
    update public.card_drafts set content = content || '{"professionColor":"red"}'::jsonb
    where client_id = '${CASE_CLIENTE}';
  `);
  verificar("banco rejeita cor inválida da profissão", !invalidProfessionColor.ok);
  const invalidAccentColor = await comoPapel(db, "authenticated", CASE_CLIENTE, `
    update public.card_drafts set content = content || '{"accentColor":"url(https://example.com/x.png)"}'::jsonb
    where client_id = '${CASE_CLIENTE}';
  `);
  verificar("banco rejeita cor de destaque fora do formato hexadecimal", !invalidAccentColor.ok);
  const validAccentColor = await comoPapel(db, "authenticated", CASE_CLIENTE, `
    update public.card_drafts set content = content || '{"accentColor":"#fab754"}'::jsonb
    where client_id = '${CASE_CLIENTE}';
  `);
  verificar("banco aceita cor de destaque hexadecimal", validAccentColor.ok);

  await db.close();

  // =========================================================================
  console.log(`\n${"=".repeat(60)}`);
  console.log(`total: ${passou + falhou} | passou: ${passou} | falhou: ${falhou}`);
  if (falhou > 0) {
    console.log("\nfalhas:");
    for (const f of falhas) console.log(`  - ${f}`);
  }
  console.log("=".repeat(60));
  process.exit(falhou === 0 ? 0 : 1);
}

principal().catch((e) => {
  console.error("\nerro fatal no harness:", e);
  process.exit(1);
});
