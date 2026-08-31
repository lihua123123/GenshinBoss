// 将 src/content 下所有 .md 文件中的大数字（5 位及以上）
// 按「万」为单位，每 4 位从右往左插入英文逗号。
// 例如：7658830 -> 765,8830 ；17260004 -> 1726,0004
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentDir = join(__dirname, '..', 'src', 'content');

// 匹配 5 位及以上、未被点号/逗号/数字包围的整数片段
// （lookbehind 排除小数部分及已有分隔符，lookahead 保证取到完整数字）
const numberRe = /(?<![\d.,])\d{5,}(?!\d)/g;

// 对一串数字按 4 位从右往左插入英文逗号
function addCommas(str) {
  return str.replace(/\B(?=(\d{4})+(?!\d))/g, ',');
}

const files = readdirSync(contentDir).filter((f) => f.endsWith('.md'));

for (const file of files) {
  const p = join(contentDir, file);
  const original = readFileSync(p, 'utf8');
  const updated = original.replace(numberRe, addCommas);
  if (updated !== original) {
    writeFileSync(p, updated);
    console.log(`已更新: ${file}`);
  } else {
    console.log(`无变化: ${file}`);
  }
}

console.log('完成。');
