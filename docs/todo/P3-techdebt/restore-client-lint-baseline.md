# フロントエンドのlintを通る状態へ戻す

発見日: 2026-10-22 / 優先度: P3-techdebt

## 問題と原因

`cd client && npm run lint` が29エラー・40警告で失敗する。
Node.js 20.20.2と26.12.1でESLintのJSON出力が完全一致し、Node.js更新に依存しない。
Reactのrefs・set-state-in-effect・immutability規則、明示的anyなど既存コードの違反がある。

## 修正方針・実装内容

ESLintの指摘を再取得し、各ファイルに適用される規約を読んで個別に修正する。
ルール無効化で隠さず、表示やイベント処理の挙動を維持する。
lint・typecheck・buildを確認し、必要な画面動作を検証する。

## 対象・参照

- `client/eslint.config.mjs`（実ファイル名は作業時に確認）
- `client/src/app/item/commentSection/commentText.tsx`、`replyList.tsx`
- `client/src/components/header/searchInputPC.tsx`
- `client/src/lib/api/server.ts`
- その他の対象はlintの全出力を参照する。

## 注意事項

Node.js更新作業では修正対象外とし、既存のlint違反として記録した。
