import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  // publicDir 指向 src/content/images：图片与 MD 同目录（方便本地查看）
  publicDir: 'src/content/images',
  build: {
    // 单独输出目录，避免覆盖默认构建产物
    outDir: 'dist-single',
  },
  plugins: [viteSingleFile()],
});
