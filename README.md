# Folkcharm Carbon Calculator — URD-202

React app for cradle-to-gate CO₂e calculation. Deploys to Vercel.
Data is fetched live from Google Sheets — no redeploy needed when products or factors change.

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

## How Data Works

All product and emission data is fetched live from two tabs in the Folkcharm Google Sheet:

- **`products` tab** — staff adds new products here (5 columns only)
- **`factors` tab** — emission factors, GSM classes, metres per type, size factors

No code changes or redeployment needed when data changes. The app recalculates everything on load using the latest sheet values.

**Google Sheet:** `https://docs.google.com/spreadsheets/d/1xIMpQhtaNeWTSjI5M8D1BNwxkjWBb6YN9KhE1iJQ8iE`

> Both tabs must remain published via **File → Share → Publish to web → CSV** for the app to read them.

## Adding a New Product (Data Owner)

Open the `products` tab and fill in these 5 columns:

| Column | Example | Notes |
|---|---|---|
| `title` | Closed-loop Linen Blouse in Indigo | Include "closed-loop" in title for Pathway B |
| `product_type` | Blouse | Must match one of the 23 categories exactly |
| `natural_dye` | Yes | Yes or No |
| `dye_type` | Buak/Indigo | Dye name or "Undyed" |
| `sizes` | S\|M\|L\|F | Pipe-separated list of available sizes |

Everything else (GSM, metres, all emissions) is calculated automatically by the app.

## Updating Emission Factors (Data Owner)

Open the `factors` tab. The top section (Emission Factors) is the one updated yearly:

| Factor | When to update |
|---|---|
| `grid_factor` | Every year when TGO releases new Thailand grid emission factor |
| `transport_ef` | If Folkcharm changes number of collection trips per year |
| `scgrand_ef` | If SC GRAND releases an updated LCA |
| `scgrand_fraction` | If the closed-loop product mix changes |

Metres per product type and GSM class rows only change if Folkcharm changes their production process — very rare.

## Calculation Logic

Per LCA Methodology v2.2:
fabric_kg   = metres_per_unit × size_factor × gsm × 0.001 × loom_width × quantity
E_transport   = fabric_kg × transport_ef
E_electricity = fabric_kg × electricity_ef
E_water       = fabric_kg × water_ef         (only if natural_dye = Yes)
E_tailoring   = fabric_kg × tailoring_ef     (only if garment, not scarf/shawl/accessories)
E_total       = sum of above
E_avoided     = fabric_kg × scgrand_fraction × scgrand_ef   (Pathway B only, never subtracted from total)

Pathway is auto-detected: if the product title contains "closed-loop" → Pathway B, otherwise Pathway A.

## File Structure
src/
hooks/useCalculator.js  ← fetches sheets, builds factors, calculates emissions
App.js                  ← all UI components
App.css                 ← styling
public/
index.html
vercel.json
package.json

