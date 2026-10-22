# Multipart脆弱性修正の回帰テスト

対象は `src/routes/shopSignup.ts` の `PATCH /:id/id-card` と共通 `parseMultipartBody`。
根拠は `docs/security/server-dependencies-20261022/report.md` のMulter対応方針。
認証と既存レート制限を解析前に実行し、既存のファイル入力契約を維持する。

| ID | 検証内容 | 期待結果 |
| --- | --- | --- |
| M01 | 稼働4ルートファイルのmultipart定義の静的検査 | 各multipartの前に認証・レート制限が存在 |
| M02 | 実HTTP・実Multerで正常な画像 | 元ファイル名・MIME・サイズ・bufferが後続へ渡る |
| M03 | 未定義field、同一fieldのmaxCount超過 | LIMIT_UNEXPECTED_FILE、後続未実行 |
| M04 | 10MiB + 1 byte | LIMIT_FILE_SIZE、後続未実行 |
| M05 | multipart終端欠落の後に正常送信 | 不正入力を拒否し、正常な後続リクエストを処理 |

配置は `test/integration/usecases/multipart/security/route.test.ts`。M03は2ケース、合計6件。
HTTPテストは最小Expressアプリと実parserを使う。DB・AWS・認証・Redis・本番controllerは接続しない。
M01はルート定義の静的保証であり、JWT/レート制限のHTTP応答は保証しない。
M05は不完全なbodyであり、TCP切断・プロセス資源回収の保証とは区別する。
所有権・状態遷移・永続化・競合は変更対象外。

実行: `npm run test:run -- test/integration/usecases/multipart/security/route.test.ts`。
静的検査: `npm run lint`、`npm run typecheck`、`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json`。
