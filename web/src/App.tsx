import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import {
  AppShell,
  Button,
  Card,
  EmptyState,
  FloatingBar,
  GroupedList,
  ListRow,
  ProgressBar,
  SearchField,
  SegmentedControl,
  Toast,
} from "./components/ui";
import {
  IconArchive,
  IconCheck,
  IconChevronLeft,
  IconDownload,
  IconFile,
  IconFolder,
  IconPlus,
  IconSpinner,
  IconTrash,
  IconX,
} from "./components/Icons";
import {
  basename,
  dirname,
  downloadBytes,
  formatBytes,
  pf8ToDisplayPath,
} from "./lib/format";
import { getApi, initWasm, type OpenResult, type PackFile, type PfsEntry } from "./lib/wasm";
import { saveZip, type ZipSource } from "./lib/zip";

type Tab = "extract" | "create";
type ToastState = { message: string; tone?: "info" | "error" | "success" } | null;

interface SelectedFile {
  id: string;
  /** Archive-relative path using forward slashes */
  path: string;
  size: number;
  file: File;
}

export default function App() {
  const [tab, setTab] = createSignal<Tab>("extract");
  const [wasmReady, setWasmReady] = createSignal(false);
  const [wasmError, setWasmError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [progress, setProgress] = createSignal(0);
  const [toast, setToast] = createSignal<ToastState>(null);

  // Extract state
  const [archiveName, setArchiveName] = createSignal<string | null>(null);
  const [archiveMeta, setArchiveMeta] = createSignal<OpenResult | null>(null);
  const [handle, setHandle] = createSignal<number | null>(null);
  const [query, setQuery] = createSignal("");
  const [selected, setSelected] = createSignal<Set<number>>(new Set());

  // Create state
  const [packFiles, setPackFiles] = createSignal<SelectedFile[]>([]);
  const [packName, setPackName] = createSignal("root.pfs");

  let extractInput: HTMLInputElement | undefined;
  let packInput: HTMLInputElement | undefined;
  let toastTimer: number | undefined;

  const showToast = (message: string, tone: ToastState extends null ? never : NonNullable<ToastState>["tone"] = "info") => {
    setToast({ message, tone });
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => setToast(null), 2600);
  };

  onMount(async () => {
    try {
      await initWasm();
      setWasmReady(true);
    } catch (e) {
      setWasmError(e instanceof Error ? e.message : String(e));
    }
  });

  onCleanup(() => {
    if (toastTimer) window.clearTimeout(toastTimer);
    const h = handle();
    if (h != null && wasmReady()) {
      try {
        getApi().closeArchive(h);
      } catch {
        /* ignore */
      }
    }
  });

  createEffect(() => {
    // Poll WASM progress while busy.
    if (!busy() || !wasmReady()) return;
    const id = window.setInterval(() => {
      try {
        setProgress(getApi().getProgress());
      } catch {
        /* ignore */
      }
    }, 120);
    onCleanup(() => window.clearInterval(id));
  });

  const filteredEntries = createMemo(() => {
    const meta = archiveMeta();
    if (!meta) return [] as { entry: PfsEntry; index: number }[];
    const q = query().trim().toLowerCase();
    return meta.entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) =>
        q ? pf8ToDisplayPath(entry.name).toLowerCase().includes(q) : true,
      );
  });

  const totalArchiveSize = createMemo(() => {
    const meta = archiveMeta();
    if (!meta) return 0;
    return meta.entries.reduce((s, e) => s + e.size, 0);
  });

  const packTotalSize = createMemo(() =>
    packFiles().reduce((s, f) => s + f.size, 0),
  );

  const closeArchive = () => {
    const h = handle();
    if (h != null && wasmReady()) {
      try {
        getApi().closeArchive(h);
      } catch {
        /* ignore */
      }
    }
    setHandle(null);
    setArchiveMeta(null);
    setArchiveName(null);
    setQuery("");
    setSelected(new Set<number>());
  };

  const onPickArchive = async (file: File | undefined) => {
    if (!file || !wasmReady()) return;
    setBusy(true);
    setProgress(0);
    try {
      closeArchive();
      const buf = new Uint8Array(await file.arrayBuffer());
      const result = await getApi().openArchive(buf);
      setHandle(result.handle);
      setArchiveMeta(result);
      setArchiveName(file.name);
      showToast(`已打开 PF${result.format} · ${result.entries.length} 个文件`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected(new Set(filteredEntries().map((x) => x.index)));
  };

  const clearSelection = () => setSelected(new Set<number>());

  const extractOne = async (index: number) => {
    const h = handle();
    const meta = archiveMeta();
    if (h == null || !meta) return;
    setBusy(true);
    setProgress(0);
    try {
      const data = await getApi().extractEntry(h, index);
      const name = basename(meta.entries[index].name) || `file_${index}`;
      downloadBytes(data, name);
      showToast(`已导出 ${name}`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const extractSelectedOrAll = async (mode: "selected" | "all") => {
    const h = handle();
    const meta = archiveMeta();
    if (h == null || !meta) return;

    const indices =
      mode === "all" || selected().size === 0 || selected().size === meta.entries.length
        ? meta.entries.map((_, i) => i)
        : [...selected()].sort((a, b) => a - b);

    if (indices.length === 0) return;

    setBusy(true);
    setProgress(0);
    try {
      const total = indices.length;
      // Extract one entry at a time and stream into ZIP so we never hold
      // extractAll() + zipSync() peak memory (all files + full archive).
      async function* sources(): AsyncGenerator<ZipSource> {
        for (let i = 0; i < indices.length; i++) {
          const idx = indices[i];
          const data = await getApi().extractEntry(h!, idx);
          // Progress: 0–90% for extract+compress, last 10% is finalize/write.
          setProgress(Math.min(90, Math.round(((i + 1) / total) * 90)));
          yield { name: meta!.entries[idx].name, data };
          // Drop reference so GC can reclaim each file after it is zipped.
        }
      }

      const base = (archiveName() ?? "archive").replace(/\.pfs(\.\d+)?$/i, "");
      const filename = `${base || "extract"}.zip`;
      const how = await saveZip(sources(), {
        filename,
        level: 1,
        total,
        onProgress: (done, n) => {
          setProgress(Math.min(99, Math.round((done / Math.max(n, 1)) * 90)));
        },
      });
      setProgress(100);
      showToast(
        how === "file-picker"
          ? `已保存 ZIP（${total} 个文件）`
          : `已打包下载 ${total} 个文件`,
        "success",
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        showToast("已取消保存", "info");
      } else {
        showToast(e instanceof Error ? e.message : String(e), "error");
      }
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const addPackFiles = async (list: FileList | File[] | null) => {
    if (!list || list.length === 0) return;
    const incoming: SelectedFile[] = [];
    for (const file of Array.from(list)) {
      // Prefer webkitRelativePath for folder picks.
      const rel =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name;
      const path = rel.replace(/^\/+/, "").replace(/\\/g, "/");
      incoming.push({
        id: `${path}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        path,
        size: file.size,
        file,
      });
    }
    setPackFiles((prev) => {
      const map = new Map(prev.map((f) => [f.path, f]));
      for (const f of incoming) map.set(f.path, f);
      return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
    });
  };

  const removePackFile = (id: string) => {
    setPackFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearPackFiles = () => setPackFiles([]);

  const createArchive = async () => {
    if (!wasmReady() || packFiles().length === 0) return;
    setBusy(true);
    setProgress(0);
    try {
      const sources: PackFile[] = [];
      const files = packFiles();
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const data = new Uint8Array(await f.file.arrayBuffer());
        sources.push({ name: f.path, data });
        setProgress(Math.round(((i + 1) / files.length) * 40));
      }
      const out = await getApi().createArchive(sources);
      setProgress(100);
      const name = packName().trim() || "root.pfs";
      downloadBytes(out, name.endsWith(".pfs") ? name : `${name}.pfs`);
      showToast(`已生成 ${name}`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const onDrop = async (e: DragEvent, mode: Tab) => {
    e.preventDefault();
    const items = e.dataTransfer?.files;
    if (!items?.length) return;
    if (mode === "extract") {
      await onPickArchive(items[0]);
    } else {
      await addPackFiles(items);
    }
  };

  return (
    <AppShell
      title="Artemis"
      subtitle={
        wasmReady()
          ? "PFS 归档工具 · WASM"
          : wasmError()
            ? "WASM 加载失败"
            : "正在加载引擎…"
      }
      left={
        <Show when={tab() === "extract" && archiveMeta()}>
          <button
            type="button"
            class="inline-flex items-center gap-0.5 text-[16px] font-medium text-ios-blue active:opacity-60"
            onClick={closeArchive}
          >
            <IconChevronLeft size={20} />
            <span class="hidden sm:inline">关闭</span>
          </button>
        </Show>
      }
      right={
        <Show when={!wasmReady() && !wasmError()}>
          <IconSpinner class="text-ios-blue" />
        </Show>
      }
    >
      <div class="space-y-4">
        <SegmentedControl
          value={tab()}
          onChange={(v) => setTab(v)}
          options={[
            { value: "extract", label: "解包" },
            { value: "create", label: "打包" },
          ]}
        />

        <Show when={wasmError()}>
          <Card class="p-4">
            <p class="text-[15px] text-ios-red">{wasmError()}</p>
          </Card>
        </Show>

        <Show when={busy()}>
          <Card class="p-4">
            <ProgressBar value={progress()} label="处理中" />
          </Card>
        </Show>

        <Show when={tab() === "extract"}>
          <Show
            when={archiveMeta()}
            fallback={
              <Card
                class="p-2"
                onClick={() => wasmReady() && !busy() && extractInput?.click()}
              >
                <div
                  class="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-ios-gray3/80 px-6 py-16 text-center"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => void onDrop(e, "extract")}
                >
                  <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-ios-blue/12 text-ios-blue">
                    <IconArchive size={30} />
                  </div>
                  <h2 class="text-[20px] font-semibold">打开 PFS 归档</h2>
                  <p class="mt-2 max-w-sm text-[15px] leading-relaxed text-ios-secondary/60">
                    支持 PF6 / PF8。文件在浏览器本地用 WASM 解密，不会上传到服务器。
                  </p>
                  <div class="mt-6">
                    <Button
                      disabled={!wasmReady() || busy()}
                      onClick={(e) => {
                        e.stopPropagation();
                        extractInput?.click();
                      }}
                    >
                      选择文件
                    </Button>
                  </div>
                </div>
              </Card>
            }
          >
            {(meta) => (
              <div class="space-y-4">
                <Card class="p-4">
                  <div class="flex items-start gap-3">
                    <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-ios-blue/12 text-ios-blue">
                      <IconArchive size={26} />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-[17px] font-semibold">
                        {archiveName()}
                      </div>
                      <div class="mt-1 text-[13px] text-ios-secondary/60">
                        PF{meta().format} · {meta().entries.length} 个文件 ·{" "}
                        {formatBytes(totalArchiveSize())}
                      </div>
                    </div>
                  </div>
                  <div class="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="tinted"
                      disabled={busy()}
                      onClick={() => void extractSelectedOrAll("all")}
                    >
                      <IconDownload size={16} />
                      全部导出 ZIP
                    </Button>
                    <Show when={selected().size > 0}>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy()}
                        onClick={() => void extractSelectedOrAll("selected")}
                      >
                        导出选中 ({selected().size})
                      </Button>
                      <Button size="sm" variant="plain" onClick={clearSelection}>
                        清除选择
                      </Button>
                    </Show>
                    <Show when={selected().size === 0}>
                      <Button size="sm" variant="plain" onClick={selectAllFiltered}>
                        全选
                      </Button>
                    </Show>
                  </div>
                </Card>

                <SearchField
                  value={query()}
                  placeholder="搜索文件名"
                  onInput={setQuery}
                />

                <Show
                  when={filteredEntries().length > 0}
                  fallback={
                    <EmptyState
                      icon={<IconFile size={28} />}
                      title="没有匹配的文件"
                      description="试试其他关键词"
                    />
                  }
                >
                  <GroupedList>
                    <For each={filteredEntries()}>
                      {(item, i) => {
                        const path = () => pf8ToDisplayPath(item.entry.name);
                        const isSelected = () => selected().has(item.index);
                        return (
                          <ListRow
                            title={basename(path())}
                            subtitle={dirname(path()) || undefined}
                            meta={formatBytes(item.entry.size)}
                            last={i() === filteredEntries().length - 1}
                            leading={
                              isSelected() ? (
                                <IconCheck size={18} />
                              ) : (
                                <IconFile size={18} />
                              )
                            }
                            trailing={
                              <button
                                type="button"
                                class="rounded-full p-2 text-ios-blue active:bg-ios-fill"
                                title="导出此文件"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void extractOne(item.index);
                                }}
                              >
                                <IconDownload size={18} />
                              </button>
                            }
                            onClick={() => toggleSelect(item.index)}
                          />
                        );
                      }}
                    </For>
                  </GroupedList>
                </Show>
              </div>
            )}
          </Show>
        </Show>

        <Show when={tab() === "create"}>
          <div class="space-y-4">
            <Card class="p-4">
              <label class="block text-[13px] font-medium text-ios-secondary/60">
                输出文件名
              </label>
              <input
                class="mt-2 h-11 w-full rounded-[12px] bg-ios-fill px-3 text-[16px] outline-none focus:ring-2 focus:ring-ios-blue/30"
                value={packName()}
                onInput={(e) => setPackName(e.currentTarget.value)}
                placeholder="root.pfs"
              />
            </Card>

            <Card>
              <div
                class="flex flex-col items-center justify-center px-6 py-10 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => void onDrop(e, "create")}
              >
                <div class="mb-3 flex h-14 w-14 items-center justify-center rounded-[18px] bg-ios-green/15 text-ios-green">
                  <IconFolder size={28} />
                </div>
                <h2 class="text-[18px] font-semibold">添加要打包的文件</h2>
                <p class="mt-1 max-w-sm text-[14px] text-ios-secondary/60">
                  支持多选文件，或选择整个文件夹。路径会写入 PF8 索引。
                </p>
                <div class="mt-5 flex flex-wrap justify-center gap-2">
                  <Button
                    size="sm"
                    disabled={!wasmReady() || busy()}
                    onClick={() => packInput?.click()}
                  >
                    <IconPlus size={16} />
                    添加文件
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!wasmReady() || busy()}
                    onClick={() => {
                      if (!packInput) return;
                      packInput.setAttribute("webkitdirectory", "");
                      packInput.setAttribute("directory", "");
                      packInput.click();
                      // reset so next "files" pick works
                      queueMicrotask(() => {
                        packInput?.removeAttribute("webkitdirectory");
                        packInput?.removeAttribute("directory");
                      });
                    }}
                  >
                    添加文件夹
                  </Button>
                  <Show when={packFiles().length > 0}>
                    <Button size="sm" variant="plain" onClick={clearPackFiles}>
                      <IconTrash size={16} />
                      清空
                    </Button>
                  </Show>
                </div>
              </div>
            </Card>

            <Show when={packFiles().length > 0}>
              <div class="flex items-center justify-between px-1 text-[13px] text-ios-secondary/60">
                <span>{packFiles().length} 个文件</span>
                <span class="tabular-nums">{formatBytes(packTotalSize())}</span>
              </div>
              <GroupedList>
                <For each={packFiles()}>
                  {(f, i) => (
                    <ListRow
                      title={basename(f.path)}
                      subtitle={dirname(f.path) || undefined}
                      meta={formatBytes(f.size)}
                      last={i() === packFiles().length - 1}
                      leading={<IconFile size={18} />}
                      trailing={
                        <button
                          type="button"
                          class="rounded-full p-2 text-ios-secondary/50 active:bg-ios-fill"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePackFile(f.id);
                          }}
                        >
                          <IconX size={16} />
                        </button>
                      }
                      onClick={() => undefined}
                    />
                  )}
                </For>
              </GroupedList>
            </Show>
          </div>
        </Show>
      </div>

      <Show when={tab() === "create" && packFiles().length > 0}>
        <FloatingBar>
          <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <div class="truncate text-[15px] font-semibold">生成 PF8 归档</div>
              <div class="truncate text-[12px] text-ios-secondary/55">
                {packFiles().length} 文件 · {formatBytes(packTotalSize())}
              </div>
            </div>
            <Button
              disabled={!wasmReady() || busy()}
              loading={busy()}
              onClick={() => void createArchive()}
            >
              打包下载
            </Button>
          </div>
        </FloatingBar>
      </Show>

      <Show when={toast()}>
        {(t) => <Toast message={t().message} tone={t().tone} />}
      </Show>

      <input
        ref={extractInput}
        type="file"
        class="hidden"
        accept=".pfs,.001,.002,.003,application/octet-stream,*/*"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          void onPickArchive(f);
        }}
      />
      <input
        ref={packInput}
        type="file"
        class="hidden"
        multiple
        onChange={(e) => {
          const files = e.currentTarget.files;
          e.currentTarget.value = "";
          void addPackFiles(files);
        }}
      />
    </AppShell>
  );
}
