import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from "fflate";
import type { ExtractedFile } from "./wasm";
import { downloadBlob, pf8ToDisplayPath } from "./format";

export type ZipSource = {
  name: string;
  data: Uint8Array;
};

export type DeflateLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type StreamZipOptions = {
  /** Deflate level; 0 = store (最低内存/CPU，适合已压缩资源). Default 0. */
  level?: DeflateLevel;
  onProgress?: (done: number, total: number) => void;
  /** Total file count for progress. */
  total?: number;
};

export type SaveZipOptions = StreamZipOptions & {
  filename: string;
  /** Prefer "Save As" dialog when available. Default true. */
  preferFilePicker?: boolean;
  /**
   * Approximate uncompressed payload size (bytes). Used to refuse the
   * in-memory Blob fallback before it freezes the tab.
   */
  estimatedBytes?: number;
};

export type ZipDeliverMethod = "share" | "save-as" | "download";

/** OPFS zip is ready on disk; must deliver via a (preferably user-gesture) call. */
export type PendingZipDelivery = {
  filename: string;
  size: number;
  /** Copy/share out of OPFS without loading the whole archive into JS heap. */
  deliver: () => Promise<ZipDeliverMethod>;
  discard: () => Promise<void>;
};

export type SaveZipResult =
  | { method: "file-picker"; size: number }
  | { method: "opfs-ready"; pending: PendingZipDelivery }
  | { method: "opfs-auto"; size: number }
  | { method: "download"; size: number };

/** Above this, never assemble ZIP in a JS-memory Blob (will freeze / OOM). */
const MAX_MEMORY_ZIP_BYTES = 48 * 1024 * 1024;
/** Auto object-URL download is only safe for relatively small OPFS files. */
const MAX_AUTO_DOWNLOAD_BYTES = 64 * 1024 * 1024;
/** Pipe copy chunk when streaming OPFS → Save As. */
const PIPE_CHUNK = 1024 * 1024;

/**
 * Android / mobile Chromium exposes showSaveFilePicker, but the SAF-backed
 * writable often stays 0 bytes until close (or fails mid-stream on multi-GB
 * writes). Prefer OPFS streaming there; desktop Chromium keeps File Picker.
 */
function shouldPreferFilePicker(): boolean {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return false;
  // iOS / iPadOS: no real FSA save; avoid dead-end empty stubs if polyfilled.
  if (/iPhone|iPad|iPod/i.test(ua)) return false;
  if (navigator.maxTouchPoints > 1 && /Mobile/i.test(ua)) return false;
  return true;
}

