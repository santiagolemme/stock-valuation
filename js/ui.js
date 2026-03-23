// ─────────────────────────────────────────────────────────────────────────────
//  UI — initialization, navigation, dropdown, helpers
// ─────────────────────────────────────────────────────────────────────────────

const showEl    = id => { const e=document.getElementById(id); if(e) e.style.display='block'; };
const hideEl    = id => { const e=document.getElementById(id); if(e) e.style.display='none';  };
const setStatus = t  => { const e=document.getElementById('statusTxt'); if(e) e.textContent=t; };

function showError(msg) {
  const b = document.getElementById('errBox');
  if (b) { b.textContent='❌ '+msg; b.style.display='block'; }
}

const fm = (v, dec=0) => {
  if (v===null||v===undefined||isNaN(v)) return '—';
  return v.toLocaleString('es-AR', {minimumFractionDigits:dec, maximumFractionDigits:dec});
};
const fmM = v => {
  if (!v||isNaN(v)) return '—';
  const s=v<0?'-':'', a=Math.abs(v)/1e6;
  if(a>=1e6) return s+(a/1e6).toFixed(2)+'T';
  if(a>=1e3) return s+(a/1e3).toFixed(1)+'B';
  return s+a.toFixed(0)+'M';
};
const fmX       = v => v&&!isNaN(v) ? fm(v,1)+'x' : '—';
const formatDate = d => `${d.slice(6,8)}/${d.slice(4,6)}/${d.slice(0,4)}`;

// ── Selection state ───────────────────────────────────────────────────────────
let selectedTickers = [];
let sortState = { col: null, dir: -1 };

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('load', async () => {
  showEl('emptyState'); hideEl('loading'); hideEl('content');
  await loadWatchlist();

  if (IS_GITHUB) {
    showEl('loading'); hideEl('emptyState');
    setStatus('Cargando índice de datos...');
    try {
      const idx = await loadIndex();
      const sel = document.getElementById('dateSelect');
      idx.dates.forEach(d => {
        const o = document.createElement('option');
        o.value=d; o.textContent=formatDate(d); sel.appendChild(o);
      });
      document.getElementById('datePickerWrap').style.display = 'flex';
      document.getElementById('filePickerBtn').style.display  = 'none';
      if (idx.latest) { sel.value=idx.latest; await loadAndRender(idx.latest); }
    } catch(e) {
      hideEl('loading'); showEl('emptyState');
      showError('No se pudo cargar el índice: ' + e.message);
    }
  } else {
    hideEl('loading'); showEl('emptyState');
  }
});

// ── Build dropdown ────────────────────────────────────────────────────────────
function initUI() {
  const allTickers    = Object.keys(DB);
  if (!allTickers.length) { showError('JSON vacío.'); return; }

  const mag7Available = MAG7.filter(t => DB[t]);
  const wlAvailable   = allTickers.filter(t => !MAG7.includes(t) && DB[t]);

  document.getElementById('ddMag7Items').innerHTML =
    mag7Available.map(t => ddItem(t, DB[t].name||t)).join('');

  const wlEl = document.getElementById('ddWLItems');
  const wlLb = document.getElementById('ddWLLabel');
  if (wlAvailable.length) {
    wlEl.innerHTML = wlAvailable.map(t => ddItem(t, DB[t].name||t)).join('');
    wlLb.style.display = 'block';
  } else {
    wlLb.style.display = 'none';
  }

  const firstFetched = DB[allTickers[0]]?.fetched_at;
  const lu = document.getElementById('lastUpdate');
  if (lu && firstFetched)
    lu.textContent = 'Actualizado: ' + new Date(firstFetched).toLocaleString('es-AR');

  document.getElementById('tickerSection').style.display = 'block';
  document.getElementById('paramsBar').style.display     = 'flex';
  hideEl('emptyState'); hideEl('loading');

  selectedTickers = [];
  updateDropdownLabel();
  renderComparison();
}

function ddItem(ticker, name) {
  return `<label class="dd-item" id="ddItem_${ticker}">
    <input type="checkbox" id="chk_${ticker}"
      onchange="onTickerCheck('${ticker}', this.checked)"
      onclick="event.stopPropagation()">
    <span><strong>${ticker}</strong> <span style="color:#4b5563;font-size:.75rem">— ${name}</span></span>
  </label>`;
}

// ── Dropdown toggle ───────────────────────────────────────────────────────────
function toggleDropdown() {
  const menu = document.getElementById('ddMenu');
  const btn  = document.getElementById('ddBtn');
  const open = menu.style.display === 'none';
  menu.style.display = open ? 'block' : 'none';
  btn.classList.toggle('open', open);
}

document.addEventListener('click', e => {
  const wrap = document.getElementById('ddWrap');
  if (wrap && !wrap.contains(e.target)) closeDropdown();
});

function closeDropdown() {
  document.getElementById('ddMenu').style.display = 'none';
  document.getElementById('ddBtn').classList.remove('open');
}

// ── Confirm button inside dropdown ────────────────────────────────────────────
function confirmSelection() {
  closeDropdown();
  applySelection();
}

