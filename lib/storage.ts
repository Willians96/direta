import path from "path";
import os from "os";
import { existsSync, statSync, mkdirSync, accessSync, constants, createReadStream } from "fs";
import { writeFile, mkdir, unlink } from "fs/promises";
import { Readable } from "stream";

/**
 * Storage de documentos.
 *
 * Dois backends:
 *
 *  1. **Vercel Blob** (usado quando existe BLOB_READ_WRITE_TOKEN) — persistência
 *     real, funciona em quantas instâncias o serverless usar.
 *  2. **Filesystem local** (fallback) — `/var/app/storage` na VPS (persistente) ou
 *     `/tmp` na Vercel (temporário: o arquivo se perde a cada deploy e pode não
 *     estar na instância que atender o próximo request).
 *
 * O campo `Document.filePath` guarda a "referência" do arquivo:
 *  - Blob  → a URL do blob (começa com https://)
 *  - Disco → caminho relativo (ex.: leads/<leadId>/<uuid>.png)
 * Assim cada registro sabe onde seu arquivo está, mesmo que o backend mude.
 */

// ---------------------------------------------------------------- filesystem

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

  // Fallback (Vercel sem Blob): /tmp é gravável, mas não é persistente
  const fallback = path.join(os.tmpdir(), "gescola-storage");
  mkdirSync(fallback, { recursive: true });
  return fallback;
}

/** Raiz do storage em disco, sempre absoluta. */
export const STORAGE_ROOT = resolveStorageRoot();

/** True quando o storage em disco é apenas temporário (Vercel sem Blob). */
export const STORAGE_IS_TEMPORARY =
  path.resolve(process.env.STORAGE_PATH ?? "./storage") !== STORAGE_ROOT;

/**
 * Resolve um caminho relativo do banco para um caminho absoluto seguro.
 * Devolve null se o caminho tentar sair da raiz do storage (path traversal).
 */
export function resolveStoredFile(relativePath: string): string | null {
  if (!relativePath) return null;

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

/** Caminho relativo (o que é gravado no banco no backend de disco). */
export function toStoredRelativePath(absolutePath: string): string {
  return path.relative(STORAGE_ROOT, absolutePath).replace(/\\/g, "/");
}

// ------------------------------------------------------------------- blob

export function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** A referência é uma URL do Blob? */
export function isBlobReference(reference: string): boolean {
  return /^https?:\/\//i.test(reference);
}

async function blobModule() {
  return await import("@vercel/blob");
}

// ------------------------------------------------------------------- API

export type StoredFile = {
  stream: ReadableStream<Uint8Array>;
  size?: number;
  mimeType?: string;
};

/**
 * Grava um arquivo e devolve a referência a ser gravada no banco.
 * Usa Blob quando há token; senão, grava em disco.
 */
export async function saveStoredFile(params: {
  pathname: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<string> {
  const { pathname, bytes, mimeType } = params;

  if (blobEnabled()) {
    const { put } = await blobModule();
    const blob = await put(pathname, bytes, {
      access: "private",
      contentType: mimeType,
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return blob.url;
  }

  const full = path.join(STORAGE_ROOT, pathname);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return toStoredRelativePath(full);
}

/**
 * Abre um arquivo para leitura.
 * Devolve null se não existir (ou se o backend não estiver configurado).
 */
export async function openStoredFile(
  reference: string
): Promise<StoredFile | null> {
  if (!reference) return null;

  if (isBlobReference(reference)) {
    if (!blobEnabled()) return null; // blob guardado mas sem token configurado
    try {
      const { get } = await blobModule();
      const res = await get(reference, {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      if (!res) return null;
      const stream =
        typeof (res.stream as any)?.getReader === "function"
          ? (res.stream as unknown as ReadableStream<Uint8Array>)
          : (Readable.toWeb(res.stream as any) as ReadableStream<Uint8Array>);
      return {
        stream,
        size: res.blob?.size ?? undefined,
        mimeType: res.blob?.contentType ?? undefined,
      };
    } catch {
      return null;
    }
  }

  const full = resolveStoredFile(reference);
  if (!full) return null;
  try {
    const st = statSync(full);
    if (!st.isFile()) return null;
    const stream = Readable.toWeb(
      createReadStream(full)
    ) as ReadableStream<Uint8Array>;
    return { stream, size: st.size };
  } catch {
    return null;
  }
}

/** O arquivo existe no storage? */
export async function storedFileExists(reference: string): Promise<boolean> {
  if (!reference) return false;

  if (isBlobReference(reference)) {
    if (!blobEnabled()) return false;
    try {
      const { head } = await blobModule();
      await head(reference, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return true;
    } catch {
      return false;
    }
  }

  const full = resolveStoredFile(reference);
  if (!full) return false;
  try {
    return existsSync(full) && statSync(full).isFile();
  } catch {
    return false;
  }
}

/** Remove o arquivo do storage (silencioso se não existir). */
export async function deleteStoredFile(reference: string): Promise<void> {
  if (!reference) return;

  if (isBlobReference(reference)) {
    if (!blobEnabled()) return;
    try {
      const { del } = await blobModule();
      await del(reference, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      // já removido ou sem permissão — segue o fluxo
    }
    return;
  }

  const full = resolveStoredFile(reference);
  if (!full) return;
  try {
    await unlink(full);
  } catch {
    // já removido
  }
}
