# Multipart脆弱性修正の回帰テスト

対象は `src/routes/shopSignup.ts` の `PATCH /:id/id-card` と共通 `parseMultipartBody`。
根拠は `docs/security/server-dependencies-20261022/report.md` のMulter対応方針。
認証と既存レート制限を解析前に実行し、既存のファイル入力契約を維持する。

| ID  | 検証内容                                           | 期待結果                                               |
| --- | -------------------------------------------------- | ------------------------------------------------------ |
| M01 | 稼働4ルートファイルのmultipart定義の静的検査       | 各multipartの前に認証・レート制限が存在                |
| M02 | 実HTTP・実Multerで正常な画像                       | 元ファイル名・MIME・サイズ・bufferが後続へ渡る         |
| M03 | 未定義field、同一fieldのmaxCount超過               | LIMIT_UNEXPECTED_FILE、後続未実行                      |
| M04 | 10MiB + 1 byte                                     | LIMIT_FILE_SIZE、後続未実行                            |
| M05 | multipart終端欠落の後に正常送信                    | 不正入力を拒否し、正常な後続リクエストを処理           |
| M06 | 実shopSignup Routerで認証境界が拒否、不正multipart | 401、レート制限とcontroller未実行                      |
| M07 | 同Routerで認証通過・制限境界拒否、不正multipart    | 429、controller未実行                                  |
| M08 | 同Routerで両境界通過、同じ不正multipart            | 実parserが400で拒否、controller未実行                  |
| M09 | text field `payload[4294967294]` の後 `payload[]`  | INVALID_FIELD_NAME、controller未実行、後続正常送信成功 |

配置は `test/integration/usecases/multipart/security/route.test.ts`。M03は2ケース、合計10件。認証先行のHTTP試験は同ディレクトリの `guardOrder.test.ts`。
HTTPテストは最小Expressアプリと実parserを使う。DB・AWS・認証・Redis・本番controllerは接続しない。
M01はルート定義の静的保証。M06〜M08は実Router・実parserを使い、認証・制限・controllerは境界モックでDB/Redisを遮断する。
JWTやRedis制限内部は保証しない。M08により同じ入力がparserに到達すれば400になる前提も確認する。
M09の根拠は [Multer上流修正87a584e](https://github.com/expressjs/multer/commit/87a584e8c8d4da873292635fa1d8c4d78d985b76)。
Multer 2.4.0のfieldNestingDepth/fieldArrayIndexLimitは既定Infinity。今回は新しい上限を設定しない。
未知キーは既存Zod schemaで除去されるが、これは解析前の資源制限を保証しない。深いfieldの負荷検証は未実施。
M05は不完全なbodyであり、TCP切断・プロセス資源回収の保証とは区別する。
所有権・状態遷移・永続化・競合は変更対象外。

実行: `npm run test:run -- test/integration/usecases/multipart/security/`。
静的検査: `npm run lint`、`npm run typecheck`、`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json`。
