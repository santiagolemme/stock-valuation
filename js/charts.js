// ─────────────────────────────────────────────────────────────────────────────
//  CHARTS — all Chart.js visualizations
// ─────────────────────────────────────────────────────────────────────────────

function renderCharts(d, annual) {
  const { hRev, hEbit, hNI, hFCF, hEbitda, hND, hEPS, histYears, price, mktCap // ─────────────────────────────────────────────────────────────────────────────
//  COMPARE 2 TICKERS — charts with 2 overlapping series
// ─────────────────────────────────────────────────────────────────────────────
function renderCompareCharts(tickerA, dA, mA, tickerB, dB, mB) {
  const COLORS = { A:'#4ade80', B:'#60a5fa' };

  const annLabelsA = mA.hist.map(r=>String(r.year).slice(0,4));
  const annLabelsB = mB.hist.map(r=>String(r.year).slice(0,4));
  // Use union of years as labels
  const allYears = [...new Set([...annLabelsA,...annLabelsB])].sort();

  const align = (hist, years, key) =>
    years.map(y => {
      const r = hist.find(r=>String(r.year).slice(0,4)===y);
      return r ? (r[key]||0)/1e6 : null;
    });

  const alignRaw = (hist, years, key) =>
    years.map(y => {
      const r = hist.find(r=>String(r.year).slice(0,4)===y);
      return r ? (r[key]||0) : null;
    });

  const alignRatio = (hist, years, keyA, keyB) =>
    years.map(y => {
      const r = hist.find(r=>String(r.year).slice(0,4)===y);
      if(!r) return null;
      const a=r[keyA]||0, b=r[keyB]||0;
      return b ? a/b*100 : null;
    });

  // EV/EBITDA needs price for historical
  const alignEVEB = (d, hist, years) =>
    years.map(y => {
      const r = hist.find(r=>String(r.year).slice(0,4)===y);
      if(!r) return null;
      const hp = r.hist_price || (y===String(new Date().getFullYear())?d.price:null);
      const nd=r.net_debt||0, eb=r.ebitda||0, sh=d.shares||1;
      if(!hp||!eb) return null;
      return (hp*sh+nd)/eb;
    });

  const alignPrice = (d, hist, years) =>
    years.map(y => {
      const r = hist.find(r=>String(r.year).slice(0,4)===y);
      if(!r) return null;
      return r.hist_price || (y===String(new Date().getFullYear())?d.price:null);
    });

  // Quarterly series
  const qtrsA = dA.quarterly||[], qtrsB = dB.quarterly||[];
  const useQtr = qtrsA.length>0 && qtrsB.length>0;
  const qDates = [...new Set([...qtrsA.map(r=>r.date?.slice(0,7)||''),...qtrsB.map(r=>r.date?.slice(0,7)||'')])].sort();

  const qAlign = (qtrs, dates, key, div=1e6) =>
    dates.map(d => { const r=qtrs.find(q=>q.date?.slice(0,7)===d); return r?(r[key]||0)/div:null; });

  const qAlignRatio = (qtrs, dates, kA, kB) =>
    dates.map(d => { const r=qtrs.find(q=>q.date?.slice(0,7)===d); if(!r)return null; const a=r[kA]||0,b=r[kB]||0; return b?a/b*100:null; });

  const xAxis = labels => ({
    ticks:{color:'#94a3b8',font:{size:9},maxRotation:0,
      callback(val,idx){ const l=labels[idx]||''; if(idx===0)return l.slice(0,4); return l.slice(0,4)!==(labels[idx-1]||'').slice(0,4)?l.slice(0,4):''; }
    }, grid:{color:'#1e2533'}
  });

  const opts = labels => ({
    responsive:true, maintainAspectRatio:true,
    plugins:{legend:{labels:{color:'#94a3b8',font:{size:10},boxWidth:12}}},
    scales:{x:xAxis(labels), y:{ticks:{color:'#94a3b8',font:{size:10}},grid:{color:'#1e2533'}}}
  });

  const ds = (label, data, color, fill=false) => ({
    label, data:data.map(v=>v!==null&&!isNaN(v)?+v.toFixed(2):null),
    borderColor:color, backgroundColor:fill?color+'22':'transparent',
    borderWidth:2, pointRadius:useQtr?3:5, pointHoverRadius:6, pointBackgroundColor:color,
    tension:0.3, fill, spanGaps:true
  });

  const dsBar = (label, data, color) => ({
    label, data:data.map(v=>v!==null&&!isNaN(v)?+v.toFixed(2):null),
    backgroundColor:color+'bb', borderRadius:3, borderSkipped:false
  });

  const mk = (id, type, labels, datasets) => {
    const el=document.getElementById(id); if(!el)return;
    new Chart(el.getContext('2d'),{type,data:{labels,datasets},options:opts(labels)});
  };

  const lA = tickerA, lB = tickerB;

  // 1. Revenue bars
  mk('cmpRev','bar', allYears, [
    dsBar(lA, align(mA.hist,allYears,'revenue'), COLORS.A),
    dsBar(lB, align(mB.hist,allYears,'revenue'), COLORS.B),
  ]);

  // 2. FCF bars
  mk('cmpFCF','bar', allYears, [
    dsBar(lA, align(mA.hist,allYears,'fcf'), COLORS.A),
    dsBar(lB, align(mB.hist,allYears,'fcf'), COLORS.B),
  ]);

  // 3. EBIT Margin lines (quarterly if available)
  mk('cmpMargins','line', useQtr?qDates:allYears, [
    ds(lA, useQtr?qAlignRatio(qtrsA,qDates,'ebit','revenue'):alignRatio(mA.hist,allYears,'ebit','revenue'), COLORS.A, true),
    ds(lB, useQtr?qAlignRatio(qtrsB,qDates,'ebit','revenue'):alignRatio(mB.hist,allYears,'ebit','revenue'), COLORS.B, false),
  ]);

  // 4. EPS lines
  mk('cmpEPS','line', allYears, [
    ds(lA, alignRaw(mA.hist,allYears,'eps'), COLORS.A),
    ds(lB, alignRaw(mB.hist,allYears,'eps'), COLORS.B),
  ]);

  // 5. EV/EBITDA lines
  mk('cmpEVEB','line', allYears, [
    ds(lA, alignEVEB(dA,mA.hist,allYears), COLORS.A),
    ds(lB, alignEVEB(dB,mB.hist,allYears), COLORS.B),
  ]);

  // 6. Price lines
  mk('cmpPrice','line', useQtr?qDates:allYears, [
    ds(lA, useQtr?qAlign(qtrsA,qDates,'price',1):alignPrice(dA,mA.hist,allYears), COLORS.A, true),
    ds(lB, useQtr?qAlign(qtrsB,qDates,'price',1):alignPrice(dB,mB.hist,allYears), COLORS.B, false),
  ]);

  // 7. ROIC lines (quarterly if available)
  const qROIC = (qtrs,dates,cap) => dates.map(d=>{
    const r=qtrs.find(q=>q.date?.slice(0,7)===d); if(!r)return null;
    const e=cap+(r.net_debt||0)/1e6; return e?(r.ebit||0)/1e6/e*100:null;
  });
  mk('cmpROIC','line', useQtr?qDates:allYears, [
    ds(lA, useQtr?qROIC(qtrsA,qDates,dA.mkt_cap/1e6):mA.hist.map((_,i)=>{const e=dA.mkt_cap+mA.hND[i];return e?mA.hEbit[i]/e*100:null;}), COLORS.A, true),
    ds(lB, useQtr?qROIC(qtrsB,qDates,dB.mkt_cap/1e6):mB.hist.map((_,i)=>{const e=dB.mkt_cap+mB.hND[i];return e?mB.hEbit[i]/e*100:null;}), COLORS.B, false),
  ]);

  // 8. Debt/EBITDA lines
  mk('cmpDebt','line', useQtr?qDates:allYears, [
    ds(lA, useQtr?qAlignRatio(qtrsA.map(r=>({...r,ebitda:(r.ebitda||0),net_debt:(r.net_debt||0)})),qDates,'net_debt','ebitda'):mA.hist.map((_,i)=>mA.hEbitda[i]?mA.hND[i]/mA.hEbitda[i]:null), COLORS.A),
    ds(lB, useQtr?qAlignRatio(qtrsB.map(r=>({...r,ebitda:(r.ebitda||0),net_debt:(r.net_debt||0)})),qDates,'net_debt','ebitda'):mB.hist.map((_,i)=>mB.hEbitda[i]?mB.hND[i]/mB.hEbitda[i]:null), COLORS.B),
  ]);
} = annual;

  // ── Quarterly data ──────────────────────────────────────────────────────────
  const qtrs   = d.quarterly || [];
  const useQtr = qtrs.length > 0;

  const qLabels = qtrs.map(r => r.date?.slice(0,7) || '');
  const qRev    = qtrs.map(r => (r.revenue    ||0)/1e6);
  const qEbit   = qtrs.map(r => (r.ebit       ||0)/1e6);
  const qNI     = qtrs.map(r => (r.net_income ||0)/1e6);
  const qFCF    = qtrs.map(r => (r.fcf        ||0)/1e6);
  const qEbitda = qtrs.map(r => (r.ebitda     ||0)/1e6);
  const qND     = qtrs.map(r => (r.net_debt   ||0)/1e6);
  const qShares = qtrs.map(r => (r.shares     ||0)/1e6);
  const qPrice  = qtrs.map(r =>  r.price      ||null);

  const cap = mktCap/1e6;
  const qEbitMargin = qRev.map((v,i)  => v ? qEbit[i]/v*100  : null);
  const qNetMargin  = qRev.map((v,i)  => v ? qNI[i]/v*100    : null);
  const qROIC       = qEbit.map((v,i) => { const e=cap+qND[i]; return e?v/e*100:null; });
  const qDebtEbitda = qEbitda.map((v,i) => v ? qND[i]/v        : null);
  const qEVEBITDA   = qEbitda.map((v,i) => { const e=cap+qND[i]; return v?e/v:null; });
  const qEVFCF      = qFCF.map((v,i)   => { const e=cap+qND[i]; return v?e/v:null; });

  const annLabels = histYears.map(String);
  const annRev    = hRev.map(v=>v/1e6);
  const annFCF    = hFCF.map(v=>v/1e6);

  // ── X axis: show year label only when year changes ──────────────────────────
  const xAxis = labels => ({
    ticks: {
      color:'#94a3b8', font:{size:9}, maxRotation:0,
      callback(val, idx) {
        const lbl = labels[idx]||'';
        if(idx===0) return lbl.slice(0,4);
        return lbl.slice(0,4) !== (labels[idx-1]||'').slice(0,4) ? lbl.slice(0,4) : '';
      }
    },
    grid:{color:'#1e2533'}
  });

  const baseOpts = labels => ({
    responsive:true, maintainAspectRatio:true,
    plugins:{ legend:{ labels:{ color:'#94a3b8', font:{size:10}, boxWidth:12 } } },
    scales:{ x: xAxis(labels), y:{ ticks:{color:'#94a3b8',font:{size:10}}, grid:{color:'#1e2533'} } }
  });

  // ── Dataset builders ────────────────────────────────────────────────────────
  const ds = (label, data, color, fill=false) => ({
    label,
    data: data.map(v => v!==null&&!isNaN(v) ? +v.toFixed(2) : null),
    borderColor:color, backgroundColor: fill ? color+'22' : 'transparent',
    borderWidth:2, pointRadius:3, pointHoverRadius:5, pointBackgroundColor:color,
    tension:0.3, fill, spanGaps:true
  });

  const dsBar = (label, data, color) => ({
    label,
    data: data.map(v => v!==null&&!isNaN(v) ? +v.toFixed(2) : null),
    backgroundColor: data.map(v => (v||0)<0 ? '#f87171' : color),
    borderRadius:3, borderSkipped:false
  });

  // ── Chart factory ────────────────────────────────────────────────────────────
  const mk = (id, type, labels, datasets) => {
    const el = document.getElementById(id);
    if (!el) return;
    new Chart(el.getContext('2d'), { type, data:{labels, datasets}, options:baseOpts(labels) });
  };

  // 1. Revenue — annual bars
  mk('chartRevYoY', 'bar', annLabels, [dsBar('Revenue (M)', annRev, '#4ade80')]);

  // 2. FCF — annual bars
  mk('chartFCFYoY', 'bar', annLabels, [dsBar('FCF (M)', annFCF, '#60a5fa')]);

  // 3. Margins — quarterly line
  mk('chartMargins', 'line',
    useQtr ? qLabels : annLabels,
    useQtr
      ? [ds('EBIT Margin %',qEbitMargin,'#4ade80',true), ds('Net Margin %',qNetMargin,'#a78bfa',true)]
      : [ds('EBIT Margin %',hEbit.map((v,i)=>hRev[i]?v/hRev[i]*100:null),'#4ade80',true),
         ds('Net Margin %', hNI.map((v,i) =>hRev[i]?v/hRev[i]*100:null),'#a78bfa',true)]
  );

  // 4. ROIC — quarterly line
  mk('chartROIC', 'line',
    useQtr ? qLabels : annLabels,
    [ds('ROIC %', useQtr ? qROIC : hEbit.map((v,i)=>{const e=mktCap+hND[i];return e?v/e*100:null;}), '#fbbf24', true)]
  );

  // 5. EV/EBITDA — quarterly line
  mk('chartEVEBITDA', 'line',
    useQtr ? qLabels : annLabels,
    [ds('EV/EBITDA', useQtr ? qEVEBITDA : hEbitda.map((v,i)=>v?(cap+hND[i]/1e6)/v:null), '#f87171')]
  );

  // 6. Price — quarterly line
  const priceAnn = d.historical.map(r=>r.hist_price||null);
  priceAnn[priceAnn.length-1] = price;
  mk('chartPrice', 'line',
    useQtr ? qLabels : annLabels,
    [ds('Precio USD', useQtr ? qPrice : priceAnn, '#4ade80', true)]
  );

  // 7. Debt/EBITDA — quarterly line
  mk('chartDebt', 'line',
    useQtr ? qLabels : annLabels,
    [ds('Deuda/EBITDA', useQtr ? qDebtEbitda : hEbitda.map((v,i)=>v?hND[i]/v/1e6:null), '#f87171')]
  );

  // 8. Shares or EV/FCF
  const hasShares = qShares.some(v=>v>0);
  if (hasShares) {
    mk('chartShares', 'line',
      useQtr ? qLabels : annLabels,
      [ds('Shares (M)', useQtr ? qShares : [], '#60a5fa')]
    );
  } else {
    const titleEl = document.getElementById('chartSharesTitle');
    if (titleEl) titleEl.textContent = 'EV/FCF Histórico';
    mk('chartShares', 'line',
      useQtr ? qLabels : annLabels,
      [ds('EV/FCF', useQtr ? qEVFCF : hFCF.map((v,i)=>v?(cap+hND[i]/1e6)/(v/1e6):null), '#60a5fa')]
    );
  }
}
