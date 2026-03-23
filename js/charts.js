// ─────────────────────────────────────────────────────────────────────────────
//  CHARTS — single ticker + 2-ticker comparison
// ─────────────────────────────────────────────────────────────────────────────

function renderCharts(d, annual) {
  const hRev     = annual.hRev;
  const hEbit    = annual.hEbit;
  const hNI      = annual.hNI;
  const hFCF     = annual.hFCF;
  const hEbitda  = annual.hEbitda;
  const hND      = annual.hND;
  const hEPS     = annual.hEPS;
  const histYears= annual.histYears;
  const price    = annual.price;
  const mktCap   = annual.mktCap;

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
  const qEbitMargin = qRev.map((v,i)    => v ? qEbit[i]/v*100   : null);
  const qNetMargin  = qRev.map((v,i)    => v ? qNI[i]/v*100     : null);
  const qROIC       = qEbit.map((v,i)   => { const e=cap+qND[i]; return e?v/e*100:null; });
  const qDebtEbitda = qEbitda.map((v,i) => v ? qND[i]/v         : null);
  const qEVEBITDA   = qEbitda.map((v,i) => { const e=cap+qND[i]; return v?e/v:null; });
  const qEVFCF      = qFCF.map((v,i)   => { const e=cap+qND[i]; return v?e/v:null; });

  const annLabels = histYears.map(String);
  const annRev    = hRev.map(v=>v/1e6);
  const annFCF    = hFCF.map(v=>v/1e6);

  // ── X axis: show year only when it changes ──────────────────────────────────
  const xAxis = labels => ({
    ticks: {
      color:'#94a3b8', font:{size:9}, maxRotation:0,
      callback(val, idx) {
        const lbl = labels[idx]||'';
        if(idx===0) return lbl.slice(0,4);
        return lbl.slice(0,4) !== (labels[idx-1]||'').slice(0,4) ? lbl.slice(0,4) : '';
      }
    },
    grid: {color:'#1e2533'}
  });

  const baseOpts = labels => ({
    responsive:true, maintainAspectRatio:true,
    plugins:{ legend:{ labels:{ color:'#94a3b8', font:{size:10}, boxWidth:12 } } },
    scales:{ x:xAxis(labels), y:{ ticks:{color:'#94a3b8',font:{size:10}}, grid:{color:'#1e2533'} } }
  });

  const ds = (label, data, color, fill=false) => ({
    label,
    data: data.map(v => v!==null&&!isNaN(v) ? +v.toFixed(2) : null),
    borderColor:color, backgroundColor: fill ? color+'22' : 'transparent',
    borderWidth:2, pointRadius:useQtr?3:5, pointHoverRadius:6, pointBackgroundColor:color,
    tension:0.3, fill, spanGaps:true
  });

  const dsBar = (label, data, color) => ({
    label,
    data: data.map(v => v!==null&&!isNaN(v) ? +v.toFixed(2) : null),
    backgroundColor: data.map(v => (v||0)<0 ? '#f87171' : color),
    borderRadius:3, borderSkipped:false
  });

  const mk = (id, type, labels, datasets) => {
    const el = document.getElementById(id); if(!el) return;
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

// ─────────────────────────────────────────────────────────────────────────────
//  COMPARE 2 TICKERS — charts with 2 overlapping series
// ─────────────────────────────────────────────────────────────────────────────

function renderCompareCharts(tickerA, dA, mA, tickerB, dB, mB) {
  const COLORS = { A:'#4ade80', B:'#60a5fa' };

  const annLabelsA = mA.hist.map(r=>String(r.year).slice(0,4));
  const annLabelsB = mB.hist.map(r=>String(r.year).slice(0,4));
  const allYears   = [...new Set([...annLabelsA,...annLabelsB])].sort();

  const qtrsA  = dA.quarterly||[], qtrsB = dB.quarterly||[];
  const useQtr = qtrsA.length>0 && qtrsB.length>0;
  const qDates = [...new Set([
    ...qtrsA.map(r=>r.date?.slice(0,7)||''),
    ...qtrsB.map(r=>r.date?.slice(0,7)||'')
  ])].sort();

  // ── Align helpers ───────────────────────────────────────────────────────────
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

  const alignRatio = (hist, years, kN, kD) =>
    years.map(y => {
      const r = hist.find(r=>String(r.year).slice(0,4)===y);
      if(!r) return null;
      const n=r[kN]||0, dv=r[kD]||0;
      return dv ? n/dv*100 : null;
    });

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

  const qAlign = (qtrs, dates, key, div=1e6) =>
    dates.map(d => {
      const r = qtrs.find(q=>q.date?.slice(0,7)===d);
      return r ? (r[key]||0)/div : null;
    });

  const qAlignRatio = (qtrs, dates, kN, kD) =>
    dates.map(d => {
      const r = qtrs.find(q=>q.date?.slice(0,7)===d);
      if(!r) return null;
      const n=r[kN]||0, dv=r[kD]||0;
      return dv ? n/dv*100 : null;
    });

  const qAlignEVEB = (qtrs, dates, cap) =>
    dates.map(d => {
      const r = qtrs.find(q=>q.date?.slice(0,7)===d);
      if(!r) return null;
      const eb=(r.ebitda||0)/1e6, nd=(r.net_debt||0)/1e6;
      return eb ? (cap+nd)/eb : null;
    });

  const qAlignROIC = (qtrs, dates, cap) =>
    dates.map(d => {
      const r = qtrs.find(q=>q.date?.slice(0,7)===d);
      if(!r) return null;
      const eb=(r.ebit||0)/1e6, nd=(r.net_debt||0)/1e6;
      const e = cap+nd; return e ? eb/e*100 : null;
    });

  const qAlignDebt = (qtrs, dates) =>
    dates.map(d => {
      const r = qtrs.find(q=>q.date?.slice(0,7)===d);
      if(!r) return null;
      const eb=(r.ebitda||0)/1e6, nd=(r.net_debt||0)/1e6;
      return eb ? nd/eb : null;
    });

  // ── Chart factory ───────────────────────────────────────────────────────────
  const xAxis = labels => ({
    ticks:{
      color:'#94a3b8', font:{size:9}, maxRotation:0,
      callback(val,idx){
        const l=labels[idx]||'';
        if(idx===0) return l.slice(0,4);
        return l.slice(0,4)!==(labels[idx-1]||'').slice(0,4)?l.slice(0,4):'';
      }
    },
    grid:{color:'#1e2533'}
  });

  const opts = labels => ({
    responsive:true, maintainAspectRatio:true,
    plugins:{legend:{labels:{color:'#94a3b8',font:{size:10},boxWidth:12}}},
    scales:{x:xAxis(labels), y:{ticks:{color:'#94a3b8',font:{size:10}},grid:{color:'#1e2533'}}}
  });

  const ds = (label, data, color, fill=false) => ({
    label,
    data: data.map(v=>v!==null&&!isNaN(v)?+v.toFixed(2):null),
    borderColor:color, backgroundColor:fill?color+'22':'transparent',
    borderWidth:2, pointRadius:useQtr?3:5, pointHoverRadius:6, pointBackgroundColor:color,
    tension:0.3, fill, spanGaps:true
  });

  const dsBar = (label, data, color) => ({
    label,
    data: data.map(v=>v!==null&&!isNaN(v)?+v.toFixed(2):null),
    backgroundColor:color+'bb', borderRadius:3, borderSkipped:false
  });

  const mk = (id, type, labels, datasets) => {
    const el=document.getElementById(id); if(!el) return;
    new Chart(el.getContext('2d'),{type,data:{labels,datasets},options:opts(labels)});
  };

  const capA = dA.mkt_cap/1e6, capB = dB.mkt_cap/1e6;
  const lA = tickerA, lB = tickerB;

  // 1. Revenue — annual bars
  mk('cmpRev','bar', allYears, [
    dsBar(lA, align(mA.hist,allYears,'revenue'), COLORS.A),
    dsBar(lB, align(mB.hist,allYears,'revenue'), COLORS.B),
  ]);

  // 2. FCF — annual bars
  mk('cmpFCF','bar', allYears, [
    dsBar(lA, align(mA.hist,allYears,'fcf'), COLORS.A),
    dsBar(lB, align(mB.hist,allYears,'fcf'), COLORS.B),
  ]);

  // 3. EBIT Margin — quarterly line
  mk('cmpMargins','line', useQtr?qDates:allYears, [
    ds(lA, useQtr?qAlignRatio(qtrsA,qDates,'ebit','revenue'):alignRatio(mA.hist,allYears,'ebit','revenue'), COLORS.A, true),
    ds(lB, useQtr?qAlignRatio(qtrsB,qDates,'ebit','revenue'):alignRatio(mB.hist,allYears,'ebit','revenue'), COLORS.B, false),
  ]);

  // 4. EPS — annual line
  mk('cmpEPS','line', allYears, [
    ds(lA, alignRaw(mA.hist,allYears,'eps'), COLORS.A),
    ds(lB, alignRaw(mB.hist,allYears,'eps'), COLORS.B),
  ]);

  // 5. EV/EBITDA — quarterly line
  mk('cmpEVEB','line', useQtr?qDates:allYears, [
    ds(lA, useQtr?qAlignEVEB(qtrsA,qDates,capA):alignEVEB(dA,mA.hist,allYears), COLORS.A),
    ds(lB, useQtr?qAlignEVEB(qtrsB,qDates,capB):alignEVEB(dB,mB.hist,allYears), COLORS.B),
  ]);

  // 6. Price — quarterly line
  mk('cmpPrice','line', useQtr?qDates:allYears, [
    ds(lA, useQtr?qAlign(qtrsA,qDates,'price',1):alignPrice(dA,mA.hist,allYears), COLORS.A, true),
    ds(lB, useQtr?qAlign(qtrsB,qDates,'price',1):alignPrice(dB,mB.hist,allYears), COLORS.B, false),
  ]);

  // 7. ROIC — quarterly line
  mk('cmpROIC','line', useQtr?qDates:allYears, [
    ds(lA, useQtr?qAlignROIC(qtrsA,qDates,capA):mA.hist.map((_,i)=>{const e=dA.mkt_cap+mA.hND[i];return e?mA.hEbit[i]/e*100:null;}), COLORS.A, true),
    ds(lB, useQtr?qAlignROIC(qtrsB,qDates,capB):mB.hist.map((_,i)=>{const e=dB.mkt_cap+mB.hND[i];return e?mB.hEbit[i]/e*100:null;}), COLORS.B, false),
  ]);

  // 8. Debt/EBITDA — quarterly line
  mk('cmpDebt','line', useQtr?qDates:allYears, [
    ds(lA, useQtr?qAlignDebt(qtrsA,qDates):mA.hist.map((_,i)=>mA.hEbitda[i]?mA.hND[i]/mA.hEbitda[i]:null), COLORS.A),
    ds(lB, useQtr?qAlignDebt(qtrsB,qDates):mB.hist.map((_,i)=>mB.hEbitda[i]?mB.hND[i]/mB.hEbitda[i]:null), COLORS.B),
  ]);
}
