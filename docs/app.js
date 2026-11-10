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
// exchangerate.host now requires an access key.  Use the public endpoint
// instead; it returns the same `rates` shape and supports CORS.
const API_URL = 'https://open.er-api.com/v6/latest';
const STORAGE_KEY = 'exrate_state';
const CACHE_KEY = 'exrate_rate_cache';

const state = {
  base: 'TWD',
  target: 'KRW',
  rate: 36,
  maxBase: 2000,
  vertical: true,
  controlsCollapsed: false,
  manualRate: false
};

const els = {
  baseCurrency: null,
  targetCurrency: null,
  rate: null,
  maxBase: null,
  controls: null,
  controlsToggle: null,
  controlFields: null,
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
    // Prevent the browser from serving an older successful response when the
    // user explicitly requests a fresh rate.
    const res = await fetch(
      `${API_URL}/${encodeURIComponent(base)}?t=${Date.now()}`,
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rate = data.rates && data.rates[target];
    if (data.result === 'success' && Number.isFinite(rate) && rate > 0) {
      return rate;
    }
  } catch (e) {
    console.warn('API fetch failed:', e);
  }
  return null;
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
    // The PWA is designed for portrait phones, so vertical mode is always on.
    state.vertical = true;
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

function setControlsCollapsed(collapsed) {
  state.controlsCollapsed = collapsed;
  els.controls.hidden = collapsed;
  els.controls.classList.toggle('collapsed', collapsed);
  els.controlFields.hidden = collapsed;
  els.controlsToggle.setAttribute('aria-expanded', String(!collapsed));
  els.controlsToggle.textContent = collapsed ? '開啟設定⌄' : '收起設定⌃';
}

function toggleControls() {
  setControlsCollapsed(!state.controlsCollapsed);
  saveState();
}

function renderRuler() {
  const svg = els.rulerSvg;
  const container = els.rulerContainer;
  const { base, target, rate, maxBase, vertical } = state;
  const maxTarget = maxBase * rate;

  const canvasWidth = vertical ? 360 : 920;
  const canvasHeight = vertical ? 720 : 160;
  const rulerLength = vertical ? 600 : 800;
  const rulerStart = vertical ? 60 : 60;
  const axisCenter = vertical ? canvasWidth / 2 : 50 + 30;

  svg.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);
  container.classList.toggle('vertical', vertical);

  svg.innerHTML = '';

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', 'var(--surface)');
  svg.appendChild(bg);

  const scaleFactor = rulerLength / maxTarget;

  const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  axis.setAttribute('x1', vertical ? axisCenter : rulerStart);
  axis.setAttribute('y1', vertical ? rulerStart : axisCenter);
  axis.setAttribute('x2', vertical ? axisCenter : rulerStart + rulerLength);
  axis.setAttribute('y2', vertical ? rulerStart + rulerLength : axisCenter);
  axis.setAttribute('stroke', 'black');
  axis.setAttribute('stroke-width', '2');
  svg.appendChild(axis);

  const baseScale = computeScale(maxBase);
  const targetScale = computeScale(maxTarget);

  drawScale(svg, axisCenter, rulerStart, rulerLength, scaleFactor, baseScale, rate, maxTarget, 'down', 10, vertical);
  drawScale(svg, axisCenter, rulerStart, rulerLength, scaleFactor, targetScale, 1, maxTarget, 'up', -10, vertical);
  drawEndpointLabel(svg, axisCenter, rulerStart, rulerLength, scaleFactor, maxTarget, vertical);

  drawCurrencyLabels(svg, axisCenter, rulerStart, rulerLength, base, target, vertical);
  drawTitle(svg, canvasWidth, canvasHeight, base, target, rate, vertical);
}

function drawEndpointLabel(svg, axisCenter, rulerStart, rulerLength, scaleFactor, value, vertical) {
  const tickLen = 15;
  const position = value * scaleFactor;
  if (position < 0 || position > rulerLength) return;

  const axisValue = vertical ? rulerStart + position : axisCenter;
  const tickX1 = vertical ? axisCenter : rulerStart + position;
  const tickY1 = vertical ? axisValue : axisCenter;
  const tickX2 = vertical ? axisCenter - tickLen : tickX1;
  const tickY2 = vertical ? axisValue : axisCenter - tickLen;
  const color = '#9ca3af';

  const endpointTick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  endpointTick.setAttribute('x1', tickX1);
  endpointTick.setAttribute('y1', tickY1);
  endpointTick.setAttribute('x2', tickX2);
  endpointTick.setAttribute('y2', tickY2);
  endpointTick.setAttribute('stroke', color);
  endpointTick.setAttribute('stroke-width', '1.5');
  svg.appendChild(endpointTick);

  const labelX = vertical ? axisCenter - tickLen - 28 : rulerStart + position;
  const labelY = vertical ? axisValue : axisCenter - tickLen - 10;
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', labelX);
  label.setAttribute('y', labelY);
  label.setAttribute('font-size', '10');
  label.setAttribute('fill', color);
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('dominant-baseline', vertical ? 'middle' : 'alphabetic');
  label.textContent = formatNumber(value);
  svg.appendChild(label);
}