function isMobileUa(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

type WritableSink = {
  write: (data: BufferSource | Blob) => Promise<void>;
  close: () => Promise<void>;
  abort: () => Promise<void>;
};

const PUSH_CHUNK = 256 * 1024; // 256 KiB — keep deflate/store windows small

function yieldToMain(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched?.yield) return sched.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function normalizePath(name: string): string {
  return pf8ToDisplayPath(name).replace(/^\/+/, "");
}

function asArrayBufferView(chunk: Uint8Array): Uint8Array<ArrayBuffer> {
  if (chunk.buffer instanceof ArrayBuffer) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  return chunk.slice();
}

function byteSizeOf(data: BufferSource | Blob): number {
  if (data instanceof Blob) return data.size;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  return data.byteLength;
}

/**
 * Stream-build a ZIP. Each output chunk is handed to `onChunk` and **awaited**
 * before more input is compressed — true backpressure so RAM does not grow
 * with archive size.
 *
 * Peak memory ≈ current source file + small compression window + one pending
 * output chunk (not the whole ZIP).
 */
export async function streamZip(
  sources: AsyncIterable<ZipSource> | Iterable<ZipSource>,
  onChunk: (chunk: Uint8Array, final: boolean) => void | Promise<void>,
  opts: StreamZipOptions = {},
): Promise<void> {
  const level = opts.level ?? 0;
  const knownTotal = opts.total;

  let settled = false;
  let failed: Error | null = null;
  // Serialize + backpressure: producer waits on this after each push burst.
  let drain: Promise<void> = Promise.resolve();

  const fail = (err: unknown) => {
    const e = err instanceof Error ? err : new Error(String(err));
    if (!failed) failed = e;
    try {
      zip.terminate();
    } catch {
      /* ignore */
    }
  };

  const enqueue = (chunk: Uint8Array | null, final: boolean) => {
    if (settled || failed) return;
    // Copy immediately: fflate reuses buffers after ondata returns.
    const copy = chunk?.length ? chunk.slice() : new Uint8Array(0);
    drain = drain
      .then(async () => {
        if (settled || failed) return;
        if (copy.length || final) {
          await onChunk(copy, final);
        }
      })
      .catch((err) => {
        fail(err);
      });
  };

  const zip = new Zip((err, chunk, final) => {
    if (err) {
      fail(err);
      return;
    }
    enqueue(chunk, !!final);
  });

  try {
    let added = 0;
    let done = 0;

    for await (const file of sources as AsyncIterable<ZipSource>) {
      if (failed) throw failed;

      const path = normalizePath(file.name);
      if (!path) continue;

      const entry =
        level <= 0
          ? new ZipPassThrough(path)
          : new ZipDeflate(path, { level });

      zip.add(entry);

      const data = file.data;
      // Push in small slices so intermediate ZIP chunks can flush + be written
      // (and so we can await drain between slices).
      if (data.byteLength === 0) {
        entry.push(data, true);
      } else {
        for (let off = 0; off < data.byteLength; ) {
          if (failed) throw failed;
          const end = Math.min(off + PUSH_CHUNK, data.byteLength);
          entry.push(data.subarray(off, end), end === data.byteLength);
          off = end;
          // Wait until previous output chunks are written to disk/sink.
          await drain;
          if (failed) throw failed;
          if (off < data.byteLength) await yieldToMain();
        }
      }

      // Drop local ref; caller should also drop after yield.
      // (data may still be held by outer generator until next iteration.)
      added++;
      done++;
      opts.onProgress?.(done, knownTotal ?? done);
      await drain;
      await yieldToMain();
    }

    if (added === 0) {
      const keep = new ZipPassThrough(".keep");
      zip.add(keep);
      keep.push(strToU8(""), true);
    }

    zip.end();
    await drain;
    if (failed) throw failed;
    settled = true;
  } catch (e) {
    fail(e);
    settled = true;
    await drain.catch(() => undefined);
    throw failed ?? e;
  }
}

async function openSavePicker(filename: string): Promise<{
  sink: WritableSink;
  bytesWritten: () => number;
} | null> {
  const w = window as Window & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<{
      createWritable: () => Promise<FileSystemWritableFileStream>;
      getFile?: () => Promise<File>;
    }>;
  };
  if (typeof w.showSaveFilePicker !== "function") return null;
  try {
    const handle = await w.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: "ZIP archive",
          accept: { "application/zip": [".zip"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    let closed = false;
    let bytesWritten = 0;
    const sink: WritableSink = {
      write: async (data) => {
        // Desktop: raw views are fine. Mobile callers usually skip this path.
        await writable.write(
          data instanceof Blob ? data : asArrayBufferView(data as Uint8Array),
        );
        bytesWritten += byteSizeOf(data);
      },
      close: async () => {
        if (closed) return;
        closed = true;
        await writable.close();
        if (bytesWritten > 0 && typeof handle.getFile === "function") {
          try {
            const file = await handle.getFile();
            if (file.size === 0) {
              throw new Error("Save As 目标文件仍为 0 字节（写入未落盘）");
            }
          } catch (e) {
            if (e instanceof Error && e.message.includes("0 字节")) throw e;
          }
        }
      },
      abort: async () => {
        if (closed) return;
        closed = true;
        try {
          await writable.abort();
        } catch {
          /* ignore */
        }
      },
    };
    return { sink, bytesWritten: () => bytesWritten };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return null;
  }
}

type OpfsTemp = {
  writable: WritableSink;
  bytesWritten: () => number;
  /** Close stream and return disk-backed File (no full JS heap copy). */
  closeAndGetFile: () => Promise<File>;
  remove: () => Promise<void>;
  abort: () => Promise<void>;
};

async function openOpfsTemp(): Promise<OpfsTemp | null> {
  const storage = navigator.storage as StorageManager & {
    getDirectory?: () => Promise<FileSystemDirectoryHandle>;
  };
  if (typeof storage?.getDirectory !== "function") return null;

  let root: FileSystemDirectoryHandle;
  try {
    root = await storage.getDirectory();
  } catch {
    return null;
  }

  const tempName = `artemis-zip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.zip`;
  let handle: FileSystemFileHandle;
  let writable: FileSystemWritableFileStream;
  try {
    handle = await root.getFileHandle(tempName, { create: true });
    writable = await handle.createWritable();
  } catch {
    return null;
  }

  let closed = false;
  let bytesWritten = 0;
  let removed = false;

  const remove = async () => {
    if (removed) return;
    removed = true;
    try {
      await root.removeEntry(tempName);
    } catch {
      /* ignore */
    }
  };

  return {
    bytesWritten: () => bytesWritten,
    writable: {
      write: async (data) => {
        await writable.write(data);
        bytesWritten += byteSizeOf(data);
      },
      close: async () => {
        if (!closed) {
          closed = true;
          await writable.close();
        }
      },
      abort: async () => {
        if (!closed) {
          closed = true;
          try {
            await writable.abort();
          } catch {
            /* ignore */
          }
        }
      },
    },
    closeAndGetFile: async () => {
      if (!closed) {
        closed = true;
        await writable.close();
      }
      const file = await handle.getFile();
      if (bytesWritten > 0 && file.size === 0) {
        await remove();
        throw new Error(
          `OPFS 写入后文件仍为 0 字节（已写入 API ${bytesWritten} bytes）。请重试或换浏览器。`,
        );
      }
      return file;
    },
    remove,
    abort: async () => {
      if (!closed) {
        closed = true;
        try {
          await writable.abort();
        } catch {
          /* ignore */
        }
      }
      await remove();
    },
  };
}

/**
 * Stream-copy a disk-backed File to a Save As target without loading it into RAM.
 * Uses ReadableStream when available; falls back to File.arrayBuffer only for tiny files.
 */
async function pipeFileToSaveAs(file: File, filename: string): Promise<void> {
  const w = window as Window & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<{ createWritable: () => Promise<FileSystemWritableFileStream> }>;
  };
  if (typeof w.showSaveFilePicker !== "function") {
    throw new Error("当前浏览器不支持另存为");
  }

  const handle = await w.showSaveFilePicker({
    suggestedName: filename,
    types: [
      {
        description: "ZIP archive",
        accept: { "application/zip": [".zip"] },
      },
    ],
  });
  const dest = await handle.createWritable();
  try {
    // Prefer native stream pipe (zero full-buffer copy).
    if (typeof file.stream === "function") {
      const reader = file.stream().getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value?.byteLength) {
            // Copy slice: some SAF writables retain the buffer.
            const copy = value.slice();
            await dest.write(copy);
            await yieldToMain();
          }
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* ignore */
        }
      }
    } else if (file.size <= MAX_AUTO_DOWNLOAD_BYTES) {
      await dest.write(file);
    } else {
      // Manual slice via Blob.stream polyfill path using slice windows.
      let offset = 0;
      while (offset < file.size) {
        const end = Math.min(offset + PIPE_CHUNK, file.size);
        const part = file.slice(offset, end);
        const buf = new Uint8Array(await part.arrayBuffer());
        await dest.write(buf);
        offset = end;
        await yieldToMain();
      }
    }
    await dest.close();
  } catch (e) {
    try {
      await dest.abort();
    } catch {
      /* ignore */
    }
    throw e;
  }
}

