// ─────────────────────────────────────────────────────────────────────────────
//  DATA — all fetch / load operations
// ─────────────────────────────────────────────────────────────────────────────

async function loadIndex() {
  const r = await fetch(`${DATA_BASE}/index.json`);
  if (!r.ok) throw new Error(`No se encontró index.json (HTTP ${r.status})`);
  return r.json();
}

async function loadFromGitHub(date) {
  const url = `${DATA_BASE}/magnificent7_${date}.json`;
  const r   = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo cargar el archivo para ${date} (HTTP ${r.status})`);
  return r.json();
}

async function loadWatchlist() {
  try {
    const base = IS_GITHUB
      ? `https://${GITHUB_USER}.github.io/${GITHUB_REPO}`
      : './data';
    const wl = await fetch(`${base}/watchlist.json`).then(r => r.json());
    MAG7      = wl.mag7      || [];
    WATCHLIST = wl.watchlist || [];
  } catch(e) {
    MAG7      = ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA'];
    WATCHLIST = [];
  }
}

function loadFile(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      DB = JSON.parse(e.target.result);
      initUI();
    } catch(err) {
      alert('Error al leer el JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

async function onDateChange() {
  const date = document.getElementById('dateSelect').value;
  if (date) await loadAndRender(date);
}

async function loadAndRender(date) {
  showEl('loading'); hideEl('content'); hideEl('emptyState');
  document.getElementById('errBox').style.display = 'none';
  setStatus(`Cargando datos del ${formatDate(date)}...`);
  try {
    DB = await loadFromGitHub(date);
    initUI();
  } catch(e) {
    showError('Error al cargar: ' + e.message);
    hideEl('loading'); showEl('emptyState');
  }
}
