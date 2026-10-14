import os
from typing import Optional
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import svgwrite

# 設定中文字體
plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Noto Sans CJK TC', 'Microsoft JhengHei', 'SimHei']
plt.rcParams['axes.unicode_minus'] = False

from .models import RulerConfig, RulerData


class RulerGenerator:
    def __init__(self, data: RulerData):
        self.data = data
        self.config = data.config

    def generate_png(self, output_path: str) -> str:
        """產生 PNG 圖片"""
        # 垂直模式時增加圖片高度
        fig_height = self.config.height / self.config.dpi
        if self.config.vertical:
            fig_height *= 1.5

        fig, ax = plt.subplots(
            figsize=(self.config.width / self.config.dpi, fig_height),
            dpi=self.config.dpi
        )

        # 隱藏上、右、下軸線，只保留左右
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['bottom'].set_visible(False)
        ax.spines['left'].set_visible(False)

        # 設定 x 軸範圍
        ax.set_xlim(0, self.data.max_target*1.005)
        ax.set_ylim(-0.5, 0.5)

        # 繪製中間主軸線（對應 SVG 的主軸線）
        ax.axhline(y=0, color='black', linewidth=2, xmin=0, xmax=1)

        # 隱藏 y 軸
        ax.get_yaxis().set_visible(False)

        # 關閉預設 x 軸刻度（避免底部殘留刻度）
        ax.set_xticks([])
        ax.set_xticklabels([])

        # 繪製刻度線和標籤（左側：基準幣，右側：目標幣）
        self._draw_scales(ax)

        # 標題與字幕位置：垂直模式時上移
        title = f"{self.config.base_currency} / {self.config.target_currency}  Exchange Rate Ruler"
        subtitle = f"1 {self.config.base_currency} = {self.config.rate:.4f} {self.config.target_currency}"
        if self.config.vertical:
            title_y = 1.30
            subtitle_y = 1.15
        else:
            title_y = 1.25
            subtitle_y = 1.00
        ax.text(0.5, title_y, title, transform=ax.transAxes, ha='center', fontsize=14, fontweight='bold')
        ax.text(0.5, subtitle_y, subtitle, transform=ax.transAxes, ha='center', fontsize=10, color='gray')

        plt.tight_layout()
        plt.savefig(output_path, dpi=self.config.dpi, bbox_inches='tight', facecolor='white')
        plt.close()

        return output_path

    def _draw_scales(self, ax):
        base_scale = self.data.base_scale
        target_scale = self.data.target_scale
        max_target = self.data.max_target

        # 旋轉角度：垂直模式時刻度數字順時針旋轉 90 度
        tick_rotation = 90 if self.config.vertical else 0

        # 左側刻度（基準幣）- 對應到目標幣的位置
        for tick in base_scale.ticks:
            x_pos = tick * self.config.rate
            if x_pos > max_target:
                continue
            # 主刻度線
            ax.plot([x_pos, x_pos], [-0.15, 0], 'k-', linewidth=1.5)
            # 標籤
            ax.text(x_pos, -0.22, f"{int(tick):,}", ha='center', va='top', fontsize=9,
                    rotation=tick_rotation)

        # 基準幣次要刻度（較短、較細、無標籤）
        for tick in base_scale.minor_ticks:
            x_pos = tick * self.config.rate
            if x_pos > max_target:
                continue
            ax.plot([x_pos, x_pos], [-0.08, 0], 'k-', linewidth=0.8)

        # 右側刻度（目標幣）
        for tick in target_scale.ticks:
            if tick > max_target:
                continue
            # 主刻度線（向上）
            ax.plot([tick, tick], [0, 0.15], 'k-', linewidth=1.5)
            # 標籤
            ax.text(tick, 0.22, f"{int(tick):,}", ha='center', va='bottom', fontsize=9,
                    rotation=tick_rotation)

        # 目標幣次要刻度（較短、較細、無標籤）
        for tick in target_scale.minor_ticks:
            if tick > max_target:
                continue
            ax.plot([tick, tick], [0, 0.08], 'k-', linewidth=0.8)

        # 幣別標籤（左側、base在下、target在上）
        label_x = -max_target * 0.03
        label_rotation = tick_rotation
        if self.config.vertical:
            base_y = -0.35
            target_y = 0.35
        else:
            base_y = -0.25
            target_y = 0.25
        ax.text(label_x, base_y, self.config.base_currency, ha='right', va='center',
                fontsize=12, fontweight='bold', rotation=label_rotation)
        ax.text(label_x, target_y, self.config.target_currency, ha='right', va='center',
                fontsize=12, fontweight='bold', rotation=label_rotation)

    def generate_svg(self, output_path: str) -> str:
        """產生 SVG 向量圖"""
        config = self.config
        data = self.data

        # SVG 畫布大小（加上邊距給標籤）
        margin_left = 60
        margin_right = 60
        margin_top = 50
        margin_bottom = 50
        ruler_height = 60
        
        # 垂直模式：增加畫布高度、上邊距
        if config.vertical:
            margin_top += 40
            margin_bottom += 20

        canvas_width = config.width + margin_left + margin_right
        canvas_height = margin_top + ruler_height + margin_bottom

        dwg = svgwrite.Drawing(output_path, size=(f"{canvas_width}px", f"{canvas_height}px"))

        # 背景
        dwg.add(dwg.rect(insert=(0, 0), size=('100%', '100%'), fill='white'))

        # 計算比例尺位置
        x_offset = margin_left
        y_center = margin_top + ruler_height // 2
        scale_factor = config.width / data.max_target

        # 主軸線
        dwg.add(dwg.line(
            start=(x_offset, y_center),
            end=(x_offset + config.width, y_center),
            stroke='black', stroke_width=2
        ))

        # 繪製基準幣刻度（下方）
        self._draw_svg_scale(dwg, x_offset, y_center, scale_factor,
                            data.base_scale, config.rate, data.max_target,
                            direction='down', label_offset=10, currency=config.base_currency)

        # 繪製目標幣刻度（上方）
        self._draw_svg_scale(dwg, x_offset, y_center, scale_factor,
                            data.target_scale, 1.0, data.max_target,
                            direction='up', label_offset=-10, currency=config.target_currency)

        # 幣別標籤（左側、base在下、target在上）
        label_x = x_offset - 15
        if config.vertical:
            base_y = y_center + 30
            target_y = y_center - 30
        else:
            base_y = y_center + 20
            target_y = y_center - 20
        base_label = dwg.text(config.base_currency, insert=(label_x, base_y),
                         font_size=14, font_weight='bold', text_anchor='end', dominant_baseline='middle')
        target_label = dwg.text(config.target_currency, insert=(label_x, target_y),
                         font_size=14, font_weight='bold', text_anchor='end', dominant_baseline='middle')
        if config.vertical:
            base_label.rotate(-90, center=(label_x, base_y))
            target_label.rotate(-90, center=(label_x, target_y))
        dwg.add(base_label)
        dwg.add(target_label)

        # 標題
        title = f"{config.base_currency} / {config.target_currency}  匯率尺"
        subtitle = f"1 {config.base_currency} = {config.rate:.4f} {config.target_currency}"
        if config.vertical:
            title_y = margin_top - 40
            subtitle_y = margin_top - 22
        else:
            title_y = margin_top - 25
            subtitle_y = margin_top - 10
        dwg.add(dwg.text(title, insert=(canvas_width / 2, title_y),
                         font_size=16, font_weight='bold', text_anchor='middle'))
        dwg.add(dwg.text(subtitle, insert=(canvas_width / 2, subtitle_y),
                         font_size=11, fill='gray', text_anchor='middle'))

        dwg.save()
        return output_path

    def _draw_svg_scale(self, dwg, x_offset, y_center, scale_factor,
                        scale, rate_mult, max_target, direction, label_offset, currency):
        """繪製單一側的刻度"""
        sign = 1 if direction == 'down' else -1
        tick_len = 15
        minor_tick_len = 8

        # 旋轉角度：垂直模式時刻度數字旋轉
        # matplotlib: 正值為逆時針, SVG: 正值為順時針
        # 為了方向一致，SVG 使用負值
        tick_rotation_svg = -90 if self.config.vertical else 0
        tick_rotation_png = 90 if self.config.vertical else 0

        # 主要刻度
        for tick in scale.ticks:
            x_pos = tick * rate_mult * scale_factor
            if x_pos > self.config.width:
                continue

            x = x_offset + x_pos

            # 刻度線
            dwg.add(dwg.line(
                start=(x, y_center),
                end=(x, y_center + sign * tick_len),
                stroke='black', stroke_width=1.5
            ))

            # 標籤
            label_y = y_center + sign * (tick_len + abs(label_offset))
            anchor = 'middle'
            baseline = 'auto' if direction == 'down' else 'alphabetic'
            
            text_element = dwg.text(
                f"{int(tick):,}",
                insert=(x, label_y),
                font_size=10,
                text_anchor=anchor,
                dominant_baseline=baseline
            )
            if tick_rotation_svg:
                text_element.rotate(tick_rotation_svg, center=(x, label_y))
            dwg.add(text_element)

        # 次要刻度（較短、較細、無標籤）
        for tick in scale.minor_ticks:
            x_pos = tick * rate_mult * scale_factor
            if x_pos > self.config.width:
                continue

            x = x_offset + x_pos
            dwg.add(dwg.line(
                start=(x, y_center),
                end=(x, y_center + sign * minor_tick_len),
                stroke='black', stroke_width=0.8
            ))


def generate_ruler(config: RulerConfig, output_dir: str = "output",
                   formats: Optional[list[str]] = None) -> dict[str, str]:
    """主入口：依設定產生比例尺圖片"""
    if formats is None:
        formats = ['png', 'svg']

    os.makedirs(output_dir, exist_ok=True)

    data = RulerData.from_config(config)
    generator = RulerGenerator(data)

    base_name = f"{config.base_currency}_{config.target_currency}_rate_{config.rate:.4f}".replace('.', 'p')
    results = {}

    if 'png' in formats:
        png_path = os.path.join(output_dir, f"{base_name}.png")
        generator.generate_png(png_path)
        results['png'] = png_path

    if 'svg' in formats:
        svg_path = os.path.join(output_dir, f"{base_name}.svg")
        generator.generate_svg(svg_path)
        results['svg'] = svg_path

    return results