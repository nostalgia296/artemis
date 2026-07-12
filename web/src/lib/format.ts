export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let v = n;
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  return `${v.toFixed(v >= 10 || i === 0 ? 1 : 2)} ${units[i]}`;
}

export function pf8ToDisplayPath(name: string): string {
  return name.replace(/\\/g, "/");
}

export function basename(path: string): string {
  const normalized = pf8ToDisplayPath(path);
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

export function dirname(path: string): string {
  const normalized = pf8ToDisplayPath(path);
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(0, idx) : "";
}

export function downloadBlob(
  blob: Blob,
  filename: string,
  opts?: { revokeMs?: number },
) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick so Safari can start the download.
  // Large disk-backed Files may need longer before the download manager copies.
  const revokeMs = opts?.revokeMs ?? 1500;
  setTimeout(() => URL.revokeObjectURL(url), revokeMs);
}

export function downloadBytes(data: Uint8Array, filename: string, mime = "application/octet-stream") {
  // Copy into a fresh ArrayBuffer-backed Uint8Array for BlobPart compatibility.
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  downloadBlob(new Blob([copy.buffer], { type: mime }), filename);
}
