# getWatchItemList テストレポート

2026-11-11にNode.js 26.12.1で検証した。GET `/api/watch-history/item-list` の対象128件と既存回帰31件の計159件が成功した。最終実行の失敗・skip・未処理例外は0件。カバレッジは未計測。

[詳細設計](../../../../../docs/design/backend/detail/watchHistory/getWatchItemList.md)・[テスト設計](../../architecture/watchHistory/getWatchItemList.md)

## 検証結果

パスはserver/基準。結合テストの対象機能ディレクトリは `test/integration/usecases/watchHistory/getWatchItemList/`。

| 検証ファイル                                                                    | ケース             | 成功 | 確認内容                                                                                   |
| ------------------------------------------------------------------------------- | ------------------ | ---: | ------------------------------------------------------------------------------------------ |
| src/validators/query/test/getWatchItemList.test.ts                              | V01〜V03           |   39 | ページ境界、status、keyword、未知キーの除去                                                |
| src/controllers/watchHistory/test/getWatchItemList.test.ts                      | C01〜C03           |    7 | 認証IDと検証済み入力の引渡し、完了待機、元例外の伝播                                       |
| src/usecases/watchHistory/test/getWatchItemList.test.ts                         | U01〜U04           |   22 | 現行関数による正規化、ILIKEエスケープ、公開項目、ページ計算、途中失敗、transaction完了待機 |
| src/services/watchHistory/test/getWatchItemList.test.ts                         | S01〜S04           |    6 | 本人条件、一覧と件数の検索条件、結合と並び順、READ ONLY SQL、元例外の伝播                  |
| route.test.ts                                                                   | H01〜H08、H10〜H13 |   31 | HTTP契約、認証・レート制限・検証の優先順位、完了待機、既存DELETEの独立した枠               |
| registration.test.ts                                                            | H09                |    1 | 実registerRoutesでの到達性                                                                 |
| database.test.ts                                                                | D01〜D07           |   22 | 実DBの本人限定、検索・記号、関連null、順序・ページング、同一snapshot、書込み拒否           |
| test/integration/usecases/itemLike/getItemLikeList/{route,registration}.test.ts | 既存回帰           |   31 | 既存のいいね一覧のHTTP契約と登録                                                           |

単体では対象層を実行し、usecase・service・transaction・Modelの依存境界をケースに応じてモックした。HTTPでは実parser・JWT認証・レート制限・schema・controller・errorHandlerを通し、usecaseと管理者認可をモックした。登録テストでは実registerRoutesと対象Routerを通し、対象外Router・認証・usecaseをモックした。実DBではusecase・service・Modelを実行し、D05/D06の待機や障害注入にspyを使用した。

## 実行コマンドと静的検査

server/で以下を実行し、すべてexit 0を確認した。

```bash
npm run test:run -- src/validators/query/test/getWatchItemList.test.ts src/controllers/watchHistory/test/getWatchItemList.test.ts src/usecases/watchHistory/test/getWatchItemList.test.ts src/services/watchHistory/test/getWatchItemList.test.ts test/integration/usecases/watchHistory/getWatchItemList/ test/integration/usecases/itemLike/getItemLikeList/route.test.ts test/integration/usecases/itemLike/getItemLikeList/registration.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/watch-item-list-results.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

Vitestの実出力は `Test Files 9 passed (9)` と `Tests 159 passed (159)`。DB fixtureのファイル間干渉を避けるため1 workerで実行し、D05ではケース内で独立した接続を使用した。

通常lint対象外のfixtureと結合テストの変更TSは、ESLint APIの `overrideConfigFile: true` で既存の `@eslint/js` と `typescript-eslint` のrecommendedを適用した。対象は `test/fixtures/watchHistory/getWatchItemList/**/*.ts` と `test/integration/usecases/watchHistory/getWatchItemList/**/*.ts` の6ファイルで、診断は0件。

## 実DBの前提と確認

DB初期化前に `.env.test` 由来のPostgreSQL設定・`NODE_ENV=test`・接続先 `test_db` を確認した。アプリ・Model・別接続のすべてで設定DB名と `current_database()` を確認し、関連5テーブルの列とNULL制約、主要な型、商品statusのenum、関連FKを検査してからseedした。

D05では `REPEATABLE READ` と `READ ONLY` の実設定を確認した。一覧SELECT後に別PIDの接続で対象履歴を削除・コミットしても、同一要求の件数は削除前の値を返し、次の要求では削除が反映された。D06では読取り専用transaction内のUPDATEがSQLSTATE `25006` で拒否され、件数取得へ進まず、自作行が維持されることと再試行の成功を確認した。実COMMIT応答の通信断と本番DBは検証範囲外。

保留処理を回収し、自作IDだけをFK順に削除して残存0件を確認した。hook・spyを解除し、3接続のcloseと環境変数の復元を確認した。

## 初回実行と修正

- H01〜H13とD01〜D07の初回は、サンドボックスでHTTP待受とPostgreSQL接続が `EPERM` となった。単体74件は成功し、DBケースはseed前に中断した。接続許可を得て同じガードで再実行し、結合54件が成功した。
- F1（H05、H11〜H13）では、本番型検査がレート制限の依存型に `Request.user` が存在しないため失敗した。認証後のRequestを既存の `AuthUser` で型付けし、認証IDを使う動作を維持した。修正後に対象・回帰テストと静的検査を再実行し、すべて成功した。
