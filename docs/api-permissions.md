# API Permissions

| API / Provider | Status | 用途 | 送信data | 環境変数 | 課金 | Fallback |
|---|---|---|---|---|---|---|
| OpenAI API | DENIED | なし | なし | `OPENAI_API_KEY` | なし | ルールベース/ブラウザ処理 |
| Gemini API | DENIED | なし | なし | なし | なし | ルールベース/ブラウザ処理 |
| Claude API | DENIED | なし | なし | なし | なし | ルールベース/ブラウザ処理 |
| 外部OCR API | DENIED | なし | なし | なし | なし | 手動クリック指定 |
| Supabase | DENIED | なし | なし | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | なし | IndexedDB / localStorage |
| Codex built-in image_gen | APPROVED | 開発時UI素材生成 | UI素材プロンプトのみ | なし | Codex内蔵 | 生成済みassetを静的配信 |
