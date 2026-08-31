/**
 * parse-md.js
 *
 * 扫描 `src/content/` 下所有 `版本号.md` 文件（如 5.7.md），
 * 或合并文件 `幽境boss.md`（其中每个版本号为一个 `## 二级标题`），
 * 解析出每个版本的 Boss 数据，下载 Boss 图片到 src/content/images/ 目录，
 * 并输出中间数据 src/data/bosses.json。
 *
 * 维护方式：
 *   - 修改任意 MD 内容，或新增一个 `X.X.md` 文件到 src/content/，
 *     然后运行 `npm run data` 或 `npm run build` 即可重新生成。
 *
 * 图片规则：
 *   - 保存到 public/images/<Boss全名>.<扩展名>，文件名取自表格中的 Boss 全名。
 *   - 若某全名的图片已存在（下载过），则直接复用，不重复下载（同名称共用）。
 *   - 下载失败时，数据中 imgMissing=true 并保留原始 URL，由前端显示占位框，
 *     可手动将图片放入 images/ 后重新构建。
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MD_DIR = join(ROOT, 'src', 'content'); // 数据源：src/content/ 下的 版本号.md
const IMG_DIR = join(ROOT, 'src', 'content', 'images'); // 图片与 MD 同目录，便于本地查看
const OUT_FILE = join(ROOT, 'src', 'data', 'bosses.json');

// ---------- 解析单个 MD 文件 ----------
/**
 * 解析一个 MD 文件为 { version, bosses: [...] }
 * 每行按规则匹配。Boss 结构：图片行 → 名称/血量表格 → 技能引用块
 */
function parseMarkdown(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);

  // 合并文件（幽境boss.md）可能包含多个版本块，按 ## 标题切分为多个版本
  const versions = [];
  let version = '';
  let bosses = [];
  let current = null;

  for (const line of lines) {
    // 版本标题（兼容 `## 幽境危战 5.7` 与 `## 5.7` 两种写法）
    const titleMatch = line.match(/^##\s*(?:幽境危战\s*)?([\d.]+)/);
    if (titleMatch) {
      // 遇到新标题：若上一版本已有数据，先保存
      if (version && bosses.length) versions.push({ version, bosses });
      version = titleMatch[1].trim();
      bosses = [];
      current = null;
      continue;
    }

    // 图片行 ![短名](url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      current = {
        shortName: imgMatch[1].trim(),
        imgUrl: imgMatch[2].trim(),
        imgLocal: '',
        imgMissing: false,
        fullName: '',
        hp: '',
        skills: [],
      };
      bosses.push(current);
      continue;
    }

    if (!current) continue;

    // 表格行：名称 或 血量
    const tableMatch = line.match(/^\|\s*([^|]+?)\s*\|/);
    if (tableMatch && line.trim().startsWith('|')) {
      const cell = tableMatch[1].trim();
      if (!current.fullName && cell !== ':' && !/^N5/i.test(cell)) {
        current.fullName = cell;
        continue;
      }
      if (/^N5/i.test(cell)) {
        current.hp = cell;
        continue;
      }
    }

    // 空行：若正在收集技能，则作为两组技能描述之间的分隔标记
    if (line.trim() === '') {
      if (current.skills.length > 0 && current.skills[current.skills.length - 1] !== '__SEP__') {
        current.skills.push('__SEP__');
      }
      continue;
    }

    // 技能描述（引用块）
    const quoteMatch = line.match(/^\s*>\s*(.*)$/);
    if (quoteMatch) {
      let content = quoteMatch[1].trim();
      if (content === '') {
        // 空引用行（>）：仅作 MD 中的视觉分隔，不产生分组标记
      } else {
        // 支持嵌套引用（> > 描述）：剥掉一级前缀，作为同级内容
        content = content.replace(/^>\s*/, '').trim();
        current.skills.push(content.replace(/^-\s*/, ''));
      }
    }
  }

  // 保存最后一个版本块
  if (version && bosses.length) versions.push({ version, bosses });
  return versions;
}

// ---------- 下载图片 ----------
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // 跟随重定向
        download(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        writeFileSync(dest, Buffer.concat(chunks));
        resolve();
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

/** 将 Boss 全名转成安全的文件名（保留中文与·，去掉 Windows 非法字符） */
function safeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

// ---------- 主流程 ----------
mkdirSync(IMG_DIR, { recursive: true });
mkdirSync(dirname(OUT_FILE), { recursive: true });

const mdFiles = readdirSync(MD_DIR)
  .filter((f) => /^\d+\.\d+\.md$/.test(f) || f === '幽境boss.md');

const allVersions = [];
const downloadedNames = new Set(); // 用于同名称共用图片（仅成功下载的）

for (const file of mdFiles) {
  const filePath = join(MD_DIR, file);

  // parseMarkdown 现在返回 { version, bosses } 数组（单个版本文件也返回单元素数组）
  for (const { version, bosses } of parseMarkdown(filePath)) {
    const imageJobs = bosses.map(async (boss) => {
    const isRemote = /^https?:\/\//i.test(boss.imgUrl);
    let fname;
    if (isRemote) {
      // 远程 URL：下载到本地，以 Boss 全名命名
      const ext = extname(new URL(boss.imgUrl).pathname) || '.webp';
      fname = safeName(boss.fullName || boss.shortName) + ext;
    } else {
      // 本地引用：如 images/水形幻人·极旋湍流.webp，直接使用文件名
      fname = basename(boss.imgUrl);
    }
    const dest = join(IMG_DIR, fname);

    if (isRemote) {
      // 若当前会话已成功下载过同名称图片，或文件已存在，则直接复用
      if (downloadedNames.has(boss.fullName) || existsSync(dest)) {
        boss.imgLocal = fname;
        downloadedNames.add(boss.fullName);
        return;
      }
      try {
        await download(boss.imgUrl, dest);
        boss.imgLocal = fname;
        downloadedNames.add(boss.fullName);
        console.log(`  已下载: ${fname}`);
      } catch (err) {
        boss.imgMissing = true;
        console.warn(`  下载失败(留占位): ${fname}  <-  ${boss.imgUrl}  (${err.message})`);
      }
    } else {
      // 本地图片：直接用，若文件缺失则标记为待补充
      boss.imgLocal = fname;
      downloadedNames.add(boss.fullName);
      if (!existsSync(dest)) {
        boss.imgMissing = true;
        console.warn(`  本地图片缺失(留占位): ${fname}`);
      }
    }
    });

    await Promise.all(imageJobs);

    allVersions.push({ version, bosses });
  }
}

// 按版本号升序排序
allVersions.sort((a, b) => parseFloat(a.version) - parseFloat(b.version));

writeFileSync(OUT_FILE, JSON.stringify(allVersions, null, 2), 'utf-8');

console.log(`\n解析完成：${allVersions.length} 个版本`);
allVersions.forEach((v) => {
  const missing = v.bosses.filter((b) => b.imgMissing).length;
  console.log(`  ${v.version}: ${v.bosses.length} 个 Boss${missing ? `，${missing} 张图片待补充` : ''}`);
});
console.log(`数据已写入: ${OUT_FILE}`);