async function tryShareFile(file: File, filename: string): Promise<boolean> {
  const nav = navigator as Navigator & {
    canShare?: (data?: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  if (typeof nav.share !== "function") return false;

  // Prefer a correctly named File. For OPFS-backed Blob, Chrome usually keeps
  // this as a reference (no multi-GB heap materialization).
  const named =
    file.name === filename
      ? file
      : new File([file], filename, {
          type: file.type || "application/zip",
          lastModified: file.lastModified,
        });

  try {
    if (typeof nav.canShare === "function" && !nav.canShare({ files: [named] })) {
      return false;
    }
    await nav.share({ files: [named], title: filename });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return false;
  }
}

function makePendingDelivery(
  getFile: () => Promise<File>,
  remove: () => Promise<void>,
  filename: string,
  size: number,
): PendingZipDelivery {
  let discarded = false;
  return {
    filename,
    size,
    deliver: async () => {
      if (discarded) throw new Error("临时 ZIP 已丢弃，请重新导出");
      const file = await getFile();
      // 1) System share sheet (best on Android for multi-GB)
      try {
        if (await tryShareFile(file, filename)) {
          // Keep OPFS a while so the share target can read it.
          const delay = size > 256 * 1024 * 1024 ? 10 * 60_000 : 2 * 60_000;
          setTimeout(() => {
            void remove();
          }, delay);
          return "share";
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
      }

      // 2) Stream copy to Save As (no full heap load)
      try {
        await pipeFileToSaveAs(file, filename);
        void remove();
        return "save-as";
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        // continue to download only if small
      }

      // 3) Object URL download — ONLY for modest sizes (large freezes mobile Chrome)
      if (size <= MAX_AUTO_DOWNLOAD_BYTES) {
        downloadBlob(file, filename, { revokeMs: 60_000 });
        setTimeout(() => {
          void remove();
        }, 60_000);
        return "download";
      }

      throw new Error(
        `ZIP 已就绪（${(size / (1024 * 1024)).toFixed(0)} MB），但浏览器无法安全下载这么大的文件。` +
          `请用系统分享保存到「文件/网盘」，或换电脑导出。`,
      );
    },
    discard: async () => {
      discarded = true;
      await remove();
    },
  };
}

async function writeZipToSink(
  sources: AsyncIterable<ZipSource> | Iterable<ZipSource>,
  sink: WritableSink,
  opts: StreamZipOptions,
): Promise<number> {
  // Blob chunks are more reliable on Android SAF / some OPFS bridges than
  // raw ArrayBuffer views for multi-GB sequential writes.
  const useBlob = !shouldPreferFilePicker();
  let written = 0;
  await streamZip(
    sources,
    async (chunk) => {
      if (!chunk.length) return;
      const view = asArrayBufferView(chunk);
      if (useBlob) {
        await sink.write(new Blob([view]));
      } else {
        await sink.write(view);
      }
      written += view.byteLength;
    },
    opts,
  );
  return written;
}

/**
 * Build a ZIP while continuously flushing bytes out of JS heap:
 *
 * 1. **Save As** (desktop Chromium) — stream straight to user disk.
 * 2. **OPFS temp** — stream to origin-private disk, then deliver via share /
 *    stream-copy Save As (never put multi-GB into a memory Blob).
 * 3. **Tiny memory Blob** — only when OPFS/picker unavailable AND size is small.
 */
export async function saveZip(
  sources: AsyncIterable<ZipSource> | Iterable<ZipSource>,
  opts: SaveZipOptions,
): Promise<SaveZipResult> {
  const preferPicker =
    opts.preferFilePicker !== false && shouldPreferFilePicker();
  const estimated = opts.estimatedBytes ?? 0;

  // 1) Direct disk write via Save As (desktop Chromium)
  if (preferPicker) {
    const picker = await openSavePicker(opts.filename);
    if (picker) {
      try {
        const size = await writeZipToSink(sources, picker.sink, opts);
        await picker.sink.close();
        return { method: "file-picker", size: size || picker.bytesWritten() };
      } catch (e) {
        try {
          await picker.sink.abort();
        } catch {
          /* ignore */
        }
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(
          `Save As 写入失败（${msg}）。手机端请使用 OPFS + 分享保存。`,
        );
      }
    }
  }

  // 2) OPFS: stream to disk, then hand off without memory Blob
  const opfs = await openOpfsTemp();
  if (opfs) {
    try {
      await writeZipToSink(sources, opfs.writable, opts);
      const file = await opfs.closeAndGetFile();
      const size = file.size || opfs.bytesWritten();

      // Small zips: auto-download is fine and keeps UX simple.
      if (size > 0 && size <= MAX_AUTO_DOWNLOAD_BYTES && !isMobileUa()) {
        downloadBlob(file, opts.filename, { revokeMs: 60_000 });
        setTimeout(() => {
          void opfs.remove();
        }, 60_000);
        return { method: "opfs-auto", size };
      }

      // Large / mobile: require explicit deliver() so we can use share / pipe.
      // Auto createObjectURL + <a download> of multi-GB freezes Android Chrome.
      const pending = makePendingDelivery(
        async () => file,
        () => opfs.remove(),
        opts.filename,
        size,
      );
      return { method: "opfs-ready", pending };
    } catch (e) {
      await opfs.abort();
      const msg = e instanceof Error ? e.message : String(e);
      if (/quota|storage|space|空间|空间不足|QuotaExceeded/i.test(msg)) {
        throw new Error(
          `OPFS 空间不足，无法写入约 ${(estimated / (1024 * 1024)).toFixed(0) || "?"} MB 的 ZIP。` +
            `请清理浏览器站点数据或换电脑导出。原始错误：${msg}`,
        );
      }
      throw e;
    }
  }

  // 3) Memory Blob — hard refuse multi-GB / large archives (this freezes tabs).
  if (estimated > MAX_MEMORY_ZIP_BYTES) {
    throw new Error(
      `当前环境没有可用的磁盘缓存（OPFS），无法安全导出约 ${(estimated / (1024 * 1024)).toFixed(0)} MB 的 ZIP。` +
        `请换用较新的 Chrome / Edge，或在电脑上用 CLI：pfs extract`,
    );
  }

  const parts: BlobPart[] = [];
  let totalBytes = 0;
  await streamZip(
    sources,
    (chunk) => {
      if (!chunk.length) return;
      if (totalBytes + chunk.length > MAX_MEMORY_ZIP_BYTES) {
        throw new Error(
          `ZIP 超过内存安全上限（${MAX_MEMORY_ZIP_BYTES / (1024 * 1024)} MB），已中止以免卡死页面。`,
        );
      }
      parts.push(asArrayBufferView(chunk));
      totalBytes += chunk.length;
    },
    opts,
  );
  downloadBlob(new Blob(parts, { type: "application/zip" }), opts.filename);
  return { method: "download", size: totalBytes };
}

/** In-memory zip for tiny lists only. Prefer saveZip for real exports. */
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
