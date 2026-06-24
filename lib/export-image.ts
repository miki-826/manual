import {
  DEFAULT_INSTRUCTION,
  getAnnotationGeometry,
  type Annotation,
  type Point,
} from "@/lib/annotation-geometry";

export async function exportAnnotatedImage(
  dataUrl: string,
  width: number,
  height: number,
  annotations: Annotation[],
) {
  const source = await loadCanvasImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not supported.");

  context.drawImage(source, 0, 0, width, height);
  annotations.forEach((annotation) => drawAnnotation(context, annotation, width, height));

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG export failed."));
    }, "image/png");
  });
}

export async function shareAnnotatedImage(blob: Blob, fileName: string) {
  if (!navigator.share) return false;
  const file = new File([blob], fileName, { type: "image/png" });
  const canShare = "canShare" in navigator ? navigator.canShare({ files: [file] }) : true;
  if (!canShare) return false;
  await navigator.share({
    files: [file],
    title: "ここ押して",
    text: "操作案内画像です。",
  });
  return true;
}

function drawAnnotation(context: CanvasRenderingContext2D, annotation: Annotation, width: number, height: number) {
  const geometry = getAnnotationGeometry(annotation, width, height);
  const { lineWidth } = geometry;

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  context.lineWidth = lineWidth + 5;
  context.strokeStyle = "rgba(255,255,255,0.9)";
  context.beginPath();
  context.ellipse(geometry.target.x, geometry.target.y, geometry.radiusX, geometry.radiusY, 0, 0, Math.PI * 2);
  context.stroke();

  context.lineWidth = lineWidth;
  context.strokeStyle = "#d92727";
  context.beginPath();
  context.ellipse(geometry.target.x, geometry.target.y, geometry.radiusX, geometry.radiusY, 0, 0, Math.PI * 2);
  context.stroke();

  context.lineWidth = lineWidth + 5;
  context.strokeStyle = "rgba(255,255,255,0.9)";
  context.beginPath();
  context.moveTo(geometry.arrowStart.x, geometry.arrowStart.y);
  context.lineTo(geometry.arrowEnd.x, geometry.arrowEnd.y);
  context.stroke();

  context.lineWidth = lineWidth;
  context.strokeStyle = "#d92727";
  context.beginPath();
  context.moveTo(geometry.arrowStart.x, geometry.arrowStart.y);
  context.lineTo(geometry.arrowEnd.x, geometry.arrowEnd.y);
  context.stroke();
  context.fillStyle = "#d92727";
  drawArrowHead(context, geometry.arrowStart, geometry.arrowEnd, Math.max(18, lineWidth * 3));

  drawLabel(context, annotation.instruction, geometry.label, geometry.fontSize);
  context.restore();
}

function drawArrowHead(context: CanvasRenderingContext2D, start: Point, end: Point, size: number) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - size * Math.cos(angle - Math.PI / 6), end.y - size * Math.sin(angle - Math.PI / 6));
  context.lineTo(end.x - size * Math.cos(angle + Math.PI / 6), end.y - size * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  label: { x: number; y: number; width: number; height: number },
  fontSize: number,
) {
  const { x, y, width, height } = label;
  const radius = 14;
  context.fillStyle = "rgba(255,255,255,0.97)";
  context.strokeStyle = "#d92727";
  context.lineWidth = Math.max(4, Math.round(fontSize * 0.18));
  roundRect(context, x, y, width, height, radius);
  context.fill();
  context.stroke();

  context.fillStyle = "#252525";
  context.font = `800 ${fontSize}px "Yu Gothic", "Hiragino Kaku Gothic ProN", Meiryo, system-ui, sans-serif`;
  context.textBaseline = "middle";
  context.textAlign = "left";

  const padX = Math.round(fontSize * 0.6) + 6;
  const lines = wrapText(context, text || DEFAULT_INSTRUCTION, width - padX * 2, 2);
  const lineHeight = fontSize * 1.25;
  const firstY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    context.fillText(line, x + padX, firstY + index * lineHeight);
  });
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const chars = Array.from(text);
  const lines: string[] = [];
  let current = "";

  chars.forEach((char) => {
    const next = current + char;
    if (context.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const clipped = lines.slice(0, maxLines);
    clipped[maxLines - 1] = `${clipped[maxLines - 1].slice(0, -1)}...`;
    return clipped;
  }
  return lines;
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
