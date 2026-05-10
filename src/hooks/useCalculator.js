import { useState, useEffect } from "react";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRq9UJMO3pMJTBe7LCD6BlKZOCnrIm8m9YrUJXBLzBCtqTmCzdmiEDevXC9eIO9QS5qbggeu_dKn9lg/pub?output=csv";

const CATEGORIES = [
  "Blouse", "Shirt", "Tank Top", "Top", "Scarf", "jackets",
  "Trousers", "Pants", "Skirt", "Shorts", "Blazer", "Vest",
  "Dress", "Shawl", "Fabric", "Throw", "Handkerchief", "Bagcharm",
  "Accessory", "Shopping Bag", "Pouch", "Scrunchy", "Key Holder",
];

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  const numericFields = [
    "size_factor", "gsm", "metres_per_unit", "fabric_kg_per_unit",
    "E_transport", "E_electricity", "E_water", "E_tailoring",
    "E_total_kg_co2e", "avoided_kg_co2e",
  ];

  return lines.slice(1).map((line) => {
    // Handle commas inside quoted fields
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else { current += char; }
    }
    values.push(current.trim());

    const row = {};
    headers.forEach((h, i) => {
      const val = (values[i] || "").trim();
      row[h] = numericFields.includes(h) ? parseFloat(val) || 0 : val;
    });
    return row;
  });
}

function emptyItem(id) {
  return { id, category: "", title: "", size: "", quantity: 1 };
}

export function useCalculator() {
  const [lookup, setLookup]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [items, setItems]     = useState([emptyItem(Date.now())]);
  const [result, setResult]   = useState(null);

  // Fetch sheet on mount
  useEffect(() => {
    async function fetchSheet() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(SHEET_CSV_URL);
        if (!res.ok) throw new Error("Failed to fetch product data");
        const text = await res.text();
        const data = parseCSV(text);
        setLookup(data);
      } catch (err) {
        setError("Could not load product data. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchSheet();
  }, []);

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "category") { updated.title = ""; updated.size = ""; }
        if (field === "title") { updated.size = ""; }
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

  function titlesFor(category) {
    if (!category) return [];
    const set = new Set(
      lookup.filter((r) => r.product_type === category).map((r) => r.title)
    );
    return [...set].sort();
  }

  function sizesFor(title) {
    if (!title) return [];
    const set = new Set(lookup.filter((r) => r.title === title).map((r) => r.size));
    return [...set].sort();
  }

  function calculate() {
    const results = items.map((item) => {
      if (!item.title || !item.size) return { id: item.id, status: "incomplete", title: item.title || "—" };
      const row = lookup.find((r) => r.title === item.title && r.size === item.size);
      if (!row) return { id: item.id, status: "not_found", title: item.title };

      const total = parseFloat((row.E_total_kg_co2e * item.quantity).toFixed(4));
      const avoided = row.pathway === "B"
        ? parseFloat((row.avoided_kg_co2e * item.quantity).toFixed(4)) : 0;

      return {
        id: item.id, status: "ok",
        title: row.title, size: row.size, quantity: item.quantity,
        pathway: row.pathway, product_type: row.product_type,
        dye_type: row.dye_type, natural_dye: row.natural_dye,
        total_kg: total, avoided_kg: avoided,
        per_unit_kg: row.E_total_kg_co2e,
        breakdown: {
          transport:   parseFloat((row.E_transport   * item.quantity).toFixed(4)),
          electricity: parseFloat((row.E_electricity * item.quantity).toFixed(4)),
          water:       parseFloat((row.E_water       * item.quantity).toFixed(4)),
          tailoring:   parseFloat((row.E_tailoring   * item.quantity).toFixed(4)),
        },
      };
    });
    setResult(results);
  }

  function reset() {
    setItems([emptyItem(Date.now())]);
    setResult(null);
  }

  const canCalculate = !loading &&
    items.every((i) => i.category && i.title && i.size && i.quantity >= 1);

  return {
    categories: CATEGORIES,
    loading, error,
    items, updateItem, addItem, removeItem,
    titlesFor, sizesFor,
    result, calculate, reset,
    canCalculate,
  };
}