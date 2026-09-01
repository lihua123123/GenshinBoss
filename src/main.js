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

// 渲染单个敌人卡片
function createEnemyCard(boss, versionStr, index) {
  const cardStateKey = `${versionStr}-${index}`;
  
  if (!cardStates[cardStateKey]) {
    cardStates[cardStateKey] = {
      tabIndex: 0 // 0=机制, 1=介绍
    };
  }
  
  const state = cardStates[cardStateKey];
  const { mechanic, intro, detail } = parseEnemyContent(boss);
  
  const card = document.createElement('div');
  card.className = 'enemy-card';
  card.setAttribute('data-version', versionStr);
  card.setAttribute('data-index', index);
  
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
    // 修复路径：直接使用文件名（文件在 dist 根目录）
    const imgPath = escapeHtml(boss.imgLocal);
    imgHtml = `<img src="${imgPath}" alt="${escapeHtml(boss.fullName || boss.shortName)}" loading="lazy" />`;
  }
  
  card.innerHTML = `
    <div class="enemy-image-container">
      ${imgHtml}
    </div>
    <div class="enemy-card-content">
      <div class="enemy-header">
        <h2 class="enemy-name">${escapeHtml(boss.fullName || boss.shortName)}</h2>
        <p class="enemy-hp">${escapeHtml(boss.hp)}</p>
      </div>
      
      <!-- 标签页切换 -->
      <div class="tabs-container">
        <button class="tab-btn ${state.tabIndex === 0 ? 'active' : ''}" data-tab="0">机制</button>
        <button class="tab-btn ${state.tabIndex === 1 ? 'active' : ''}" data-tab="1">介绍</button>
      </div>
      
      <!-- 机制标签页 -->
      <div class="tab-content ${state.tabIndex === 0 ? 'active' : ''}" data-tab="0">
        ${renderBlocks(mechanic)}
      </div>
      
      <!-- 介绍标签页（含可折叠背景） -->
      <div class="tab-content ${state.tabIndex === 1 ? 'active' : ''}" data-tab="1">
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
  `;
  
  // 标签页切换事件
  const tabBtns = card.querySelectorAll('.tab-btn');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabIndex = parseInt(btn.dataset.tab);
      state.tabIndex = tabIndex;
      
      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      
      card.querySelectorAll('.tab-content').forEach((content) => {
        content.classList.remove('active');
      });
      card.querySelector(`.tab-content[data-tab="${tabIndex}"]`).classList.add('active');
    });
  });
  
  // 背景折叠切换
  const bgToggle = card.querySelector('.background-toggle');
  if (bgToggle) {
    bgToggle.addEventListener('click', () => {
      const isOpen = bgToggle.getAttribute('aria-expanded') === 'true';
      const next = !isOpen;
      bgToggle.setAttribute('aria-expanded', String(next));
      bgToggle.classList.toggle('open', next);
      card.querySelector('.background-content').classList.toggle('open', next);
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
