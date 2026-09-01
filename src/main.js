import data from './data/bosses.json';
import colors from './content/colors.json';
import { renderRichText } from './renderer.js';

// DOM 元素引用
const versionTabsEl = document.getElementById('version-tabs');
const enemyGridEl = document.getElementById('enemy-grid');

// ---- 配置 ----
const GENSIN = colors.genshin || {};
const ELEMENT_ORDER = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];
const CURRENT_GAME_VERSION = '5.7';

// 默认版本
let currentVersion = CURRENT_GAME_VERSION;

// 卡片状态管理
const cardStates = {};

// 工具函数：转义 HTML
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 渲染珠子串版本导航
function renderVersionTabs() {
  versionTabsEl.innerHTML = '';
  const chain = document.createElement('div');
  chain.className = 'bead-chain';
  chain.setAttribute('role', 'tablist');

  data.forEach((versionData) => {
    const isActive = versionData.version === currentVersion;

    const btn = document.createElement('button');
    btn.className = 'bead' + (isActive ? ' active' : '');
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(isActive));
    btn.title = versionData.version;
    btn.innerHTML = `<span class="bead-dot"></span><span class="bead-tip">${escapeHtml(versionData.version)}</span>`;
    
    btn.addEventListener('click', () => {
      currentVersion = versionData.version;
      renderVersionTabs();
      renderEnemyCards();
    });
    
    chain.appendChild(btn);
  });

  versionTabsEl.appendChild(chain);
}

// 解析敌人技能数据
function parseEnemyContent(boss) {
  if (!boss.skills || boss.skills.length === 0) {
    return { mechanic: [], intro: [], detail: [] };
  }
  
  const skillText = boss.skills.join('\n');
  const parts = skillText.split('__SEP__').map(s => s.trim());
  
  // 每个部分都按行拆分为数组（对应每个 > 引用块）
  const toLines = (str) => (str ? str.split('\n').map(s => s.trim()).filter(Boolean) : []);
  
  return {
    mechanic: toLines(parts[0]),
    intro: toLines(parts[1]),
    detail: toLines(parts[2])
  };
}

// 通用板块化渲染：每个 > 引用块独立成小板块，标题行（**X**）单独高亮
function renderBlocks(lines) {
  if (!lines || lines.length === 0) return '<p class="empty-hint">暂无数据</p>';
  
  let html = '<div class="block-list">';
  
  lines.forEach((line) => {
    if (!line.trim()) return;
    
    // 标题行（纯加粗，如 **唤雷·坚盾** 或 **【模式】**）
    const isTitleLine = /^\*\*[^*]+\*\*$/.test(line.trim());
    
    if (isTitleLine) {
      const titleText = line.replace(/\*\*/g, '');
      html += `<div class="block block-title"><span class="block-title-mark"></span>${escapeHtml(titleText)}</div>`;
    } else {
      // 普通描述行：独立小板块
      html += `<div class="block block-text">${renderRichText(line)}</div>`;
    }
  });
  
  html += '</div>';
  return html;
}

