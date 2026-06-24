# Demo Check

## Checked
- Desktop initial screen screenshot: `docs/qa-desktop-initial.png`
- Desktop edited screen screenshot: `docs/qa-desktop-edited.png`
- Mobile 390px initial screenshot: `docs/qa-mobile-initial.png`
- File chooser flow: image selected, editor opened.
- Manual target flow: image click created one annotation.
- Primary export button remained visible after annotation.

## 45 Second Route
Open `http://127.0.0.1:3000`, choose or paste an image, click the target point, then press `画像をコピー` or `PNG保存`.

## Fallbacks
- Clipboard unsupported or copy failure: PNG download.
- Web Share unsupported: PNG download.
- External API keys missing: no effect; the app does not call external APIs.
- OCR missing: manual click remains the primary completion route.
