import assert from "node:assert/strict";
import test from "node:test";

import config from "../next.config";
import { adicionarBotao, alternarAtivo, duplicarBotao, editarBotao, removerBotao, reordenarBotoes, validarBotoes } from "../src/lib/card/buttons";
import { imageUploadPath, isImagePurpose, validateImageFile } from "../src/lib/card/image-upload";
import type { CardContent } from "../src/lib/card/types";
import { UPLOAD_IMAGEM } from "../src/lib/constants";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CardProfession } from "../src/components/card-profession";
import { validarConteudoCartao } from "../src/lib/card/validation";
import { duplicarConteudoSemDadosPessoais } from "../src/lib/card/templates";
import { checkSquareEligibility, getAccentColor, getButtonLayouts, isSystemIconKey, moveButtonToLayout, organizeCardButtons, resolveButtonIcon } from "../src/lib/card/presentation";
import { buildVCard, getContactCardData, getVCardFileName } from "../src/lib/card/vcard";
import { ICON_CATALOG, ICON_CATEGORIES, searchIcons } from "../src/lib/card/icon-catalog";
import { SYSTEM_ICON_COMPONENTS } from "../src/components/system-icons";

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

test("vCard usa somente dados de botões visíveis e escapa o conteúdo", () => {
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
  assert.match(vcard, /ADR;TYPE=WORK:;;Rua A\\, 10/);
  assert.match(vcard, /URL:https:\/\/example\.com/);
  assert.ok(!vcard.includes("0000"));
  assert.equal(getVCardFileName(contact.name), "renan-dias.vcf");
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
  assert.deepEqual(only("avaliacoes"), ["star"]);
  assert.deepEqual(only("pix"), ["card"]);
  assert.deepEqual(only("twitter"), ["x"]);
  assert.deepEqual(only("zzzz"), []);
  assert.equal(searchIcons("").length, ICON_CATALOG.length);
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
