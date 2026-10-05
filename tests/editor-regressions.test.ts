import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import config from "../next.config";
import { adicionarBotao, alternarAtivo, duplicarBotao, editarBotao, removerBotao, reordenarBotoes, validarBotoes } from "../src/lib/card/buttons";
import { imageUploadPath, isImagePurpose, validateImageFile } from "../src/lib/card/image-upload";
import { TIPOS_DE_BOTAO, TIPOS_PARA_CRIAR, type CardButton, type CardContent } from "../src/lib/card/types";
import { UPLOAD_IMAGEM } from "../src/lib/constants";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CardProfession } from "../src/components/card-profession";
import { validarConteudoCartao } from "../src/lib/card/validation";
import { CARD_TEMPLATES, duplicarConteudoSemDadosPessoais } from "../src/lib/card/templates";
import { checkSquareEligibility, getAccentColor, getButtonLayouts, isSystemIconKey, moveButtonToLayout, organizeCardButtons, resolveButtonIcon } from "../src/lib/card/presentation";
import { buildVCard, getContactCardData, getVCardFileName } from "../src/lib/card/vcard";
import { ICON_CATALOG, ICON_CATEGORIES, searchIcons } from "../src/lib/card/icon-catalog";
import { SYSTEM_ICON_COMPONENTS } from "../src/components/system-icons";
import { RODAPE_PADRAO, validarRodape } from "../src/lib/system/card-footer";
import { validarSuporte } from "../src/lib/support/support";
import { avaliarSaudeDoCartao } from "../src/lib/admin/card-health";
import { emailValido, formatarWhatsapp, normalizarWhatsapp } from "../src/lib/admin/contacts";
import { lerFiltro } from "../src/lib/admin/filters";
import { lerPagamento, lerValorEmCentavos } from "../src/lib/admin/payments";
import { categoriaEfetiva } from "../src/lib/support/categories";
import { diasAte, formatarCentavos } from "../src/lib/format";

test("cria e duplica botões mesmo sem randomUUID (HTTP na rede local)", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis.crypto, "randomUUID");
  Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
  try {
    const content = adicionarBotao({ buttons: [] }, {
      type: "link", enabled: true, title: "Site", url: "https://example.com",
    } as Parameters<typeof adicionarBotao>[1]);
    const copy = duplicarBotao(content, content.buttons[0]!.id);
    assert.equal(copy.buttons.length, 2);
    assert.notEqual(copy.buttons[0]!.id, copy.buttons[1]!.id);
    for (const button of copy.buttons) {
      assert.match(button.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    assert.deepEqual(validarBotoes(copy.buttons), { valido: true });
  } finally {
    if (previous) Object.defineProperty(globalThis.crypto, "randomUUID", previous);
    else Reflect.deleteProperty(globalThis.crypto, "randomUUID");
  }
});

test("transporte permite os 5 MB de imagem mais o multipart", () => {
  const limit = config.experimental?.serverActions?.bodySizeLimit;
  assert.equal(typeof limit, "number");
  assert.ok(Number(limit) > UPLOAD_IMAGEM.tamanhoMaximoBytes);
  assert.ok(Number(limit) <= 6 * 1024 * 1024);
});

test("mantém edição, ordem, ativação, remoção e limite de 10 botões", () => {
  let content: CardContent = { buttons: [{ id: "original", type: "phone", enabled: true, number: "123" }] };
  const edited = editarBotao(content, "original", { title: "Contato" });
  assert.equal(edited.buttons[0]!.title, "Contato");
  assert.equal(content.buttons[0]!.title, undefined);
  content = duplicarBotao(edited, "original");
  const secondId = content.buttons[1]!.id;
  content = reordenarBotoes(content, [secondId, "original"]);
  assert.equal(content.buttons[0]!.id, secondId);
  content = alternarAtivo(content, secondId);
  assert.equal(content.buttons[0]!.enabled, false);
  assert.equal(removerBotao(content, secondId).buttons.length, 1);
  while (content.buttons.length < 10) content = duplicarBotao(content, "original");
  assert.throws(() => duplicarBotao(content, "original"), /Máximo de 10/);
  assert.deepEqual(validarBotoes(content.buttons), { valido: true });
});

