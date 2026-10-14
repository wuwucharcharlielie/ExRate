const CURRENCIES = ['TWD', 'USD', 'JPY', 'KRW'];
const CURRENCY_NAMES = {
  TWD: '台幣',
  USD: '美金',
  JPY: '日圓',
  KRW: '韓元'
};
const FALLBACK_RATES = {
  'TWD-USD': 0.031, 'TWD-JPY': 4.7, 'TWD-KRW': 43.5,
  'USD-TWD': 32.3, 'USD-JPY': 151, 'USD-KRW': 1400,
  'JPY-TWD': 0.21, 'JPY-USD': 0.0066, 'JPY-KRW': 9.3,
  'KRW-TWD': 0.023, 'KRW-USD': 0.00071, 'KRW-JPY': 0.11
};
const API_URL = 'https://api.exchangerate.host/latest';
const STORAGE_KEY = 'exrate_state';
const CACHE_KEY = 'exrate_rate_cache';

const state = {
  base: 'TWD',
  target: 'KRW',
  rate: 36,
  maxBase: 2000,
  vertical: false,
  manualRate: false
};

const els = {
  baseCurrency: null,
  targetCurrency: null,
  rate: null,
  maxBase: null,
  verticalMode: null,
  syncRateBtn: null,
  rateStatus: null,
  rulerContainer: null,
  rulerSvg: null,
  infoBtn: null,
  infoDialog: null,
  closeDialog: null
};

function computeScale(maxValue, maxTicks = 10) {
  if (maxValue <= 0) return { step: 1, start: 0, end: 0, ticks: [0], minorTicks: [] };

  let rawStep = maxValue / maxTicks;
  const magnitude = rawStep >= 1 ? Math.pow(10, Math.floor(Math.log10(rawStep))) : 1;
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

  let step = 1;
  for (const c of candidates) {
    if (c * magnitude >= rawStep) {
      step = c * magnitude;
      break;
    }
    step = 1000 * magnitude;
  }

  while (maxValue / step > maxTicks) step *= 2;

  const start = 0;
  const numSteps = Math.ceil(maxValue / step);
  const end = step * numSteps;
  const ticks = [];
  for (let i = 0; i <= numSteps; i++) ticks.push(start + i * step);

  const minorTicks = [];
  for (let i = 0; i < ticks.length - 1; i++) {
    minorTicks.push(ticks[i] + step / 2);
  }

  return { step, start, end, ticks, minorTicks };
}

function formatNumber(n) {
  return Math.round(n).toLocaleString();
}

async function fetchRate(base, target) {
  try {
    const res = await fetch(`${API_URL}?base=${base}&symbols=${target}`);
    const data = await res.json();
    if (data.rates && data.rates[target]) {
      return data.rates[target];
    }
  } catch (e) {
    console.warn('API fetch failed:', e);
  }
  const key = `${base}-${target}`;
  return FALLBACK_RATES[key] || 1;
}

function loadCachedRate(base, target) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const key = `${base}-${target}`;
    if (cached[key] && Date.now() - cached[key].ts < 86400000) {
      return cached[key].rate;
    }
  } catch {}
  return null;
}

function saveCachedRate(base, target, rate) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cached[`${base}-${target}`] = { rate, ts: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {}
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    Object.assign(state, saved);
    if (!CURRENCIES.includes(state.base)) state.base = 'TWD';
    if (!CURRENCIES.includes(state.target)) state.target = 'KRW';
    if (state.base === state.target) state.target = state.base === 'TWD' ? 'KRW' : 'TWD';
  } catch {}
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function renderRuler() {
  const svg = els.rulerSvg;
  const container = els.rulerContainer;
  const { base, target, rate, maxBase, vertical } = state;
  const maxTarget = maxBase * rate;

  const config = { width: 800, height: 200, vertical };
  const marginLeft = 60, marginRight = 60, marginTop = 50, marginBottom = 50;
  const rulerHeight = 60;

  let canvasWidth = config.width + marginLeft + marginRight;
  let canvasHeight = marginTop + rulerHeight + marginBottom;

  if (vertical) {
    marginTop += 40;
    marginBottom += 20;
    canvasHeight = marginTop + rulerHeight + marginBottom;
  }

  svg.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);
  container.classList.toggle('vertical', vertical);

  svg.innerHTML = '';

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', 'white');
  svg.appendChild(bg);

  const xOffset = marginLeft;
  const yCenter = marginTop + rulerHeight / 2;
  const scaleFactor = config.width / maxTarget;

  const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  axis.setAttribute('x1', xOffset);
  axis.setAttribute('y1', yCenter);
  axis.setAttribute('x2', xOffset + config.width);
  axis.setAttribute('y2', yCenter);
  axis.setAttribute('stroke', 'black');
  axis.setAttribute('stroke-width', '2');
  svg.appendChild(axis);

  const baseScale = computeScale(maxBase);
  const targetScale = computeScale(maxTarget);

  drawScale(svg, xOffset, yCenter, scaleFactor, baseScale, rate, maxTarget, 'down', 10, base);
  drawScale(svg, xOffset, yCenter, scaleFactor, targetScale, 1, maxTarget, 'up', -10, target);

  drawCurrencyLabels(svg, xOffset, yCenter, base, target, vertical);
  drawTitle(svg, canvasWidth, marginTop, base, target, rate, vertical);
}

