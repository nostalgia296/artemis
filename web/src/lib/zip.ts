import { zipSync, strToU8 } from "fflate";
import type { ExtractedFile } from "./wasm";
import { pf8ToDisplayPath } from "./format";

export function buildZip(files: ExtractedFile[]): Uint8Array {
  const tree: Record<string, Uint8Array> = {};
  for (const f of files) {
    const path = pf8ToDisplayPath(f.name);
    // fflate expects Unix-style paths; empty names are skipped.
    if (!path) continue;
    tree[path] = f.data;
  }
  // Ensure non-empty zip for edge cases.
  if (Object.keys(tree).length === 0) {
    tree[".keep"] = strToU8("");
  }
  return zipSync(tree, { level: 6 });
}
