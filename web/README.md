# Artemis Web

浏览器端 PFS 解包 / 打包工具。核心算法通过 Go 编译的 WebAssembly 在本地执行，文件不会上传。

## 技术栈

- TypeScript + SolidJS + Tailwind CSS v4
- Go WASM（`../cmd/wasm` + `../internal/pfs`）
- fflate（批量导出 ZIP）

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
- 选择多个文件或文件夹，打包为 PF8 并下载
- iOS 风格 UI，自适应手机与桌面

## 隐私

所有解密与打包均在当前浏览器内存中完成。
