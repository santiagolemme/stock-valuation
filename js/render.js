// ─────────────────────────────────────────────────────────────────────────────
//  RENDER — single ticker detail + comparison table + 2-ticker compare
// ─────────────────────────────────────────────────────────────────────────────

function render(ticker) {
  const d = DB[ticker];
  if (!d) return;
  const hist = d.historical || [];
  const N    = hist.length;
  if (!N) { alert('Sin datos para ' + ticker); return; }

  const p = getParams();
  const { tPER, tEVCF, tEVEBITDA, tEVEBIT, growth, wacc, termG, PROJ } = p;

  const price    = d.price      || 0;
  const prev     = d.prev_close || price;
  const chg      = price - prev;
  const chgPct   = prev ? (chg/prev)*100 : 0;
  const mktCap   = d.mkt_cap    || 0;
  const shares   = d.shares     || 1;
  const currency = d.currency   || 'USD';

  const histYears = hist.map(r => r.year);
  const hRev    = hist.map(r => r.revenue    || 0);
  const hEbitda = hist.map(r => r.ebitda     || 0);
  const hEbit   = hist.map(r => r.ebit       || 0);
  const hNI     = hist.map(r => r.net_income || 0);
  const hFCF    = hist.map(r => r.fcf        || 0);
  const hEPS    = hist.map(r => r.eps        || 0);
  const hND     = hist.map(r => r.net_debt   || 0);

  const lastRev    = hRev[N-1],    lastEbitda = hEbitda[N-1];
  const lastEbit   = hEbit[N-1],   lastNI     = hNI[N-1];
  const lastFCF    = hFCF[N-1],    lastEPS    = hEPS[N-1];
  const curNetDebt = hND[N-1];
  const ev         = mktCap + curNetDebt;

  const mPER      = lastNI     ? mktCap / lastNI     : 0;
  const mEVCF     = lastFCF    ? ev     / lastFCF    : 0;
  const mEVEBITDA = lastEbitda ? ev     / lastEbitda : 0;
  const mEVEBIT   = lastEbit   ? ev     / lastEbit   : 0;

  const lastYearRaw = histYears[N-1];
  const lastYear    = parseInt(String(lastYearRaw).match(/\d{4}/)?.[0] || lastYearRaw);
  const projYears   = Array.from({length:PROJ}, (_,i) => lastYear+i+1);
  const proj        = base => Array.from({length:PROJ}, (_,i) => base*(1+growth)**(i+1));

  const pRev=proj(lastRev), pEbitda=proj(lastEbitda), pEbit=proj(lastEbit);
  const pNI=proj(lastNI),   pFCF=proj(lastFCF),       pEPS=proj(lastEPS);

  const sh     = shares || 1;
  const ivPER  = pNI.map(v    => (v*tPER) / sh);
  const ivEVCF = pFCF.map(v   => (v*tEVCF - curNetDebt) / sh);
  const ivAvg  = ivPER.map((_,i) => (ivPER[i]+ivEVCF[i])/2);

  const pvFCF    = pFCF.reduce((s,v,i) => s+v/(1+wacc)**(i+1), 0);
  const terminal = pFCF[PROJ-1]*(1+termG)/(wacc-termG);
  const dcfPrice = (pvFCF+terminal/(1+wacc)**PROJ-curNetDebt)/sh;

  const allYears  = [...histYears, ...projYears.map(y=>y+'e')];
  const allRev    = [...hRev,    ...pRev];
  const allEbitda = [...hEbitda, ...pEbitda];
  const allEbit   = [...hEbit,   ...pEbit];
  const allNI     = [...hNI,     ...pNI];
  const allFCF    = [...hFCF,    ...pFCF];
  const allEPS    = [...hEPS,    ...pEPS];
  const allND     = [...hND,     ...Array(PROJ).fill(curNetDebt)];

  const revYoY        = yoyArr(allRev);
  const epsYoY        = yoyArr(allEPS);
  const ebitMargin    = allRev.map((v,i)    => v ? allEbit[i]/v*100   : null);
  const netMargin     = allRev.map((v,i)    => v ? allNI[i]/v*100     : null);
  const roic          = allEbit.map((v,i)   => { const evN=mktCap+allND[i]; return evN?v/evN*100:null; });
  const debtEbitdaArr = allEbitda.map((v,i) => v ? allND[i]/v         : null);
  const fcfNIArr      = allNI.map((v,i)     => v ? allFCF[i]/v        : null);

  const allHistPrice  = [...hist.map(r=>r.hist_price||null), ...Array(PROJ).fill(null)];
  allHistPrice[N-1]   = price;

  const perAll = allYears.map((_,i) => {
    const eps=allEPS[i]; if(!eps) return null;
    if(i<N) { const p=allHistPrice[i]; return p?p/eps:null; }
    return ivPER[i-N]/eps;
  });

  const histPERs = hist.slice(0,N-1)
    .map((r,i) => { const hp=r.hist_price||null; return hp&&hEPS[i]?hp/hEPS[i]:null; })
    .filter(v => v&&v>0&&v<200);
  const avgHistPER    = histPERs.length ? histPERs.reduce((s,v)=>s+v,0)/histPERs.length : null;
  const currentPER    = lastEPS ? price/lastEPS : null;
  const cheapVsHist   = avgHistPER&&currentPER ? currentPER<avgHistPER  : false;
  const cheapVsTarget = currentPER ? currentPER<tPER : false;
  const isCheap       = cheapVsHist&&cheapVsTarget;

  const ttmRevGrowth   = calcYoY(hRev, N-1);
  const ttmFCFGrowth   = calcYoY(hFCF, N-1);
  const ttmEPSGrowth   = calcYoY(hEPS, N-1);
  const currEBITMargin = hRev[N-1] ? hEbit[N-1]/hRev[N-1]*100 : null;
  const prevEBITMargin = hRev[N-2] ? hEbit[N-2]/hRev[N-2]*100 : null;

  const checks = {
    revenueGrowth: ttmRevGrowth!==null  ? ttmRevGrowth>0  : false,
    ebitMargin:    (currEBITMargin!==null&&prevEBITMargin!==null) ? currEBITMargin>=prevEBITMargin*0.97 : false,
    fcfGrowth:     ttmFCFGrowth!==null  ? (hFCF[N-1]>0&&ttmFCFGrowth>0) : false,
    epsGrowth:     ttmEPSGrowth!==null  ? ttmEPSGrowth>0  : false,
  };
  const healthyCount = Object.values(checks).filter(Boolean).length;
  const isHealthy    = healthyCount >= 3;

  let vClass, vIcon, vLabel, vDesc;
  if      (isCheap&&isHealthy)  { vClass='buy';   vIcon='🟢'; vLabel='COMPRA';                    vDesc=`PER actual (${fm(currentPER,1)}x) por debajo del histórico (${fm(avgHistPER,1)}x) y objetivo. Fundamentals sólidos (${healthyCount}/4).`; }
  else if (isCheap&&!isHealthy) { vClass='watch'; vIcon='👀'; vLabel='ATENCIÓN — Precio atractivo'; vDesc=`PER bajo vs histórico pero fundamentals débiles (${healthyCount}/4 indicadores saludables).`; }
  else if (!isCheap&&isHealthy) { vClass='hold';  vIcon='⏸️'; vLabel='MANTENER — Empresa sólida';  vDesc=`Fundamentals excelentes (${healthyCount}/4) pero PER actual (${fm(currentPER,1)}x) por encima del objetivo (${fm(tPER,1)}x).`; }
  else                           { vClass='sell';  vIcon='🔴'; vLabel='CARA / EVITAR';              vDesc=`PER elevado vs histórico y objetivo. Fundamentals débiles (${healthyCount}/4).`; }

  const thCols = allYears.map((y,i)=>`<th class="${i>=N?'est':''}">${y}</th>`).join('');

  const metricRow = (lbl, vals, div=1e6, dec=0, hl=false) =>
    `<tr class="${hl?'hl':''}"><td>${lbl}</td>${
      vals.map((v,i)=>{const dv=v/div;return `<td class="${i>=N?'est est-bg':''} ${dv<0?'red-v':''}">${fm(dv,dec)}</td>`;}).join('')
    }</tr>`;

  const ivRowHtml = (lbl, arr, isAvg=false) => {
    const cagr=price&&arr[4]?((arr[4]/price)**(1/5)-1)*100:0;
    const cc=cagr>12?'#4ade80':cagr>6?'#fbbf24':'#f87171';
    return `<tr class="${isAvg?'avg-row':''}">
      <td>${lbl}</td>
      ${arr.map(v=>`<td class="${isAvg?'':'est est-bg'}" style="${isAvg?'color:#fbbf24;font-weight:700':''}">${fm(v,2)}</td>`).join('')}
      <td style="color:${cc};font-weight:700">${fm(cagr,1)}%</td>
    </tr>`;
  };

  const msRowHtml = () => `<tr class="ms-row"><td>Margen de Seguridad</td>${
    ivAvg.map(v=>{const ms=price?(v/price-1)*100:0;return `<td style="color:${ms>0?'#4ade80':'#f87171'};font-weight:600">${ms>0?'+':''}${fm(ms,0)}%</td>`;}).join('')
  }<td>—</td></tr>`;

  const qualityRow = (lbl, vals, isPct=false, dec=1, isPrice=false) => {
    const cells = vals.map((v,i) => {
      if(v===null||v===undefined||isNaN(v)) return `<td class="${i>=N?'est-bg':''}">—</td>`;
      const isEst=i>=N;
      let color='';
      if(isPct) color=v>=0?'#4ade80':'#f87171';
      if(isPrice&&isEst) color='#4b5563';
      const txt=isPct?(v>=0?'+':'')+fm(v,dec)+'%':fm(v,dec);
      return `<td class="${isEst?'est est-bg':''}" style="${color?'color:'+color+';font-weight:600':''}">${txt}</td>`;
    }).join('');
    return `<tr><td>${lbl}</td>${cells}</tr>`;
  };

  document.getElementById('content').innerHTML = `
    <div class="s-header">
      <div class="s-title">
        <h2>${ticker} — ${d.name||ticker}</h2>
        <div class="sub">${[d.sector,d.industry,d.exchange,currency].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="price-card">
        <div class="price">${fm(price,2)} ${currency}</div>
        <div class="chg ${chg>=0?'pos':'neg-c'}">${chg>=0?'▲':'▼'} ${fm(Math.abs(chg),2)} (${fm(Math.abs(chgPct),2)}%)</div>
      </div>
    </div>

    <div class="kpi-strip">
      <div class="kpi"><div class="kl">Market Cap</div><div class="kv">${fmM(mktCap)}</div></div>
      <div class="kpi"><div class="kl">EV</div><div class="kv">${fmM(ev)}</div></div>
      <div class="kpi"><div class="kl">Net Debt</div><div class="kv" style="color:${curNetDebt<0?'#4ade80':'#f87171'}">${fmM(curNetDebt)}</div></div>
      <div class="kpi"><div class="kl">PER LTM</div><div class="kv">${fmX(mPER)}</div></div>
      <div class="kpi"><div class="kl">EV/EBITDA</div><div class="kv">${fmX(mEVEBITDA)}</div></div>
      <div class="kpi"><div class="kl">EV/FCF</div><div class="kv">${fmX(mEVCF)}</div></div>
      <div class="kpi"><div class="kl">EV/EBIT</div><div class="kv">${fmX(mEVEBIT)}</div></div>
      <div class="kpi"><div class="kl">Beta</div><div class="kv">${fm(d.beta||0,2)}</div></div>
      <div class="kpi"><div class="kl">Fwd PE</div><div class="kv">${fmX(d.fwd_pe)}</div></div>
      <div class="kpi"><div class="kl">52W High</div><div class="kv">${fm(d.week52h||0,2)}</div></div>
      <div class="kpi"><div class="kl">52W Low</div><div class="kv">${fm(d.week52l||0,2)}</div></div>
      <div class="kpi"><div class="kl">Div. Yield</div><div class="kv">${d.div_yield?(d.div_yield*100).toFixed(2)+'%':'—'}</div></div>
    </div>

    <div class="verdict ${vClass}">
      <div class="v-top"><div class="v-icon">${vIcon}</div>
        <div class="v-text"><h3>${vLabel}</h3><p>${vDesc}</p></div>
      </div>
      <div class="scorecard">
        <span class="sc-item ${checks.revenueGrowth?'sc-green':'sc-red'}">${checks.revenueGrowth?'✅':'❌'} Revenue ${ttmRevGrowth!==null?(ttmRevGrowth>=0?'+':'')+fm(ttmRevGrowth,1)+'%':'—'}</span>
        <span class="sc-item ${checks.ebitMargin?'sc-green':'sc-red'}">${checks.ebitMargin?'✅':'❌'} EBIT Margin ${fm(currEBITMargin,1)}%</span>
        <span class="sc-item ${checks.fcfGrowth?'sc-green':'sc-red'}">${checks.fcfGrowth?'✅':'❌'} FCF ${ttmFCFGrowth!==null?(ttmFCFGrowth>=0?'+':'')+fm(ttmFCFGrowth,1)+'%':'—'}</span>
        <span class="sc-item ${checks.epsGrowth?'sc-green':'sc-red'}">${checks.epsGrowth?'✅':'❌'} EPS ${ttmEPSGrowth!==null?(ttmEPSGrowth>=0?'+':'')+fm(ttmEPSGrowth,1)+'%':'—'}</span>
      </div>
      <div class="per-badges">
        <span class="per-badge">PER actual: ${fm(currentPER,1)}x</span>
        <span class="per-badge ${cheapVsHist?'sc-green':'sc-red'}">${cheapVsHist?'✅':'❌'} vs histórico avg: ${fm(avgHistPER,1)}x</span>
        <span class="per-badge ${cheapVsTarget?'sc-green':'sc-red'}">${cheapVsTarget?'✅':'❌'} vs objetivo: ${fm(tPER,1)}x</span>
      </div>
    </div>

    <div class="sec-title">Métricas de Calidad — Evolución Histórica</div>
    <div class="t-wrap"><table>
      <thead><tr><th>Métrica</th>${thCols}</tr></thead>
      <tbody>
        ${qualityRow('Revenue Y/Y %',   revYoY,        true)}
        ${qualityRow('EBIT Margin %',   ebitMargin,    false)}
        ${qualityRow('Net Margin %',    netMargin,     false)}
        ${qualityRow('ROIC %',          roic,          false)}
        ${qualityRow('Deuda / EBITDA',  debtEbitdaArr, false, 1)}
        ${qualityRow('FCF / Net Income',fcfNIArr,      false, 2)}
        <tr><td colspan="${1+allYears.length}" style="padding:4px 11px;background:#111827;color:#4b5563;font-size:.72rem;letter-spacing:.5px;text-transform:uppercase">Precio · EPS · PER</td></tr>
        ${qualityRow('Precio',          allHistPrice,  false, 2, true)}
        ${qualityRow('EPS',             allEPS,        false, 2)}
        ${qualityRow('EPS Y/Y %',       epsYoY,        true)}
        ${qualityRow('PER',             perAll,        false, 1)}
      </tbody>
    </table></div>

    <div class="sec-title">Estado de Resultados (millones ${currency})</div>
    <div class="t-wrap"><table>
      <thead><tr><th>Métrica</th>${thCols}</tr></thead>
      <tbody>
        ${metricRow('Revenue',    allRev)}
        ${metricRow('EBITDA',     allEbitda)}
        ${metricRow('EBIT',       allEbit)}
        ${metricRow('Net Income', allNI, 1e6, 0, true)}
        ${metricRow('FCF',        allFCF)}
        ${metricRow('EPS (USD)',  allEPS, 1, 2)}
        ${metricRow('Net Debt',   allND)}
      </tbody>
    </table></div>

    <div class="sec-title">Valoración por Múltiplos</div>
    <div class="grid2">
      <div class="box">
        <h3>PER — Precio / EPS TTM</h3>
        <div class="mrow"><span class="ml">EPS TTM</span><span class="mv">${fm(lastEPS,2)} ${currency}</span></div>
        <div class="mrow"><span class="ml">PER actual</span><span style="color:${mPER>tPER?'#f87171':'#4ade80'};font-weight:700;font-size:1.1rem">${fmX(mPER)}</span></div>
        <div class="mrow"><span class="ml">PER objetivo</span><span class="mt">${fm(tPER,1)}x</span></div>
        <div class="mrow"><span class="ml">Precio justo (PER obj.)</span><span style="color:#4ade80;font-weight:700;font-size:1.1rem">${fm(lastEPS*tPER,2)} ${currency}</span></div>
        <div class="mrow"><span class="ml">Diferencia vs precio actual</span>
          <span style="color:${(lastEPS*tPER)>=price?'#4ade80':'#f87171'};font-weight:700">${fm((lastEPS*tPER/price-1)*100,1)}%</span>
        </div>
      </div>
      <div class="box">
        <h3>EV/FCF — Actual vs Objetivo</h3>
        <div class="mrow"><span class="ml">FCF TTM</span><span class="mv">${fmM(lastFCF)}</span></div>
        <div class="mrow"><span class="ml">EV actual</span><span class="mv">${fmM(ev)}</span></div>
        <div class="mrow"><span class="ml">EV/FCF actual</span><span style="color:${mEVCF>tEVCF?'#f87171':'#4ade80'};font-weight:700;font-size:1.1rem">${fmX(mEVCF)}</span></div>
        <div class="mrow"><span class="ml">EV/FCF objetivo</span><span class="mt">${fm(tEVCF,1)}x</span></div>
        <div class="mrow"><span class="ml">Diferencia</span>
          <span style="color:${mEVCF<=tEVCF?'#4ade80':'#f87171'};font-weight:700">${mEVCF&&tEVCF?fm(mEVCF-tEVCF,1)+'x':'—'}</span>
        </div>
      </div>
    </div>

    <div class="sec-title">Precio Objetivo Proyectado (${currency} / acción)</div>
    <div class="t-wrap"><table>
      <thead><tr>
        <th>Método</th>
        ${projYears.map(y=>`<th class="est">${y}e</th>`).join('')}
        <th style="color:#60a5fa">CAGR 5a</th>
      </tr></thead>
      <tbody>
        ${ivRowHtml('PER × '+tPER,         ivPER)}
        ${ivRowHtml('EV/FCF × '+tEVCF,     ivEVCF)}
        ${ivRowHtml('⭐ PROMEDIO PER+FCF',  ivAvg, true)}
        ${msRowHtml()}
      </tbody>
    </table></div>

    <div class="grid2">
      <div class="box">
        <h3>DCF — Discounted Cash Flow</h3>
        <div class="mrow"><span class="ml">WACC</span><span class="mv">${fm(wacc*100,1)}%</span></div>
        <div class="mrow"><span class="ml">Terminal Growth</span><span class="mv">${fm(termG*100,1)}%</span></div>
        <div class="mrow"><span class="ml">FCF base (TTM)</span><span class="mv">${fmM(lastFCF)}</span></div>
        <div class="mrow"><span class="ml">Valor Intrínseco DCF</span><span style="color:#4ade80;font-size:1.1rem;font-weight:700">${fm(dcfPrice,2)} ${currency}</span></div>
        <div class="mrow"><span class="ml">Potencial DCF</span>
          <span style="color:${dcfPrice>price?'#4ade80':'#f87171'};font-weight:700">${price?fm((dcfPrice/price-1)*100,1)+'%':'—'}</span>
        </div>
      </div>
      <div class="box">
        <h3>Resumen</h3>
        <div class="mrow"><span class="ml">Precio actual</span><span class="mv">${fm(price,2)} ${currency}</span></div>
        <div class="mrow"><span class="ml">Precio justo PER</span><span class="mv">${fm(lastEPS*tPER,2)}</span></div>
        <div class="mrow"><span class="ml">IV PER año 5</span><span class="mv">${fm(ivPER[4],2)}</span></div>
        <div class="mrow"><span class="ml">IV EV/FCF año 5</span><span class="mv">${fm(ivEVCF[4],2)}</span></div>
        <div class="mrow"><span class="ml">DCF</span><span class="mv">${fm(dcfPrice,2)}</span></div>
      </div>
    </div>

    <div class="sec-title">📈 Análisis Visual</div>
    <div class="charts-grid">
      <div class="chart-wrap"><h3>Revenue Anual (M)</h3><canvas id="chartRevYoY"></canvas></div>
      <div class="chart-wrap"><h3>FCF Anual (M)</h3><canvas id="chartFCFYoY"></canvas></div>
      <div class="chart-wrap"><h3>Márgenes % (EBIT + Net)</h3><canvas id="chartMargins"></canvas></div>
      <div class="chart-wrap"><h3>ROIC %</h3><canvas id="chartROIC"></canvas></div>
      <div class="chart-wrap"><h3>EV/EBITDA Histórico</h3><canvas id="chartEVEBITDA"></canvas></div>
      <div class="chart-wrap"><h3>Precio Histórico (USD)</h3><canvas id="chartPrice"></canvas></div>
      <div class="chart-wrap"><h3>Deuda / EBITDA</h3><canvas id="chartDebt"></canvas></div>
      <div class="chart-wrap"><h3 id="chartSharesTitle">Shares Outstanding (M)</h3><canvas id="chartShares"></canvas></div>
    </div>
  `;

  showEl('content');
  renderCharts(d, { hRev, hEbit, hNI, hFCF, hEbitda, hND, hEPS, histYears, price, mktCap });
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPARISON TABLE
// ─────────────────────────────────────────────────────────────────────────────
function renderComparison() {
  const tickers = Object.keys(DB);
  const { tPER, tEVCF, growth } = getParams();
  const PROJ = DEFAULTS.projYears;

  const col    = (v,dec=1) => v!==null&&!isNaN(v) ? fm(v,dec) : '—';
  const pctCol = (v,dec=1) => {
    if(v===null||isNaN(v)) return '<td>—</td>';
    const c=v>=0?'#4ade80':'#f87171';
    return `<td style="color:${c};font-weight:600">${v>=0?'+':''}${fm(v,dec)}%</td>`;
  };
  const perCol = (cur,avg) => {
    if(!cur) return '<td>—</td>';
    const cheap=avg&&cur<avg;
    return `<td style="color:${cheap?'#4ade80':'#f87171'};font-weight:600">${fm(cur,1)}x</td>`;
  };

  let rows = tickers.map(ticker => {
    const d=DB[ticker]; if(!d) return null;
    const hist=d.historical||[]; const N=hist.length; if(!N) return null;

    const price=d.price||0, mktCap=d.mkt_cap||0, shares=d.shares||1;
    const hEPS=hist.map(r=>r.eps||0),       hFCF=hist.map(r=>r.fcf||0);
    const hNI=hist.map(r=>r.net_income||0), hRev=hist.map(r=>r.revenue||0);
    const hEbit=hist.map(r=>r.ebit||0),     hND=hist.map(r=>r.net_debt||0);
    const hEbitda=hist.map(r=>r.ebitda||0);

    const lastEPS=hEPS[N-1], lastFCF=hFCF[N-1], lastNI=hNI[N-1];
    const lastEbit=hEbit[N-1], lastRev=hRev[N-1], lastND=hND[N-1], lastEbitda=hEbitda[N-1];
    const ev=mktCap+lastND;

    const currentPER  = lastEPS    ? price/lastEPS    : null;
    const mEVCF       = lastFCF    ? ev/lastFCF       : null;
    const mEVEBITDA   = lastEbitda ? ev/lastEbitda    : null;
    const debtEbitda  = lastEbitda ? lastND/lastEbitda: null;
    const fcfQuality  = lastNI     ? lastFCF/lastNI   : null;

    const lastDataRaw  = hist[N-1]?.fiscal_end||hist[N-1]?.year||'—';
    const lastDataDate = String(lastDataRaw).replace(/^TTM\s*\(([^)]+)\)$/,'$1');

    const histPERs = hist.slice(0,N-1)
      .map((r,i)=>{const hp=r.hist_price||null;return hp&&hEPS[i]?hp/hEPS[i]:null;})
      .filter(v=>v&&v>0&&v<200);
    const avgHistPER = histPERs.length ? histPERs.reduce((s,v)=>s+v,0)/histPERs.length : null;

    const histEVEBs = hist.slice(0,N-1).map((r,i)=>{
      const hp=r.hist_price||null, nd=hND[i], eb=hEbitda[i];
      if(!hp||!shares||!eb) return null;
      return (hp*shares+nd)/eb;
    }).filter(v=>v&&v>0&&v<200);
    const avgHistEVEBITDA = histEVEBs.length ? histEVEBs.reduce((s,v)=>s+v,0)/histEVEBs.length : null;

    const pNI5=lastNI*(1+growth)**PROJ, pFCF5=lastFCF*(1+growth)**PROJ;
    const ivAvg5=((pNI5*tPER)/shares + (pFCF5*tEVCF-lastND)/shares)/2;
    const cagrAvg=price&&ivAvg5?((ivAvg5/price)**(1/5)-1)*100:null;

    const revYoY=calcYoY(hRev,N-1), epsYoY=calcYoY(hEPS,N-1), fcfYoY=calcYoY(hFCF,N-1);
    const cheapVsHist=avgHistPER&&currentPER?currentPER<avgHistPER:false;
    const cheapVsTarget=currentPER?currentPER<tPER:false;
    const isCheap=cheapVsHist&&cheapVsTarget;
    const currEBITM=lastRev?lastEbit/lastRev*100:null, prevEBITM=hRev[N-2]?hEbit[N-2]/hRev[N-2]*100:null;
    const checks={
      rev:revYoY!==null?revYoY>0:false,
      ebit:(currEBITM&&prevEBITM)?currEBITM>=prevEBITM*0.97:false,
      fcf:fcfYoY!==null?(lastFCF>0&&fcfYoY>0):false,
      eps:epsYoY!==null?epsYoY>0:false,
    };
    const healthyCount=Object.values(checks).filter(Boolean).length;
    const isHealthy=healthyCount>=3;
    let verdict,vColor;
    if(isCheap&&isHealthy)   {verdict='🟢 COMPRA';  vColor='#4ade80';}
    else if(isCheap)          {verdict='👀 ATENCIÓN'; vColor='#60a5fa';}
    else if(isHealthy)        {verdict='⏸️ MANTENER'; vColor='#fbbf24';}
    else                      {verdict='🔴 EVITAR';   vColor='#f87171';}

    return { ticker, d, price, currentPER, avgHistPER, mEVCF, mEVEBITDA,
             avgHistEVEBITDA, debtEbitda, fcfQuality, cagrAvg, revYoY, epsYoY,
             verdict, vColor, lastDataDate, tEVCF, healthyCount };
  }).filter(Boolean);

  const colMap = {
    price:'price', per:'currentPER', perAvg:'avgHistPER',
    evcf:'mEVCF', evebitda:'mEVEBITDA', evebitdaAvg:'avgHistEVEBITDA',
    revyoy:'revYoY', epsyoy:'epsYoY', fcfni:'fcfQuality',
    debt:'debtEbitda', cagr:'cagrAvg'
  };

  function buildTable(sortCol=null, sortDir=-1) {
    let sorted = [...rows];
    if (sortCol && colMap[sortCol]) {
      sorted.sort((a,b) => {
        const av=a[colMap[sortCol]], bv=b[colMap[sortCol]];
        if(av===null||av===undefined) return 1;
        if(bv===null||bv===undefined) return -1;
        return (av-bv)*sortDir;
      });
    }
    const tbody = document.getElementById('compTbody');
    if (!tbody) return;
    tbody.innerHTML = sorted.map(r=>`
      <tr style="cursor:pointer" onclick="selectTicker('${r.ticker}')">
        <td><strong style="color:#fff">${r.ticker}</strong><br><span style="font-size:.7rem;color:#4b5563">${r.d.name||''}</span></td>
        <td>${col(r.price,2)}</td>
        <td style="font-size:.75rem;color:#4b5563">${r.lastDataDate}</td>
        ${perCol(r.currentPER,r.avgHistPER)}
        <td style="color:#94a3b8">${col(r.avgHistPER,1)}x</td>
        <td style="color:${r.mEVCF&&r.mEVCF<r.tEVCF?'#4ade80':'#f87171'}">${col(r.mEVCF,1)}x</td>
        <td style="color:${r.mEVEBITDA&&r.avgHistEVEBITDA&&r.mEVEBITDA<r.avgHistEVEBITDA?'#4ade80':'#e2e8f0'}">${col(r.mEVEBITDA,1)}x</td>
        <td style="color:#94a3b8">${col(r.avgHistEVEBITDA,1)}x</td>
        ${pctCol(r.revYoY)}
        ${pctCol(r.epsYoY)}
        <td style="color:${r.fcfQuality>=1?'#4ade80':r.fcfQuality>=0.8?'#fbbf24':'#f87171'}">${col(r.fcfQuality,2)}</td>
        <td style="color:${r.debtEbitda!==null&&r.debtEbitda<2?'#4ade80':r.debtEbitda!==null&&r.debtEbitda<3?'#fbbf24':'#f87171'}">${col(r.debtEbitda,1)}x</td>
        <td style="color:${r.cagrAvg>12?'#4ade80':r.cagrAvg>6?'#fbbf24':'#f87171'};font-weight:700">${col(r.cagrAvg,0)}%</td>
        <td style="color:${r.vColor};font-weight:700;white-space:nowrap">${r.verdict}</td>
      </tr>`).join('');
  }

  const th = (label, col, right=true) =>
    `<th class="sortable" data-col="${col}" style="text-align:${right?'right':'left'}">${label}</th>`;

  document.getElementById('content').innerHTML = `
    <div class="sec-title" style="margin-bottom:16px">📊 Tabla Comparativa</div>
    <div class="t-wrap"><table id="compTable">
      <thead><tr>
        ${th('Ticker','ticker',false)}
        ${th('Precio','price')}
        <th>Último dato</th>
        ${th('PER actual','per')}
        ${th('PER hist. avg','perAvg')}
        ${th('EV/FCF','evcf')}
        ${th('EV/EBITDA','evebitda')}
        ${th('EV/EBITDA avg','evebitdaAvg')}
        ${th('Rev Y/Y','revyoy')}
        ${th('EPS Y/Y','epsyoy')}
        ${th('FCF/NI','fcfni')}
        ${th('Deuda/EBITDA','debt')}
        ${th('CAGR 5a','cagr')}
        <th>Veredicto</th>
      </tr></thead>
      <tbody id="compTbody"></tbody>
    </table></div>
    <p style="font-size:.72rem;color:#4b5563;margin-top:8px">Click en header para ordenar · Click en fila para ver detalle</p>
  `;

  buildTable();
  showEl('content');

  document.querySelectorAll('#compTable thead th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortState.col===col) sortState.dir*=-1;
      else { sortState.col=col; sortState.dir=-1; }
      document.querySelectorAll('#compTable thead th').forEach(h=>h.classList.remove('sort-asc','sort-desc'));
      th.classList.add(sortState.dir===-1?'sort-desc':'sort-asc');
      buildTable(sortState.col, sortState.dir);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPARE 2 TICKERS
// ─────────────────────────────────────────────────────────────────────────────
function renderCompare2(tickerA, tickerB) {
  document.getElementById('content').innerHTML = '';
  document.getElementById('errBox').style.display = 'none';

  const dA = DB[tickerA], dB = DB[tickerB];
  if (!dA || !dB) return;

  const { tPER, tEVCF, growth } = getParams();

  const getMetrics = (d) => {
    const hist=d.historical||[], N=hist.length;
    const price=d.price||0, mktCap=d.mkt_cap||0;
    const hRev=hist.map(r=>r.revenue||0),    hEbitda=hist.map(r=>r.ebitda||0);
    const hEbit=hist.map(r=>r.ebit||0),      hNI=hist.map(r=>r.net_income||0);
    const hFCF=hist.map(r=>r.fcf||0),        hEPS=hist.map(r=>r.eps||0);
    const hND=hist.map(r=>r.net_debt||0);
    const lastNI=hNI[N-1], lastFCF=hFCF[N-1];
    const lastEbitda=hEbitda[N-1], lastEbit=hEbit[N-1], lastND=hND[N-1];
    const ev=mktCap+lastND, sh=d.shares||1;
    return { price, mktCap, ev, sh, hist, N,
      hRev, hEbit, hNI, hFCF, hEPS, hND, hEbitda,
      per:       hEPS[N-1]   ? price/hEPS[N-1]   : null,
      evcf:      lastFCF     ? ev/lastFCF         : null,
      evebitda:  lastEbitda  ? ev/lastEbitda      : null,
      evebit:    lastEbit    ? ev/lastEbit         : null,
      netMargin: hRev[N-1]   ? lastNI/hRev[N-1]*100   : null,
      ebitMargin:hRev[N-1]   ? lastEbit/hRev[N-1]*100 : null,
      revYoY:    calcYoY(hRev,N-1),
      epsYoY:    calcYoY(hEPS,N-1),
      fcfYoY:    calcYoY(hFCF,N-1),
      roic:      (()=>{ const e=mktCap+lastND; return e?lastEbit/e*100:null; })(),
      debtEbitda:lastEbitda ? lastND/lastEbitda : null,
      fcfNI:     lastNI     ? lastFCF/lastNI    : null,
      iv5: ((lastNI*(1+growth)**5*tPER)/sh + (lastFCF*(1+growth)**5*tEVCF-lastND)/sh)/2,
    };
  };

  const mA=getMetrics(dA), mB=getMetrics(dB);
  const cagrA = mA.price&&mA.iv5 ? ((mA.iv5/mA.price)**(1/5)-1)*100 : null;
  const cagrB = mB.price&&mB.iv5 ? ((mB.iv5/mB.price)**(1/5)-1)*100 : null;

  const win = (a, b, lowerBetter=false) => {
    if(a===null||b===null) return ['',''];
    return (lowerBetter ? a<b : a>b)
      ? ['color:#4ade80;font-weight:700','color:#e2e8f0']
      : ['color:#e2e8f0','color:#4ade80;font-weight:700'];
  };

  const row = (label, va, vb, dec=1, lowerBetter=false, suffix='') => {
    const [ca,cb]=win(va,vb,lowerBetter);
    const fmt = v => v!==null&&!isNaN(v) ? fm(v,dec)+suffix : '—';
    return `<tr><td style="color:#94a3b8">${label}</td>
      <td style="text-align:right;${ca}">${fmt(va)}</td>
      <td style="text-align:right;${cb}">${fmt(vb)}</td></tr>`;
  };

  const pctRow = (label, va, vb, lowerBetter=false) => {
    const [ca,cb]=win(va,vb,lowerBetter);
    const fmt = v => v!==null&&!isNaN(v) ? (v>=0?'+':'')+fm(v,1)+'%' : '—';
    const styleA = ca || (va!==null ? va>=0?'color:#4ade80':'color:#f87171' : '');
    const styleB = cb || (vb!==null ? vb>=0?'color:#4ade80':'color:#f87171' : '');
    return `<tr><td style="color:#94a3b8">${label}</td>
      <td style="text-align:right;${styleA}">${fmt(va)}</td>
      <td style="text-align:right;${styleB}">${fmt(vb)}</td></tr>`;
  };

  const secRow = label =>
    `<tr><td colspan="3" style="padding:4px 11px;background:#111827;color:#4b5563;font-size:.72rem;text-transform:uppercase">${label}</td></tr>`;

  document.getElementById('content').innerHTML = `
    <div class="s-header">
      <div class="s-title">
        <h2>⚖️ ${tickerA} vs ${tickerB}</h2>
        <div class="sub">${[dA.sector, dB.sector].filter(Boolean).join(' · ')}</div>
      </div>
    </div>

    <div class="t-wrap" style="margin-bottom:20px"><table>
      <thead><tr>
        <th style="text-align:left;min-width:200px">Métrica</th>
        <th style="text-align:right;color:#4ade80;font-size:.95rem">${tickerA}
          <div style="font-size:.7rem;font-weight:400;color:#94a3b8">${dA.name||''}</div></th>
        <th style="text-align:right;color:#60a5fa;font-size:.95rem">${tickerB}
          <div style="font-size:.7rem;font-weight:400;color:#94a3b8">${dB.name||''}</div></th>
      </tr></thead>
      <tbody>
        ${secRow('Precio & Valoración')}
        ${row('Precio',             mA.price,      mB.price,      2)}
        ${row('Market Cap',         mA.mktCap/1e9, mB.mktCap/1e9, 1, false, 'B')}
        ${row('PER actual',         mA.per,        mB.per,        1, true,  'x')}
        ${row('EV/FCF',             mA.evcf,       mB.evcf,       1, true,  'x')}
        ${row('EV/EBITDA',          mA.evebitda,   mB.evebitda,   1, true,  'x')}
        ${row('EV/EBIT',            mA.evebit,     mB.evebit,     1, true,  'x')}
        ${row('IV Promedio año 5',  mA.iv5,        mB.iv5,        2)}
        ${row('CAGR 5a estimado',   cagrA,         cagrB,         1, false, '%')}
        ${secRow('Calidad & Crecimiento')}
        ${pctRow('Revenue Y/Y %',   mA.revYoY,    mB.revYoY)}
        ${pctRow('EPS Y/Y %',       mA.epsYoY,    mB.epsYoY)}
        ${pctRow('FCF Y/Y %',       mA.fcfYoY,    mB.fcfYoY)}
        ${row('EBIT Margin %',      mA.ebitMargin, mB.ebitMargin, 1, false, '%')}
        ${row('Net Margin %',       mA.netMargin,  mB.netMargin,  1, false, '%')}
        ${row('ROIC %',             mA.roic,       mB.roic,       1, false, '%')}
        ${row('FCF / Net Income',   mA.fcfNI,      mB.fcfNI,      2)}
        ${row('Deuda / EBITDA',     mA.debtEbitda, mB.debtEbitda, 1, true,  'x')}
      </tbody>
    </table></div>

    <div class="sec-title" style="margin-bottom:12px">📈 Gráficos Comparativos</div>
    <div class="charts-grid">
      <div class="chart-wrap"><h3>Revenue Anual (M)</h3><canvas id="cmpRev"></canvas></div>
      <div class="chart-wrap"><h3>FCF Anual (M)</h3><canvas id="cmpFCF"></canvas></div>
      <div class="chart-wrap"><h3>EBIT Margin %</h3><canvas id="cmpMargins"></canvas></div>
      <div class="chart-wrap"><h3>EPS</h3><canvas id="cmpEPS"></canvas></div>
      <div class="chart-wrap"><h3>EV/EBITDA Histórico</h3><canvas id="cmpEVEB"></canvas></div>
      <div class="chart-wrap"><h3>Precio Histórico (USD)</h3><canvas id="cmpPrice"></canvas></div>
      <div class="chart-wrap"><h3>ROIC %</h3><canvas id="cmpROIC"></canvas></div>
      <div class="chart-wrap"><h3>Deuda / EBITDA</h3><canvas id="cmpDebt"></canvas></div>
    </div>
  `;

  showEl('content');
  renderCompareCharts(tickerA, dA, mA, tickerB, dB, mB);
}
