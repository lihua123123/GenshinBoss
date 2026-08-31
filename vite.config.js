import { defineConfig } from 'vite';

export default defineConfig({
  // publicDir 指向 src/content/images：图片与 MD 同目录（方便本地查看），
  // 构建时这些图片会复制到 dist/ 根目录，页面以 /文件名.webp 引用
  publicDir: 'src/content/images',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // 固定 JS / CSS 文件名，方便后续引用
        entryFileNames: 'script.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.some((name) => name.endsWith('.css'))) {
            return 'style.css';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
