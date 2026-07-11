import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from "fflate";
import type { ExtractedFile } from "./wasm";
import { downloadBlob, pf8ToDisplayPath } from "./format";

export type ZipSource = {
  name: string;
  data: Uint8Array;
};

export type DeflateLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type StreamZipOptions = {
  /** Deflate level; 0 = store (fastest, lowest peak CPU). Default 1. */
  level?: DeflateLevel;
  onProgress?: (done: number, total: number) => void;
  /** Total file count for progress (required when sources are streamed). */
  total?: number;
};

export type SaveZipOptions = StreamZipOptions & {
  filename: string;
  /**
   * Prefer File System Access API streaming write when available.
   * Falls back to in-memory Blob download (still chunked, not one giant zipSync).
   */
  preferFilePicker?: boolean;
};

function yieldToMain(): Promise<void> {
  // Prefer scheduler.yield when available; otherwise a macrotask is enough
  // to keep the progress bar / UI responsive between files.
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched?.yield) return sched.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function normalizePath(name: string): string {
  return pf8ToDisplayPath(name).replace(/^\/+/, "");
}

/**
 * Stream-build a ZIP archive from an async sequence of files.
 * Files are compressed one-by-one so peak memory stays near
 * (one file + compression window + pending output chunks), not (all files + full zip).
 */
export async function streamZip(
  sources: AsyncIterable<ZipSource> | Iterable<ZipSource>,
  onChunk: (chunk: Uint8Array, final: boolean) => void | Promise<void>,
  opts: StreamZipOptions = {},
): Promise<void> {
  const level = opts.level ?? 1;
  const knownTotal = opts.total;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let writeChain = Promise.resolve();
    let added = 0;
    let done = 0;

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      try {
        zip.terminate();
      } catch {
        /* ignore */
      }
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const zip = new Zip((err, chunk, final) => {
      if (settled) return;
      if (err) {
        fail(err);
        return;
      }
      // Serialize async sinks (e.g. FileSystemWritableFileStream.write)
      // so chunk order is preserved even if the sink is slow.
      writeChain = writeChain
        .then(async () => {
          if (settled) return;
          if (chunk?.length) {
            // Copy: fflate may reuse internal buffers after the callback returns.
            await onChunk(chunk.slice(), !!final);
          } else if (final) {
            await onChunk(new Uint8Array(0), true);
          }
          if (final && !settled) {
            settled = true;
            resolve();
          }
        })
        .catch(fail);
    });

    void (async () => {
      try {
        // Chunk large files so compression/store doesn't monopolize the main thread.
        const PUSH_CHUNK = 512 * 1024;

        for await (const file of sources as AsyncIterable<ZipSource>) {
          const path = normalizePath(file.name);
          if (!path) continue;

          const entry =
            level <= 0
              ? new ZipPassThrough(path)
              : new ZipDeflate(path, { level });

          zip.add(entry);

          const data = file.data;
          if (data.byteLength <= PUSH_CHUNK) {
            entry.push(data, true);
          } else {
            for (let off = 0; off < data.byteLength; off += PUSH_CHUNK) {
              const end = Math.min(off + PUSH_CHUNK, data.byteLength);
              entry.push(data.subarray(off, end), end === data.byteLength);
              if (end < data.byteLength) await yieldToMain();
            }
          }

          added++;
          done++;
          opts.onProgress?.(done, knownTotal ?? done);
          await yieldToMain();
        }

        if (added === 0) {
          const keep = new ZipPassThrough(".keep");
          zip.add(keep);
          keep.push(strToU8(""), true);
        }

        zip.end();
      } catch (e) {
        fail(e);
      }
    })();
  });
}

/**
 * Build a ZIP and save it.
 * - Chromium: streams directly to a user-chosen file (best for large archives).
 * - Other browsers: accumulates Blob parts (still no zipSync / no full extractAll).
 */
export async function saveZip(
  sources: AsyncIterable<ZipSource> | Iterable<ZipSource>,
  opts: SaveZipOptions,
): Promise<"file-picker" | "download"> {
  const preferPicker = opts.preferFilePicker !== false;
  const w = window as Window & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: BufferSource | Blob) => Promise<void>;
        close: () => Promise<void>;
        abort: () => Promise<void>;
      }>;
    }>;
  };

  if (preferPicker && typeof w.showSaveFilePicker === "function") {
    let writable: {
      write: (data: BufferSource | Blob) => Promise<void>;
      close: () => Promise<void>;
      abort: () => Promise<void>;
    } | null = null;
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: opts.filename,
        types: [
          {
            description: "ZIP archive",
            accept: { "application/zip": [".zip"] },
          },
        ],
      });
      writable = await handle.createWritable();
    } catch (e) {
      // User cancelled the save dialog — surface as abort, don't fall back.
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      // showSaveFilePicker / createWritable unavailable → fall through to Blob.
      writable = null;
    }

    if (writable) {
      // Once streaming starts, sources may be partially consumed — do not fall back.
      try {
        await streamZip(
          sources,
          async (chunk, final) => {
            if (chunk.length) {
              // Ensure ArrayBuffer-backed view for FileSystemWritableFileStream.
              const buf =
                chunk.buffer instanceof ArrayBuffer
                  ? new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
                  : chunk.slice();
              await writable!.write(buf);
            }
            if (final) await writable!.close();
          },
          opts,
        );
        return "file-picker";
      } catch (e) {
        try {
          await writable.abort();
        } catch {
          /* ignore */
        }
        throw e;
      }
    }
  }

  const parts: BlobPart[] = [];
  await streamZip(
    sources,
    (chunk) => {
      if (!chunk.length) return;
      // slice() guarantees a fresh ArrayBuffer-backed Uint8Array for BlobPart.
      parts.push(chunk.slice());
    },
    opts,
  );
  downloadBlob(new Blob(parts, { type: "application/zip" }), opts.filename);
  return "download";
}

/**
 * Convenience: zip an already-materialized file list (small archives only).
 * Prefer saveZip + per-file extract for large data.
 */
export async function buildZipAsync(
  files: ExtractedFile[],
  opts: StreamZipOptions = {},
): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let totalLen = 0;
  await streamZip(
    files,
    (chunk) => {
      if (!chunk.length) return;
      parts.push(chunk);
      totalLen += chunk.length;
    },
    { ...opts, total: opts.total ?? files.length },
  );
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
