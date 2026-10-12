type StorageListResult = { data: Array<{ name: string }> | null; error: unknown };
type StorageRemoveResult = { error: unknown };

export type StorageFolder = {
  list: (path: string, options: { limit: number; offset: number; sortBy: { column: "name"; order: "asc" } }) => PromiseLike<StorageListResult>;
  remove: (paths: string[]) => PromiseLike<StorageRemoveResult>;
};

export type StorageCleanupResult =
  | { ok: true; removidas: number }
  | { ok: false; mensagem: string; removidas: number };

export async function removerArquivosEmLotes(storage: StorageFolder, clientId: string): Promise<StorageCleanupResult> {
  let removidas = 0;
  for (;;) {
    const { data, error } = await storage.list(clientId, {
      limit: 100,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) return { ok: false, mensagem: "Não foi possível listar todas as imagens do cliente.", removidas };
    if (!data || data.length === 0) return { ok: true, removidas };
    const caminhos = data.map((arquivo) => `${clientId}/${arquivo.name}`);
    const { error: erroRemocao } = await storage.remove(caminhos);
    if (erroRemocao) return { ok: false, mensagem: "Não foi possível remover todas as imagens do cliente.", removidas };
    removidas += caminhos.length;
  }
}
