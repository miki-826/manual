"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clipboard,
  Download,
  FileImage,
  ImagePlus,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import { clearSavedProject, loadSavedProject, saveProject } from "@/lib/db";
import { exportAnnotatedImage, shareAnnotatedImage } from "@/lib/export-image";
import {
  DEFAULT_INSTRUCTION,
  getAnnotationGeometry,
  MAX_SCALE,
  MIN_SCALE,
  type Annotation,
  type Point,
} from "@/lib/annotation-geometry";

type ImageState = {
  dataUrl: string;
  blob: Blob;
  name: string;
  width: number;
  height: number;
};

type ToastState = {
  tone: "ok" | "warn";
  message: string;
};

const TEMPLATES = [
  "ここを押してください",
  "ここを選択してください",
  "ここに入力してください",
  "この項目を確認してください",
  "次へ進んでください",
];

export default function Home() {
  const [image, setImage] = useState<ImageState | null>(null);
  const [history, setHistory] = useState<Annotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [hasRecovery, setHasRecovery] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveAnnotations, setLiveAnnotations] = useState<Annotation[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const annotations = useMemo(() => history[historyIndex] ?? [], [history, historyIndex]);
  const displayAnnotations = liveAnnotations ?? annotations;
  const selectedAnnotation = displayAnnotations.find((a) => a.id === selectedId) ?? null;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const showToast = useCallback((nextToast: ToastState) => {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const pushAnnotations = useCallback(
    (next: Annotation[]) => {
      const trimmed = history.slice(0, historyIndex + 1);
      setHistory([...trimmed, next]);
      setHistoryIndex(trimmed.length);
    },
    [history, historyIndex],
  );

  const readImageFile = useCallback(
    async (file: File | Blob, name = "pasted-image.png") => {
      if (!file.type.startsWith("image/")) {
        showToast({
          tone: "warn",
          message: "PNG、JPEG、WebP画像を選択してください。",
        });
        return;
      }

      const dataUrl = await blobToDataUrl(file);
      const size = await loadImageSize(dataUrl);
      const blob = file instanceof File ? file : new Blob([file], { type: file.type });
      const nextImage = {
        dataUrl,
        blob,
        name: file instanceof File ? file.name : name,
        width: size.width,
        height: size.height,
      };

      setImage(nextImage);
      setHistory([[]]);
      setHistoryIndex(0);
      setSelectedId(null);
      setLiveAnnotations(null);
      setHasRecovery(false);
      await saveProject({ image: nextImage, annotations: [] });
      showToast({ tone: "ok", message: "画像を読み込みました。押してほしい場所を選んでください。" });
    },
    [showToast],
  );

  useEffect(() => {
    loadSavedProject().then((saved) => setHasRecovery(Boolean(saved))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!image) return;
    const timer = window.setTimeout(() => {
      saveProject({ image, annotations }).catch(() => {
        showToast({ tone: "warn", message: "自動保存に失敗しました。PNG保存は利用できます。" });
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [annotations, image, showToast]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = Array.from(event.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      const file = imageItem?.getAsFile();
      if (file) {
        event.preventDefault();
        void readImageFile(file, "clipboard-image.png");
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [readImageFile]);

  const restoreProject = async () => {
    const saved = await loadSavedProject();
    if (!saved) return;
    const dataUrl = await blobToDataUrl(saved.imageBlob);
    setImage({
      dataUrl,
      blob: saved.imageBlob,
      name: saved.imageName,
      width: saved.width,
      height: saved.height,
    });
    setHistory([saved.annotations]);
    setHistoryIndex(0);
    setSelectedId(null);
    setLiveAnnotations(null);
    setHasRecovery(false);
    showToast({ tone: "ok", message: "前回の編集を復元しました。" });
  };

  const discardRecovery = async () => {
    await clearSavedProject();
    setHasRecovery(false);
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const file = Array.from(files).find((candidate) => candidate.type.startsWith("image/"));
    if (!file) return;
    try {
      await readImageFile(file);
    } catch {
      showToast({ tone: "warn", message: "画像を読み込めませんでした。別のPNG、JPEG、WebPを選んでください。" });
    }
  }, [readImageFile, showToast]);

  const handleFileInput = (event: React.FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length) void handleFiles(files).finally(() => {
      input.value = "";
    });
  };

  useEffect(() => {
    const handleNativeFileChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== "file") return;
      if (!target.id.startsWith("image-file-input")) return;
      const files = Array.from(target.files ?? []);
      if (files.length) void handleFiles(files).finally(() => {
        target.value = "";
      });
    };

    document.addEventListener("input", handleNativeFileChange, true);
    document.addEventListener("change", handleNativeFileChange, true);
    return () => {
      document.removeEventListener("input", handleNativeFileChange, true);
      document.removeEventListener("change", handleNativeFileChange, true);
    };
  }, [handleFiles]);

  useEffect(() => {
    if (!image) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      if (event.key === "Escape") {
        setSelectedId(null);
        setLiveAnnotations(null);
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        pushAnnotations(annotations.filter((a) => a.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [image, selectedId, annotations, pushAnnotations]);

  const addAnnotation = (point: Point) => {
    const id = crypto.randomUUID();
    pushAnnotations([
      ...annotations,
      { id, target: point, instruction: DEFAULT_INSTRUCTION, scale: 1 },
    ]);
    setSelectedId(id);
  };

  const updateInstruction = (instruction: string) => {
    if (!selectedAnnotation) return;
    const selected = selectedAnnotation.id;
    const next = annotations.map((annotation) =>
      annotation.id === selected ? { ...annotation, instruction } : annotation,
    );
    setHistory((current) => current.map((entry, index) => (index === historyIndex ? next : entry)));
  };

  const commitInstruction = () => {
    if (!selectedAnnotation) return;
    pushAnnotations(annotations);
  };

  const resizeSelected = (factor: number) => {
    if (!selectedAnnotation) return;
    const selected = selectedAnnotation.id;
    const scale = clamp((selectedAnnotation.scale ?? 1) * factor, MIN_SCALE, MAX_SCALE);
    pushAnnotations(annotations.map((a) => (a.id === selected ? { ...a, scale } : a)));
  };

  const removeSelected = () => {
    if (!selectedAnnotation) return;
    const selected = selectedAnnotation.id;
    pushAnnotations(annotations.filter((a) => a.id !== selected));
    setSelectedId(null);
  };

  // ドラッグ中の一時表示。確定時のみ履歴へ積む（移動/リサイズを1ステップでundo可能に）。
  const beginDrag = (next: Annotation[]) => setLiveAnnotations(next);
  const endDrag = (next: Annotation[]) => {
    setLiveAnnotations(null);
    pushAnnotations(next);
  };
  const cancelDrag = () => setLiveAnnotations(null);

  const resetAll = async () => {
    setImage(null);
    setHistory([[]]);
    setHistoryIndex(0);
    setSelectedId(null);
    setLiveAnnotations(null);
    await clearSavedProject();
    setHasRecovery(false);
  };

  const copyImage = async () => {
    if (!image) return;
    setIsExporting(true);
    try {
      const blob = await exportAnnotatedImage(image.dataUrl, image.width, image.height, annotations);
      if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
        downloadBlob(blob, makeFileName());
        showToast({ tone: "warn", message: "直接コピーできないため、PNGを保存しました。" });
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      showToast({ tone: "ok", message: "画像をコピーしました。そのまま相手へ貼り付けられます。" });
    } catch {
      const blob = await exportAnnotatedImage(image.dataUrl, image.width, image.height, annotations);
      downloadBlob(blob, makeFileName());
      showToast({ tone: "warn", message: "コピーに失敗したため、PNGを保存しました。" });
    } finally {
      setIsExporting(false);
    }
  };

  const downloadImage = async () => {
    if (!image) return;
    setIsExporting(true);
    try {
      const blob = await exportAnnotatedImage(image.dataUrl, image.width, image.height, annotations);
      downloadBlob(blob, makeFileName());
      showToast({ tone: "ok", message: "PNGを保存しました。" });
    } finally {
      setIsExporting(false);
    }
  };

  const shareImage = async () => {
    if (!image) return;
    setIsExporting(true);
    try {
      const blob = await exportAnnotatedImage(image.dataUrl, image.width, image.height, annotations);
      const shared = await shareAnnotatedImage(blob, makeFileName());
      if (!shared) {
        downloadBlob(blob, makeFileName());
        showToast({ tone: "warn", message: "共有に非対応のため、PNGを保存しました。" });
      }
    } finally {
      setIsExporting(false);
    }
  };

  const statusText = useMemo(() => {
    if (!image) return "画像を貼る";
    if (!annotations.length) return "場所を選ぶ";
    return "コピーして送る";
  }, [annotations.length, image]);

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#252525]">
      <div className="fixed inset-0 -z-10 bg-[url('/images/ui/paper-workbench.png')] bg-cover bg-center opacity-80" />
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dedbd2] bg-[#f7f7f4]/90 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#9a2c28]">LOCAL IMAGE GUIDE</p>
            <h1 className="text-2xl font-bold tracking-normal sm:text-3xl">ここ押して</h1>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-[#dedbd2] bg-white px-3 py-2 text-sm text-[#555]">
            <span className="h-2 w-2 rounded-full bg-[#28835a]" />
            <span>{statusText}</span>
          </div>
        </header>

        {!image ? (
          <section className="grid flex-1 place-items-center py-8">
            <div className="w-full max-w-3xl">
              <div className="mb-5 flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/ui/red-pen-motif.png"
                  alt=""
                  className="hidden h-24 w-24 rounded-md object-cover opacity-90 sm:block"
                />
                <div>
                  <h2 className="text-2xl font-bold sm:text-[28px]">画像を貼って、場所を選ぶだけ。</h2>
                  <p className="mt-2 max-w-2xl text-base leading-7 text-[#5f5a52]">
                    「右上のあれ」を、もう説明しなくていい。スクリーンショットはブラウザ内で処理します。
                  </p>
                </div>
              </div>

              {hasRecovery && (
                <RecoveryPrompt onRestore={restoreProject} onDiscard={discardRecovery} />
              )}

              <PasteDropZone
                isDragging={isDragging}
                onDropFiles={handleFiles}
                setIsDragging={setIsDragging}
              />
              <input
                ref={inputRef}
                id="image-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleFileInput}
                onInput={handleFileInput}
              />
            </div>
          </section>
        ) : (
          <section className="grid flex-1 gap-4 py-4 lg:grid-cols-[1fr_320px]">
            <ImageEditor
              image={image}
              annotations={displayAnnotations}
              selectedId={selectedId}
              onAddAnnotation={addAnnotation}
              onSelect={setSelectedId}
              onDragLive={beginDrag}
              onDragEnd={endDrag}
              onDragCancel={cancelDrag}
            />
            <aside className="flex flex-col gap-3">
              <ExportActions
                disabled={isExporting}
                onCopy={copyImage}
                onDownload={downloadImage}
                onShare={shareImage}
              />

              <section className="rounded-lg border border-[#dedbd2] bg-white p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold">説明文</h2>
                  <span className="text-xs text-[#8b867c]">
                    {selectedAnnotation ? "選択中の案内を編集" : "画像上の丸を押すと選択"}
                  </span>
                </div>
                <textarea
                  value={selectedAnnotation?.instruction ?? ""}
                  disabled={!selectedAnnotation}
                  onChange={(event) => updateInstruction(event.target.value)}
                  onBlur={commitInstruction}
                  rows={3}
                  className="mt-3 w-full resize-none rounded-md border border-[#d8d3ca] bg-[#fffefb] px-3 py-2 text-base outline-none transition focus-visible:border-[#d92727] focus-visible:ring-2 focus-visible:ring-[#d92727]/20 disabled:bg-[#f1eee8] disabled:text-[#8b867c]"
                  placeholder="画像上を押すと説明文を編集できます"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {TEMPLATES.map((template) => (
                    <button
                      key={template}
                      type="button"
                      disabled={!selectedAnnotation}
                      onClick={() => {
                        updateInstruction(template);
                        window.setTimeout(commitInstruction, 0);
                      }}
                      className="rounded-md border border-[#dedbd2] bg-[#faf8f2] px-3 py-2 text-sm transition hover:bg-[#f1ede2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d92727] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-[#dedbd2] bg-white p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold">大きさ</h2>
                  <span className="text-xs text-[#8b867c]">
                    {selectedAnnotation ? `${Math.round((selectedAnnotation.scale ?? 1) * 100)}%` : "未選択"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <ToolButton disabled={!selectedAnnotation} onClick={() => resizeSelected(1 / 1.2)} icon={<Minus size={18} />} label="小さく" />
                  <ToolButton disabled={!selectedAnnotation} onClick={() => resizeSelected(1.2)} icon={<Plus size={18} />} label="大きく" />
                </div>
                <p className="mt-2 text-xs leading-5 text-[#8b867c]">
                  画像上の丸をドラッグで移動、右下の白い印をドラッグで大きさを変えられます。
                </p>
              </section>

              <section className="rounded-lg border border-[#dedbd2] bg-white p-4">
                <h2 className="text-base font-bold">調整</h2>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <ToolButton disabled={!canUndo} onClick={() => setHistoryIndex(historyIndex - 1)} icon={<RotateCcw size={18} />} label="元に戻す" />
                  <ToolButton disabled={!canRedo} onClick={() => setHistoryIndex(historyIndex + 1)} icon={<RotateCw size={18} />} label="やり直す" />
                  <ToolButton disabled={!selectedAnnotation} onClick={removeSelected} icon={<Trash2 size={18} />} label="選択を削除" />
                  <ToolButton onClick={() => inputRef.current?.click()} icon={<ImagePlus size={18} />} label="新しい画像" />
                </div>
                <button
                  type="button"
                  onClick={resetAll}
                  className="mt-3 w-full rounded-md border border-[#cfc7ba] bg-white px-3 py-2.5 text-sm font-semibold transition hover:bg-[#f4f0e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d92727]"
                >
                  最初からやり直す
                </button>
              </section>

              <section className="rounded-lg border border-[#dedbd2] bg-[#fffefb] p-4 text-sm leading-6 text-[#5f5a52]">
                <p className="font-semibold text-[#252525]">外部送信なし</p>
                <p>画像、説明文、注釈はこのブラウザ内に保存します。AI APIとサーバー保存は使いません。</p>
              </section>
            </aside>
            <input
              ref={inputRef}
              id="image-file-input-editor"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={handleFileInput}
              onInput={handleFileInput}
            />
          </section>
        )}
      </div>
      {toast && <Toast toast={toast} />}
    </main>
  );
}

function PasteDropZone({
  isDragging,
  onDropFiles,
  setIsDragging,
}: {
  isDragging: boolean;
  onDropFiles: (files: FileList) => void;
  setIsDragging: (dragging: boolean) => void;
}) {
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        onDropFiles(event.dataTransfer.files);
      }}
      className={`rounded-lg border-2 border-dashed bg-white p-8 text-center transition sm:p-12 ${
        isDragging ? "border-[#d92727] shadow-[0_0_0_4px_rgba(217,39,39,0.12)]" : "border-[#cfc7ba]"
      }`}
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-md border border-[#dedbd2] bg-[#faf8f2]">
        <Upload className="text-[#d92727]" size={30} />
      </div>
      <h2 className="mt-5 text-xl font-bold">スクリーンショットを貼り付け</h2>
      <p className="mt-2 text-base leading-7 text-[#5f5a52]">Ctrl+V、ドラッグ、または画像選択で開始できます。</p>
      <label
        htmlFor="image-file-input"
        className="primary-skin-button mt-6 inline-flex min-h-12 items-center justify-center gap-2 px-6 text-base font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#252525]"
      >
        <FileImage size={19} />
        画像を選択
      </label>
      <p className="mt-5 text-sm text-[#6b6b6b]">対応形式: PNG / JPEG / WebP</p>
    </div>
  );
}

function RecoveryPrompt({ onRestore, onDiscard }: { onRestore: () => void; onDiscard: () => void }) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-[#e3c080] bg-[#fff7df] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-bold">前回の編集があります</p>
        <p className="text-sm text-[#5f5a52]">続きから再開できます。</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onRestore} className="rounded-md bg-[#252525] px-4 py-2 text-sm font-semibold text-white">
          続きから編集
        </button>
        <button type="button" onClick={onDiscard} className="rounded-md border border-[#cfc7ba] bg-white px-4 py-2 text-sm font-semibold">
          削除
        </button>
      </div>
    </div>
  );
}

type DragSession = {
  mode: "move" | "resize";
  id: string;
  base: Annotation[];
  startNorm: Point;
  startTarget: Point;
  startScale: number;
  startDistPx: number;
  moved: boolean;
  last: Annotation[];
};

function ImageEditor({
  image,
  annotations,
  selectedId,
  onAddAnnotation,
  onSelect,
  onDragLive,
  onDragEnd,
  onDragCancel,
}: {
  image: ImageState;
  annotations: Annotation[];
  selectedId: string | null;
  onAddAnnotation: (point: Point) => void;
  onSelect: (id: string) => void;
  onDragLive: (next: Annotation[]) => void;
  onDragEnd: (next: Annotation[]) => void;
  onDragCancel: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const { width, height } = image;

  const toNorm = (event: React.PointerEvent): Point | null => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const setCursor = (value: string) => {
    if (frameRef.current && frameRef.current.style.cursor !== value) {
      frameRef.current.style.cursor = value;
    }
  };

  const hitTest = (np: Point): { mode: "move" | "resize"; annotation: Annotation } | null => {
    const px = { x: np.x * width, y: np.y * height };
    const selected = annotations.find((a) => a.id === selectedId);
    if (selected) {
      const g = getAnnotationGeometry(selected, width, height);
      if (Math.hypot(px.x - g.handle.x, px.y - g.handle.y) <= g.handle.r * 1.8) {
        return { mode: "resize", annotation: selected };
      }
    }
    for (let i = annotations.length - 1; i >= 0; i -= 1) {
      const a = annotations[i];
      const g = getAnnotationGeometry(a, width, height);
      const dx = (px.x - g.target.x) / g.radiusX;
      const dy = (px.y - g.target.y) / g.radiusY;
      if (dx * dx + dy * dy <= 1) return { mode: "move", annotation: a };
    }
    return null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!frameRef.current) return;
    const np = toNorm(event);
    if (!np) return;
    const hit = hitTest(np);
    if (!hit) {
      onAddAnnotation(np);
      return;
    }
    onSelect(hit.annotation.id);
    const g = getAnnotationGeometry(hit.annotation, width, height);
    const distPx = Math.hypot(np.x * width - g.target.x, np.y * height - g.target.y) || 1;
    dragRef.current = {
      mode: hit.mode,
      id: hit.annotation.id,
      base: annotations,
      startNorm: np,
      startTarget: { ...hit.annotation.target },
      startScale: hit.annotation.scale ?? 1,
      startDistPx: distPx,
      moved: false,
      last: annotations,
    };
    frameRef.current.setPointerCapture(event.pointerId);
    setCursor(hit.mode === "resize" ? "nwse-resize" : "grabbing");
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!frameRef.current) return;
    const np = toNorm(event);
    if (!np) return;
    const drag = dragRef.current;
    if (!drag) {
      const hit = hitTest(np);
      setCursor(hit ? (hit.mode === "resize" ? "nwse-resize" : "move") : "crosshair");
      return;
    }
    let next: Annotation[];
    if (drag.mode === "move") {
      const target = {
        x: clamp(drag.startTarget.x + (np.x - drag.startNorm.x), 0, 1),
        y: clamp(drag.startTarget.y + (np.y - drag.startNorm.y), 0, 1),
      };
      next = drag.base.map((a) => (a.id === drag.id ? { ...a, target } : a));
    } else {
      const tx = drag.startTarget.x * width;
      const ty = drag.startTarget.y * height;
      const curDist = Math.hypot(np.x * width - tx, np.y * height - ty);
      const scale = clamp(drag.startScale * (curDist / drag.startDistPx), MIN_SCALE, MAX_SCALE);
      next = drag.base.map((a) => (a.id === drag.id ? { ...a, scale } : a));
    }
    drag.moved = true;
    drag.last = next;
    onDragLive(next);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setCursor("crosshair");
    if (frameRef.current?.hasPointerCapture(event.pointerId)) {
      frameRef.current.releasePointerCapture(event.pointerId);
    }
    if (!drag) return;
    if (drag.moved) onDragEnd(drag.last);
    else onDragCancel();
  };

  return (
    <section className="min-w-0 rounded-lg border border-[#dedbd2] bg-white p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">どこを押してほしいですか？</h2>
          <p className="text-sm text-[#6b6b6b]">空いた場所を押すと案内を追加。丸を押して選び、ドラッグで移動できます。</p>
        </div>
        <span className="rounded-md border border-[#dedbd2] bg-[#faf8f2] px-3 py-1.5 text-sm text-[#5f5a52]">
          {annotations.length ? `${annotations.length}個の案内` : "未指定"}
        </span>
      </div>
      <div className="overflow-auto rounded-md border border-[#d8d3ca] bg-[#f1eee8] p-2">
        <div
          ref={frameRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative mx-auto w-fit max-w-full cursor-crosshair touch-none bg-white"
          aria-label="押してほしい場所を指定"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.dataUrl}
            alt="編集対象の画像"
            className="block max-h-[68vh] max-w-full select-none object-contain"
            draggable={false}
          />
          <SvgOverlay width={width} height={height} annotations={annotations} selectedId={selectedId} />
        </div>
      </div>
    </section>
  );
}

function SvgOverlay({
  width,
  height,
  annotations,
  selectedId,
}: {
  width: number;
  height: number;
  annotations: Annotation[];
  selectedId: string | null;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <marker id="arrow-head" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
          <path d="M2,2 L10,6 L2,10 Z" fill="#d92727" />
        </marker>
      </defs>
      {annotations.map((annotation) => (
        <AnnotationShape
          key={annotation.id}
          annotation={annotation}
          width={width}
          height={height}
          selected={annotation.id === selectedId}
        />
      ))}
    </svg>
  );
}

function AnnotationShape({
  annotation,
  width,
  height,
  selected,
}: {
  annotation: Annotation;
  width: number;
  height: number;
  selected: boolean;
}) {
  const g = getAnnotationGeometry(annotation, width, height);
  const haloWidth = g.lineWidth + 5;
  const dash = Math.max(8, Math.round(g.lineWidth * 2.5));
  return (
    <g>
      <ellipse cx={g.target.x} cy={g.target.y} rx={g.radiusX} ry={g.radiusY} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={haloWidth} />
      <ellipse cx={g.target.x} cy={g.target.y} rx={g.radiusX} ry={g.radiusY} fill="none" stroke="#d92727" strokeWidth={g.lineWidth} />
      <line x1={g.arrowStart.x} y1={g.arrowStart.y} x2={g.arrowEnd.x} y2={g.arrowEnd.y} stroke="rgba(255,255,255,0.9)" strokeWidth={haloWidth} strokeLinecap="round" />
      <line
        x1={g.arrowStart.x}
        y1={g.arrowStart.y}
        x2={g.arrowEnd.x}
        y2={g.arrowEnd.y}
        stroke="#d92727"
        strokeWidth={g.lineWidth}
        strokeLinecap="round"
        markerEnd="url(#arrow-head)"
      />
      <foreignObject x={g.label.x} y={g.label.y} width={g.label.width} height={g.label.height}>
        <div
          className="annotation-label"
          style={{
            fontSize: `${g.fontSize}px`,
            padding: `${Math.round(g.fontSize * 0.35)}px ${Math.round(g.fontSize * 0.6)}px`,
          }}
        >
          {annotation.instruction}
        </div>
      </foreignObject>
      {selected && (
        <>
          <ellipse
            cx={g.target.x}
            cy={g.target.y}
            rx={g.radiusX + haloWidth}
            ry={g.radiusY + haloWidth}
            fill="none"
            stroke="#1769e0"
            strokeWidth={g.lineWidth * 0.8}
            strokeDasharray={`${dash} ${dash}`}
          />
          <circle cx={g.handle.x} cy={g.handle.y} r={g.handle.r} fill="#ffffff" stroke="#1769e0" strokeWidth={Math.max(2, g.lineWidth * 0.7)} />
        </>
      )}
    </g>
  );
}

function ExportActions({
  disabled,
  onCopy,
  onDownload,
  onShare,
}: {
  disabled: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onShare: () => void;
}) {
  return (
    <section className="rounded-lg border border-[#dedbd2] bg-white p-4">
      <button
        type="button"
        disabled={disabled}
        onClick={onCopy}
        className="primary-skin-button flex min-h-12 w-full items-center justify-center gap-2 px-4 text-base font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#252525] disabled:cursor-wait disabled:opacity-65"
      >
        <Clipboard size={19} />
        {disabled ? "作成中..." : "画像をコピー"}
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onShare}
          className="rounded-md border border-[#d8d3ca] bg-[#faf8f2] px-3 py-2.5 text-sm font-semibold transition hover:bg-[#f1ede2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d92727] disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-1.5">
            <Share2 size={16} />
            共有
          </span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onDownload}
          className="rounded-md border border-[#d8d3ca] bg-[#faf8f2] px-3 py-2.5 text-sm font-semibold transition hover:bg-[#f1ede2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d92727] disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-1.5">
            <Download size={16} />
            PNG保存
          </span>
        </button>
      </div>
    </section>
  );
}

function ToolButton({
  disabled,
  onClick,
  icon,
  label,
}: {
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#d8d3ca] bg-[#faf8f2] px-3 py-2 text-sm font-semibold transition hover:bg-[#f1ede2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d92727] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {icon}
      {label}
    </button>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  return (
    <div
      className={`fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg sm:left-auto sm:right-4 sm:translate-x-0 ${
        toast.tone === "ok" ? "border-[#9fc9ae] bg-[#eef9f1] text-[#20583d]" : "border-[#e2c075] bg-[#fff8de] text-[#6f4d00]"
      }`}
      role="status"
    >
      {toast.message}
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function makeFileName() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  return `koko-oshite-${stamp}.png`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
