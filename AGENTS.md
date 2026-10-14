# Exchange Rate Ruler - Agent Guide

## Project Overview
CLI tool to generate dual-scale exchange rate rulers (PNG + SVG). Fixed 0-2000 base currency range, auto-scales with ≤10 major ticks + minor ticks at midpoints.

## Commands

```bash
# Install deps (system Python with --break-system-packages)
pip install --break-system-packages -r requirements.txt

# Run
python3 main.py --base TWD --target KRW --rate 36 --output output
python3 main.py -b TWD -t USD -r 0.031 -o output -f png svg
python3 main.py -v  # vertical mode: labels rotated 90°, canvas taller
```

## Key Files
- `main.py` - CLI entry point
- `ruler/__init__.py` - exports `RulerConfig`, `generate_ruler`
- `ruler/models.py` - `RulerConfig`, `Scale`, `compute_scale()`, `RulerData`
- `ruler/generator.py` - `RulerGenerator` with `generate_png()` / `generate_svg()`

## Config (RulerConfig)
| Param | Default | Description |
|-------|---------|-------------|
| base_currency | "TWD" | Base currency code |
| target_currency | "KRW" | Target currency code |
| rate | 36.0 | 1 base = rate target |
| max_base | 2000.0 | Max base value (fixed range) |
| width | 1200 | Image width (px) |
| height | 200 | Image height (px) |
| dpi | 150 | PNG resolution |
| vertical | False | Rotate tick labels 90° |

## Vertical Mode (-v)
- Adds 50% height (PNG) / +60px (SVG)
- Tick labels + currency labels rotated 90° (PNG: `rotation=90`, SVG: `rotate(-90)`)
- Title/subtitle moved up, currency labels spaced further apart

## Output
- Files: `{BASE}_{TARGET}_rate_{RATE}.png/.svg` in `--output` dir
- Rate in filename uses `p` for decimal point (e.g., `36p0000`)

## Dependencies
- `matplotlib>=3.7` (PNG)
- `svgwrite>=1.4` (SVG)

## Architecture Notes
- No tests, lint, or typecheck configured
- Single-package layout, no monorepo complexity
- All logic in `ruler/` module, thin CLI in `main.py`
- Uses `matplotlib.use('Agg')` for headless PNG generation

## PWA Web Version (in `/docs`)

### Overview
Installable Progressive Web App for mobile. Dual-scale exchange rate ruler with live preview, no image export needed.

### Commands
```bash
# Local dev (HTTP, localhost only)
cd docs && python3 -m http.server 8080

# Test on LAN/phone via HTTPS tunnel
ngrok http 8080

# Deploy to GitHub Pages
git push origin main  # Settings → Pages → main / docs folder
```

### Key Files (in `/docs`)
- `index.html` - Single page app
- `app.js` - State, scale computation (ported from Python), SVG renderer, API integration
- `styles.css` - Mobile-first responsive CSS
- `manifest.json` - PWA manifest (standalone, maskable icons, shortcuts)
- `sw.js` - Service Worker (cache-first static, network-first API, offline fallback)
- `icons/icon-192.png`, `icon-512.png` - Maskable-safe icons

### Features
| Feature | Implementation |
|---------|----------------|
| Currencies | Fixed 4: TWD, USD, JPY, KRW |
| Live rate | exchangerate.host API (no key, CORS) |
| Offline | SW caches static assets + API responses (24h) |
| Manual rate override | User edits rate → "manual mode" → sync button to restore auto |
| Vertical mode | CSS `transform: rotate(90deg)` on container |
| Installability | Meets Chrome PWA criteria (manifest, SW, HTTPS, icons) |

### Config (via UI)
| Param | Default | Description |
|-------|---------|-------------|
| base_currency | TWD | Select dropdown |
| target_currency | KRW | Select dropdown |
| rate | auto | Fetched on load/currency change |
| max_base | 2000 | Number input |
| vertical | false | Checkbox |

### Local Development
```bash
cd /mnt/d/MyProj-new/ExRate/docs
python3 -m http.server 8080
# Open http://localhost:8080
```

### Deployment
1. Push to GitHub `main` branch
2. Repo Settings → Pages → Source: `Deploy from branch` / `main` / `/docs`
3. Wait for deploy → `https://<user>.github.io/ExRate/`
4. Mobile Chrome: open URL → "Install" banner appears → standalone app
5. Offline test: enable airplane mode → app still works

### API Fallback
- Primary: `https://api.exchangerate.host/latest?base=X&symbols=Y`
- Cache: `localStorage` (24h TTL) + Service Worker cache
- Fallback: Hardcoded rates in `app.js` (`FALLBACK_RATES`)