function drawScale(svg, xOffset, yCenter, scaleFactor, scale, rateMult, maxTarget, direction, labelOffset, currency) {
  const sign = direction === 'down' ? 1 : -1;
  const tickLen = 15;
  const minorTickLen = 8;
  const tickRotation = state.vertical ? -90 : 0;

  scale.ticks.forEach(tick => {
    const xPos = tick * rateMult * scaleFactor;
    if (xPos > scaleFactor * maxTarget / rateMult * rateMult) return;

    const x = xOffset + xPos;

    const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tickLine.setAttribute('x1', x);
    tickLine.setAttribute('y1', yCenter);
    tickLine.setAttribute('x2', x);
    tickLine.setAttribute('y2', yCenter + sign * tickLen);
    tickLine.setAttribute('stroke', 'black');
    tickLine.setAttribute('stroke-width', '1.5');
    svg.appendChild(tickLine);

    const labelY = yCenter + sign * (tickLen + Math.abs(labelOffset));
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', labelY);
    text.setAttribute('font-size', '10');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', direction === 'down' ? 'auto' : 'alphabetic');
    text.textContent = formatNumber(tick);
    if (tickRotation) text.setAttribute('transform', `rotate(${tickRotation} ${x} ${labelY})`);
    svg.appendChild(text);
  });

  scale.minorTicks.forEach(tick => {
    const xPos = tick * rateMult * scaleFactor;
    if (xPos > scaleFactor * maxTarget / rateMult * rateMult) return;

    const x = xOffset + xPos;
    const minorLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    minorLine.setAttribute('x1', x);
    minorLine.setAttribute('y1', yCenter);
    minorLine.setAttribute('x2', x);
    minorLine.setAttribute('y2', yCenter + sign * minorTickLen);
    minorLine.setAttribute('stroke', 'black');
    minorLine.setAttribute('stroke-width', '0.8');
    svg.appendChild(minorLine);
  });
}

function drawCurrencyLabels(svg, xOffset, yCenter, base, target, vertical) {
  const labelX = xOffset - 15;
  let baseY, targetY;

  if (vertical) {
    baseY = yCenter + 30;
    targetY = yCenter - 30;
  } else {
    baseY = yCenter + 20;
    targetY = yCenter - 20;
  }

  const baseLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  baseLabel.setAttribute('x', labelX);
  baseLabel.setAttribute('y', baseY);
  baseLabel.setAttribute('font-size', '14');
  baseLabel.setAttribute('font-weight', 'bold');
  baseLabel.setAttribute('text-anchor', 'end');
  baseLabel.setAttribute('dominant-baseline', 'middle');
  baseLabel.textContent = base;
  if (vertical) baseLabel.setAttribute('transform', `rotate(-90 ${labelX} ${baseY})`);
  svg.appendChild(baseLabel);

  const targetLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  targetLabel.setAttribute('x', labelX);
  targetLabel.setAttribute('y', targetY);
  targetLabel.setAttribute('font-size', '14');
  targetLabel.setAttribute('font-weight', 'bold');
  targetLabel.setAttribute('text-anchor', 'end');
  targetLabel.setAttribute('dominant-baseline', 'middle');
  targetLabel.textContent = target;
  if (vertical) targetLabel.setAttribute('transform', `rotate(-90 ${labelX} ${targetY})`);
  svg.appendChild(targetLabel);
}

function drawTitle(svg, canvasWidth, marginTop, base, target, rate, vertical) {
  let titleY, subtitleY;
  if (vertical) {
    titleY = marginTop - 40;
    subtitleY = marginTop - 22;
  } else {
    titleY = marginTop - 25;
    subtitleY = marginTop - 10;
  }

  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', canvasWidth / 2);
  title.setAttribute('y', titleY);
  title.setAttribute('font-size', '16');
  title.setAttribute('font-weight', 'bold');
  title.setAttribute('text-anchor', 'middle');
  title.textContent = `${base} / ${target}  匯率尺`;
  svg.appendChild(title);

  const subtitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  subtitle.setAttribute('x', canvasWidth / 2);
  subtitle.setAttribute('y', subtitleY);
  subtitle.setAttribute('font-size', '11');
  subtitle.setAttribute('fill', 'gray');
  subtitle.setAttribute('text-anchor', 'middle');
  subtitle.textContent = `1 ${base} = ${rate.toFixed(4)} ${target}`;
  svg.appendChild(subtitle);
}