function applySelection() {
  document.getElementById('content').innerHTML = '';
  document.getElementById('errBox').style.display = 'none';

  if (selectedTickers.length === 0)      renderComparison();
  else if (selectedTickers.length === 1) render(selectedTickers[0]);
  else                                   renderCompare2(selectedTickers[0], selectedTickers[1]);

  window.scrollTo({ top:0, behavior:'smooth' });
}

// ── Ticker checkbox ───────────────────────────────────────────────────────────
function onTickerCheck(ticker, checked) {
  if (checked) {
    if (selectedTickers.length >= 2) {
      // Remove oldest
      const removed = selectedTickers.shift();
      const chk = document.getElementById('chk_'+removed);
      if (chk) chk.checked = false;
      document.getElementById('ddItem_'+removed)?.classList.remove('selected');
    }
    selectedTickers.push(ticker);
    document.getElementById('ddItem_'+ticker)?.classList.add('selected');
  } else {
    selectedTickers = selectedTickers.filter(t => t !== ticker);
    document.getElementById('ddItem_'+ticker)?.classList.remove('selected');
  }
  updateDropdownLabel();
  updateConfirmBtn();
}

function updateConfirmBtn() {
  const btn = document.getElementById('ddConfirmBtn');
  if (!btn) return;
  const n = selectedTickers.length;
  if (n === 0) {
    btn.textContent = '📊 Ver tabla comparativa';
    btn.style.background = '#1e3a5f';
    btn.style.color = '#60a5fa';
  } else if (n === 1) {
    btn.textContent = `🔍 Ver análisis de ${selectedTickers[0]}`;
    btn.style.background = '#14532d';
    btn.style.color = '#4ade80';
  } else {
    btn.textContent = `⚖️ Comparar ${selectedTickers[0]} vs ${selectedTickers[1]}`;
    btn.style.background = '#2d1b69';
    btn.style.color = '#a78bfa';
  }
}

function updateDropdownLabel() {
  const lbl = document.getElementById('ddLabel');
  if (!lbl) return;
  if (selectedTickers.length === 0)      lbl.textContent = '📊 Tabla Comparativa';
  else if (selectedTickers.length === 1) lbl.textContent = selectedTickers[0];
  else lbl.textContent = selectedTickers[0] + '  vs  ' + selectedTickers[1];
}

// ── "Tabla comparativa" option ────────────────────────────────────────────────
function selectCompare() {
  selectedTickers.forEach(t => {
    const chk = document.getElementById('chk_'+t);
    if (chk) chk.checked = false;
    document.getElementById('ddItem_'+t)?.classList.remove('selected');
  });
  selectedTickers = [];
  updateDropdownLabel();
  updateConfirmBtn();
  closeDropdown();
  renderComparison();
}

// ── Navigate from comparison table row ───────────────────────────────────────
function selectTicker(ticker) {
  selectedTickers.forEach(t => {
    const chk = document.getElementById('chk_'+t);
    if (chk) chk.checked = false;
    document.getElementById('ddItem_'+t)?.classList.remove('selected');
  });
  selectedTickers = [ticker];
  const chk = document.getElementById('chk_'+ticker);
  if (chk) chk.checked = true;
  document.getElementById('ddItem_'+ticker)?.classList.add('selected');
  updateDropdownLabel();
  updateConfirmBtn();
  document.getElementById('content').innerHTML = '';
  document.getElementById('errBox').style.display = 'none';
  render(ticker);
  window.scrollTo({ top:0, behavior:'smooth' });
}

function recalc() {
  if (selectedTickers.length === 0)      renderComparison();
  else if (selectedTickers.length === 1) render(selectedTickers[0]);
  else                                   renderCompare2(selectedTickers[0], selectedTickers[1]);
}

// ── Params ────────────────────────────────────────────────────────────────────
function getParams() {
  return {
    tPER:      +document.getElementById('t_per').value      || DEFAULTS.per,
    tEVCF:     +document.getElementById('t_evcf').value     || DEFAULTS.evcf,
    tEVEBITDA: +document.getElementById('t_evebitda').value || DEFAULTS.evebitda,
    tEVEBIT:   +document.getElementById('t_evebit').value   || DEFAULTS.evebit,
    growth:    (+document.getElementById('t_growth').value  || DEFAULTS.growth) / 100,
    wacc:      (+document.getElementById('t_wacc').value    || DEFAULTS.wacc)   / 100,
    termG:     DEFAULTS.termG / 100,
    PROJ:      DEFAULTS.projYears,
  };
}

// ── Y/Y helpers ───────────────────────────────────────────────────────────────
function calcYoY(arr, idx) {
  if (idx <= 0) return null;
  const curr=arr[idx], prev=arr[idx-1];
  if (prev===null||prev===undefined||prev===0) return null;
  if (curr === prev) {
    if (idx>=2 && arr[idx-2]!==null && arr[idx-2]!==0)
      return (prev/arr[idx-2]-1)*100;
    return null;
  }
  return (curr/prev-1)*100;
}
function yoyArr(arr) { return arr.map((_,i) => i===0?null:calcYoY(arr,i)); }
