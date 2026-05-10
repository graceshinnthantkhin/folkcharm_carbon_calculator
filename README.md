# Folkcharm Carbon Calculator — URD-202

React app for cradle-to-gate CO₂e calculation. Deploys to Vercel.

## Quick Start

```bash
npm install
npm start        # dev server at localhost:3000
npm run build    # production build → /build
```

## Deploying to Vercel

1. Push this repo to GitHub / GitLab.
2. Import the repo in Vercel dashboard.
3. Vercel auto-detects Create React App; no extra config needed (`vercel.json` included).
4. Deploy!

## Updating the Lookup Data (Data Owner)

When `folkcharm_product_emission_lookup.csv` is updated:

1. Place the new CSV in the project root (tab-separated).
2. Run the conversion script:
   ```bash
   node scripts/csv-to-json.js
   ```
3. This overwrites `src/data/lookup.js` with fresh data.
4. Verify QA test cases (see below).
5. Commit and push — Vercel auto-redeploys.

> **Never manually edit `src/data/lookup.js`** — it is generated from the CSV.

## QA Test Cases

| Product | Size | Qty | Expected Total | Expected Avoided |
|---|---|---|---|---|
| Recomposed Tang Jacket (Huchang-Red) | F | 1 | 1.3144 kg | 0 (Pathway A) |
| Kimono Shortsleeved Blouse in Closed-Loop Buak Blue | F | 10 | 6.3200 kg | 1.0350 kg (Pathway B) |

## Calculation Logic

Per README_TEAM.md and Methodology v2.2:
- Lookup by `(title, size)` in the CSV
- `total = E_total_kg_co2e × quantity`
- `avoided = avoided_kg_co2e × quantity` (only shown for Pathway B)
- Avoided is **never** subtracted from total
- If `(title, size)` not found → "Not in lookup yet" message

## File Structure

```
src/
  data/lookup.js        ← Generated from CSV (do not edit manually)
  hooks/useCalculator.js ← All lookup + calculation logic
  App.js                ← UI components
  App.css               ← Styling
scripts/
  csv-to-json.js        ← CSV → JS converter (run with Node)
```

## Team Contacts

See README_TEAM.md for role assignments (Data / Frontend / Backend / QA / Docs owners).
