# 原神 Boss 图鉴生成器

从 `src/content/` 下的 `版本号.md` 文件（如 `5.7.md`）自动生成一个可切换版本、三 Boss 横排展示的 HTML 图鉴。

## 维护方式（核心）

**你只需改 MD 或新增 MD 文件，然后运行一次构建即可：**

```bash
npm run build
```

- 修改任意 `src/content/*.md` 的内容 → 重新 `npm run build`
- 在 `src/content/` 新增一个文件（如 `7.2.md`，命名即版本号）→ 重新 `npm run build`，版本按钮自动出现
- 产物：`dist/index.html`（单文件，CSS/JS 已内联）+ `dist/*.webp`（本地图片）

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run build` | 解析 MD → 下载图片 → 打包单文件到 `dist/`（最常用） |
| `npm run data` | 仅重新解析 MD 并下载图片，生成 `src/data/bosses.json` |
| `npm run dev` | 本地开发预览（Vite dev server） |

## 目录结构

```
├── src/
│   ├── content/                  # 数据源（你只改这里）
│   │   ├── 5.7.md ...            #   版本号.md
│   │   ├── images/               #   Boss 图片（与 MD 同目录，本地查看器可直接显示）
│   │   └── colors.json           #   配色表（改它可换字体/强调色）
│   ├── data/bosses.json          # 生成的中间数据（勿手改）
│   ├── main.js                   # 渲染 + 版本切换 + 配色注入
│   └── style.css                 # 简约卡片样式
├── index.html                    # 页面入口
├── scripts/
│   ├── parse-md.js               # 解析 MD + 下载图片（勿手改）
│   └── relocalize.js             # 一次性：把已下载的远程图片引用改为本地
└── dist/                         # 构建产物
```

> `src/content/` 里的 MD 与 `images/` 图片放在一起，用本地 MD 查看器直接打开 `src/content/5.7.md` 即可看到图片。

## 配色（字体颜色）维护

页面颜色由 `src/content/colors.json` 驱动（内含 genshin 各元素配色）。
构建时 `main.js` 会读取它，把配色注入为 CSS 变量：

- `--accent`：全局强调色（激活标签、链接、占位链接）——默认取 `genshin.hydro`，可在 `src/main.js` 中改引用其他元素
- `--el-pyro` / `--el-hydro` / `--el-electro` / …：各元素颜色，可用于需要元素色的元素（目前卡片顶部已不使用颜色，如需可随时启用）

**换色方法**：修改 `src/content/colors.json` 中的色值，然后 `npm run build` 即可，无需改 HTML/CSS 代码。
其余通用文字色（正文、次要文字、边框、背景）在 `src/style.css` 顶部的 `:root` 变量中定义。

### 技能文本的富文本标记（`src/content/*.md` 技能行内）

渲染由 `src/renderer.js` 处理（构建时生效），支持以下写法：

| 写法 | 效果 |
| --- | --- |
| `<span class="pyro">**火元素**</span>` | 元素/反应词着色（类名 = `colors.json` 的 `genshin` 键） |
| `$45\%$`、`$0.6s$`、`$12U$` | 行内数字/数学（单个 `$`，`\%` 会还原为 `%`） |
| `` `深黯护盾` `` | 无配色命名机制词，反引号强调 |

- 渐变反应名（`月感电`/`月绽放`/`星超导` 等）直接用对应渐变键作类名。
- 新增版本时可用 `node scripts/apply-colors.js` 对技能行批量补标记（仅处理引用块行）。
  ⚠️ 脚本非幂等：对已标记的文件再跑会重复包裹，运行前请先用 `node scripts/revert-colors.js` 还原。

## MD 格式约定

每个 MD 文件必须遵循以下结构（脚本按此解析）：

```markdown
## 幽境危战 5.7

![短名](images/Boss全名.webp)   ← 图片可引用本地文件（src/content/images/ 下）或远程 URL

| Boss全名·称号 |
| :----------: |
| N5 / N6：xxx / xxx |

> - 技能描述 1
> - 技能描述 2

> - 机制详解 1   ← 两组之间用空行分隔
```

要点：
- 文件放入 `src/content/` 文件夹，文件名即版本号（如 `5.7.md`），脚本按版本号数字升序排列
- 每个文件恰好 3 个 Boss（图片行 `![...](...)` 作为 Boss 起点）
- **图片引用**：可写本地路径（如 `images/Boss全名.webp`）或远程 URL。
  - 本地引用：脚本直接用 `src/content/images/` 下的文件，不下载；本地查看器也能显示
  - 远程 URL：脚本自动下载到 `src/content/images/`，以 Boss 全名命名
- 图片文件名取**表格第一行的 Boss 全名**；同全名的 Boss 共用一张图，不会重复下载
- 每个 Boss 渲染为 3 张叠放卡片：① 图片 + 居中名称 + 血量；② 第一组机制；③ 第二组机制（两组由**空行**分隔，纯文本无符号）

> 说明：`scripts/relocalize.js` 为一次性脚本，可把 MD 中已下载成功的远程图片 URL 批量改为本地引用；本地缺失的图片保留远程 URL。运行：`node scripts/relocalize.js`

## 图片下载失败 / 本地缺失

若某 Boss 图片下载失败（如 404）或本地引用缺失，脚本会：
- 在 `src/content/images/` 不生成该文件
- 在页面中该 Boss 显示"待手动补充图片 + 原始链接"占位框

**手动补充方式**：把图片放入 `src/content/images/<Boss全名>.<扩展名>`，再 `npm run build` 即可。
若 MD 中该 Boss 仍为远程 URL，可重跑 `node scripts/relocalize.js` 把它改为本地引用。
