import path from "path";
import os from "os";
import { existsSync, statSync, mkdirSync, accessSync, constants } from "fs";

/**
 * Storage de documentos (filesystem local).
 *
 * Os arquivos ficam em `${STORAGE_ROOT}/leads/<leadId>/<uuid><ext>` e o banco
 * guarda apenas o caminho RELATIVO (`leads/<leadId>/<uuid><ext>`), para que o
 * diretório de storage possa mudar de lugar sem quebrar os registros.
 *
 * Ambientes:
 *  - VPS (STORAGE_PATH=/var/app/storage): disco persistente, sobrevive a deploy.
 *  - Vercel: o filesystem do app é SOMENTE LEITURA (/var/task) — o upload
 *    falharia com EROFS. Nesse caso caímos automaticamente em /tmp, que é
 *    gravável, mas temporário: os arquivos se perdem a cada novo deploy.
 *    (A solução definitiva na Vercel seria Vercel Blob/S3 — ver README_DEPLOY.md)
 */

function isWritable(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveStorageRoot(): string {
  const configured = process.env.STORAGE_PATH ?? "./storage";
  const primary = path.resolve(configured);
  if (isWritable(primary)) return primary;

  // Fallback (Vercel): /tmp é gravável, mas não é persistente
  const fallback = path.join(os.tmpdir(), "gescola-storage");
  mkdirSync(fallback, { recursive: true });
  return fallback;
}

/** Raiz do storage, sempre absoluta. */
export const STORAGE_ROOT = resolveStorageRoot();

/** True quando estamos no fallback temporário (ex.: Vercel). */
export const STORAGE_IS_TEMPORARY =
  path.resolve(process.env.STORAGE_PATH ?? "./storage") !== STORAGE_ROOT;

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