async function syncRate() {
  const { base, target } = state;
  els.syncRateBtn.disabled = true;
  els.syncRateBtn.classList.add('syncing');
  els.rateStatus.textContent = '同步中...';
  els.rateStatus.classList.remove('manual');

  const cached = loadCachedRate(base, target);
  let rate = cached;

  if (!rate) {
    rate = await fetchRate(base, target);
  }

  if (rate) {
    state.rate = rate;
    state.manualRate = false;
    saveCachedRate(base, target, rate);
    els.rate.value = rate.toFixed(4);
    els.rateStatus.textContent = '即時匯率已同步';
  } else {
    els.rateStatus.textContent = '同步失敗，使用預設值';
  }

  els.syncRateBtn.disabled = false;
  els.syncRateBtn.classList.remove('syncing');
  renderRuler();
  saveState();
}

function onRateChange() {
  const val = parseFloat(els.rate.value);
  if (!isNaN(val) && val > 0) {
    state.rate = val;
    state.manualRate = true;
    els.rateStatus.textContent = '手動模式 - 點擊 🔄 恢復自動';
    els.rateStatus.classList.add('manual');
    renderRuler();
    saveState();
  }
}

function onCurrencyChange() {
  const newBase = els.baseCurrency.value;
  const newTarget = els.targetCurrency.value;

  if (newBase === newTarget) {
    const other = CURRENCIES.find(c => c !== newBase);
    if (newBase === state.base) {
      els.targetCurrency.value = other;
      state.target = other;
    } else {
      els.baseCurrency.value = other;
      state.base = other;
    }
  } else {
    state.base = newBase;
    state.target = newTarget;
  }

  state.manualRate = false;
  syncRate();
  saveState();
}

function onMaxBaseChange() {
  const val = parseInt(els.maxBase.value, 10);
  if (!isNaN(val) && val > 0) {
    state.maxBase = val;
    renderRuler();
    saveState();
  }
}

function onVerticalChange() {
  state.vertical = els.verticalMode.checked;
  renderRuler();
  saveState();
}

function initElements() {
  els.baseCurrency = document.getElementById('baseCurrency');
  els.targetCurrency = document.getElementById('targetCurrency');
  els.rate = document.getElementById('rate');
  els.maxBase = document.getElementById('maxBase');
  els.verticalMode = document.getElementById('verticalMode');
  els.syncRateBtn = document.getElementById('syncRateBtn');
  els.rateStatus = document.getElementById('rateStatus');
  els.rulerContainer = document.getElementById('rulerContainer');
  els.rulerSvg = document.getElementById('rulerSvg');
  els.infoBtn = document.getElementById('infoBtn');
  els.infoDialog = document.getElementById('infoDialog');
  els.closeDialog = document.getElementById('closeDialog');
}

function bindEvents() {
  els.baseCurrency.addEventListener('change', onCurrencyChange);
  els.targetCurrency.addEventListener('change', onCurrencyChange);
  els.rate.addEventListener('change', onRateChange);
  els.rate.addEventListener('input', () => {
    const val = parseFloat(els.rate.value);
    if (!isNaN(val) && val > 0) {
      state.rate = val;
      renderRuler();
    }
  });
  els.maxBase.addEventListener('change', onMaxBaseChange);
  els.verticalMode.addEventListener('change', onVerticalChange);
  els.syncRateBtn.addEventListener('click', syncRate);
  els.infoBtn.addEventListener('click', () => els.infoDialog.showModal());
  els.closeDialog.addEventListener('click', () => els.infoDialog.close());
  els.infoDialog.addEventListener('click', (e) => {
    if (e.target === els.infoDialog) els.infoDialog.close();
  });
}

function applyState() {
  els.baseCurrency.value = state.base;
  els.targetCurrency.value = state.target;
  els.maxBase.value = state.maxBase;
  els.verticalMode.checked = state.vertical;
  if (state.manualRate) {
    els.rateStatus.textContent = '手動模式 - 點擊 🔄 恢復自動';
    els.rateStatus.classList.add('manual');
  }
  els.rate.value = state.rate.toFixed(4);
}

async function init() {
  initElements();
  loadState();
  applyState();
  bindEvents();
  renderRuler();

  if (!state.manualRate) {
    await syncRate();
  }
}

document.addEventListener('DOMContentLoaded', init);