// 渲染单个敌人卡片（正面：机制 / 背面：介绍+背景，点击翻面）
function createEnemyCard(boss, versionStr, index) {
  const cardStateKey = `${versionStr}-${index}`;
  
  if (!cardStates[cardStateKey]) {
    cardStates[cardStateKey] = {
      flipped: false // 是否翻到背面（介绍+背景）
    };
  }
  
  const state = cardStates[cardStateKey];
  const { mechanic, intro, detail } = parseEnemyContent(boss);
  
  const card = document.createElement('div');
  card.className = 'enemy-card' + (state.flipped ? ' flipped' : '');
  card.setAttribute('data-version', versionStr);
  card.setAttribute('data-index', index);
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `查看${boss.fullName || boss.shortName}的介绍与背景`);
  card.setAttribute('aria-expanded', String(state.flipped));
  card.setAttribute('tabindex', '0');
  
  // 图片路径修复
  let imgHtml;
  if (boss.imgMissing) {
    imgHtml = `
      <div class="image-placeholder">
        <div>🖼️ 图片待补充</div>
        <code>${escapeHtml(boss.imgLocal || '')}</code>
        <a href="${escapeHtml(boss.imgUrl)}" target="_blank" rel="noopener">获取链接</a>
      </div>
    `;
  } else {
    const imgPath = escapeHtml(boss.imgLocal);
    imgHtml = `<img src="${imgPath}" alt="${escapeHtml(boss.fullName || boss.shortName)}" loading="lazy" />`;
  }
  
  card.innerHTML = `
    <div class="flip-inner">
      <!-- 正面：机制 -->
      <div class="flip-face flip-front">
        <div class="enemy-image-container">
          ${imgHtml}
        </div>
        <div class="enemy-card-content">
          <div class="enemy-header">
            <h2 class="enemy-name">${escapeHtml(boss.fullName || boss.shortName)}</h2>
            <p class="enemy-hp">${escapeHtml(boss.hp)}</p>
          </div>
          <div class="face-title">机制</div>
          <div class="face-body">
            ${renderBlocks(mechanic)}
          </div>
        </div>
      </div>
      
      <!-- 背面：介绍 + 背景 -->
      <div class="flip-face flip-back">
        <div class="enemy-card-content">
          <div class="enemy-header">
            <h2 class="enemy-name">${escapeHtml(boss.shortName || boss.fullName)}</h2>
            <p class="enemy-hp">${escapeHtml(boss.hp)}</p>
          </div>
          <div class="face-title">介绍</div>
          <div class="face-body">
            ${intro.length ? renderBlocks(intro) : ''}
            ${detail.length ? `
              <div class="background-section">
                <button class="background-toggle" aria-expanded="false">
                  <span>背景</span>
                  <span class="bg-arrow">▾</span>
                </button>
                <div class="background-content">
                  ${renderBlocks(detail)}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
    <!-- 底部提示条：固定在卡片容器底部，跟随卡片高度变化 -->
    <div class="flip-hint">
      <span class="hint-front">点击翻面 · 查看介绍与背景</span>
      <span class="hint-back">点击返回 · 查看机制</span>
    </div>
  `;
  
  // 点击卡片翻面
  const flipCard = () => {
    state.flipped = !state.flipped;
    card.classList.toggle('flipped', state.flipped);
    card.setAttribute('aria-expanded', String(state.flipped));
  };
  card.addEventListener('click', flipCard);
  // 键盘支持：Enter / 空格触发翻面
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      flipCard();
    }
  });
  
  // 背景折叠（阻止冒泡，避免触发翻面；JS 精确控制 max-height 保证展开到内容完整高度）
  const bgToggle = card.querySelector('.background-toggle');
  if (bgToggle) {
    const bgContent = card.querySelector('.background-content');
    bgToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = bgToggle.getAttribute('aria-expanded') === 'true';
      if (!isOpen) {
        // 展开：设置 max-height 为内容的实际完整高度，卡片随背景自然变长
        bgContent.style.maxHeight = bgContent.scrollHeight + 'px';
        bgToggle.setAttribute('aria-expanded', 'true');
        bgToggle.classList.add('open');
        bgContent.classList.add('open');
      } else {
        // 收回：先固定当前高度再动画到 0，避免过渡跳动
        bgContent.style.maxHeight = bgContent.scrollHeight + 'px';
        requestAnimationFrame(() => {
          bgContent.style.maxHeight = '0px';
        });
        bgToggle.setAttribute('aria-expanded', 'false');
        bgToggle.classList.remove('open');
        setTimeout(() => bgContent.classList.remove('open'), 400);
      }
    });
  }
  
  return card;
}

// 渲染敌人卡片
function renderEnemyCards() {
  enemyGridEl.innerHTML = '';
  
  const versionData = data.find((v) => v.version === currentVersion);
  if (!versionData || !versionData.bosses || versionData.bosses.length === 0) {
    enemyGridEl.innerHTML = '<div class="empty-state"><p>该版本暂无数据</p></div>';
    return;
  }
  
  versionData.bosses.forEach((boss, index) => {
    const card = createEnemyCard(boss, versionData.version, index);
    enemyGridEl.appendChild(card);
  });
}

// 初始化
renderVersionTabs();
renderEnemyCards();

// ===== 顶部悬浮标题栏：鼠标移到顶部自动弹出（带回弹动画） =====
const headerEl = document.querySelector('.header');
const topTriggerEl = document.querySelector('.top-trigger');
let hideTimer = null;

function showHeader() {
  if (!headerEl) return;
  clearTimeout(hideTimer);
  headerEl.classList.add('show');
  document.body.classList.add('header-open');
}

function hideHeader() {
  if (!headerEl) return;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    headerEl.classList.remove('show');
    document.body.classList.remove('header-open');
  }, 300);
}

if (headerEl) {
  // 鼠标进入顶部感应条或悬浮栏区域 -> 弹出
  topTriggerEl && topTriggerEl.addEventListener('mouseenter', showHeader);
  headerEl.addEventListener('mouseenter', showHeader);
  // 鼠标移出悬浮栏 -> 收起
  headerEl.addEventListener('mouseleave', hideHeader);
  // 鼠标移到页面顶部（触发条区域外的小阈值）也弹出
  document.addEventListener('mousemove', (e) => {
    if (e.clientY < 12) showHeader();
  });
  // 触摸设备：点击触发条展开/收起
  topTriggerEl && topTriggerEl.addEventListener('click', () => {
    if (headerEl.classList.contains('show')) {
      hideHeader();
    } else {
      showHeader();
    }
  });
}
