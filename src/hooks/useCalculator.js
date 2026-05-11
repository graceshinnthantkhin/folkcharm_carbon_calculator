import { useState, useEffect } from "react";

// ─── Sheet URLs ───────────────────────────────────────────────────────────────
const PRODUCTS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQphA_aegbFA_wzU5etl0TD5hnMYI23OivAmZrTTJ62J0_zTO55Ho8oZ_H_J9ISza6TuX_X3-SusaEb/pub?gid=877971675&single=true&output=csv"
const FACTORS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQphA_aegbFA_wzU5etl0TD5hnMYI23OivAmZrTTJ62J0_zTO55Ho8oZ_H_J9ISza6TuX_X3-SusaEb/pub?gid=0&single=true&output=csv"
const PRODUCTION_URL ="https://docs.google.com/spreadsheets/d/e/2PACX-1vQphA_aegbFA_wzU5etl0TD5hnMYI23OivAmZrTTJ62J0_zTO55Ho8oZ_H_J9ISza6TuX_X3-SusaEb/pub?gid=1914895149&single=true&output=csv"

// ─── Categories (order for dropdown) ─────────────────────────────────────────
const CATEGORIES = [
  "Blouse", "Shirt", "Tank Top", "Top", "Scarf", "jackets",
  "Trousers", "Pants", "Skirt", "Shorts", "Blazer", "Vest",
  "Dress", "Shawl", "Fabric", "Throw", "Handkerchief", "Bagcharm",
  "Accessory", "Shopping Bag", "Pouch", "Scrunchy", "Key Holder",
];

// Off-the-loom types — no tailoring emission
const OFF_LOOM_TYPES = new Set([
  "Scarf", "Shawl", "Throw", "Handkerchief", "Fabric",
  "Scrunchy", "Bagcharm", "Accessory", "Shopping Bag", "Pouch", "Key Holder",
]);

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n");
  
  // Auto-detect delimiter — tab or comma
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim());

  return lines.slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      let values;
      if (delimiter === "\t") {
        values = line.split("\t").map((v) => v.trim());
      } else {
        // comma parser handles quoted fields
        values = [];
        let current = "";
        let inQuotes = false;
        for (let char of line) {
          if (char === '"') { inQuotes = !inQuotes; }
          else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
          else { current += char; }
        }
        values.push(current.trim());
      }

      const row = {};
      headers.forEach((h, i) => { row[h] = (values[i] || "").trim(); });
      return row;
    });
}

// ─── Build factors object from CSV rows ──────────────────────────────────────
function buildFactors(rows) {
  const f = {};
  rows.forEach((row) => {
    if (!row.Factor || !row.Value) return; // skip section header rows
    f[row.Factor.trim()] = isNaN(row.Value) ? row.Value.trim() : parseFloat(row.Value);
  });
  return f;
}

// ─── Derive GSM from factors for a given product type ────────────────────────
function getGSM(productType, factors, pathway) {
  // normalise product type to key format e.g. "Tank Top" → "tank_top"
  const key = "gsmclass_" + productType.toLowerCase().replace(/\s+/g, "_");
  const gsmClass = factors[key] || "medium";

  const gsmMap = {
    light:        factors.gsm_light        || 100,
    light_medium: factors.gsm_light_medium || 130,
    medium:       factors.gsm_medium       || 160,
    medium_heavy: factors.gsm_medium_heavy || 190,
    heavy:        factors.gsm_heavy        || 225,
  };

  let gsm = gsmMap[gsmClass] || 160;

  // Pathway B uses lighter fabric (closed-loop material)
  if (pathway === "B") gsm = Math.max(factors.gsm_light || 100, gsm - 30);

  return gsm;
}

// ─── Derive metres per unit from factors ─────────────────────────────────────
function getMetres(productType, factors) {
  const key = "metres_" + productType.toLowerCase().replace(/\s+/g, "_");
  return factors[key] || 1.0;
}

