# Artemis Web

浏览器端 PFS 解包 / 打包工具。核心算法通过 Go 编译的 WebAssembly 在本地执行，文件不会上传。

## 技术栈

- TypeScript + SolidJS + Tailwind CSS v4
- Go WASM（`../cmd/wasm` + `../internal/pfs`）
- fflate（流式 ZIP）

## 开发

```bash
# 1) 编译 WASM（在仓库根目录）
GOOS=js GOARCH=wasm go build -o web/public/artemis.wasm ./cmd/wasm
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" web/public/

# 2) 安装并启动前端
cd web
npm install
npm run dev
```

也可在 `web/` 下使用：

```bash
npm run wasm   # 重新编译 wasm 到 public/
npm run build  # 生产构建
npm run preview
```

## 功能

- 打开 PF6 / PF8 归档，列出文件
- 单文件导出 / 全部（或选中）导出为 ZIP
  - 桌面 Chromium：Save As 直接流式写用户磁盘
  - Android / 移动 Chromium：跳过 Save As（SAF 常留下 0 KB 占位文件），流式写入 OPFS
  - 大体积 ZIP（手机 / >64MB）：**禁止**整包进内存 Blob / `createObjectURL`（会卡死标签页）
    - 写完后显示「保存到手机」→ 系统分享，或流式另存为（按 1MB 切片拷贝）
  - 小体积：OPFS 临时文件自动触发下载
  - 无 OPFS 且预估 >48MB：直接拒绝内存回退，避免卡死
  - 导出进度由前端按文件数驱动，不再与 WASM `getProgress` 抢进度条
- 选择多个文件或文件夹，打包为 PF8 并下载

## 隐私

所有解密与打包均在当前浏览器内存中完成。
