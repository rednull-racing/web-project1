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

## 2026-10-23 再確認

createItemEditingCopyのstatusクエリ対応時もclient全体lintは29エラー・36警告で失敗した。変更したcopyUpload.tsとsellerSection/uploadButton.tsxの個別lintは成功。既存のrefs・set-state-in-effect・immutability・anyの違反は今回の修正範囲外として維持する。

## 2026-10-29 getItemDraftPage型整合時の再確認

Node.js 22.22.2で全体ESLintは23エラー・37警告。変更7 TS/TSXの個別lintは成功し、本番・テスト型検査も成功。既存のrefs・immutability・any等は今回の範囲外として保持。今回実行した全体lintの一時出力は `/tmp/item-draft-client-lint.log`。

## 2026-10-30 メタデータAPI接続時の再確認

Node22.22.2で全体lintは既存23 errors/37 warnings。今回のpage.tsx・server.ts・server.test.ts・apiServer.ts・page.spec.tsの個別lintは0 errors/既存2 warnings。本API接続の範囲外として保持。結果はclient/test/docs/report/item/itemDraftPage.mdへ記録する。
