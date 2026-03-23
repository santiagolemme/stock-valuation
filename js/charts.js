// ─────────────────────────────────────────────────────────────────────────────
//  CHARTS — all Chart.js visualizations
// ─────────────────────────────────────────────────────────────────────────────

function renderCharts(d, annual) {
  const { hRev, hEbit, hNI, hFCF, hEbitda, hND, hEPS, histYears, price, mktCap } = annual;

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