test("valida tamanho e MIME antes de enviar, sem restringir os formatos existentes", () => {
  for (const type of UPLOAD_IMAGEM.tiposAceitos) {
    assert.equal(validateImageFile({ type, size: UPLOAD_IMAGEM.tamanhoMaximoBytes }), null);
  }
  assert.match(validateImageFile({ type: "image/png", size: 0 })!, /vazio/);
  assert.match(validateImageFile({ type: "image/png", size: UPLOAD_IMAGEM.tamanhoMaximoBytes + 1 })!, /5 MB/);
  for (const type of ["image/svg+xml", "image/gif", "text/html"]) {
    assert.match(validateImageFile({ type, size: 200 })!, /Formato não suportado/);
  }
});

test("propósitos são validados e URLs novas não sobrescrevem a versão publicada", () => {
  for (const purpose of ["profile", "banner", "background", "icon"] as const) {
    assert.equal(isImagePurpose(purpose), true);
    const oldPath = imageUploadPath("owner", purpose, "version-1");
    const newPath = imageUploadPath("owner", purpose, "version-2");
    assert.notEqual(oldPath, newPath);
    assert.equal(newPath, `owner/${purpose}-version-2.webp`);
  }
  for (const invalid of [null, "../other-user", "avatar", {}]) assert.equal(isImagePurpose(invalid), false);
});

test("profissão opcional: não deixa elemento vazio, escapa HTML e isola sua cor", () => {
  for (const profession of [undefined, "", "   "]) {
    assert.equal(renderToStaticMarkup(createElement(CardProfession, { content: { buttons: [], profession } })), "");
  }
  const content: CardContent = { buttons: [], profession: "<img src=x onerror=alert(1)>", professionColor: "#d4a853" };
  const markup = renderToStaticMarkup(createElement(CardProfession, { content }));
  assert.ok(markup.includes("&lt;img"));
  assert.ok(!markup.includes("<img"));
  assert.ok(markup.includes("color:#d4a853"));
  assert.ok(markup.includes("data-card-profession"));
});

test("profissão persiste no JSON e a duplicação de modelo não leva esse dado pessoal", () => {
  const content: CardContent = { buttons: [], profession: "Desenvolvedor Web", professionColor: "#d4a853" };
  assert.deepEqual(JSON.parse(JSON.stringify(content)), content);
  const copy = duplicarConteudoSemDadosPessoais(content);
  assert.equal(copy.profession, undefined);
  assert.equal(copy.professionColor, content.professionColor);
  assert.equal(validarConteudoCartao({ buttons: [] }, false).valido, true);
  assert.equal(validarConteudoCartao({ ...content, profession: "a".repeat(61) }, false).valido, false);
  assert.equal(validarConteudoCartao({ ...content, professionColor: "red" }, false).valido, false);
});

test("organiza redes sociais no destaque sem esconder os demais botões", () => {
  const content: CardContent = {
    buttons: [
      { id: "wa", type: "link", enabled: true, title: "WhatsApp", url: "https://wa.me/5511999999999" },
      { id: "ig", type: "link", enabled: true, title: "Instagram", url: "https://instagram.com/exemplo" },
      { id: "li", type: "link", enabled: true, title: "LinkedIn", url: "https://www.linkedin.com/in/exemplo" },
      { id: "mail", type: "link", enabled: true, title: "E-mail", url: "https://mail.google.com/" },
      { id: "services", type: "link", enabled: true, title: "Meus serviços", url: "https://example.com/servicos" },
    ],
  };
  const organized = organizeCardButtons(content.buttons);
  assert.deepEqual(organized.featured.map(({ kind }) => kind), ["whatsapp", "instagram", "linkedin", "email"]);
  assert.deepEqual(organized.regular.map(({ id }) => id), ["services"]);
});