// ─── Derive size factor from factors ─────────────────────────────────────────
function getSizeFactor(size, factors) {
  const key = "size_" + size.toLowerCase().replace(/\+/g, "").replace(/\s+/g, "_");
  return factors[key] || 1.0;
}

// ─── Main emission calculator ─────────────────────────────────────────────────
function calculateEmissions(product, size, quantity, factors) {
  const pathway = /closed.?loop/i.test(product.title) ? "B" : "A";

  const gsm        = getGSM(product.product_type, factors, pathway);
  const metres     = getMetres(product.product_type, factors);
  const sizeFactor = getSizeFactor(size, factors);

  // fabric mass per unit in kg
  const metresPerUnit  = metres * sizeFactor;
  const fabricKgPerUnit = metresPerUnit * gsm * 0.001 * (factors.loom_width || 0.95);

  // total fabric kg for quantity
  const m_fabric = fabricKgPerUnit * quantity;

  const E_transport   = m_fabric * (factors.transport_ef   || 4.983);
  const E_electricity = m_fabric * (factors.electricity_ef || 0.8249);
  const E_water       = product.natural_dye === "Yes"
    ? m_fabric * (factors.water_ef || 0.004128) : 0;
  const E_tailoring   = OFF_LOOM_TYPES.has(product.product_type)
    ? 0 : m_fabric * (factors.tailoring_ef || 0.84);

  const E_total   = E_transport + E_electricity + E_water + E_tailoring;
  const E_avoided = pathway === "B"
    ? m_fabric * (factors.scgrand_fraction || 0.30) * (factors.scgrand_ef || 3.63) : 0;

  const round = (v) => parseFloat(v.toFixed(4));

  return {
    pathway,
    total_kg:    round(E_total),
    avoided_kg:  round(E_avoided),
    per_unit_kg: round(E_total / quantity),
    breakdown: {
      transport:   round(E_transport),
      electricity: round(E_electricity),
      water:       round(E_water),
      tailoring:   round(E_tailoring),
    },
  };
}

