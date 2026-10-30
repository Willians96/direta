import path from "path";
import { existsSync, statSync } from "fs";

/**
 * Storage de documentos (filesystem local).
 *
 * Os arquivos ficam em `${STORAGE_PATH}/leads/<leadId>/<uuid><ext>` e o banco
 * guarda apenas o caminho RELATIVO (`leads/<leadId>/<uuid><ext>`), para que o
 * diretório de storage possa mudar de lugar sem quebrar os registros.
 *
 * Atenção: na Vercel o filesystem é efêmero — o arquivo se perde no próximo
 * deploy. Na VPS (STORAGE_PATH=/var/app/storage) o disco é persistente.
 */

/** Raiz do storage, sempre absoluta. */
export const STORAGE_ROOT = path.resolve(process.env.STORAGE_PATH ?? "./storage");

/**
 * Resolve um caminho relativo do banco para um caminho absoluto seguro.
 * Devolve null se o caminho tentar sair da raiz do storage (path traversal).
 */
export function resolveStoredFile(relativePath: string): string | null {
  if (!relativePath) return null;

  // Normaliza e remove barras iniciais (o banco sempre guarda relativo)
  const normalized = path
    .normalize(relativePath)
    .replace(/^([/\\])+/, "")
    .replace(/\\/g, "/");

  if (!normalized || normalized === "." || normalized.startsWith("..")) {
    return null;
  }

  const full = path.resolve(STORAGE_ROOT, normalized);
  const rootWithSep = STORAGE_ROOT.endsWith(path.sep)
    ? STORAGE_ROOT
    : STORAGE_ROOT + path.sep;

  if (full !== STORAGE_ROOT && !full.startsWith(rootWithSep)) {
    return null; // saiu da raiz do storage
  }

  return full;
}

/** O arquivo existe no disco? (false em ambiente serverless após deploy) */
export function storedFileExists(relativePath: string): boolean {
  const full = resolveStoredFile(relativePath);
  if (!full) return false;
  try {
    return existsSync(full) && statSync(full).isFile();
  } catch {
    return false;
  }
}

/** Caminho relativo (o que é gravado no banco). */
export function toStoredRelativePath(absolutePath: string): string {
  return path.relative(STORAGE_ROOT, absolutePath).replace(/\\/g, "/");
}
