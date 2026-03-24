"""
================================================================================
  MAG7 DATA FETCHER — Con datos TTM (Trailing Twelve Months)
  
  Lógica de datos:
    - Histórico anual:  últimos 4 años completos (desde yfinance.financials)
    - Año actual (TTM): suma de los últimos 4 quarters reportados
    - Balance / CF:     último quarter disponible (más fresco)
  
  Instalación:
    pip install yfinance pandas
  
  Uso:
    Correr en Jupyter → genera magnificent7.json en la misma carpeta
================================================================================
"""

import yfinance as yf
import pandas as pd
import json, os, warnings
from datetime import datetime

warnings.filterwarnings("ignore")

# ── Cargar tickers desde watchlist.json ──────────────────────────────────────
SCRIPT_DIR     = os.path.dirname(os.path.abspath(__file__))
WATCHLIST_FILE = os.path.join(SCRIPT_DIR, "data", "watchlist.json")

with open(WATCHLIST_FILE, "r", encoding="utf-8") as f:
    watchlist_cfg = json.load(f)

MAG7      = watchlist_cfg.get("mag7", [])
WATCHLIST = watchlist_cfg.get("watchlist", [])
TICKERS   = MAG7 + [t for t in WATCHLIST if t not in MAG7]

HIST_YEARS  = 4
OUTPUT_DIR  = os.path.join(SCRIPT_DIR, "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, f"magnificent7_{datetime.now().strftime('%Y%m%d')}.json")

print("=" * 55)
print("  Stock Valuation Fetcher")
print(f"  Mag7:      {MAG7}")
print(f"  Watchlist: {WATCHLIST}")
print(f"  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
print("=" * 55)

# ─────────────────────────────────────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def safe(val, default=0.0):
    """Convierte a float de forma segura."""
    try:
        v = float(val)
        return default if (v != v) else v   # NaN → default
    except:
        return default

def get_row(df, *keys):
    """Busca la primera key que exista en el índice de un DataFrame."""
    if df is None or df.empty:
        return None
    for k in keys:
        if k in df.index:
            return df.loc[k]
    return None

def series_to_annual(series, n=HIST_YEARS):
    """
    Convierte una pandas Series (índice = fechas) en lista de dicts
    [{year, value}] ordenada de más antiguo a más reciente.
    Toma los últimos n períodos.
    """
    if series is None:
        return []
    s = series.dropna().sort_index()
    result = []
    for date, val in s.items():
        result.append({"year": str(date)[:4], "value": safe(val)})
    return result[-n:]

def calc_ttm(quarterly_series):
    """
    Suma los últimos 4 quarters disponibles → TTM value.
    Retorna (value, label) donde label es el período cubierto.
    """
    if quarterly_series is None:
        return 0.0, "TTM"
    s = quarterly_series.dropna().sort_index()
    if len(s) == 0:
        return 0.0, "TTM"
    last4 = s.iloc[-4:]
    total = safe(last4.sum())
    # Label: "TTM al Q ending YYYY-MM"
    last_date = str(last4.index[-1])[:7]
    return total, f"TTM ({last_date})"

def latest_balance_value(quarterly_series):
    """Toma el valor más reciente del balance (no se suma, es snapshot)."""
    if quarterly_series is None:
        return 0.0
    s = quarterly_series.dropna().sort_index()
    if len(s) == 0:
        return 0.0
    return safe(s.iloc[-1])

# ─────────────────────────────────────────────────────────────────────────────
#  FETCH POR TICKER
# ─────────────────────────────────────────────────────────────────────────────

def fetch_ticker(ticker):
    print(f"  [{ticker}]", end=" ")
    t   = yf.Ticker(ticker)
    inf = t.info

    # ── Precio histórico (cierre al fin de cada año fiscal) ──────────────────
    raw_hist     = t.history(period="6y", interval="1d")["Close"]
    # Normalizar índice: quitar timezone y llevar a fecha sin hora
    hist_prices  = raw_hist.copy()
    hist_prices.index = pd.to_datetime(hist_prices.index).tz_localize(None).normalize()

    def price_at_fiscal_end(fiscal_date_str):
        """Retorna el precio de cierre en o antes del último día del año fiscal."""
        try:
            target = pd.Timestamp(fiscal_date_str).normalize()
            prices_before = hist_prices[hist_prices.index <= target]
            if prices_before.empty:
                return None
            return round(float(prices_before.iloc[-1]), 2)
        except:
            return None

    # ── Precio & perfil ──────────────────────────────────────────────────────
    price      = safe(inf.get("currentPrice") or inf.get("regularMarketPrice"))
    prev_close = safe(inf.get("previousClose") or inf.get("regularMarketPreviousClose") or price)
    shares     = safe(inf.get("sharesOutstanding", 1))
    mkt_cap    = safe(inf.get("marketCap") or (price * shares))

    # ── DataFrames ───────────────────────────────────────────────────────────
    inc_annual = t.financials           # anual
    inc_qtr    = t.quarterly_financials # trimestral
    bal_annual = t.balance_sheet
    bal_qtr    = t.quarterly_balance_sheet
    cf_annual  = t.cashflow
    cf_qtr     = t.quarterly_cashflow

    # yfinance por defecto trae pocos quarters — forzar más historia
    try:
        import yfinance as _yf
        _t2 = _yf.Ticker(ticker)
        inc_qtr2 = _t2.get_income_stmt(freq='quarterly', as_dict=False, pretty=False, trailing=False)
        bal_qtr2 = _t2.get_balance_sheet(freq='quarterly', as_dict=False, pretty=False, trailing=False)
        cf_qtr2  = _t2.get_cash_flow(freq='quarterly', as_dict=False, pretty=False, trailing=False)
        if inc_qtr2 is not None and not inc_qtr2.empty: inc_qtr = inc_qtr2
        if bal_qtr2 is not None and not bal_qtr2.empty: bal_qtr = bal_qtr2
        if cf_qtr2  is not None and not cf_qtr2.empty:  cf_qtr  = cf_qtr2
    except Exception:
        pass  # fallback a los datos por defecto

    # ── HISTÓRICO ANUAL (últimos HIST_YEARS años completos) ──────────────────
    rev_ann    = series_to_annual(get_row(inc_annual, "Total Revenue"))
    ebit_ann   = series_to_annual(get_row(inc_annual, "Operating Income", "EBIT"))
    ni_ann     = series_to_annual(get_row(inc_annual, "Net Income"))
    eps_ann    = series_to_annual(get_row(inc_annual, "Basic EPS", "Diluted EPS"))
    da_ann     = series_to_annual(get_row(cf_annual,  "Depreciation And Amortization", "Depreciation"))
    fcf_ann    = series_to_annual(get_row(cf_annual,  "Free Cash Flow"))
    opcf_ann   = series_to_annual(get_row(cf_annual,  "Operating Cash Flow"))
    capex_ann  = series_to_annual(get_row(cf_annual,  "Capital Expenditure"))
    ltdebt_ann = series_to_annual(get_row(bal_annual, "Long Term Debt"))
    stdebt_ann = series_to_annual(get_row(bal_annual, "Current Debt", "Short Term Debt"))
    cash_ann   = series_to_annual(get_row(bal_annual, "Cash And Cash Equivalents", "Cash"))

    # Construir histórico anual alineado por año
    ann_years = [r["year"] for r in rev_ann]

    def gv(lst, year):
        for item in lst:
            if item["year"] == year:
                return item["value"]
        return 0.0

    # Obtener fechas fiscales exactas del income statement anual
    fiscal_dates = {}
    if inc_annual is not None and not inc_annual.empty:
        for col in inc_annual.columns:
            yr = str(col)[:4]
            fiscal_dates[yr] = str(col)[:10]  # "YYYY-MM-DD"

    historical = []
    for yr in ann_years:
        ebit_v  = gv(ebit_ann,   yr)
        da_v    = abs(gv(da_ann, yr))
        lt_v    = gv(ltdebt_ann, yr)
        st_v    = gv(stdebt_ann, yr)
        cash_v  = gv(cash_ann,   yr)
        opcf_v  = gv(opcf_ann,   yr)
        capex_v = gv(capex_ann,  yr)
        fcf_v   = gv(fcf_ann,    yr) or (opcf_v + capex_v)

        # Precio de cierre al fin del año fiscal
        fiscal_end = fiscal_dates.get(yr)
        hist_price = price_at_fiscal_end(fiscal_end) if fiscal_end else None

        historical.append({
            "year":        yr,
            "is_ttm":      False,
            "fiscal_end":  fiscal_end,
            "hist_price":  hist_price,
            "revenue":     gv(rev_ann, yr),
            "ebitda":      ebit_v + da_v,
            "ebit":        ebit_v,
            "net_income":  gv(ni_ann, yr),
            "fcf":         fcf_v,
            "eps":         gv(eps_ann, yr),
            "net_debt":    lt_v + st_v - cash_v,
            "cash":        cash_v,
        })

    # ── QUARTERLY DATA (para gráficos) ──────────────────────────────────────
    quarterly = []
    
    # Obtener todas las fechas de quarters disponibles
    qtrs = set()
    for df in [inc_qtr, bal_qtr, cf_qtr]:
        if df is not None and not df.empty:
            qtrs.update([str(c)[:10] for c in df.columns])
    qtrs = sorted(qtrs)[-20:]  # últimos 20 quarters (~5 años)

    for qdate in qtrs:
        def qget(df, *keys):
            if df is None or df.empty: return 0
            # buscar columna que empiece con qdate
            cols = [c for c in df.columns if str(c)[:10] == qdate]
            if not cols: return 0
            col = cols[0]
            for k in keys:
                if k in df.index:
                    v = df.loc[k, col]
                    return safe(v)
            return 0

        q_rev    = qget(inc_qtr, "Total Revenue")
        q_ebit   = qget(inc_qtr, "Operating Income", "EBIT")
        q_ni     = qget(inc_qtr, "Net Income")
        q_eps    = qget(inc_qtr, "Basic EPS", "Diluted EPS")
        q_da     = abs(qget(cf_qtr, "Depreciation And Amortization", "Depreciation"))
        q_opcf   = qget(cf_qtr, "Operating Cash Flow")
        q_capex  = qget(cf_qtr, "Capital Expenditure")
        q_fcf    = qget(cf_qtr, "Free Cash Flow") or (q_opcf + q_capex)
        q_ebitda = q_ebit + q_da
        q_ltdebt = qget(bal_qtr, "Long Term Debt")
        q_stdebt = qget(bal_qtr, "Current Debt", "Short Term Debt")
        q_cash   = qget(bal_qtr, "Cash And Cash Equivalents", "Cash")
        q_nd     = q_ltdebt + q_stdebt - q_cash
        q_shares = qget(bal_qtr, "Ordinary Shares Number", "Share Issued", "CommonStock")

        # Precio de cierre al final del quarter
        q_price  = price_at_fiscal_end(qdate)

        quarterly.append({
            "date":        qdate,
            "revenue":     q_rev,
            "ebitda":      q_ebitda,
            "ebit":        q_ebit,
            "net_income":  q_ni,
            "fcf":         q_fcf,
            "eps":         q_eps,
            "net_debt":    q_nd,
            "cash":        q_cash,
            "shares":      q_shares,
            "price":       q_price,
        })
    ttm_rev,  ttm_rev_lbl  = calc_ttm(get_row(inc_qtr, "Total Revenue"))
    ttm_ebit, _            = calc_ttm(get_row(inc_qtr, "Operating Income", "EBIT"))
    ttm_ni,   _            = calc_ttm(get_row(inc_qtr, "Net Income"))
    ttm_da,   _            = calc_ttm(get_row(cf_qtr,  "Depreciation And Amortization", "Depreciation"))
    ttm_opcf, _            = calc_ttm(get_row(cf_qtr,  "Operating Cash Flow"))
    ttm_capex,_            = calc_ttm(get_row(cf_qtr,  "Capital Expenditure"))
    ttm_fcf,  ttm_lbl      = calc_ttm(get_row(cf_qtr,  "Free Cash Flow"))
    if ttm_fcf == 0:
        ttm_fcf = ttm_opcf + ttm_capex

    # EPS TTM: sumar los últimos 4 quarters de EPS reportado directamente
    # NO calcular desde NI/shares para evitar doble ajuste
    ttm_eps_raw = get_row(inc_qtr, "Basic EPS", "Diluted EPS")
    if ttm_eps_raw is not None:
        ttm_eps, _ = calc_ttm(ttm_eps_raw)
    else:
        # fallback: NI TTM / shares solo si no hay EPS trimestral
        ttm_eps = (ttm_ni / shares) if shares else 0.0

    # Balance: último snapshot trimestral (no se suma)
    ttm_ltdebt = latest_balance_value(get_row(bal_qtr, "Long Term Debt"))
    ttm_stdebt = latest_balance_value(get_row(bal_qtr, "Current Debt", "Short Term Debt"))
    ttm_cash   = latest_balance_value(get_row(bal_qtr, "Cash And Cash Equivalents", "Cash"))
    ttm_netdebt= ttm_ltdebt + ttm_stdebt - ttm_cash

    # Año TTM: año del último quarter + "T" para distinguirlo
    ttm_year = ttm_lbl   # ej: "TTM (2025-03)"

    historical.append({
        "year":       ttm_year,
        "is_ttm":     True,
        "revenue":    ttm_rev,
        "ebitda":     ttm_ebit + abs(ttm_da),
        "ebit":       ttm_ebit,
        "net_income": ttm_ni,
        "fcf":        ttm_fcf,
        "eps":        ttm_eps,
        "net_debt":   ttm_netdebt,
        "cash":       ttm_cash,
    })

    print(f"✅  {len(historical)-1} años + TTM ({ttm_lbl}) · {len(quarterly)} quarters")

    return {
        "ticker":     ticker,
        "name":       inf.get("longName", ticker),
        "sector":     inf.get("sector", ""),
        "industry":   inf.get("industry", ""),
        "currency":   inf.get("currency", "USD"),
        "exchange":   inf.get("exchange", ""),
        "price":      price,
        "prev_close": prev_close,
        "mkt_cap":    mkt_cap,
        "shares":     shares,
        "beta":       safe(inf.get("beta")),
        "fwd_pe":     safe(inf.get("forwardPE")),
        "div_yield":  safe(inf.get("dividendYield")),
        "week52h":    safe(inf.get("fiftyTwoWeekHigh")),
        "week52l":    safe(inf.get("fiftyTwoWeekLow")),
        "historical": historical,
        "quarterly":  quarterly,
        "fetched_at": datetime.now().isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────────────────────

print("=" * 55)
print("  Stock Valuation Fetcher")
print(f"  Mag7:      {MAG7}")
print(f"  Watchlist: {WATCHLIST}")
print(f"  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
print("=" * 55)

output = {}
errors = []

for ticker in TICKERS:
    try:
        output[ticker] = fetch_ticker(ticker)
    except Exception as e:
        print(f"  ❌ {ticker}: {e}")
        errors.append(ticker)

# ── Guardar JSON ──────────────────────────────────────────────────────────────
os.makedirs(OUTPUT_DIR, exist_ok=True)  # crea la carpeta /data si no existe
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print()
print(f"✅  Guardado: {OUTPUT_FILE}")
print(f"   OK:      {[t for t in TICKERS if t not in errors]}")
if errors:
    print(f"   Errores: {errors}")
print("=" * 55)
