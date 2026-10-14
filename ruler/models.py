from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RulerConfig:
    base_currency: str = "TWD"
    target_currency: str = "KRW"
    rate: float = 36.0
    max_base: float = 2000.0
    width: int = 800
    height: int = 200
    dpi: int = 150
    vertical: bool = False


@dataclass
class Scale:
    step: float
    start: float
    end: float
    ticks: list[float]
    minor_ticks: list[float] = field(default_factory=list)

    @property
    def count(self) -> int:
        return len(self.ticks)


def compute_scale(max_value: float, max_ticks: int = 10) -> Scale:
    """計算好看的刻度間距（1, 2, 5, 10, 20, 50, 100... 系列），不超過 max_ticks 格"""
    if max_value <= 0:
        return Scale(step=1, start=0, end=0, ticks=[0])

    raw_step = max_value / max_ticks

    # 找最接近的 "好看數字" - 用 log10 計算數量級
    import math
    magnitude = 10 ** int(math.floor(math.log10(raw_step))) if raw_step >= 1 else 1
    candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]

    step = 1
    for c in candidates:
        if c * magnitude >= raw_step:
            step = c * magnitude
            break
        else:
            step = 1000 * magnitude

    # 確保不超過 max_ticks 格（間隔數，不含 0）
    while max_value / step > max_ticks:
        step *= 2

    start = 0
    # end 正好覆蓋 max_value，不多加一格
    num_steps = int(math.ceil(max_value / step))
    end = step * num_steps
    ticks = [start + i * step for i in range(num_steps + 1)]

    # 次要刻度：主要刻度間的中點
    minor_ticks = [ticks[i] + step / 2 for i in range(len(ticks) - 1)]

    return Scale(step=step, start=start, end=end, ticks=ticks, minor_ticks=minor_ticks)


@dataclass
class RulerData:
    config: RulerConfig
    base_scale: Scale
    target_scale: Scale
    max_target: float

    @classmethod
    def from_config(cls, config: RulerConfig) -> "RulerData":
        max_target = config.max_base * config.rate
        base_scale = compute_scale(config.max_base)
        target_scale = compute_scale(max_target)
        return cls(
            config=config,
            base_scale=base_scale,
            target_scale=target_scale,
            max_target=max_target,
        )