test("vCard grava só nome e telefone, ignora botão desativado e escapa o conteúdo", () => {
  const content: CardContent = {
    displayName: "Renan, Dias",
    profession: "Desenvolvedor Web",
    description: "Soluções; digitais",
    buttons: [
      { id: "phone", type: "phone", enabled: true, number: "+55 96 99999-9999" },
      { id: "address", type: "address", enabled: true, address: "Rua A, 10" },
      { id: "site", type: "link", enabled: true, title: "Site", url: "https://example.com" },
      { id: "hidden", type: "phone", enabled: false, number: "0000" },
    ],
  };
  const contact = getContactCardData(content);
  assert.ok(contact);
  const vcard = buildVCard(contact);
  assert.match(vcard, /FN:Renan\\, Dias/);
  assert.match(vcard, /TEL;TYPE=CELL:\+55 96 99999-9999/);
  for (const fora of ["TITLE:", "NOTE:", "ADR", "URL:", "Rua A", "example.com", "Desenvolvedor", "0000"]) {
    assert.ok(!vcard.includes(fora), fora);
  }
  assert.equal(getVCardFileName(contact.name), "renan-dias.vcf");
  // Sem número não há contato a salvar: o botão não aparece.
  assert.equal(getContactCardData({ ...content, buttons: content.buttons.slice(1) }), null);
  assert.equal(getContactCardData({ buttons: [], contactPhone: "96 99999-0000" }), null);
});

test("telefone do Salvar Contato: vem primeiro no vCard, sem repetir, validado e fora da duplicação", () => {
  const content: CardContent = {
    displayName: "Renan Dias",
    contactPhone: "(96) 99999-9999",
    buttons: [
      { id: "same", type: "phone", enabled: true, number: "+55 96 99999-9999" },
      { id: "other", type: "phone", enabled: true, number: "(96) 3222-0000" },
    ],
  };
  const contact = getContactCardData(content);
  assert.deepEqual(contact?.phones, ["(96) 99999-9999", "(96) 3222-0000"]);
  // Só o número do Salvar Contato, sem botão de telefone.
  assert.deepEqual(getContactCardData({ displayName: "A", contactPhone: "96 99999-0000", buttons: [] })?.phones, ["96 99999-0000"]);
  // Vazio ou sem dígito não vira telefone.
  assert.equal(getContactCardData({ displayName: "A", contactPhone: " - ", buttons: [] }), null);
  for (const valido of ["", "+55 (96) 99999-9999", "96.99999.9999"]) {
    assert.equal(validarConteudoCartao({ buttons: [], contactPhone: valido }, false).valido, true, valido);
  }
  for (const invalido of ["abc", "96999\n99999", "1".repeat(31), "tel:96999999999", 96999999999 as unknown as string]) {
    assert.equal(validarConteudoCartao({ buttons: [], contactPhone: invalido }, false).valido, false, String(invalido));
  }
  assert.equal(duplicarConteudoSemDadosPessoais(content).contactPhone, undefined);
});

test("tipo Telefone não é mais criado: some da criação, dos modelos e da duplicação, mas o antigo segue válido", () => {
  assert.ok(!TIPOS_PARA_CRIAR.includes("phone"));
  assert.ok(TIPOS_DE_BOTAO.includes("phone"));
  for (const modelo of CARD_TEMPLATES) assert.ok(!modelo.buttonTypes.includes("phone"), modelo.id);
  const antigo: CardContent = { buttons: [
    { id: "p", type: "phone", enabled: true, number: "96999998888" },
    { id: "a", type: "address", enabled: true, address: "Rua A" },
  ] };
  assert.deepEqual(duplicarConteudoSemDadosPessoais(antigo).buttons.map((b) => b.type), ["address"]);
  assert.equal(validarBotoes(antigo.buttons).valido, true);
});

