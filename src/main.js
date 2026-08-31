import data from './data/bosses.json';
import colors from './content/colors.json';
import { renderRichText } from './renderer.js';

const tabsEl = document.getElementById('version-tabs');
const cardsEl = document.getElementById('boss-cards');

// ---- 从 colors.json 注入主题与元素颜色（改 colors.json 后重新 build 即可） ----
const GENSIN = colors.genshin || {};
const ELEMENT_ORDER = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];
const root = document.documentElement;
// 全局强调色：可改下面的引用，例如换成 'pyro' / 'cryo' 等
root.style.setProperty('--accent', GENSIN.hydro || '#0066cc');
ELEMENT_ORDER.forEach((name) => {
  if (GENSIN[name]) root.style.setProperty(`--el-${name}`, GENSIN[name]);
});

// 当前游戏版本：珠子串中会用特殊颜色标识，并作为默认打开时跳转的版本
const CURRENT_GAME_VERSION = '7.0';

// 默认打开时自动跳转到当前设置的版本号
let currentVersion = CURRENT_GAME_VERSION;

function renderTabs() {
  tabsEl.innerHTML = '';
  const chain = document.createElement('div');
  chain.className = 'bead-chain';
  chain.setAttribute('role', 'tablist');

  data.forEach((v) => {
    const isActive = v.version === currentVersion;
    const isCurrentGame = v.version === CURRENT_GAME_VERSION;

    const btn = document.createElement('button');
    btn.className =
      'bead' +
      (isActive ? ' active' : '') +
      (isCurrentGame ? ' current-game' : '');
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(isActive));
    btn.title = v.version;
    btn.innerHTML = `<span class="bead-dot"></span><span class="bead-tip">${escapeHtml(v.version)}</span>`;
    btn.addEventListener('click', () => {
      currentVersion = v.version;
      renderTabs();
      renderCards();
    });
    chain.appendChild(btn);
  });

  tabsEl.appendChild(chain);
}

function splitSkillGroups(skills) {
  // 将两组机制（用空引用行 __SEP__ 分隔）拆成两个列表
  const groups = [[]];
  for (const s of skills) {
    if (s === '__SEP__') {
      groups.push([]);
    } else if (s) {
      groups[groups.length - 1].push(s);
    }
  }
  return groups.filter((g) => g.length > 0);
}

function paraHtml(items) {
  if (!items || items.length === 0) return '';
  let html = '<div class="mech-list">';
  items.forEach((item) => {
    // 技能文本经富文本渲染：支持 <span class> 颜色、$…$ 行内数学、`…` 代码强调
    // 纯加粗名称行（**名称**）渲染为机制标题
    const isNameLine = /^\*\*[^*]+\*\*$/.test(item.trim());
    html += `<p${isNameLine ? ' class="mech-name"' : ''}>${renderRichText(item)}</p>`;
  });
  html += '</div>';
  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 读取当前生效的列数（与 CSS 断点保持一致，避免 JS 与样式不同步）
function getColumnCount() {
  const count = getComputedStyle(cardsEl).gridTemplateColumns.split(' ').length;
  return count >= 1 ? count : 3;
}

function renderCards() {
  const version = data.find((v) => v.version === currentVersion);
  if (!version) return;

  // 版本徽章（标题右上角小标签）
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.dataset.version = currentVersion;

  cardsEl.innerHTML = '';
  // 卡片交错进场动画计数器
  let order = 0;

  const cols = getColumnCount();
  // 记录每一列已用到的行号指针，实现「逐 Boss 分列」的列主序布局
  const colRows = new Array(cols).fill(1);

  version.bosses.forEach((boss, idx) => {
    const elName = ELEMENT_ORDER[idx % ELEMENT_ORDER.length];
    const elColor = GENSIN[elName] || '#0066cc';
    const groups = splitSkillGroups(boss.skills);

    // 每个 Boss 是一列（boss-col 用 display:contents，卡片直接参与父网格）
    const col = document.createElement('div');
    col.className = 'boss-col';
    col.style.setProperty('--el-color', elColor);

    // 图片：缺失时显示占位框
    let imgHtml;
    if (boss.imgMissing) {
      imgHtml = `
        <div class="img-placeholder">
          <span>🖼️ 待手动补充图片</span>
          <code>images/${escapeHtml(boss.imgLocal || '')}</code>
          <a href="${escapeHtml(boss.imgUrl)}" target="_blank" rel="noopener">原始链接</a>
        </div>`;
    } else {
      const imgPath = `/${encodeURI(boss.imgLocal)}`;
      imgHtml = `<img src="${imgPath}" alt="${escapeHtml(boss.fullName)}" loading="lazy" />`;
    }

    // 当前列：按列数循环分配（3/2/1 列），行号从该列当前指针继续，实现列主序分列
    const column = (idx % cols) + 1;
    let row = colRows[column - 1];

    // 卡片 1：图片 + 居中 Boss 名称 + 血量（第一行，弹性拉伸补齐列高）
    const identityCard = document.createElement('div');
    identityCard.className = 'card identity-card';
    identityCard.style.gridColumn = String(column);
    identityCard.style.gridRow = String(row);
    identityCard.style.setProperty('--order', String(order++));
    identityCard.innerHTML = `
      ${imgHtml}
      <div class="card-body">
        <h2 class="boss-name">${escapeHtml(boss.fullName || boss.shortName)}</h2>
        <p class="hp">${escapeHtml(boss.hp)}</p>
      </div>
    `;
    col.appendChild(identityCard);
    row += 1;

    // 机制卡片：每个分组一张卡片，自动按行排列（增删分组会自动增减卡片）
    groups.forEach((group) => {
      if (!group || !group.length) return;
      const mech = document.createElement('div');
      mech.className = 'card mech';
      mech.style.gridColumn = String(column);
      mech.style.gridRow = String(row);
      mech.style.setProperty('--order', String(order++));
      mech.innerHTML = paraHtml(group);
      col.appendChild(mech);
      row += 1;
    });

    // 记录该列已用到的行号，供后续分配到同一列的 Boss 使用
    colRows[column - 1] = row;

    cardsEl.appendChild(col);
  });
}

renderTabs();
renderCards();

// 窗口尺寸变化（跨过断点导致列数改变）时重新布局
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderCards, 120);
});
