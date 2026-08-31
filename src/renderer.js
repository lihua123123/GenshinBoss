import katex from 'katex';
import 'katex/dist/katex.min.css';
import colors from './content/colors.json';

/**
 * renderer.js — 技能文本的富文本渲染（KaTeX 数学 + 颜色 + 代码强调）。
 *
 * 数据源写法（写在 src/content/*.md 的技能行内）：
 *   - 元素/反应词着色：<span class="pyro">**火元素**</span>
 *       类名 = colors.json 的 genshin 键（pyro/hydro/electro/cryo/anemo/geo/dendro + lunar- 与 stellar- 渐变）
 *   - 行内数字/数学：单个美元符 $…$，如 $45%$、$0.4s$、$12U$（KaTeX 渲染）
 *   - 整段公式：双美元符 $$…$$（KaTeX 块模式，可横向滚动）
 *   - 无颜色的特殊名词：用反引号强调，如 `深黯护盾`
 *   - 加粗：**文字**
 */

// 依据 colors.json 的 genshin 段动态生成元素颜色样式（单一数据源）。
// 纯色 -> color；渐变色 -> background-clip:text 文字渐变。
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.id = 'element-colors';
  style.textContent = Object.entries(colors.genshin || {})
    .map(([name, color]) => {
      const sel = `.${name}`;
      if (typeof color === 'string' && color.includes('linear-gradient')) {
        return `${sel} { background: ${color}; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }`;
      }
      return `${sel} { color: ${color}; }`;
    })
    .join('\n');
  document.head.appendChild(style);
}

/** 转义 HTML 特殊字符 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 把技能文本渲染为带 KaTeX 数学 / 颜色 / 代码强调的 HTML。
 *
 * 顺序：先抽取块公式 $$…$$、行内公式 $…$、反引号代码、<span class> 颜色块，
 * 并对块/行内公式用 KaTeX 渲染；再处理 **加粗**、转义剩余纯文本，最后还原所有占位符。
 * 占位符用 NUL + 字母（不含数字），避免被后续正则误匹配。
 */
export function renderRichText(text) {
  const blocks = [];
  let idx = 0;
  const ph = () => `\x00RICH${'y'.repeat(++idx)}\x00`;

  // 1) 块公式 $$…$$（KaTeX displayMode，可横向滚动）
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, math) => {
    const key = ph();
    try {
      blocks.push({ key, html: `<div class="katex-wrap">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false, strict: false })}</div>` });
    } catch (e) {
      blocks.push({ key, html: `<pre class="katex-error">${escapeHtml(math)}</pre>` });
    }
    return key;
  });

  // 2) 行内公式 $…$（单个 $，避开 $$）
  text = text.replace(/(?<!\$)\$(?!\$)([^\n]+?)(?<!\$)\$(?!\$)/g, (_m, math) => {
    const key = ph();
    try {
      blocks.push({ key, html: `<span class="katex-inline">${katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, strict: false })}</span>` });
    } catch (e) {
      blocks.push({ key, html: `<span class="katex-inline"><code class="katex-error">${escapeHtml(math)}</code></span>` });
    }
    return key;
  });

  // 3) 反引号代码强调 `…`
  text = text.replace(/`([^`]+?)`/g, (_m, code) => {
    const key = ph();
    blocks.push({ key, html: `<code>${escapeHtml(code)}</code>` });
    return key;
  });

  // 4) 颜色块 <span class="X">**文字**</span> 或 <span class="X">文字</span>
  text = text.replace(/<span class="([\w-]+)">((?:(?!<\/span>).)+?)<\/span>/g, (_m, cls, inner) => {
    const key = ph();
    inner = inner.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    blocks.push({ key, html: `<span class="${cls}">${inner}</span>` });
    return key;
  });

  // 5) 剩余的 **加粗**（也放进占位符，避免被第 6 步转义）
  text = text.replace(/\*\*(.+?)\*\*/g, (_m, inner) => {
    const key = ph();
    blocks.push({ key, html: `<strong>${escapeHtml(inner)}</strong>` });
    return key;
  });

  // 6) 转义剩余纯文本（占位符中的 NUL 不受影响）
  text = escapeHtml(text);

  // 7) 还原受保护片段（可能嵌套，如 **`深黯护盾`**；循环还原直到无残留）
  let result = text;
  const restoreOnce = () =>
    result.replace(/\x00RICH(y+)\x00/g, (_m, ys) => (blocks[ys.length - 1] ? blocks[ys.length - 1].html : _m));
  for (let guard = 0; guard <= blocks.length + 1; guard++) {
    const next = restoreOnce();
    if (next === result) break;
    result = next;
  }
  return result;
}
