/**
 * revert-colors.js — 一次性脚本：把 apply-colors.js（旧版）生成的标记还原为原始文本，
 * 以便用修复后的脚本重新应用。运行：node scripts/revert-colors.js
 *
 * 还原规则（原文本不含 $、`、**、<span>，可安全剥离）：
 *   - 行内数学 $…$：去掉 $，并把 \% 还原为 %
 *   - 反引号：删除
 *   - <span class="…">、</span>、**：删除
 *   - 7.1.md 用户预置的 <span class="anemo">风抗</span> 占位符：还原为原 span
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'src', 'content');

function revertLine(s) {
  // 1) 行内数学
  s = s.replace(/\$([^$\n]*?)\$/g, (_m, inner) => inner.replace(/\\%/g, '%'));
  // 2) 反引号
  s = s.replace(/`/g, '');
  // 3) span 标签与加粗
  s = s.replace(/<span class="[^"]+">/g, '');
  s = s.replace(/<\/span>/g, '');
  s = s.replace(/\*\*/g, '');
  // 4) 还原 7.1.md 用户预置的 span（占位符旧版为 \x00SPAN_0\x00）
  s = s.replace(/\x00SPAN_0\x00/g, '<span class="anemo">风抗</span>');
  // 兜底：清理任何残留占位符
  s = s.replace(/\x00SPAN_\d+\x00/g, '');
  return s;
}

const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md')).sort();
for (const file of files) {
  const p = join(CONTENT_DIR, file);
  const raw = readFileSync(p, 'utf8');
  const lines = raw.split(/\r?\n/);
  let changed = 0;
  const out = lines.map((line) => {
    const m = line.match(/^(\s*>\s*)(.*)$/);
    if (!m) return line;
    const reverted = revertLine(m[2]);
    if (reverted !== m[2]) {
      changed++;
      return m[1] + reverted;
    }
    return line;
  });
  if (changed) {
    writeFileSync(p, out.join('\n'));
    console.log(`已还原 ${file}（${changed} 行）`);
  } else {
    console.log(`无变化 ${file}`);
  }
}
console.log('完成。');
