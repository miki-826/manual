# Technical Plan

## Roles
- technology-researcher: `docs/technology-research.md`, `docs/api-permissions.md`
- frontend-engineer: `app/page.tsx`, `app/globals.css`, `app/layout.tsx`
- backend-engineer: 不使用。IndexedDBのみ。
- qa-engineer: lint/build、Mock 1play、390px確認。
- release-engineer: `.gitignore`, `.env.example`, deployment handoff。
- demo-producer: 45秒導線と失敗fallback確認。

## Boundaries
外部APIは呼び出さない。画像生成assetは `public/images/ui/**` から参照する。元画像と編集内容はブラウザ内保存に限定する。

## Acceptance
画像選択または貼り付け、画像クリック、注釈表示、説明文変更、Undo/Redo、PNGコピーまたは保存、復元が動くこと。
