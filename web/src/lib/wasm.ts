export interface PfsEntry {
  name: string;
  offset: number;
  size: number;
}

export interface OpenResult {
  handle: number;
  format: number;
  entries: PfsEntry[];
}

export interface ExtractedFile {
  name: string;
  data: Uint8Array;
}

export interface PackFile {
  name: string;
  data: Uint8Array;
}

interface ArtemisPFSApi {
  ready: boolean;
  openArchive: (data: Uint8Array) => Promise<OpenResult>;
  listEntries: (handle: number) => Promise<PfsEntry[]>;
  extractEntry: (handle: number, index: number) => Promise<Uint8Array>;
  extractAll: (handle: number) => Promise<ExtractedFile[]>;
  createArchive: (files: PackFile[]) => Promise<Uint8Array>;
  closeArchive: (handle: number) => void;
  getProgress: () => number;
}

declare global {
  interface Window {
    Go: new () => {
      importObject: WebAssembly.Imports;
      run: (instance: WebAssembly.Instance) => Promise<void>;
    };
    ArtemisPFS?: ArtemisPFSApi;
  }
}

let initPromise: Promise<ArtemisPFSApi> | null = null;

function waitForReady(timeoutMs = 15000): Promise<ArtemisPFSApi> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (window.ArtemisPFS?.ready) {
        resolve(window.ArtemisPFS);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("WASM 初始化超时"));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export async function initWasm(): Promise<ArtemisPFSApi> {
  if (window.ArtemisPFS?.ready) return window.ArtemisPFS;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (typeof window.Go !== "function") {
      throw new Error("wasm_exec.js 未加载");
    }
    const go = new window.Go();
    const result = await WebAssembly.instantiateStreaming(
      fetch("/artemis.wasm"),
      go.importObject,
    );
    // Do not await — Go main blocks forever with select{}.
    void go.run(result.instance);
    return waitForReady();
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

export function getApi(): ArtemisPFSApi {
  if (!window.ArtemisPFS?.ready) {
    throw new Error("WASM 尚未就绪");
  }
  return window.ArtemisPFS;
}
