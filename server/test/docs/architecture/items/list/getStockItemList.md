# getStockItemList テスト設計

設計日: 2026-11-10。パスはserver/基準。
根拠: [詳細設計](../../../../../../docs/design/backend/detail/items/getStockItemList.md) とユーザー回答（_も通常文字として検索・normalizeJapaneseは変更しない）。
対象: GET /api/items/list/stock。既存一覧API・client・DBスキーマは変更しない。
結果は[レポート](../../../report/items/list/getStockItemList.md)へ記録する。

## 責務・実処理とモック

- validator: src/validators/query/test/getStockItemList.test.ts。実schema、DBなし。HTTP外のnull・数値・object直接注入を区別する。
- controller: src/controllers/items/test/getStockItemList.test.ts。実controller、usecaseと対象外依存はモック。認証IDとvalidatedQueryの採用・200・next伝播・応答待機を検証。
- usecase: src/usecases/items/list/test/getStockItemList.test.ts。実normalizeJapaneseとusecase、service・transactionはモック。条件・公開項目の選択・順序・待機・停止を検証。実snapshotの保証は行わない。
- service: src/services/items/query/list/test/getStockItemList.test.ts。実service、Modelメソッドとqueryはモック。SQL optionsの完全一致を検証。
- HTTP: test/integration/usecases/items/getStockItemList/{route,registration}.test.ts。実Router/controller/parser/認証/schema/limiter/errorHandlerと、別途実registerRoutes。対象usecaseと対象外依存をモック。
- DB: test/integration/usecases/items/getStockItemList/database.test.ts。実usecase/service/model/PostgreSQL。fixtureはtest/fixtures/items/getStockItemList/。準備・schemaガード・追跡IDのみcleanup・全接続closeを完了条件とする。

## ケース（P0優先、待機・回帰はP1）

| ID              | レベル・前提/入力/手順                                                    | 期待結果・停止位置                                                                             |
| --------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| V01             | schema page省略、1、10000、指数表記、0、負数、小数、10001、空白、不正型   | default1・単一文字列coerce、整数1〜10000のみ成功                                               |
| V02             | keyword省略/null/空/空白/文字列null、trim、配列等、偽装キー               | 検索なしnull、文字列trim、不正型拒否、未知キー除去・raw不変                                    |
| V03             | status active/soldout、その他文字列、配列、object、null等                 | 有効2値維持、その他undefined                                                                   |
| C01             | 認証ID7とraw偽装ID99、validated query、空/値あり結果                      | usecaseへ認証IDと検証値のみ、200 JSON公開2キー                                                 |
| C02             | Error/AppError、送信失敗                                                  | 同じ例外next、成功なし、再実行なし                                                             |
| C03             | usecase resolve/rejectを保留                                              | 保留中応答なし、完了後200またはnext                                                            |
| U01             | page2/10000、status各分岐、半角・全角・カナ・特殊文字・空白検索語         | limit20/offset、正規化と%/\_/\エスケープ、search_text ILIKE、status条件、同じwhere/transaction |
| U02             | transaction開始/READ ONLY/一覧/count/完了を個別失敗                       | 元例外伝播、失敗段階より後の処理・成功なし                                                     |
| U03             | READ ONLY/一覧/count/外側transactionを個別保留                            | 依存をawaitし、後続処理・成功を待つ                                                            |
| U04             | 余分な親・関連idや管理値を含む行、nullable列・関連null                    | JSON例の項目のみ、0/false/null保持、件数0/20/21の切上げ                                        |
| S01             | whereに他人seller_idを混入、同じtransactionで一覧/count                   | ownerをAND固定、公開9列とLEFT関連2つ、uploaded_at/id降順、countにページ/関連なし               |
| S02/S03/S04     | READ ONLY SQL、空/0、query/findAll/countの例外                            | 同一transactionの固定SQL、空/0保持、同じ例外を伝播                                             |
| H01/H02/H07     | HTTPの本人ID・query、page/keyword不正、status配列/objectを含む正規化      | 200/400、偽装無視、不正時usecase未実行                                                         |
| H03/H04         | 未認証・署名不正・期限切れ、業務例外                                      | 401がquery拒否より優先、500の内部情報非公開                                                    |
| H05/H06/H11/H12/H13 | 50/51回、別本人・窓・不正JSON・400/500・token/IP変更                      | 本人別枠、窓再開、401/parser非消費、400/500消費、同本人の枠共有・既存出品一覧とは専用枠                                |
| H08/H09/H10     | JSON例と関連null/ISO、実registerRoutes、成功・失敗deferred                | 公開JSON・実URL到達、usecase確定前応答なし                                                     |
| D01/D02         | 2所有者と所有者null、2status、21件以上、同日時、search_text対照、関連なし | 本人・status・検索条件・順序・ページ・列/関連が契約どおり。全行不変                            |
| D05             | 一覧完了後に保留、別接続で削除commit、解放してcount・再送                         | REPEATABLE READ/READ ONLY、当該応答件数は旧snapshot、次回は最新                                |
| D06             | READ ONLY設定後に書込みを試す（自作行限定）                               | DBが拒否、元データ不変                                                                         |

D07は商品・色・サイズ在庫を持つJSONBの完全一致・配列順・再送・非対象不変を検証する。D03は12種類の記号を通常文字として検索する対照（aXb）を置く。D04はserviceへ他人seller_idを直接注入して一覧空・count0と不変を確認する。D05では独立接続PIDの差異と実分離レベル/readOnlyを確認し、削除commit後も保留中一覧・件数は旧snapshotで一致する。通常取得で行ロックは使わないため、ロック待機検出は対象外。

HTTPレート制限: 本人単位60秒50回/51回、別本人の枠、同本人のtoken/IP変更は同枠、429ヘッダー、窓59999/60000/60001ms、400/500消費、401/parser拒否非消費を検証。
状態遷移・書込みrollback・S3/通知は読取APIに存在しないため対象外。破損FKはDB制約の責務であり、関連nullは合法なnullable FKで準備する。ページ間snapshot共有・実通信断時rollbackは契約外。

## 実行と完了条件

server/で対象のsrc単体4ファイルとHTTP2ファイルを指定してnpm run test:run --を実行。DBはガード確認後にdatabase.test.tsのみ指定する。影響回帰はitems/createItem・updateItemのcontroller/route/registrationを対象とする。
npm run lint、npm run typecheck、./node_modules/.bin/tsc --noEmit -p test/tsconfig.json、および通常lint対象外の追加TSを既存ESLint/TypeScript parserで検査する。
必須ケース成功、未処理例外・skip・未解決仕様なし、DB cleanupとclose成功、設計・実装・結果が一致して完了とする。

JSONBのattributesは空オブジェクトおよび商品・色・サイズの入れ子在庫をそのまま返し、読取り前後の値を保持する。追加の在庫変換や在庫有無での絞込みは行わない。
