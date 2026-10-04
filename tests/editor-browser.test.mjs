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
      import PublicPage from './src/app/[username]/page';
      import styles from './src/app/painel/editor/editor.module.css';
      Object.defineProperty(crypto, 'randomUUID', {value: undefined});
      window.fixture = {failUpload: true, uploadCount: 0};
      const root = createRoot(document.getElementById('root'));
      window.fixture.showPublic = async () => root.render(await PublicPage({params: Promise.resolve({username:'teste'})}));
      root.render(
        <main className={styles.page}><section className={styles.workspace}>
        <CardEditor isActive initialContent={{displayName: 'Teste', backgroundColor:'#edf2fa',
          buttonColor:'#2455ad', profilePhoto:'/test.png', buttons:[]}}/>
        </section></main>);
    ` },
    plugins: [{ name: "isolated-editor", setup(builder) {
      builder.onResolve({ filter: /^@\/app\/painel\/editor\/actions$/ }, () => ({ path: "actions", namespace: "fixture" }));
      builder.onResolve({ filter: /^next\/image$/ }, () => ({ path: "image", namespace: "fixture" }));
      builder.onResolve({ filter: /^@\/lib\/card\/public$/ }, () => ({ path: "public", namespace: "fixture" }));
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixture" }));
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
    assert.equal(await evaluate("window.fixture.uploadCount"), count);
    await click("Excluir");
    await until("document.querySelectorAll('li').length === 1");
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `Sem overflow horizontal em ${width}px`);
    await click("Salvar rascunho");
    await until("window.fixture.saved?.profession === 'Desenvolvedor Web'");
    // Publicar exige o rascunho confirmado na tela, não só a action chamada.
    await until("document.querySelector('[role=status]')?.textContent === 'Rascunho salvo.'");
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
      {id:'text',type:'text',enabled:true,title:'Informações',content:'Texto completo',description:'Descrição do botão'},
      {id:'wifi',type:'wifi',enabled:true,ssid:'Rede de teste',password:'senha-teste'},
      {id:'pix',type:'pix',enabled:true,key:'chave-teste'},
      {id:'phone',type:'phone',enabled:true,number:'123456'},
      {id:'address',type:'address',enabled:true,address:'Endereço de teste'},
      {id:'hidden',type:'link',enabled:false,title:'Oculto',url:'https://example.com'}
    ]}); window.fixture.showPublic()`);
    await until("document.querySelectorAll('[aria-label=\"Contato e redes sociais\"] a').length === 4");
    await until("document.querySelectorAll('[data-digital-card] details').length === 5");
    await evaluate("document.querySelectorAll('[data-digital-card] summary').forEach(el=>el.click())");
    assert.equal(await evaluate("document.querySelectorAll('[data-digital-card] details[open]').length"), 5);
    assert.equal(await evaluate("document.querySelectorAll('[data-digital-card] details button').length"), 3);
    assert.equal(await evaluate("document.querySelector('[data-digital-card]').textContent.includes('Oculto')"), false);
    assert.ok(await evaluate("document.querySelector('[data-digital-card]').textContent.includes('Texto completo')"));
    assert.ok(await evaluate("document.querySelector('[data-digital-card]').textContent.includes('Salvar Contato')"));
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "Grade social sem overflow");
    await screenshot(`social-public-${width}.png`);
    await evaluate(`Object.assign(window.fixture.published, {
      displayName:'Renan Dias', backgroundColor:'#0f0f0f', buttonColor:'#1c1c1c', professionColor:'#ffbf52',
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
    await evaluate("window.scrollTo(0,0)");
    await screenshot(`reference-public-${width}.png`, true);
    await evaluate("window.fixture.published.professionColor='#3154ae'; window.fixture.showPublic()");
    await until("getComputedStyle(document.querySelector('[data-card-profession]')).color === 'rgb(49, 84, 174)'");
    assert.equal(await evaluate("document.querySelector('[data-digital-card]').style.getPropertyValue('--card-accent')"), palette.accent, "Cor da profissão não altera o destaque");
    t.diagnostic(`${width}×${height}: botões/uploads OK; profissão, cor, vazio e ordem na prévia e página pública OK.`);
  }
  assert.deepEqual(exceptions, []);
});
