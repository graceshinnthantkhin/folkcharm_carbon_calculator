import React, { useState } from "react";
import { useCalculator, useMonthlyCalculator } from "./hooks/useCalculator";
import "./App.css";

function LeafIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
    </svg>
  );
}

function PieChart({ breakdown, total, size = 220 }) {
  const colors = {
    transport: "#8fbc8f", electricity: "#d4a853",
    water: "#7bb8d4", tailoring: "#c4956a",
  };
  const labels = {
    transport: "Transport", electricity: "Electricity",
    water: "Water", tailoring: "Tailoring",
  };

  const cx = size / 2, cy = size / 2, r = size * 0.42;
  const labelR = r * 0.68;
  const entries = Object.entries(breakdown).filter(([, v]) => v > 0.00001);
  let cumulative = 0;

  const slices = entries.map(([key, val]) => {
    const pct = total > 0 ? val / total : 0;
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += pct;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    const midAngle = (startAngle + endAngle) / 2;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle),   y2 = cy + r * Math.sin(endAngle);
    const large = pct > 0.5 ? 1 : 0;
    const path = pct >= 0.9999
      ? `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 1 ${r*2} 0 a ${r} ${r} 0 1 1 -${r*2} 0`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    return { key, val, pct, path, lx, ly };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map(({ key, path }) => (
        <path key={key} d={path} fill={colors[key]} stroke="#fdfaf4" strokeWidth="2" />
      ))}
      {slices.map(({ key, pct, lx, ly }) => pct > 0.06 && (
        <g key={key + "-label"}>
          <text x={lx} y={ly - 6} textAnchor="middle" fontSize="10" fontWeight="600"
            fill="white" fontFamily="DM Sans, sans-serif">{labels[key]}</text>
          <text x={lx} y={ly + 7} textAnchor="middle" fontSize="9"
            fill="white" fontFamily="DM Sans, sans-serif">{(pct * 100).toFixed(1)}%</text>
        </g>
      ))}
    </svg>
  );
}

// ─── Mode selector ────────────────────────────────────────────────────────────
function ModeSelector({ onSelect }) {
  return (
    <div className="mode-card">
      <h2 className="form-heading">Calculate Emissions</h2>
      <p className="mode-subtitle">Choose your calculation mode</p>
      <div className="mode-options">
        <button className="mode-option" onClick={() => onSelect("batch")}>
          <span className="mode-icon">📦</span>
          <span className="mode-label">Per Batch</span>
          <span className="mode-desc">Select products and quantities manually</span>
        </button>
        <button className="mode-option" onClick={() => onSelect("monthly")}>
          <span className="mode-icon">📅</span>
          <span className="mode-label">Monthly Range</span>
          <span className="mode-desc">Aggregate production data by month</span>
        </button>
      </div>
    </div>
  );
}

