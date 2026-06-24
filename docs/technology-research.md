# Technology Research

調査日時: 2026-06-24

## ADOPT
- Next.js App Router + TypeScript + Tailwind CSS: 新規MVPの標準構成。公式: https://nextjs.org/docs/app/getting-started
- Browser Clipboard API: PNG Blobのコピーに利用し、非対応時はPNG保存へfallback。公式: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/write
- Web Share API: モバイル共有の任意導線。非対応時はPNG保存へfallback。公式: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
- Dexie.js / IndexedDB: 元画像Blobと注釈状態のブラウザ内保存。公式: https://dexie.org/docs/
- Canvas API + SVG overlay: 編集中はSVG、出力時はCanvasでPNG化。公式: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

## KEEP FOR LATER
- Tesseract.js: OCR候補検出はPhase 3で導入可能。今回の完成条件は手動指定で満たす。公式: https://tesseract.projectnaptha.com/

## REJECT
- OpenAI API / Gemini API / Claude API / 外部OCR API: main.mdが有料AI APIと外部送信を除外しているため不採用。
- Supabase: サーバー保存を原則行わないため不採用。LocalStorage/IndexedDB fallbackのみ。

## Fallback
API keyなし、外部通信なしで、画像読み込み、注釈、PNG保存まで完結する。ClipboardやShareが使えない場合もPNG保存に落とす。
