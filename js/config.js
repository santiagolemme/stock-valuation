// ─────────────────────────────────────────────────────────────────────────────
//  CONFIG — edit this file to change GitHub settings or default parameters
// ─────────────────────────────────────────────────────────────────────────────

const GITHUB_USER = 'santiagolemme';
const GITHUB_REPO = 'stock-valuation';
const DATA_BASE   = `https://${GITHUB_USER}.github.io/${GITHUB_REPO}/data`;
const IS_GITHUB   = window.location.hostname.includes('github.io');

// Default valuation parameters (can be overridden in the UI)
const DEFAULTS = {
  per:      20,
  evcf:     20,
  evebitda: 11,
  evebit:   14,
  growth:   12,   // %
  wacc:     10,   // %
  termG:    3,    // % terminal growth for DCF
  projYears: 5,
};

// Global state
let DB             = {};
let currentTicker  = null;
let MAG7           = [];
let WATCHLIST      = [];
