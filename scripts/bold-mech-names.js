/**
 * bold-mech-names.js — 一次性脚本：把每个 Boss「机制二」（第二组机制详解）中
 * 每条机制的「名称」加粗，类似 `**驱风·烈袭**`、`**「全装甲歼灭鸭」**`。
 *
 * 规则：
 *   - 只处理每个 Boss 的第二组引用块（机制详解组）。
 *   - 加粗名称 = 行内首个全角冒号 `：` 之前的内容。
 *   - 若名称以 `「` 开头，只加粗到首个 `」`（去掉如 `模式` 之类后缀，符合 `**「全装甲歼灭鸭」**`）。
 *   - 幂等：已含 `**` 的行跳过。
 *
 * 运行：node scripts/bold-mech-names.js
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'src', 'content');

/** 对“机制二”中的一条 `> - 名称：…` 行加粗名称；返回处理后的行（无法处理则原样返回） */
function boldLine(line) {
  const m = line.match(/^(\s*>\s*-\s*)(.*)$/);
  if (!m) return line;
  const prefix = m[1];
  const rest = m[2];
  const idx = rest.indexOf('：');
  if (idx < 0) return line;
  let name = rest.slice(0, idx);
  if (name.startsWith('「')) {
    const e = name.indexOf('」');
    if (e >= 0) name = name.slice(0, e + 1);
  }
  if (!name || name.includes('**')) return line; // 已加粗或空名，跳过
  return prefix + '**' + name + '**' + rest.slice(idx);
}

const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md')).sort();
for (const file of files) {
  const p = join(CONTENT_DIR, file);
  const raw = readFileSync(p, 'utf8');
  const lines = raw.split(/\r?\n/);

  let boss = false;       // 是否已在某个 Boss 内
  let group = 0;          // 当前引用组索引（0 起）
  let inQuoteRun = false; // 是否正在一段连续引用中
  let changed = 0;

  const out = lines.map((line) => {
    if (/^\s*!\[[^\]]*\]\(/.test(line)) {
      // 图片行 = 新 Boss 起点
      boss = true;
      group = 0;
      inQuoteRun = false;
      return line;
    }
    if (!boss) return line;

    if (line.trim() === '') {
      // 空行：结束当前引用组
      if (inQuoteRun) {
        group++;
        inQuoteRun = false;
      }
      return line;
    }

    if (/^\s*>/.test(line)) {
      const isBullet = /^\s*>\s*-\s*/.test(line);
      if (!inQuoteRun) inQuoteRun = true;
      // 第二组（机制详解）+ 项目符号行
      if (group === 1 && isBullet) {
        const processed = boldLine(line);
        if (processed !== line) changed++;
        return processed;
      }
      return line;
    }

    // 表格 / 标题等非引用行，不影响引用分组
    return line;
  });

  if (changed) {
    writeFileSync(p, out.join('\n'));
    console.log(`已更新 ${file}（${changed} 行）`);
  } else {
    console.log(`无变化 ${file}`);
  }
}
console.log('完成。');