function drawScale(svg, axisCenter, rulerStart, rulerLength, scaleFactor, scale, rateMult, maxTarget, direction, labelOffset, vertical) {
  const sign = direction === 'down' ? 1 : -1;
  const tickLen = 15;
  const minorTickLen = 8;
  // Keep labels horizontal in portrait mode so they can be read naturally
  // while holding the phone upright.
  const tickRotation = 0;

  scale.ticks.forEach(tick => {
    const position = tick * rateMult * scaleFactor;
    if (position > rulerLength) return;
    const x = vertical ? axisCenter : rulerStart + position;
    const y = vertical ? rulerStart + position : axisCenter;

    const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tickLine.setAttribute('x1', vertical ? axisCenter : x);
    tickLine.setAttribute('y1', vertical ? y : axisCenter);
    tickLine.setAttribute('x2', vertical ? axisCenter + sign * tickLen : x);
    tickLine.setAttribute('y2', vertical ? y : axisCenter + sign * tickLen);
    tickLine.setAttribute('stroke', 'black');
    tickLine.setAttribute('stroke-width', '1.5');
    svg.appendChild(tickLine);

    const labelDistance = vertical ? 28 : Math.abs(labelOffset);
    const labelX = vertical ? axisCenter + sign * (tickLen + labelDistance) : x;
    const labelY = vertical ? y : axisCenter + sign * (tickLen + Math.abs(labelOffset));
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', labelX);
    text.setAttribute('y', labelY);
    text.setAttribute('font-size', '10');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', vertical ? 'middle' : direction === 'down' ? 'auto' : 'alphabetic');
    text.textContent = formatNumber(tick);
    if (tickRotation) text.setAttribute('transform', `rotate(${tickRotation} ${labelX} ${labelY})`);
    svg.appendChild(text);
  });

  scale.minorTicks.forEach(tick => {
    const position = tick * rateMult * scaleFactor;
    if (position > rulerLength) return;
    const x = vertical ? axisCenter : rulerStart + position;
    const y = vertical ? rulerStart + position : axisCenter;
    const minorLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    minorLine.setAttribute('x1', vertical ? axisCenter : x);
    minorLine.setAttribute('y1', vertical ? y : axisCenter);
    minorLine.setAttribute('x2', vertical ? axisCenter + sign * minorTickLen : x);
    minorLine.setAttribute('y2', vertical ? y : axisCenter + sign * minorTickLen);
    minorLine.setAttribute('stroke', 'black');
    minorLine.setAttribute('stroke-width', '0.8');
    svg.appendChild(minorLine);
  });
}

function drawCurrencyLabels(svg, axisCenter, rulerStart, rulerLength, base, target, vertical) {
  if (vertical) {
    const labelY = rulerStart + rulerLength / 2;
    addCurrencyLabel(svg, axisCenter + 93, labelY, base, true);
    addCurrencyLabel(svg, axisCenter - 93, labelY, target, true);
    return;
  }

  const labelX = rulerStart - 15;
  const yCenter = axisCenter;
  addCurrencyLabel(svg, labelX, yCenter + 20, base, false);
  addCurrencyLabel(svg, labelX, yCenter - 20, target, false);
}

function addCurrencyLabel(svg, x, y, currency, vertical) {
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', x);
  label.setAttribute('y', y);
  label.setAttribute('font-size', '14');
  label.setAttribute('font-weight', 'bold');
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('dominant-baseline', 'middle');
  label.textContent = currency;
  svg.appendChild(label);
}

function drawTitle(svg, canvasWidth, canvasHeight, base, target, rate, vertical) {
  let titleY, subtitleY;
  if (vertical) {
    titleY = 22;
    subtitleY = 40;
  } else {
    titleY = 25;
    subtitleY = 42;
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

  // Always try the network first when the user explicitly synchronizes.
  // Cache and the hardcoded value are only fallbacks for offline/API failure.
  let rate = await fetchRate(base, target);
  let source = 'live';

  if (!rate) {
    rate = loadCachedRate(base, target);
    source = rate ? 'cache' : 'fallback';
  }

  if (!rate) {
    rate = FALLBACK_RATES[`${base}-${target}`] || 1;
  }

  if (rate) {
    state.rate = rate;
    state.manualRate = false;
    if (source === 'live') saveCachedRate(base, target, rate);
    els.rate.value = rate.toFixed(4);
    els.rateStatus.textContent = source === 'live'
      ? '即時匯率已同步'
      : source === 'cache'
        ? '網路無法連線，使用快取匯率'
        : '網路無法連線，使用備援匯率';
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

function onCurrencyChange(event) {
  const newBase = els.baseCurrency.value;
  const newTarget = els.targetCurrency.value;
  const previousBase = state.base;
  const previousTarget = state.target;

  if (newBase === newTarget) {
    // Selecting the other side's currency is a quick-swap gesture.
    if (event.target === els.baseCurrency) {
      state.base = newBase;
      state.target = previousBase;
    } else {
      state.base = previousTarget;
      state.target = newTarget;
    }
  } else {
    state.base = newBase;
    state.target = newTarget;
  }

  els.baseCurrency.value = state.base;
  els.targetCurrency.value = state.target;

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

function initElements() {
  els.baseCurrency = document.getElementById('baseCurrency');
  els.targetCurrency = document.getElementById('targetCurrency');
  els.rate = document.getElementById('rate');
  els.maxBase = document.getElementById('maxBase');
  els.controls = document.getElementById('controls');
  els.controlsToggle = document.getElementById('controlsToggle');
  els.controlFields = document.getElementById('controlFields');
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
  els.controlsToggle.addEventListener('click', toggleControls);
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
  setControlsCollapsed(state.controlsCollapsed);
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
