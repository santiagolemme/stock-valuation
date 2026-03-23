// ─────────────────────────────────────────────────────────────────────────────
//  UI — initialization, navigation, helpers
// ─────────────────────────────────────────────────────────────────────────────

// ── DOM helpers ───────────────────────────────────────────────────────────────
const showEl    = id => { const e=document.getElementById(id); if(e) e.style.display='block'; };
const hideEl    = id => { const e=document.getElementById(id); if(e) e.style.display='none';  };
const setStatus = t  => { const e=document.getElementById('statusTxt'); if(e) e.textContent=t; };

function showError(msg) {
  const b = document.getElementById('errBox');
  if (b) { b.textContent='❌ '+msg; b.style.display='block'; }
}

// ── Format helpers ────────────────────────────────────────────────────────────
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

// ── Ticker UI ─────────────────────────────────────────────────────────────────
function initUI() {
  const allTickers    = Object.keys(DB);
  if (!allTickers.length) { showError('JSON vacío.'); return; }

  const mag7Available = MAG7.filter(t => DB[t]);
  const wlAvailable   = allTickers.filter(t => !MAG7.includes(t) && DB[t]);

  const sel = document.getElementById('tickerSelect');
  sel.innerHTML = `
    <option value="__compare__">📊 Tabla Comparativa</option>
    <optgroup label="── Mag 7 ──">
      ${mag7Available.map(t=>`<option value="${t}">${t} — ${DB[t].name||t}</option>`).join('')}
    </optgroup>` +
    (wlAvailable.length ? `
    <optgroup label="── Watchlist ──">
      ${wlAvailable.map(t=>`<option value="${t}">${t} — ${DB[t].name||t}</option>`).join('')}
    </optgroup>` : '');

  const firstFetched = DB[allTickers[0]]?.fetched_at;
  const lu = document.getElementById('lastUpdate');
  if (lu && firstFetched)
    lu.textContent = 'Actualizado: ' + new Date(firstFetched).toLocaleString('es-AR');

  document.getElementById('tickerSection').style.display = 'block';
  document.getElementById('paramsBar').style.display     = 'flex';
  hideEl('emptyState'); hideEl('loading');

  sel.value = '__compare__';
  renderComparison();
}

function onTickerSelect() {
  const t = document.getElementById('tickerSelect').value;
  if (t === '__compare__') renderComparison();
  else if (t) selectTicker(t);
}

function selectTicker(ticker) {
  currentTicker = ticker;
  const sel = document.getElementById('tickerSelect');
  if (sel) sel.value = ticker;
  document.getElementById('content').innerHTML = '';
  document.getElementById('errBox').style.display = 'none';
  render(ticker);
  window.scrollTo({ top:0, behavior:'smooth' });
}

function recalc() {
  const sel = document.getElementById('tickerSelect');
  if (sel?.value === '__compare__') renderComparison();
  else if (currentTicker) render(currentTicker);
}

// ── Read params from UI ───────────────────────────────────────────────────────
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

function yoyArr(arr) {
  return arr.map((_,i) => i===0 ? null : calcYoY(arr,i));
}
