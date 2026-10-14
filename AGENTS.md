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