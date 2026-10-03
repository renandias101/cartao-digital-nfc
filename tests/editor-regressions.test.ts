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
import { organizeCardButtons } from "../src/lib/card/presentation";
import { buildVCard, getContactCardData, getVCardFileName } from "../src/lib/card/vcard";

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
