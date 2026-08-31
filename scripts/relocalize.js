/**
 * relocalize.js — 一次性脚本：把 md/*.md 中的远程图片 URL 改为本地引用。
 *
 * 规则：
 *   - 已下载成功（public/images/ 中存在对应文件）的，改为 `images/<Boss全名>.<扩展名>`
 *   - 本地缺失的图片保留远程 URL（便于脚本继续尝试下载，或作为占位源链接）
 *
 * 运行：node scripts/relocalize.js
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MD_DIR = join(ROOT, 'src', 'content');
const IMG_DIR = join(ROOT, 'src', 'content', 'images');

function safeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

/** 解析 MD，收集每个 Boss 的 短名 / 全名 / 图片URL（与 parse-md.js 一致） */
function parseMarkdown(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);
  const bosses = [];
  let current = null;
  for (const line of lines) {
    const titleMatch = line.match(/^##\s*幽境危战\s*([\d.]+)/);
    if (titleMatch) continue;
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      current = { shortName: imgMatch[1].trim(), imgUrl: imgMatch[2].trim(), fullName: '' };
      bosses.push(current);
      continue;
    }
    if (!current) continue;
    const tableMatch = line.match(/^\|\s*([^|]+?)\s*\|/);
    if (tableMatch && line.trim().startsWith('|')) {
      const cell = tableMatch[1].trim();
      if (!current.fullName && cell !== ':' && !/^N5/i.test(cell)) {
        current.fullName = cell;
      }
    }
  }
  return bosses;
}

const mdFiles = readdirSync(MD_DIR)
  .filter((f) => /^\d+\.\d+\.md$/.test(f))
  .sort((a, b) => parseFloat(a) - parseFloat(b));

let changed = 0;
let keptRemote = 0;

for (const file of mdFiles) {
  const filePath = join(MD_DIR, file);
  const bosses = parseMarkdown(filePath);
  const lines = readFileSync(filePath, 'utf-8').split(/\r?\n/);

  let bi = 0;
  const out = lines.map((line) => {
    const img = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/);
    if (!img) return line;
    const boss = bosses[bi++];
    if (!boss) return line;

    const ext = extname(new URL(boss.imgUrl).pathname) || '.webp';
    const fname = safeName(boss.fullName || boss.shortName) + ext;
    const localRef = `images/${fname}`;

    if (!existsSync(join(IMG_DIR, fname))) {
      keptRemote++;
      console.warn(`  ${file} 本地缺失(保留远程): ${boss.shortName} <- ${boss.imgUrl}`);
      return `![${boss.shortName}](${boss.imgUrl})`;
    }

    changed++;
    console.log(`  ${file}: ${boss.shortName} -> ${localRef}`);
    return `![${boss.shortName}](${localRef})`;
  });

  writeFileSync(filePath, out.join('\r\n'), 'utf-8');
}

console.log(`\n完成：${changed} 张图片改为本地引用，${keptRemote} 张因本地缺失保留远程（请手动补图后重新运行本脚本或直接改 MD）。`);