// ─── Monthly range form ───────────────────────────────────────────────────────
function MonthPicker({ label, month, year, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [viewYear, setViewYear] = React.useState(year);

  const short = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const full  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  function select(i) {
    onChange({ month: full[i], year: viewYear });
    setOpen(false);
  }

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (!e.target.closest(".mp-wrap")) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="mp-wrap">
      <p className="field-label">{label}</p>
      <button className="mp-trigger" onClick={() => { setOpen(!open); setViewYear(year); }}>
        <span>{month} {year}</span>
        <span className="mp-caret">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="mp-dropdown">
          <div className="mp-year-nav">
            <button className="mp-year-btn" onClick={() => setViewYear(v => v - 1)}>‹</button>
            <span className="mp-year-label">{viewYear}</span>
            <button className="mp-year-btn" onClick={() => setViewYear(v => v + 1)}>›</button>
          </div>
          <div className="mp-grid">
            {short.map((m, i) => (
              <button
                key={m}
                className={`mp-month ${full[i] === month && viewYear === year ? "mp-month--active" : ""} ${full[i] === full[new Date().getMonth()] && viewYear === new Date().getFullYear() ? "mp-month--today" : ""}`}
                onClick={() => select(i)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MonthlyForm({ hook, onBack }) {
  const {
    fromMonth, setFromMonth, fromYear, setFromYear,
    toMonth, setToMonth, toYear, setToYear,
    loading, error, calculate,
  } = hook;

  return (
    <div className="form-area">
      <div className="form-nav">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h2 className="form-heading">Monthly Range</h2>
      </div>

      <div className="product-input-card">
        <div className="monthly-range">
          <MonthPicker
            label="From Month"
            month={fromMonth}
            year={fromYear}
            onChange={({ month, year }) => { setFromMonth(month); setFromYear(year); }}
          />
          <div className="monthly-divider">
            <div className="monthly-divider-line" />
            <div className="monthly-arrow">→</div>
            <div className="monthly-divider-line" />
          </div>
          <MonthPicker
            label="To Month"
            month={toMonth}
            year={toYear}
            onChange={({ month, year }) => { setToMonth(month); setToYear(year); }}
          />
        </div>
        {error && <p className="monthly-error">{error}</p>}
      </div>

      <button className="btn-primary" onClick={calculate} disabled={loading}>
        {loading ? "Loading..." : "Calculate"}
      </button>
    </div>
  );
}

// ─── Product input card ───────────────────────────────────────────────────────
function ProductInputCard({ item, index, categories, titlesFor, sizesFor, onUpdate, onRemove, removable }) {
  const titles = titlesFor(item.category);
  const sizes  = sizesFor(item.title);
  return (
    <div className="product-input-card">
      <div className="pic-header">
        <span className="pic-index">Product {index + 1}</span>
        {removable && <button className="btn-remove" onClick={() => onRemove(item.id)} title="Remove">✕</button>}
      </div>
      <div className="field">
        <label className="field-label">Category</label>
        <div className="select-wrapper">
          <select className="field-select" value={item.category} onChange={(e) => onUpdate(item.id, "category", e.target.value)}>
            <option value="">— Select a category —</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="field-label">Product</label>
        <div className="select-wrapper">
          <select className="field-select" value={item.title} disabled={!item.category} onChange={(e) => onUpdate(item.id, "title", e.target.value)}>
            <option value="">— Select a product —</option>
            {titles.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="field-label">Size</label>
        <div className="select-wrapper">
          <select className="field-select" value={item.size} disabled={!item.title} onChange={(e) => onUpdate(item.id, "size", e.target.value)}>
            <option value="">— Select a size —</option>
            {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="field-label">Quantity</label>
        <input type="number" className="field-input" min="1" value={item.quantity}
          onChange={(e) => onUpdate(item.id, "quantity", Math.max(1, parseInt(e.target.value) || 1))} />
      </div>
    </div>
  );
}

// ─── Individual result row ────────────────────────────────────────────────────
function ResultRow({ r, index }) {
  const colors = { transport: "#8fbc8f", electricity: "#d4a853", water: "#7bb8d4", tailoring: "#c4956a" };
  const labels = { transport: "Transport", electricity: "Electricity", water: "Water", tailoring: "Tailoring" };

  if (r.status === "not_found") return (
    <div className="result-row result-row--error">
      <span className="rr-index">#{index + 1}</span>
      <span className="rr-title">{r.title}</span>
      <span className="rr-notfound">Not in lookup yet</span>
    </div>
  );

  return (
    <div className="result-row">
      <div className="rr-top">
        <span className="rr-index">#{index + 1}</span>
        <div className="rr-info">
          <span className="rr-title">{r.title}</span>
          <span className="rr-meta">
            {r.product_type} · Size {r.size} · qty {r.quantity} · {r.dye_type}
            {r.month && ` · ${r.month} ${r.year}`}
          </span>
        </div>
        <div className="rr-nums">
          <div className="rr-total">
            <span className="rr-val">{r.total_kg.toFixed(4)}</span>
            <span className="rr-unit">kg CO₂e</span>
          </div>
          {r.pathway === "B" && (
            <div className="rr-avoided">
              <span className="rr-val">{r.avoided_kg.toFixed(4)}</span>
              <span className="rr-unit">kg avoided</span>
            </div>
          )}
        </div>
      </div>
      <div className="rr-breakdown">
        {Object.entries(r.breakdown).map(([key, val]) => (
          <div key={key} className="rr-bd-item">
            <span className="legend-dot" style={{ background: colors[key] }} />
            <span>{labels[key]}</span>
            <span className="rr-bd-val">{val.toFixed(4)} <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>kg CO₂e</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Results page ─────────────────────────────────────────────────────────────
function ResultsPage({ result, onReset, mode, monthRange }) {
  const ok = result.filter((r) => r.status === "ok");
  const grandTotal   = ok.reduce((s, r) => s + r.total_kg,   0);
  const grandAvoided = ok.reduce((s, r) => s + r.avoided_kg, 0);
  const combined = ok.reduce((acc, r) => {
    Object.entries(r.breakdown).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v; });
    return acc;
  }, { transport: 0, electricity: 0, water: 0, tailoring: 0 });

  const colors = { transport: "#8fbc8f", electricity: "#d4a853", water: "#7bb8d4", tailoring: "#c4956a" };
  const labels = { transport: "Transport", electricity: "Electricity", water: "Water", tailoring: "Tailoring" };

  return (
    <div className="results-page">
      <div className="summary-card">
        <div className="summary-left">
          <div className="result-header">
            <LeafIcon />
            <span className="pathway-badge">
              {mode === "monthly" ? `${monthRange} · ` : ""}{ok.length} product{ok.length !== 1 ? "s" : ""} calculated
            </span>
          </div>
          <div className="summary-nums">
            <div className="number-block number-block--main">
              <span className="number-label">Grand Total CO₂e</span>
              <span className="number-value">{grandTotal.toFixed(4)}</span>
              <span className="number-unit">kg CO₂e</span>
            </div>
            {grandAvoided > 0 && (
              <div className="number-block number-block--avoided">
                <span className="number-label">Total Avoided</span>
                <span className="number-value">{grandAvoided.toFixed(4)}</span>
                <span className="number-unit">kg CO₂e</span>
              </div>
            )}
          </div>

          <div className="summary-breakdown">
            <p className="breakdown-title">Combined emission breakdown</p>
            {Object.entries(combined).map(([key, val]) => {
              const pct = grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) : "0.0";
              return (
                <div key={key} className="summary-bd-row">
                  <span className="legend-dot" style={{ background: colors[key] }} />
                  <span className="summary-bd-label">{labels[key]}</span>
                  <div className="summary-bd-bar-wrap">
                    <div className="summary-bd-bar" style={{ width: `${pct}%`, background: colors[key] }} />
                  </div>
                  <span className="summary-bd-val">{val.toFixed(4)} <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>kg CO₂e</span></span>
                  <span className="summary-bd-pct">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="summary-pie">
          <PieChart breakdown={combined} total={grandTotal} size={220} />
        </div>
      </div>

      <div className="result-rows">
        <p className="section-label">Per Product</p>
        {result.map((r, i) => <ResultRow key={r.id} r={r} index={i} />)}
      </div>

      <div className="results-footer">
        <p className="methodology-note">Folkcharm LCA Methodology v2.2 · Transport factor 4.983</p>
        <button className="btn-secondary" onClick={onReset}>Calculate another</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState(null); // null | "batch" | "monthly"

  const {
    categories, loading, error,
    items, updateItem, addItem, removeItem,
    titlesFor, sizesFor,
    result: batchResult, calculate: batchCalculate,
    reset: batchReset, canCalculate,
    products, factors,
  } = useCalculator();

  const monthlyHook = useMonthlyCalculator(products, factors);
  const { result: monthlyResult, reset: monthlyReset } = monthlyHook;

  function handleReset() {
    if (mode === "batch") batchReset();
    else monthlyReset();
    setMode(null);
  }

  const activeResult = mode === "batch" ? batchResult : monthlyResult;

  const monthRange = mode === "monthly"
    ? `${monthlyHook.fromMonth} ${monthlyHook.fromYear} – ${monthlyHook.toMonth} ${monthlyHook.toYear}`
    : "";

  return (
    <div className="app">
      <div className="bg-circle bg-circle--1" />
      <div className="bg-circle bg-circle--2" />

      <header className="app-header">
        <div className="logo"><LeafIcon /><span>Folkcharm</span></div>
        <h1 className="app-title">Carbon Emission Calculator</h1>
        <p className="app-subtitle">Cradle-to-gate CO₂e · Methodology v2.2</p>
      </header>

      <main className="app-main">
        {loading ? (
          <div className="status-card">
            <div className="status-spinner" />
            <p className="status-text">Loading product data...</p>
          </div>
        ) : error ? (
          <div className="status-card status-card--error">
            <div className="not-found-icon">⚠</div>
            <p className="status-text">{error}</p>
          </div>
        ) : activeResult ? (
          <ResultsPage result={activeResult} onReset={handleReset} mode={mode} monthRange={monthRange} />
        ) : !mode ? (
          <ModeSelector onSelect={setMode} />
        ) : mode === "batch" ? (
          <div className="form-area">
            <div className="form-nav">
              <button className="btn-back" onClick={() => setMode(null)}>← Back</button>
              <h2 className="form-heading">Per Batch</h2>
            </div>
            <div className="product-cards-list">
              {items.map((item, index) => (
                <ProductInputCard
                  key={item.id} item={item} index={index}
                  categories={categories} titlesFor={titlesFor} sizesFor={sizesFor}
                  onUpdate={updateItem} onRemove={removeItem} removable={items.length > 1}
                />
              ))}
            </div>
            <button className="btn-add" onClick={addItem}>+ Add another product</button>
            <button className="btn-primary" onClick={batchCalculate} disabled={!canCalculate}>Calculate</button>
          </div>
        ) : (
          <MonthlyForm hook={monthlyHook} onBack={() => setMode(null)} />
        )}
      </main>

      <footer className="app-footer">
        <p>Internal tool · Folkcharm URD-202 · Not for external distribution</p>
      </footer>
    </div>
  );
}