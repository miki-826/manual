# Deployment Handoff

## GitHub
この作業時点ではGitリポジトリURLは未設定。`git remote get-url origin` は利用不可のため、push/deployは実施していない。

## Vercel
Next.jsプロジェクトとしてImportすれば動作する。必須環境変数はない。

## Supabase
未使用。サーバー保存を行わず、IndexedDBとlocalStorageでブラウザ内保存する。

## Secrets
`.env*` は `.gitignore` 対象。外部API keyは使わない。
