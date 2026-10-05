/** Chrome local + componentes reais; actions simuladas, sem contas ou Storage reais. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { build } from "esbuild";
import sharp from "sharp";

const chromePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const root = resolve(import.meta.dirname, "..");

test("editor desktop/mobile: HTTP, botões e falha/retentativa de upload", {
  skip: !existsSync(chromePath) && "Defina CHROME_PATH para executar este teste.", timeout: 90000,
}, async (t) => {
  const result = await build({
    absWorkingDir: root, bundle: true, write: false, outfile: "fixture.js", jsx: "automatic", external: ["/fonts/*"],
    define: { "process.env.NODE_ENV": '"development"' },
    stdin: { resolveDir: root, loader: "tsx", contents: `
      import {createRoot} from 'react-dom/client';
      import {CardEditor} from './src/app/painel/editor/card-editor';
      import {SupportBubble} from './src/app/painel/support-bubble';
      import PublicPage from './src/app/[username]/page';
      import styles from './src/app/painel/editor/editor.module.css';
      import {CardPreviewTabs} from './src/app/admin/clientes/[username]/card-preview-tabs';
      import {CardHealthPanel} from './src/app/admin/clientes/[username]/card-health-panel';
      import {CardStateBadge} from './src/app/admin/card-state-badge';
      import {avaliarSaudeDoCartao} from './src/lib/admin/card-health';
      Object.defineProperty(crypto, 'randomUUID', {value: undefined});
      window.fixture = {failUpload: true, uploadCount: 0, footer: {title: 'Precisa de uma solução digital?',
        subtitle: 'Sites, sistemas e cartões digitais para o seu negócio.', buttonLabel: 'Solicitar serviço',
        url: 'https://wa.me/5596981233398'}};
      const root = createRoot(document.getElementById('root'));
      window.fixture.showPublic = async () => root.render(await PublicPage({params: Promise.resolve({username:'teste'})}));
      // Mesmo CardEditor com ações administrativas (presas ao cliente alvo, como na página do admin).
      // Peças da ficha administrativa (prévia Publicado × Rascunho e saúde).
      window.fixture.showAdminPieces = () => {
        const publicado = {displayName:'Renan Dias', backgroundColor:'#0f0f0f', buttonColor:'#1c1c1c', contactPhone:'96 99999-9999',
          buttons:[{id:'s',type:'link',enabled:true,title:'Meu site',url:'https://a.com'}]};
        const rascunho = {...publicado, displayName:'Renan Dias (rascunho)'};
        const saude = avaliarSaudeDoCartao({status:'active', diasParaVencer:10, estadoCartao:'pending_changes', publicado, rascunho});
        root.render(<main style={{padding:16, display:'grid', gap:16}} data-admin-pieces>
          <CardStateBadge estado="pending_changes" />
          <CardHealthPanel nivel={saude.nivel} itens={saude.itens} />
          <CardPreviewTabs publicado={publicado} rascunho={rascunho} footer={window.fixture.footer} />
        </main>);
      };
      window.fixture.adminCalls = [];
      const registrar = (nome) => async (...args) => { window.fixture.adminCalls.push(nome); return {ok:true,mensagem:'ok ' + nome}; };
      window.fixture.showAdminEditor = () => root.render(
        <main className={styles.page}><section className={styles.workspace}>
        <CardEditor key="admin" isActive initialContent={{displayName: 'Cliente', backgroundColor:'#000000',
          buttonColor:'#ffffff', buttons:[]}} actions={{salvarRascunho: registrar('salvar'), publicar: registrar('publicar'),
          restaurar: registrar('restaurar'), enviarImagem: async () => ({ok:false, mensagem:'sem upload'})}}/>
        </section></main>);
      root.render(
        <main className={styles.page}><section className={styles.workspace}>
        <CardEditor isActive initialContent={{displayName: 'Teste', backgroundColor:'#edf2fa',
          buttonColor:'#2455ad', profilePhoto:'/test.png', buttons:[]}}/>
        </section><SupportBubble /></main>);
    ` },
    plugins: [{ name: "isolated-editor", setup(builder) {
      builder.onResolve({ filter: /^@\/app\/painel\/editor\/actions$/ }, () => ({ path: "actions", namespace: "fixture" }));
      builder.onResolve({ filter: /^next\/image$/ }, () => ({ path: "image", namespace: "fixture" }));
      builder.onResolve({ filter: /^@\/lib\/card\/public$/ }, () => ({ path: "public", namespace: "fixture" }));
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixture" }));
      builder.onResolve({ filter: /^@\/lib\/system\/card-footer-server$/ }, () => ({ path: "footer", namespace: "fixture" }));
      builder.onResolve({ filter: /^@\/app\/painel\/support-actions$/ }, () => ({ path: "support", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
        resolveDir: root, loader: "jsx", contents: path === "actions" ? `
          export async function salvarRascunhoAction(content) {
            window.fixture.saved = structuredClone(content); return {ok:true,mensagem:'Rascunho salvo.'};
          }
          export async function publicarAction() {window.fixture.published=structuredClone(window.fixture.saved); return {ok:true,mensagem:'Publicado.'};}
          export async function restaurarAction() {return {ok:false,mensagem:'Fixture sem restauração.'};}
          export async function enviarImagemAction(purpose) {
            window.fixture.uploadCount++;
            if(window.fixture.failUpload) throw new Error('Falha de transporte simulada');
            return {ok:true,url:'/test.png?new=' + purpose};
          }
        ` : path === "public" ? `export async function getPublicCard(){return window.fixture.published;}
          export async function usernameExists(){return true;}`
          : path === "footer" ? `export async function getCardFooter(){return window.fixture.footer ?? null;}`
          : path === "support" ? `export async function enviarSuporteAction(_prev, form) {
              window.fixture.support = Object.fromEntries(form);
              return {ok:true, mensagem:'Recebemos sua mensagem. Vamos analisar e entrar em contato.'};
            }`
          : path === "navigation" ? `export function notFound(){throw new Error('Not found');}`
          : `export default function Image({fill, priority, ...props}) {return <img {...props} style={fill ? {position:'absolute',width:'100%',height:'100%',inset:0} : props.style}/>;}`,
      }));
    } }],
  });
  const js = result.outputFiles.find((file) => file.path.endsWith(".js")).text;
  const css = result.outputFiles.find((file) => file.path.endsWith(".css")).text;
  const chunks = join(root, ".next/static/chunks");
  const globalCss = existsSync(chunks) ? readdirSync(chunks).filter((file) => file.endsWith(".css"))
    .map((file) => readFileSync(join(chunks, file), "utf8")).join("\n") : "";
  assert.ok(globalCss, "Execute npm run build antes do teste de navegador.");
  // Imagem sintética transparente: os testes de upload não ocultam o fundo
  // usado para conferir a hierarquia de texto nas capturas.
  const png = await sharp({ create: { width: 1, height: 1, channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const server = createServer((request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    if (path === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(js); }
    else if (path === "/fixture.css") { response.setHeader("Content-Type", "text/css"); response.end(globalCss + css); }
    else if (path === "/test.png") { response.setHeader("Content-Type", "image/png"); response.end(png); }
    else if (path === "/images/modelo-apresentacao-banner-gold-v1.png") { response.setHeader("Content-Type", "image/png"); response.end(readFileSync(join(root, "public", path))); }
    else if (path === "/fonts/inter-latin.woff2") { response.setHeader("Content-Type", "font/woff2"); response.end(readFileSync(join(root, "public/fonts/inter-latin.woff2"))); }
    else { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script></html>'); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", `--user-data-dir=${mkdtempSync(join(tmpdir(), "card-editor-test-"))}`, "about:blank"],
  { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  t.after(() => chrome.kill());
  const endpoint = await new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("Chrome não iniciou em 15 s")), 15000);
    chrome.once("error", reject);
    chrome.stderr.on("data", (data) => {
      output += data.toString();
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const socket = new WebSocket(endpoint);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  t.after(() => socket.close());
  let sequence = 0;
  const waiting = new Map();
  const exceptions = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
    if (waiting.has(message.id)) { waiting.get(message.id)(message); waiting.delete(message.id); }
  });
  async function send(method, params = {}, sessionId) {
    const id = ++sequence;
    const response = new Promise((resolve) => waiting.set(id, resolve));
    socket.send(JSON.stringify({ id, method, params, sessionId }));
    const message = await response;
    if (message.error) throw new Error(JSON.stringify(message.error));
    return message.result;
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const command = (method, params) => send(method, params, sessionId);
  await command("Runtime.enable");
  async function evaluate(expression) {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function until(expression) {
    const end = Date.now() + 5000;
    while (Date.now() < end) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.fail(`Condição não atendida: ${expression}`);
  }
  async function click(text) {
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`);
  }
  async function input(id, value) {
    await evaluate(`(() => {const el=document.getElementById(${JSON.stringify(id)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  }
  async function chooseImage(label, type = "image/png") {
    await evaluate(`(() => {const el=document.querySelector('input[aria-label="${label}"]'); const files=new DataTransfer(); files.items.add(new File(['fixture'],'fixture.png',{type:${JSON.stringify(type)}})); el.files=files.files; el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  }
  async function screenshot(name, fullPage = false) {
    if (!process.env.EDITOR_SCREENSHOT_DIR) return;
    mkdirSync(process.env.EDITOR_SCREENSHOT_DIR, { recursive: true });
    const { cssContentSize } = await command("Page.getLayoutMetrics");
    const image = await command("Page.captureScreenshot", { format: "png", ...(fullPage ? {
      captureBeyondViewport: true, clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 },
    } : {}) });
    writeFileSync(join(process.env.EDITOR_SCREENSHOT_DIR, name), Buffer.from(image.data, "base64"));
  }
  for (const [width, height] of [[1440, 900], [390, 844], [320, 740]]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await command("Page.navigate", { url: `http://127.0.0.1:${server.address().port}` });
    await until("document.getElementById('displayName') !== null");
    assert.equal(await evaluate("document.querySelector('[data-card-profession]')"), null);
    await input("profession", "Desenvolvedor Web");
    await input("professionColor", "#3154ae");
    await until("getComputedStyle(document.querySelector('[data-card-profession]')).color === 'rgb(49, 84, 174)'");
    await evaluate(`(() => {const el=document.getElementById('description'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'Soluções digitais para o seu negócio.'); el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await until("document.querySelector('[data-card-profession]')?.textContent === 'Desenvolvedor Web'");
    const hierarchy = await evaluate(`(() => {const p=document.querySelector('[data-card-profession]'); return {
      name:p.previousElementSibling.textContent, description:p.nextElementSibling.textContent,
      color:getComputedStyle(p).color, nameColor:getComputedStyle(p.previousElementSibling).color,
      size:parseFloat(getComputedStyle(p).fontSize), nameSize:parseFloat(getComputedStyle(p.previousElementSibling).fontSize),
      descriptionSize:parseFloat(getComputedStyle(p.nextElementSibling).fontSize)};})()`);
    assert.equal(hierarchy.name, "Teste");
    assert.equal(hierarchy.description, "Soluções digitais para o seu negócio.");
    assert.equal(hierarchy.color, "rgb(49, 84, 174)");
    assert.notEqual(hierarchy.color, hierarchy.nameColor);
    assert.ok(hierarchy.size < hierarchy.nameSize && hierarchy.size > hierarchy.descriptionSize);
    assert.ok(hierarchy.nameSize >= 28 && hierarchy.nameSize <= 34);
    assert.ok(hierarchy.size >= 18 && hierarchy.size <= 22);
    assert.ok(hierarchy.descriptionSize >= 15 && hierarchy.descriptionSize <= 20);
    await evaluate("document.fonts.ready");
    assert.equal(await evaluate("document.fonts.check('16px Inter')"), true);
    const avatarSize = await evaluate("document.querySelector('aside img').getBoundingClientRect().width");
    assert.ok(avatarSize >= 144 && avatarSize <= 200, "Foto acompanha a largura da prévia");
    await evaluate("document.querySelector('aside').scrollIntoView({block:'nearest'})");
    await screenshot(`profession-preview-${width}.png`);
    // Telefone do Salvar Contato: caracteres fora do formato nem entram.
    await input("contactPhone", "(96) 99999-9999abc<");
    await until("document.getElementById('contactPhone').value === '(96) 99999-9999'");
    await evaluate("document.getElementById('contactPhone').scrollIntoView({block:'center'})");
    await screenshot(`contact-phone-${width}.png`);
    // Balão de suporte: no canto, sem cobrir a barra de ações; envia erro com os dois campos.
    const balao = "document.querySelector('button[aria-label^=\"Ajuda e suporte\"]')";
    await until(`(() => {const b=${balao}?.getBoundingClientRect(); const bar=document.querySelector('[data-editor-action-bar]').getBoundingClientRect();
      return b && b.right <= innerWidth && b.bottom <= innerHeight && (b.bottom <= bar.top || b.left >= bar.right || b.right <= bar.left);})()`);
    await evaluate(`${balao}.click()`);
    await until("document.querySelector('dialog[open]')?.textContent.includes('Ajuda e suporte')");
    await click("Reportar um erro");
    await until("document.getElementById('suporte-erro') !== null");
    await evaluate(`(() => {for (const [id, v] of [['suporte-mensagem','Trocar a foto'],['suporte-erro','Formato não suportado']]) {
      const el=document.getElementById(id); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,v);
      el.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
    await screenshot(`support-form-${width}.png`);
    await click("Enviar");
    await until("window.fixture.support?.errorText === 'Formato não suportado' && window.fixture.support.kind === 'error'");
    await until("document.querySelector('dialog[open] [role=status]')?.textContent.includes('Recebemos sua mensagem')");
    await evaluate("document.querySelector('dialog[open] [aria-label=\"Fechar\"]').click()");
    await until("!document.querySelector('dialog[open]')");
    await input("profession", " ");
    await until("!document.querySelector('[data-card-profession]')");
    await input("profession", "Desenvolvedor Web");
    assert.equal(await evaluate("typeof crypto.randomUUID"), "undefined");
    await click("Adicionar botão");
    await until("document.activeElement?.id === 'tipo-botao'");
    await input("titulo-botao", "Site");
    await input("url-botao", "https://example.com");
    await evaluate("window.fixture.failUpload = false");
    await chooseImage("Ícone personalizado (opcional)");
    await until("window.fixture.uploadCount === 1 && !document.querySelector('[aria-busy=true]')");
    await click("Adicionar botão");
    await until("document.querySelector('aside a')?.textContent === 'Site'");
    await click("Duplicar");
    await until("document.querySelectorAll('li').length === 2");
    await click("Editar");
    await input("titulo-botao", "Não salvo");
    await evaluate("Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.trim()==='Editar')[1].click()");
    await until("document.getElementById('titulo-botao')?.value === 'Site'");
    await input("titulo-botao", "Outro site");
    await click("Salvar botão");
    await click("Salvar rascunho");
    await until("window.fixture.saved?.buttons[1]?.title === 'Outro site'");
    assert.equal(await evaluate("window.fixture.saved.buttons[1].icon"), "/test.png?new=icon");
    // Clicar e arrastar na lista do editor, com mouse de verdade e SEM esperar: o segundo item sobe para o topo.
    await evaluate("document.querySelector('li[data-button-id]').scrollIntoView({block:'center'})");
    const titulos = () => evaluate("[...document.querySelectorAll('li[data-button-id]')].map(li => li.textContent)");
    assert.ok((await titulos())[0].includes("Site") && (await titulos())[1].includes("Outro site"));
    const alvo = await evaluate(`(() => {const [a,b]=[...document.querySelectorAll('li[data-button-id]')].map(li=>li.getBoundingClientRect());
      return {x:b.left+40, y:b.top+b.height/2, toY:a.top+4};})()`);
    const mouse = (type, y, buttons = 1) => command("Input.dispatchMouseEvent",
      { type, x: alvo.x, y, button: "left", buttons, clickCount: type === "mouseMoved" ? 0 : 1 });
    await mouse("mouseMoved", alvo.y, 0);
    await mouse("mousePressed", alvo.y);
    for (let passo = 1; passo <= 6; passo++) await mouse("mouseMoved", alvo.y + (alvo.toY - alvo.y) * passo / 6);
    await mouse("mouseReleased", alvo.toY, 0);
    await until("document.querySelector('li[data-button-id]')?.textContent.includes('Outro site')");
    await evaluate("window.fixture.failUpload = true");
    await chooseImage("Foto de perfil");
    await until("document.querySelector('[role=alert]')?.textContent.includes('imagem anterior')");
    assert.equal(await evaluate("document.querySelector('aside img').getAttribute('src')"), "/test.png");
    await evaluate("window.fixture.failUpload = false");
    for (const label of ["Foto de perfil", "Banner", "Imagem de fundo"]) {
      const count = await evaluate("window.fixture.uploadCount");
      await chooseImage(label);
      await until(`window.fixture.uploadCount === ${count + 1} && !document.querySelector('[aria-busy=true]')`);
    }
    await click("Salvar rascunho");
    await until("window.fixture.saved?.backgroundImage === '/test.png?new=background'");
    assert.equal(await evaluate("window.fixture.saved.profilePhoto"), "/test.png?new=profile");
    assert.equal(await evaluate("window.fixture.saved.banner"), "/test.png?new=banner");
    const count = await evaluate("window.fixture.uploadCount");
    await chooseImage("Foto de perfil", "image/svg+xml");
    await until("document.querySelector('[role=alert]')?.textContent.includes('Formato não suportado')");
    if (width === 1440) {
      // Legenda de erro é temporária: some sozinha depois de alguns segundos.
      await new Promise((resolve) => setTimeout(resolve, 8300));
      assert.equal(await evaluate("[...document.querySelectorAll('[role=alert]')].some(el => el.textContent.includes('Formato não suportado'))"), false);
    }
    assert.equal(await evaluate("window.fixture.uploadCount"), count);
    await click("Excluir");
    // Excluir pede confirmação antes de tirar o botão do rascunho.
    await until("document.querySelector('dialog[open] [data-confirm]') !== null");
    await evaluate("document.querySelector('dialog[open] [data-confirm]').click()");
    await until("document.querySelectorAll('li').length === 1");
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `Sem overflow horizontal em ${width}px`);
    await click("Salvar rascunho");
    await until("window.fixture.saved?.profession === 'Desenvolvedor Web'");
    // Publicar exige o rascunho confirmado na tela, não só a action chamada.
    await until("document.body.textContent.includes('Alterações salvas automaticamente')");
    await click("Publicar alterações");
    await until("window.fixture.published?.professionColor === '#3154ae'");
    await evaluate("window.fixture.showPublic()");
    await until("document.querySelector('h1')?.textContent === 'Teste'");
    assert.equal(await evaluate("document.querySelector('h1').nextElementSibling.textContent"), "Desenvolvedor Web");
    assert.equal(await evaluate("document.querySelector('[data-card-profession]').nextElementSibling.textContent"), "Soluções digitais para o seu negócio.");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-card-profession]')).color"), "rgb(49, 84, 174)");
    assert.ok(await evaluate("parseFloat(getComputedStyle(document.querySelector('h1')).fontSize) >= 28"));
    assert.ok(await evaluate("parseFloat(getComputedStyle(document.querySelector('[data-card-profession]')).fontSize) >= 18"));
    assert.ok(await evaluate("document.querySelector('[data-digital-card]').getBoundingClientRect().width <= 420"));
    assert.ok(await evaluate("document.querySelector('[data-digital-card] a').getBoundingClientRect().height >= 56"));
    await evaluate("window.scrollTo(0,0)");
    await screenshot(`profession-public-${width}.png`);
    assert.ok(await evaluate(`(() => {const p=document.querySelector('[data-card-profession]'); return parseFloat(getComputedStyle(p).fontSize) < parseFloat(getComputedStyle(p.previousElementSibling).fontSize) && parseFloat(getComputedStyle(p).fontSize) > parseFloat(getComputedStyle(p.nextElementSibling).fontSize);})()`));
    await evaluate("window.fixture.published.profession = 'W'.repeat(60); window.fixture.showPublic()");
    await until("document.querySelector('[data-card-profession]')?.textContent.length === 60");
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "Profissão longa quebra linha");
    await evaluate("window.fixture.published.profession = ' '; window.fixture.showPublic()");
    await until("!document.querySelector('[data-card-profession]')");
    assert.equal(await evaluate("document.querySelector('h1').nextElementSibling.textContent"), "Soluções digitais para o seu negócio.");
    await evaluate(`Object.assign(window.fixture.published, {
      backgroundColor:'#050908', buttonColor:'#f5b942', professionColor:'#f5b942',
      profession:'Desenvolvedor Web', description:'Soluções digitais para o seu negócio.', buttons: [
      {id:'wa',type:'link',enabled:true,title:'WhatsApp',url:'https://wa.me/5596999999999'},
      {id:'ig',type:'link',enabled:true,title:'Instagram',url:'https://instagram.com/exemplo'},
      {id:'li',type:'link',enabled:true,title:'LinkedIn',url:'https://linkedin.com/in/exemplo'},
      {id:'mail',type:'link',enabled:true,title:'E-mail',url:'https://mail.google.com/'},
      {id:'text',type:'text',enabled:true,title:'Informações',content:'Texto completo\\n\\nSegundo bloco',description:'Descrição do botão'},
      {id:'wifi',type:'wifi',enabled:true,ssid:'Rede de teste',password:'senha-teste'},
      {id:'pix',type:'pix',enabled:true,key:'chave-teste'},
      {id:'phone',type:'phone',enabled:true,number:'123456'},
      {id:'address',type:'address',enabled:true,address:'Endereço de teste'},
      {id:'hidden',type:'link',enabled:false,title:'Oculto',url:'https://example.com'}
    ]}); window.fixture.showPublic()`);
    await until("document.querySelectorAll('[aria-label=\"Contato e redes sociais\"] a').length === 4");
    await until("document.querySelectorAll('[data-digital-card] details').length === 3");
    await evaluate("document.querySelectorAll('[data-digital-card] summary').forEach(el=>el.click())");
    assert.equal(await evaluate("document.querySelectorAll('[data-digital-card] details[open]').length"), 3);
    // Wi-Fi abre em modal, com a senha e o botão de copiar.
    await evaluate("document.querySelector('[data-digital-card] button[data-button-id=\"wifi\"]').click()");
    assert.ok(await evaluate("document.querySelector('[data-digital-card] dialog[open]')?.textContent.includes('Senha: senha-teste')"));
    assert.ok(await evaluate("[...document.querySelectorAll('[data-digital-card] dialog[open] button')].some(b => b.textContent.includes('Copiar senha'))"));
    await screenshot(`wifi-modal-${width}.png`);
    await evaluate("document.querySelector('[data-digital-card] dialog[open] [aria-label=\"Fechar\"]').click()");
    assert.equal(await evaluate("document.querySelector('[data-digital-card] dialog[open]')"), null);
    // Texto abre em modal, não expande no meio dos botões.
    await evaluate("document.querySelector('[data-digital-card] button[data-button-id=\"text\"]').click()");
    assert.ok(await evaluate("document.querySelector('[data-digital-card] dialog[open]')?.textContent.includes('Texto completo')"));
    // Quebras de linha e linha em branco do texto aparecem no modal.
    assert.equal(await evaluate("[...document.querySelectorAll('[data-digital-card] dialog[open] p')].at(-1).innerText"), "Texto completo\n\nSegundo bloco");
    await screenshot(`text-modal-${width}.png`);
    await evaluate("document.querySelector('[data-digital-card] dialog[open] [aria-label=\"Fechar\"]').click()");
    assert.equal(await evaluate("document.querySelector('[data-digital-card] dialog[open]')"), null);
    assert.equal(await evaluate("document.querySelectorAll('[data-digital-card] details button').length"), 2);
    assert.equal(await evaluate("document.querySelector('[data-digital-card]').textContent.includes('Oculto')"), false);
    assert.ok(await evaluate("document.querySelector('[data-digital-card]').textContent.includes('Texto completo')"));
    assert.ok(await evaluate("document.querySelector('[data-digital-card]').textContent.includes('Salvar Contato')"));
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "Grade social sem overflow");
    await screenshot(`social-public-${width}.png`);
    await evaluate(`Object.assign(window.fixture.published, {
      displayName:'Renan Dias', backgroundColor:'#0f0f0f', buttonColor:'#1c1c1c', professionColor:'#ffbf52',
      contactPhone:'(96) 99999-9999',
      profilePhoto:undefined, backgroundImage:undefined, banner:'/images/modelo-apresentacao-banner-gold-v1.png',
      buttons:[...window.fixture.published.buttons.slice(0,4),
        {id:'services',type:'link',enabled:true,title:'Meus serviços',url:'https://example.com/servicos'},
        {id:'portfolio',type:'link',enabled:true,title:'Meu portfólio',url:'https://example.com/portfolio'},
        {id:'location',type:'address',enabled:true,title:'Minha localização',address:'Endereço de exemplo'}]
    }); window.fixture.showPublic()`);
    await until("document.querySelector('h1')?.textContent === 'Renan Dias'");
    await evaluate("Promise.all([...document.images].map(img => img.decode()))");
    const palette = await evaluate(`(() => {const card=document.querySelector('[data-digital-card]');
      const social=card.querySelector('nav a span'); return {
        surface:getComputedStyle(social).backgroundColor, text:getComputedStyle(social).color,
        accent:card.style.getPropertyValue('--card-accent'),
        cta:getComputedStyle(card.querySelector('button')).color
      };})()`);
    assert.deepEqual(palette, {surface:'rgb(28, 28, 28)',text:'rgb(255, 255, 255)',accent:'#ffbf52',cta:'rgb(0, 0, 0)'});
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "Modelo dourado sem overflow");
    // Rodapé do sistema: último bloco do cartão, link http(s) em nova aba.
    const rodape = await evaluate(`(() => {const f=document.querySelector('[data-digital-card] [data-card-footer]');
      const a=f?.querySelector('a'); return f && {last: f === f.parentElement.lastElementChild, text: f.textContent,
        href: a.getAttribute('href'), target: a.target, rel: a.rel, height: a.getBoundingClientRect().height};})()`);
    assert.ok(rodape?.last && rodape.text.includes('Precisa de uma solução digital?') && rodape.text.includes('Solicitar serviço'));
    assert.deepEqual([rodape.href, rodape.target, rodape.rel], ['https://wa.me/5596981233398', '_blank', 'noopener noreferrer']);
    assert.ok(rodape.height >= 44, "Botão do rodapé com área de toque");
    await evaluate("window.scrollTo(0,0)");
    await screenshot(`reference-public-${width}.png`, true);
    await evaluate("window.fixture.published.professionColor='#3154ae'; window.fixture.showPublic()");
    await until("getComputedStyle(document.querySelector('[data-card-profession]')).color === 'rgb(49, 84, 174)'");
    assert.equal(await evaluate("document.querySelector('[data-digital-card]').style.getPropertyValue('--card-accent')"), palette.accent, "Cor da profissão não altera o destaque");
    // Peças da ficha administrativa: abas trocam entre publicado e rascunho, sem estourar a largura.
    await evaluate("window.fixture.showAdminPieces()");
    await until("document.querySelector('[data-admin-pieces] [data-digital-card] h2')?.textContent === 'Renan Dias'");
    await evaluate("[...document.querySelectorAll('[role=tab]')].find(b => b.textContent === 'Rascunho').click()");
    await until("document.querySelector('[data-admin-pieces] [data-digital-card] h2')?.textContent === 'Renan Dias (rascunho)'");
    assert.ok(await evaluate("document.querySelector('[data-admin-pieces]').textContent.includes('Requer atenção')"));
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "Peças da ficha sem overflow");
    await screenshot(`admin-pieces-${width}.png`);
    if (width === 1440) {
      // Editor do admin: salvar e publicar passam pelas ações entregues, não pelas do cliente.
      const salvoDoCliente = await evaluate("JSON.stringify(window.fixture.saved)");
      await evaluate("window.fixture.showAdminEditor()");
      await until("document.getElementById('displayName')?.value === 'Cliente'");
      await input("displayName", "Cliente Editado");
      await until("window.fixture.adminCalls.includes('salvar')");
      await click("Publicar alterações");
      await until("window.fixture.adminCalls.includes('publicar')");
      assert.equal(await evaluate("JSON.stringify(window.fixture.saved)"), salvoDoCliente, "ações do cliente não foram usadas");
    }
    t.diagnostic(`${width}×${height}: botões/uploads OK; profissão, cor, vazio e ordem na prévia e página pública OK.`);
  }
  assert.deepEqual(exceptions, []);
});
