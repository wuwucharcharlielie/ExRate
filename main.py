#!/usr/bin/env python3
"""
匯率比例尺產生器

輸入兩個幣別與匯率，輸出一張雙刻度比例尺圖片（PNG + SVG）。
左側為基準幣（預設 TWD），右側為目標幣。
數值範圍固定 0~2000 基準幣，刻度不超過 10 格。
"""

import argparse
import sys
from pathlib import Path

from ruler import RulerConfig, generate_ruler


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="產生匯率比例尺圖片",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument('--base', '-b', default='TWD', help='基準幣別代碼')
    parser.add_argument('--target', '-t', default='KRW', help='目標幣別代碼')
    parser.add_argument('--rate', '-r', type=float, default=36.0,
                        help='匯率：1 base = rate target')
    parser.add_argument('--max-base', '-m', type=float, default=2000.0,
                        help='基準幣最大值')
    parser.add_argument('--width', '-w', type=int, default=1200,
                        help='圖片寬度（像素）')
    parser.add_argument('--height', type=int, default=200,
                        help='圖片高度（像素）')
    parser.add_argument('--dpi', type=int, default=150,
                        help='PNG 解析度 DPI')
    parser.add_argument('--output', '-o', default='output',
                        help='輸出目錄')
    parser.add_argument('--format', '-f', nargs='+', choices=['png', 'svg'],
                        default=['png', 'svg'], help='輸出格式')
    parser.add_argument('--quiet', '-q', action='store_true',
                        help='不輸出進度訊息')
    parser.add_argument('--vertical', '-v', action='store_true',
                        help='刻度數字順時針旋轉 90°（圖片保持橫向）')

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    config = RulerConfig(
        base_currency=args.base.upper(),
        target_currency=args.target.upper(),
        rate=args.rate,
        max_base=args.max_base,
        width=args.width,
        height=args.height,
        dpi=args.dpi,
        vertical=args.vertical,
    )

    try:
        results = generate_ruler(config, args.output, args.format)
    except Exception as e:
        print(f"錯誤: {e}", file=sys.stderr)
        return 1

    if not args.quiet:
        for fmt, path in results.items():
            print(f"已產生 {fmt.upper()}: {path}")

    return 0


if __name__ == '__main__':
    sys.exit(main())