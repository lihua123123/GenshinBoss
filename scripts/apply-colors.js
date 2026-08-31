/**
 * apply-colors.js — 一次性脚本：为 src/content/*.md 的技能行批量添加
 *   - 元素/反应词着色 <span class="...">**词**</span>
 *   - 数字行内数学 $…$
 *   - 命名机制词反引号 `…`
 *
 * 仅处理引用块行（以 > 开头），不改标题/图片/表格/分隔线。
 * 已存在的 <span …>…</span> 会被保护，不会被重复处理。
 * 运行：node scripts/apply-colors.js
 *
 * 说明：脚本只做「确定无疑」的替换；单字元素、叙事文本等需要判断的
 * 部分由人工复核补充（本脚本对这些情况保持保守）。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'src', 'content');

const ELEM = { 火: 'pyro', 水: 'hydro', 雷: 'electro', 冰: 'cryo', 风: 'anemo', 岩: 'geo', 草: 'dendro' };

// 反应词 -> 类名（长的在前，避免部分匹配）
const REACTIONS = [
  ['月感电', 'lunar-charged-electro'],
  ['月绽放', 'lunar-bloom-dendro'],
  ['星超导', 'stellar-conduct-cryo'],
  ['超绽放', 'dendro'],
  ['烈绽放', 'dendro'],
  ['超激化', 'electro'],
  ['蔓激化', 'dendro'],
  ['超导', 'cryo'],
  ['感电', 'electro'],
  ['超载', 'pyro'],
  ['冻结', 'cryo'],
  ['燃烧', 'pyro'],
  ['扩散', 'anemo'],
  ['结晶', 'geo'],
  ['绽放', 'dendro'],
];

// 命名机制词（无配色）-> 反引号强调；长的在前
const SPECIAL = [
  '深黯护盾·沉疴', '虚界力护罩', '深黯护盾', '实验型多重护盾', '辉映·星烁', '月兆·满辉',
  '岩居之种', '活性元素星', '惰性元素星', '探侦机关', '冲鸭机关', '应战对策', '球状雷炮',
  '生命之契', '元素晶球', '元素微粒', '液流动量', '固态燃素', '雷矩套件', '汲聚械',
  '狂猎幽魂', '荒野幽徒', '失色哀恸', '涉血追猎', '重力削减力场',
  '半幻人', '深黯钓客', '月锚岩', '雷暴云', '草原核', '星辉棱晶', '极星辉域',
  '星辉风旋', '狂猎', '冰棺', '巨口霜精', '晦隐', '夜魂', '星烁', '物理', '碎冰', '融化',
];

const sp = (cls, word) => `<span class="${cls}">**${word}**</span>`;

/** 数字 -> 行内数学（% 用 \%，U/s 随数字入内，其余只包数字） */
function wrapNumbers(s) {
  return s.replace(
    /(?<![\d.,A-Za-z])([+\-]?\d[\d,]*(?:\.\d+)?)(%|U|s)?(?![\d.,A-Za-z])/g,
    (_m, num, unit) => {
      if (unit === '%') return `$${num}\\%$`;
      if (unit === 'U' || unit === 's') return `$${num}${unit}$`;
      return `$${num}$`;
    }
  );
}

function processLine(line) {
  // 0) 先包数字（此时尚无占位符，避免误改占位符内的数字）
  line = wrapNumbers(line);

  // 保护已存在的 <span …>…</span>
  const spans = [];
  let i = 0;
  const ph = () => `\x00SPAN${'x'.repeat(++i)}\x00`;
  line = line.replace(/<span class="[^"]+">(?:(?!<\/span>).)+?<\/span>/g, (m) => {
    const k = ph();
    spans.push({ k, m });
    return k;
  });

  // 1) 斜杠列表中的单字元素，如 火/水/雷/冰、冰/水（先于 X元素，避免“X/Y/冰元素”中 Y 被 span 隔断）
  line = line.replace(/([火水雷冰风岩草])\/([火水雷冰风岩草])/g, (_m, a, b) => `${sp(ELEM[a], a)}/${sp(ELEM[b], b)}`);

  // 2) 元素词 X元素
  line = line.replace(/([火水雷冰风岩草])元素/g, (_m, c) => sp(ELEM[c], c + '元素'));

  // 3) 单字元素 + 明确后缀（附着量/附着/盾/抗）
  line = line.replace(/([火水雷冰风岩草])附着量/g, (_m, c) => sp(ELEM[c], c + '附着量'));
  line = line.replace(/([火水雷冰风岩草])附着/g, (_m, c) => sp(ELEM[c], c + '附着'));
  line = line.replace(/([火水雷冰风岩草])盾/g, (_m, c) => sp(ELEM[c], c + '盾'));
  line = line.replace(/([火水雷冰风岩草])抗/g, (_m, c) => sp(ELEM[c], c + '抗'));

  // 4) 反应词（单次正则，长词优先，避免二次处理）
  const reactMap = Object.fromEntries(REACTIONS.map(([w, c]) => [w, c]));
  const reactRe = new RegExp('(' + REACTIONS.map((r) => r[0]).sort((a, b) => b.length - a.length).join('|') + ')', 'g');
  line = line.replace(reactRe, (m) => sp(reactMap[m], m));

  // 5) 命名机制词 -> 反引号（单次正则，长词优先）
  const specialRe = new RegExp('(' + [...new Set(SPECIAL)].sort((a, b) => b.length - a.length).join('|') + ')', 'g');
  line = line.replace(specialRe, '`$1`');

  // 还原受保护的 span
  for (const { k, m } of spans) line = line.split(k).join(m);
  return line;
}

const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md')).sort();
for (const file of files) {
  const p = join(CONTENT_DIR, file);
  const raw = readFileSync(p, 'utf8');
  const lines = raw.split(/\r?\n/);
  let changed = 0;
  const out = lines.map((line) => {
    // 引用块内容行：以 > 开头（可带前导空白）
    const m = line.match(/^(\s*>\s*)(.*)$/);
    if (!m) return line;
    const processed = processLine(m[2]);
    if (processed !== m[2]) {
      changed++;
      return m[1] + processed;
    }
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
