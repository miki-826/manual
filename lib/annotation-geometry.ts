export type Point = {
  x: number;
  y: number;
};

export type Annotation = {
  id: string;
  target: Point;
  instruction: string;
  scale?: number;
};

export const MIN_SCALE = 0.4;
export const MAX_SCALE = 6;

export type LabelBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnnotationGeometry = {
  target: Point;
  radiusX: number;
  radiusY: number;
  arrowStart: Point;
  arrowEnd: Point;
  label: LabelBox;
  lineWidth: number;
  fontSize: number;
  handle: { x: number; y: number; r: number };
};

export const DEFAULT_INSTRUCTION = "ここを押してください";

type Direction = "below" | "above" | "right" | "left";

// プレビュー(SVG)と書き出し(Canvas)で同じ配置を使うための単一ソース。
// ラベルは対象の円を避けて、最も空いている方向へ置く。文字で元のマークを隠さない。
export function getAnnotationGeometry(
  annotation: Annotation,
  width: number,
  height: number,
): AnnotationGeometry {
  const size = Math.min(width, height);
  const target = {
    x: clamp(annotation.target.x, 0, 1) * width,
    y: clamp(annotation.target.y, 0, 1) * height,
  };
  const scale = clamp(annotation.scale ?? 1, MIN_SCALE, MAX_SCALE);
  // 基準サイズは画像の短辺に比例（端末非依存で統一）。上限カットはせず、
  // 高解像度のスマホ写真でも相対的に同じ大きさに見えるようにする。
  const radiusX = Math.max(size * 0.11, 40) * scale;
  const radiusY = Math.max(size * 0.076, 28) * scale;
  const lineWidth = Math.max(5, Math.round(size * 0.008));

  const labelWidth = clamp(width * 0.36, 220, Math.max(220, width - 28));
  const labelHeight = clamp(size * 0.1, 64, 150);
  const fontSize = Math.max(20, Math.round(labelHeight * 0.32));
  const margin = Math.max(14, Math.round(size * 0.02));
  const gap = Math.max(18, Math.round(size * 0.04));

  const spaceBelow = height - (target.y + radiusY);
  const spaceAbove = target.y - radiusY;
  const spaceRight = width - (target.x + radiusX);
  const spaceLeft = target.x - radiusX;

  const placements: Array<{ dir: Direction; x: number; y: number; room: number }> = [
    {
      dir: "below",
      x: target.x - labelWidth / 2,
      y: target.y + radiusY + gap,
      room: spaceBelow - labelHeight - gap - margin,
    },
    {
      dir: "above",
      x: target.x - labelWidth / 2,
      y: target.y - radiusY - gap - labelHeight,
      room: spaceAbove - labelHeight - gap - margin,
    },
    {
      dir: "right",
      x: target.x + radiusX + gap,
      y: target.y - labelHeight / 2,
      room: spaceRight - labelWidth - gap - margin,
    },
    {
      dir: "left",
      x: target.x - radiusX - gap - labelWidth,
      y: target.y - labelHeight / 2,
      room: spaceLeft - labelWidth - gap - margin,
    },
  ];

  const best = placements.slice().sort((a, b) => b.room - a.room)[0];

  let labelX = best.x;
  let labelY = best.y;
  // 対象を隠さない主軸は固定し、副軸だけ画面内へ収める。
  if (best.dir === "below" || best.dir === "above") {
    labelX = clamp(labelX, margin, Math.max(margin, width - labelWidth - margin));
  } else {
    labelY = clamp(labelY, margin, Math.max(margin, height - labelHeight - margin));
  }

  const label = { x: labelX, y: labelY, width: labelWidth, height: labelHeight };

  const pad = Math.min(labelWidth, labelHeight) * 0.25;
  const arrowStart = getArrowStart(best.dir, label, target, pad);
  const angle = Math.atan2(arrowStart.y - target.y, arrowStart.x - target.x);
  const arrowEnd = {
    x: target.x + Math.cos(angle) * (radiusX + lineWidth * 1.5),
    y: target.y + Math.sin(angle) * (radiusY + lineWidth * 1.5),
  };

  // 大きさ変更ハンドル: 円の右下外周に置く。
  const handle = {
    x: target.x + radiusX * Math.SQRT1_2,
    y: target.y + radiusY * Math.SQRT1_2,
    r: Math.max(9, size * 0.02),
  };

  return { target, radiusX, radiusY, arrowStart, arrowEnd, label, lineWidth, fontSize, handle };
}

function getArrowStart(dir: Direction, label: LabelBox, target: Point, pad: number): Point {
  switch (dir) {
    case "below":
      return { x: clamp(target.x, label.x + pad, label.x + label.width - pad), y: label.y };
    case "above":
      return { x: clamp(target.x, label.x + pad, label.x + label.width - pad), y: label.y + label.height };
    case "right":
      return { x: label.x, y: clamp(target.y, label.y + pad, label.y + label.height - pad) };
    default:
      return { x: label.x + label.width, y: clamp(target.y, label.y + pad, label.y + label.height - pad) };
  }
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
