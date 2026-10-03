/**
 * Cria o bucket de imagens do cartão (PRD §10). Script isolado, fora do
 * bundle do Next, mesma razão de `create-admin.mjs`: `server-only` só é
 * entendido pelo bundler, não pelo Node puro.
 *
 * Idempotente: se o bucket já existir, atualiza os limites em vez de falhar.
 *
 * Uso: node --env-file=.env.local scripts/create-storage-bucket.mjs
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;

if (!URL || !SECRET) {
  console.error("Faltando NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY. Rode com --env-file=.env.local.");
  process.exit(1);
}

const admin = createClient(URL, SECRET, { auth: { autoRefreshToken: false, persistSession: false } });

const BUCKET_ID = "card-images";
const config = {
  public: true, // imagens do cartão são vistas por qualquer visitante, sem sessão (PRD §62)
  fileSizeLimit: 5 * 1024 * 1024, // 5 MB (PRD §10)
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"], // sem SVG: é executável no navegador
};

const { data: existente } = await admin.storage.getBucket(BUCKET_ID);

if (existente) {
  console.log(`Bucket "${BUCKET_ID}" já existe. Atualizando limites…`);
  const { error } = await admin.storage.updateBucket(BUCKET_ID, config);
  if (error) {
    console.error(`Erro ao atualizar bucket: ${error.message}`);
    process.exit(1);
  }
} else {
  console.log(`Criando bucket "${BUCKET_ID}"…`);
  const { error } = await admin.storage.createBucket(BUCKET_ID, config);
  if (error) {
    console.error(`Erro ao criar bucket: ${error.message}`);
    process.exit(1);
  }
}

console.log(`Bucket "${BUCKET_ID}" pronto: público, ≤5MB, jpeg/png/webp.`);