test('arquivos "use server" só exportam funções assíncronas (senão todas as ações da página quebram)', () => {
  const arquivos = (readdirSync("src", { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .map((f) => join("src", f))
    .filter((f) => /^\s*["']use server["']/.test(readFileSync(f, "utf8")));
  assert.ok(arquivos.length > 0);
  for (const arquivo of arquivos) {
    const proibidas = readFileSync(arquivo, "utf8")
      .split("\n")
      .filter((linha) => /^export\s+(const|let|var|class|enum|\{|default\s+(?!async))/.test(linha));
    assert.deepEqual(proibidas, [], arquivo);
  }
});

test("suporte: erro exige o que tentava fazer e o erro; ajuda exige só o pedido", () => {
  const ok = validarSuporte({ kind: "error", message: "  Trocar a foto  ", errorText: " Formato não suportado " });
  assert.ok(ok.valido && ok.pedido.message === "Trocar a foto" && ok.pedido.errorText === "Formato não suportado");
  assert.equal(validarSuporte({ kind: "error", message: "Trocar a foto", errorText: "  " }).valido, false);
  assert.equal(validarSuporte({ kind: "error", message: " ", errorText: "x" }).valido, false);
  const ajuda = validarSuporte({ kind: "help", message: "Quero mudar o link", errorText: "ignorado" });
  assert.ok(ajuda.valido && ajuda.pedido.errorText === undefined);
  assert.equal(validarSuporte({ kind: "help", message: "📱".repeat(1000) }).valido, true);
  assert.equal(validarSuporte({ kind: "help", message: "a".repeat(1001) }).valido, false);
  assert.equal(validarSuporte({ kind: "outro" as "help", message: "x" }).valido, false);
});

test("limites de texto contam emoji como 1 caractere, igual ao banco", () => {
  const texto = (content: string) => validarBotoes([{ id: "t", type: "text", enabled: true, title: "Catálogo", content }]);
  // 990 letras + 10 emojis = 1000 caracteres: cabe, mesmo valendo 1010 para `string.length`.
  assert.equal(texto("a".repeat(990) + "📱".repeat(10)).valido, true);
  assert.equal(texto("a".repeat(991) + "📱".repeat(10)).valido, false);
  assert.equal(validarConteudoCartao({ buttons: [], description: "😀".repeat(250) }, false).valido, true);
  assert.equal(validarConteudoCartao({ buttons: [], description: "😀".repeat(251) }, false).valido, false);
});

test("rodapé do sistema: validação espelha o banco e só aceita link http(s)", () => {
  const base = { enabled: true, ...RODAPE_PADRAO };
  assert.equal(validarRodape(base).valido, true);
  const limpo = validarRodape({ ...base, title: "  Título  " });
  assert.ok(limpo.valido && limpo.rodape.title === "Título");
  assert.equal(validarRodape({ ...base, subtitle: "" }).valido, true);
  for (const invalido of [
    { title: "" }, { title: "a".repeat(61) }, { subtitle: "a".repeat(121) }, { buttonLabel: " " },
    { buttonLabel: "a".repeat(31) }, { url: "javascript:alert(1)" }, { url: "wa.me/559699" },
    { url: "https://a.com/x y" }, { url: "data:text/html,oi" }, { url: `https://a.com/${"a".repeat(500)}` },
  ]) {
    assert.equal(validarRodape({ ...base, ...invalido }).valido, false, JSON.stringify(invalido).slice(0, 60));
  }
});

test("cor de destaque é opcional, validada e copiada em modelos; nada fora de hex chega ao estilo", () => {
  const dark: CardContent = { buttons: [], backgroundColor: "#0c0c0d", buttonColor: "#1a1a1a" };
  assert.equal(getAccentColor(dark), "#ffbf52");
  assert.equal(getAccentColor({ buttons: [], backgroundColor: "#ffffff", buttonColor: "#2455ad" }), "#2455ad");
  assert.equal(getAccentColor({ ...dark, accentColor: "#fab754" }), "#fab754");
  for (const invalid of ["red", "url(https://example.com/x.png)", "#fab754; color: red"]) {
    assert.equal(getAccentColor({ ...dark, accentColor: invalid }), "#ffbf52");
    assert.equal(validarConteudoCartao({ ...dark, accentColor: invalid }, false).valido, false);
  }
  assert.equal(getAccentColor({ ...dark, accentColor: "#fab754", professionColor: "#3154ae" }), "#fab754");
  assert.equal(duplicarConteudoSemDadosPessoais({ ...dark, accentColor: "#fab754" }).accentColor, "#fab754");
});

test("ícone escolhido pelo cliente substitui o automático; chave desconhecida volta ao automático", () => {
  const site = { id: "s", type: "link", enabled: true, title: "Site", url: "https://example.com" } as const;
  assert.equal(resolveButtonIcon(site), "link");
  assert.equal(resolveButtonIcon({ ...site, title: "Meus serviços" }), "monitor");
  assert.equal(resolveButtonIcon({ ...site, icon: "map-pin" }), "map-pin");
  assert.equal(resolveButtonIcon({ ...site, title: "Meus serviços", icon: "phone" }), "phone");
  assert.equal(isSystemIconKey("toString"), false);
  assert.equal(resolveButtonIcon({ ...site, icon: "toString" }), "link");
  assert.equal(resolveButtonIcon({ ...site, icon: "https://example.com/icon.webp" }), "link");
});

test("modelo quadrado: só link de um toque com logo; o motivo é explicado ao cliente", () => {
  const site = { id: "site", type: "link", enabled: true, title: "Site", url: "https://example.com" } as const;
  const wifi = { id: "wifi", type: "wifi", enabled: true, ssid: "Rede", password: "senha" } as const;
  const semLogo = checkSquareEligibility(site);
  assert.equal(semLogo.ok, false);
  assert.match(semLogo.ok ? "" : semLogo.mensagem, /precisa de um logo/);
  const detalhes = checkSquareEligibility(wifi);
  assert.match(detalhes.ok ? "" : detalhes.mensagem, /Wi-Fi abre detalhes/);
  assert.equal(checkSquareEligibility({ ...site, icon: "monitor" }).ok, true);
  assert.equal(checkSquareEligibility({ ...site, icon: "https://example.com/icon.webp" }).ok, true);
  assert.equal(checkSquareEligibility({ ...site, url: "https://wa.me/5511999999999" }).ok, true);
  assert.equal(validarBotoes([{ ...site, layout: "square" }]).valido, false);
  assert.equal(validarBotoes([{ ...wifi, layout: "square" }]).valido, false);
  assert.equal(validarBotoes([{ ...site, icon: "monitor", layout: "square" }]).valido, true);
  assert.equal(validarBotoes([{ ...site, layout: "grade" as never }]).valido, false);
});

test("modelo do botão: cartões antigos não mudam; escolha explícita vale; inválida cai para lista", () => {
  const rede = (id: string, url: string) => ({ id, type: "link", enabled: true, title: id, url }) as const;
  const antigos = [rede("wa", "https://wa.me/1"), rede("ig", "https://instagram.com/a"), rede("li", "https://linkedin.com/in/a"),
    rede("ig2", "https://instagram.com/b"), rede("ig3", "https://instagram.com/c")];
  assert.deepEqual(organizeCardButtons(antigos).featured.map(({ button }) => button.id), ["wa", "ig", "li", "ig2"]);
  const escolhidos: CardContent["buttons"] = [{ ...antigos[0]!, layout: "row" as const }, { ...rede("site", "https://example.com"), icon: "monitor", layout: "square" as const },
    { id: "pix", type: "pix", enabled: true, key: "chave", layout: "square" as const }];
  const organizado = organizeCardButtons(escolhidos);
  assert.deepEqual(organizado.featured.map(({ button }) => button.id), ["site"]);
  assert.deepEqual(organizado.regular.map(({ id }) => id), ["wa", "pix"]);
});

test("arrastar entre áreas: insere na posição, fixa o modelo de todos e recusa o que não pode ser quadrado", () => {
  const buttons: CardContent["buttons"] = [
    { id: "wa", type: "link", enabled: true, title: "WhatsApp", url: "https://wa.me/1" },
    { id: "ig", type: "link", enabled: true, title: "Instagram", url: "https://instagram.com/a" },
    { id: "services", type: "link", enabled: true, title: "Meus serviços", url: "https://example.com", icon: "monitor" },
    { id: "local", type: "address", enabled: true, title: "Minha localização", address: "Rua A" },
  ];
  const paraQuadrado = moveButtonToLayout(buttons, "services", "square", "ig");
  assert.ok(paraQuadrado.ok);
  assert.deepEqual(paraQuadrado.buttons.map(({ id, layout }) => `${id}:${layout}`), ["wa:square", "services:square", "ig:square", "local:row"]);
  const paraLista = moveButtonToLayout(paraQuadrado.buttons, "wa", "row", null);
  assert.ok(paraLista.ok);
  assert.deepEqual(paraLista.buttons.map(({ id, layout }) => `${id}:${layout}`), ["services:square", "ig:square", "local:row", "wa:row"]);
  const recusado = moveButtonToLayout(buttons, "local", "square", null);
  assert.equal(recusado.ok, false);
  assert.match(recusado.ok ? "" : recusado.mensagem, /endereço abre detalhes/);
  assert.deepEqual(getButtonLayouts(buttons).get("local"), "row");
});

test("catálogo de ícones: cada ícone existe uma vez, tem desenho e categoria válida", () => {
  const keys = ICON_CATALOG.map((entry) => entry.key);
  const labels = ICON_CATALOG.map((entry) => entry.label.toLocaleLowerCase("pt-BR"));
  assert.equal(new Set(keys).size, keys.length, "chaves repetidas");
  assert.equal(new Set(labels).size, labels.length, "nomes repetidos");
  assert.deepEqual([...keys].sort(), Object.keys(SYSTEM_ICON_COMPONENTS).sort());
  const categories = new Set<string>(ICON_CATEGORIES.map((category) => category.id));
  for (const entry of ICON_CATALOG) assert.ok(categories.has(entry.category), entry.key);
  // Chaves já salvas em cartões antigos continuam valendo.
  for (const antiga of ["monitor", "link", "map-pin", "phone", "whatsapp", "instagram", "linkedin", "email", "note", "lock", "card"]) {
    assert.ok(keys.includes(antiga as never), `chave antiga removida: ${antiga}`);
  }
});

test("busca de ícones: sinônimos e acentos levam à mesma opção, sem repetir resultados", () => {
  const only = (query: string) => searchIcons(query).map((entry) => entry.key);
  for (const sinonimo of ["site", "website", "internet", "Página", "www"]) assert.deepEqual(only(sinonimo).slice(0, 1), ["globe"], sinonimo);
  assert.deepEqual(only("cardapio"), ["menu"]);
  assert.deepEqual(only("CARDÁPIO"), ["menu"]);
  assert.deepEqual(only("agendar"), ["calendar"]);
  assert.deepEqual(only("avaliacoes"), ["star", "google"]);
  assert.deepEqual(only("google meu negócio"), ["google"]);
  assert.deepEqual(only("pix"), ["card"]);
  assert.deepEqual(only("twitter"), ["x"]);
  assert.deepEqual(only("zzzz"), []);
  // Telefone saiu do seletor (o número fica no Salvar Contato), mas a chave salva continua desenhando.
  assert.equal(searchIcons("").length, ICON_CATALOG.length - 1);
  assert.deepEqual(only("telefone"), []);
  assert.ok(isSystemIconKey("phone"));
  for (const query of ["", "site", "link", "a", "e", "rede", "mensagem"]) {
    const keys = only(query);
    assert.equal(new Set(keys).size, keys.length, `resultado repetido em "${query}"`);
  }
});

test("ícone desconhecido ou chave nova de outra versão não quebra: volta ao automático", () => {
  const site = { id: "s", type: "link", enabled: true, title: "Site", url: "https://example.com" } as const;
  assert.equal(isSystemIconKey("globe"), true);
  assert.equal(isSystemIconKey("icone-inexistente"), false);
  assert.equal(resolveButtonIcon({ ...site, icon: "icone-inexistente" }), "link");
  assert.equal(validarBotoes([{ ...site, icon: "globe", layout: "square" }]).valido, true);
});

test("saúde do cartão: classificação com critérios explícitos", () => {
  const site: CardButton = { id: "s", type: "link", enabled: true, title: "Site", url: "https://a.com" };
  const completo: CardContent = { displayName: "Renan", profilePhoto: "/f.webp", contactPhone: "(96) 99999-9999", buttons: [site] };
  const base = { status: "active" as const, diasParaVencer: 60, estadoCartao: "up_to_date" as const, publicado: completo, rascunho: completo };
  assert.equal(avaliarSaudeDoCartao(base).nivel, "saudavel");
  assert.equal(avaliarSaudeDoCartao({ ...base, estadoCartao: "pending_changes" }).nivel, "atencao");
  assert.equal(avaliarSaudeDoCartao({ ...base, diasParaVencer: 15 }).nivel, "atencao");
  assert.equal(avaliarSaudeDoCartao({ ...base, status: "expired" }).nivel, "atencao");
  assert.equal(avaliarSaudeDoCartao({ ...base, publicado: { ...completo, contactPhone: undefined } }).nivel, "atencao");
  assert.equal(avaliarSaudeDoCartao({ ...base, publicado: { ...completo, buttons: [{ ...site, enabled: false }] } }).nivel, "atencao");
  assert.equal(avaliarSaudeDoCartao({ ...base, estadoCartao: "never_published", publicado: null }).nivel, "incompleto");
  assert.equal(avaliarSaudeDoCartao({ ...base, publicado: { ...completo, displayName: " " } }).nivel, "incompleto");
  // Sem publicação, os itens olham o rascunho (o que falta antes de publicar).
  const nunca = avaliarSaudeDoCartao({ ...base, estadoCartao: "never_published", publicado: null });
  assert.ok(nunca.itens.some((i) => i.chave === "nome" && i.situacao === "ok"));
});

test("painel admin: filtros, contato, pagamento e suporte — regras iguais às do banco", () => {
  assert.equal(lerFiltro("alteracoes_nao_publicadas"), "alteracoes_nao_publicadas");
  assert.equal(lerFiltro("'; drop table x"), "todos");
  assert.equal(lerFiltro(undefined), "todos");

  assert.equal(normalizarWhatsapp("(96) 98123-3398"), "5596981233398");
  assert.equal(normalizarWhatsapp("+55 96 98123-3398"), "5596981233398");
  assert.equal(normalizarWhatsapp(""), null);
  assert.equal(normalizarWhatsapp("123"), "invalido");
  assert.equal(formatarWhatsapp("5596981233398"), "+55 (96) 98123-3398");
  assert.equal(emailValido("cliente@exemplo.com"), true);
  assert.equal(emailValido("sem arroba"), false);

  assert.equal(lerValorEmCentavos("120,00"), 12000);
  assert.equal(lerValorEmCentavos("R$ 1.200,5"), 120050);
  assert.equal(lerValorEmCentavos("99"), 9900);
  assert.equal(lerValorEmCentavos(""), null);
  assert.equal(lerValorEmCentavos("12,345"), "invalido");
  assert.equal(lerValorEmCentavos("abc"), "invalido");
  const form = (campos: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(campos)) f.set(k, v);
    return f;
  };
  const semPagamento = lerPagamento(form({ amount: "", method: "", paid_on: "2026-10-04", payment_note: "" }));
  assert.ok(semPagamento.ok && !semPagamento.valor.registrar && semPagamento.valor.paidOn === null);
  const comPagamento = lerPagamento(form({ amount: "120,00", method: "pix", paid_on: "2026-10-04", payment_note: " " }));
  assert.ok(comPagamento.ok && comPagamento.valor.registrar && comPagamento.valor.amountCents === 12000 && comPagamento.valor.note === null);
  assert.equal(lerPagamento(form({ method: "boleto" })).ok, false);
  assert.equal(lerPagamento(form({ amount: "-5" })).ok, false);
  assert.equal(formatarCentavos(12000).replace(/\s/g, " "), "R$ 120,00");

  assert.equal(categoriaEfetiva(null, "error"), "erro");
  assert.equal(categoriaEfetiva(null, "help"), "duvida");
  assert.equal(categoriaEfetiva("financeiro", "help"), "financeiro");

  const agora = new Date("2026-10-04T12:00:00Z");
  assert.equal(diasAte("2026-10-14T12:00:00Z", agora), 10);
  assert.ok(diasAte("2026-10-01T12:00:00Z", agora) < 0);
});