// ─── Empty item factory ───────────────────────────────────────────────────────
function emptyItem(id) {
  return { id, category: "", title: "", size: "", quantity: 1 };
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useCalculator() {
  const [products, setProducts] = useState([]);
  const [factors, setFactors]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [items, setItems]       = useState([emptyItem(Date.now())]);
  const [result, setResult]     = useState(null);

  // Fetch both sheets on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [prodRes, factRes] = await Promise.all([
          fetch(PRODUCTS_URL),
          fetch(FACTORS_URL),
        ]);

        if (!prodRes.ok || !factRes.ok) throw new Error("Fetch failed");

        const [prodText, factText] = await Promise.all([
          prodRes.text(),
          factRes.text(),
        ]);

        const prodRows  = parseCSV(prodText);
        const factRows  = parseCSV(factText);

        setProducts(prodRows);
        setFactors(buildFactors(factRows));

      } catch (err) {
        setError("Could not load data. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Titles filtered by category
  function titlesFor(category) {
    if (!category) return [];
    const set = new Set(
      products
        .filter((r) => r.product_type === category)
        .map((r) => r.title)
    );
    return [...set].sort();
  }

  // Sizes for a product — reads from sizes column (pipe-separated) or falls back to all size keys
  function sizesFor(title) {
    if (!title) return [];
    const rows = products.filter((r) => r.title === title);
    if (rows.length === 0) return [];
  
    const sizesRaw = rows[0].sizes || "";
    if (!sizesRaw.trim()) return [];
  
    // Handle both "S, M, L" and "S|M|L" formats
    const delimiter = sizesRaw.includes("|") ? "|" : ",";
    return sizesRaw.split(delimiter).map((s) => s.trim()).filter(Boolean);
  }

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "category") { updated.title = ""; updated.size = ""; }
        if (field === "title")    { updated.size = ""; }
        return updated;
      })
    );
    setResult(null);
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem(Date.now())]);
    setResult(null);
  }

  function removeItem(id) {
    setItems((prev) => prev.length > 1 ? prev.filter((i) => i.id !== id) : prev);
    setResult(null);
  }

  function calculate() {
    const results = items.map((item) => {
      if (!item.title || !item.size) {
        return { id: item.id, status: "incomplete", title: item.title || "—" };
      }

      const product = products.find((r) => r.title === item.title);
      if (!product) {
        return { id: item.id, status: "not_found", title: item.title };
      }

      const calc = calculateEmissions(product, item.size, item.quantity, factors);

      return {
        id: item.id,
        status: "ok",
        title:        product.title,
        size:         item.size,
        quantity:     item.quantity,
        pathway:      calc.pathway,
        product_type: product.product_type,
        dye_type:     product.dye_type || "—",
        natural_dye:  product.natural_dye,
        total_kg:     calc.total_kg,
        avoided_kg:   calc.avoided_kg,
        per_unit_kg:  calc.per_unit_kg,
        breakdown:    calc.breakdown,
      };
    });
    setResult(results);
  }

  function reset() {
    setItems([emptyItem(Date.now())]);
    setResult(null);
  }

  const canCalculate = !loading && !!factors &&
    items.every((i) => i.category && i.title && i.size && i.quantity >= 1);

  return {
    categories: CATEGORIES,
    loading, error,
    products, factors,
    items, updateItem, addItem, removeItem,
    titlesFor, sizesFor,
    result, calculate, reset,
    canCalculate,
  };
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export function useMonthlyCalculator(products, factors) {
  const [fromMonth, setFromMonth] = useState("January");
  const [fromYear,  setFromYear]  = useState(2026);
  const [toMonth,   setToMonth]   = useState("January");
  const [toYear,    setToYear]    = useState(2026);
  const [result,    setResult]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  async function calculate() {
    try {
      setLoading(true);
      setError(null);

      const res  = await fetch(PRODUCTION_URL);
      const text = await res.text();
      const rows = parseCSV(text);

      // Filter rows within the selected month/year range
      const fromIdx = MONTHS.indexOf(fromMonth) + (fromYear * 12);
      const toIdx   = MONTHS.indexOf(toMonth)   + (toYear   * 12);

      const filtered = rows.filter((row) => {
        const rowIdx = MONTHS.indexOf(row.month) + (parseInt(row.year) * 12);
        return rowIdx >= fromIdx && rowIdx <= toIdx;
      });

      if (filtered.length === 0) {
        setError("No production data found for the selected range.");
        setLoading(false);
        return;
      }

      // Calculate emissions for each production row
      const results = filtered.map((row) => {
        const product = products.find((p) => p.title === row.title);
        if (!product) {
          return {
            id: row.title + row.month + row.year,
            status: "not_found",
            title: row.title,
            month: row.month,
            year: row.year,
          };
        }

        const qty  = parseInt(row.quantity) || 1;
        const calc = calculateEmissions(product, row.size, qty, factors);

        return {
          id: row.title + row.month + row.year + row.size,
          status: "ok",
          title:        product.title,
          size:         row.size,
          quantity:     qty,
          month:        row.month,
          year:         row.year,
          pathway:      calc.pathway,
          product_type: product.product_type,
          dye_type:     product.dye_type || "—",
          natural_dye:  product.natural_dye,
          total_kg:     calc.total_kg,
          avoided_kg:   calc.avoided_kg,
          per_unit_kg:  calc.per_unit_kg,
          breakdown:    calc.breakdown,
        };
      });

      setResult(results);
    } catch (err) {
      setError("Could not load production data. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
  }

  return {
    months: MONTHS,
    fromMonth, setFromMonth,
    fromYear,  setFromYear,
    toMonth,   setToMonth,
    toYear,    setToYear,
    result, loading, error,
    calculate, reset,
  };
}