# getCartItemList テスト設計

設計日: 2026-11-11。パスはserver/基準。
仕様の根拠: [詳細設計](../../../../../docs/design/backend/detail/cart/getCartItemList.md)、ユーザーの検索正規化に関する回答、および対象APIの各層。実行結果は[レポート](../../report/cart/getCartItemList.md)へ記録する。

## 対象・境界・配置

GET /api/cart/item-listの入力、認証、レート制限、公開項目、本人限定、同一snapshotの一覧と件数を検証する。既存API置換、共通化、フロント、migration、S3・通知は対象外。

| レベル | 配置 | 実処理・モック |
| --- | --- | --- |
| validator | src/validators/query/test/getCartItemList.test.ts | 実schema。DBなし |
| controller | src/controllers/cart/test/getCartItemList.test.ts | 実controller、全cart usecaseをモック |
| usecase | src/usecases/cart/test/getCartItemList.test.ts | 実usecaseとnormalizeJapanese、serviceとtransactionをモック |
| service | src/services/cart/test/getCartItemList.test.ts | 実service、Modelメソッドとsequelize.queryをモック |
| HTTP | test/integration/usecases/cart/getCartItemList/route.test.ts | 実parser・JWT認証・制限・schema・controller・errorHandler、全cart usecaseはモック |
| 登録 | 同ディレクトリ/registration.test.ts | 実registerRoutesとCartRouter、対象外Router・認証・usecaseをモック |
| DB | 同ディレクトリ/database.test.ts | 実usecase・service・Model・PostgreSQL。D05は実取得後gate、D06はSQL失敗注入 |

## ケース

全ケースを実装する。P0は入力・認証・認可・公開契約・snapshot・停止位置、P1は登録・待機・再送を対象とする。以下のIDは複数の値を独立したテストへ展開する。

| ID | 条件・手順 | 期待結果 |
| --- | --- | --- |
| V01 | page省略、1、10000、空、0、10001、小数、配列・object等を実schemaへ渡す | 省略は1、単一文字列から整数へcoerce、範囲外・不正型は拒否 |
| V02 | keyword欠落/null/空白/文字列null/長文/配列、userId・seller_id等の未知キー | keywordはtrim、検索なしはnull、配列等拒否、未知キーを除去し元入力は維持 |
| V03 | status両値/未知値/不正型 | 両値だけ採用し残りundefined |
| C01 | 認証IDとvalidatedQueryにraw query/body偽装値を混ぜる | 認証IDと検証値だけを1回渡し200、公開結果のみ返す |
| C02 | usecase/レスポンス送信を失敗させる | 同じErrorをnextへ1回渡す。usecase失敗では成功応答なし |
| C03 | usecaseをdeferredで保留し成功/失敗へ解放 | 解放前は応答なし、解放後に成功/伝播、再実行なし |
| U01 | 日本語・英数・全角・空白・記号・空検索語、page/statusの各条件 | 現行normalizeJapaneseを用い%/_/バックスラッシュをILIKE向けescape、20件とoffset、状態条件・同じwhere/transactionを一覧とcountへ渡す |
| U02 | transaction開始/外側完了・READ ONLY設定・一覧・countを個別に失敗 | 失敗で停止し後続なし、元Errorを伝播 |
| U03 | READ ONLY設定・一覧・count・外側完了を保留 | 解放前は後続・結果確定なし、解放後に成功 |
| U04 | 余剰列入り商品・Video/Saleの欠落/null/0/false、件数0/20/21、範囲外ページ | 明示した公開項目のみ、nullable保持、空結果とtotalPages算出、モデルをそのまま返さない |
| S01 | 一覧と件数serviceのModel呼出しを観測 | Cart本人条件とItem whereを分離、一覧の最小attributes・LEFT関連・createdAt/id DESC・limit/offset、件数のItem attributes空・関連メディア/ページング/順序なし、同一transaction/where |
| S02 | READ ONLY設定呼出しを観測しSQL完了を保留 | 固定SET TRANSACTION READ ONLYと同一transaction、RAW、完了待機 |
| S03 | 一覧空配列と件数0 | そのまま伝達 |
| S04 | 各DBメソッドの失敗 | 元例外伝播、不要な後続なし |
| H01 | 正常HTTPに所有者偽装キーを混ぜる | 検証済みqueryとJWT本人のみ採用、200 JSON |
| H02 | 不正queryをHTTP送信 | INVALID_QUERY/400、usecase未実行 |
| H03 | tokenなし/無効/期限切れ | 401、usecase未実行 |
| H04 | usecaseで内部情報入り例外 | 500定型応答、情報非公開 |
| H05 | 50回→51回、本人変更、窓再開 | 50回許容・51回429、本人別枠、ヘッダーと既定本文 |
| H06 | 400/500/401/不正JSONを連続送信 | 認証後400/500のみ枠を消費 |
| H07 | queryの省略・null文字列・配列status等 | schema契約通りusecaseへ渡る |
| H08 | 公開項目とnullable関連を返す | HTTP JSONの形と値完全一致 |
| H09 | registerRoutesへ登録して要求 | 実/api/cart/item-listに到達 |
| H10 | usecase保留・解放/拒否 | HTTP成功応答の早まりなし |
| H11 | 窓の59999/60000/60001ms | 期限前拒否、一致/後に受付 |
| H12 | token・IP・偽装IDを変更 | 同一認証本人の枠を共有 |
| H13 | 一覧枠消費後に旧cart追加/削除/status | 旧経路と専用枠が独立し従来引数で到達 |
| H14 | 不正JSON+未認証 | parserの400が先、usecase未実行 |
| D01 | 本人カート21件、別検索語・他人カート・カートなし商品・null search_textをseed、正規化検索と両status・1/2/3ページ・再送 | 出品者他人/nullも含む本人行のみ、20/1/空配列、totalPages 2、状態別結果、DB不変 |
| D02 | 20件、関連あり/なし、nullable列 | 公開値完全一致・関連ID等非公開、totalPages 1、範囲外空配列、DB不変 |
| D03 | %/_/バックスラッシュ/*/正規表現記号/全角記号を保存し各語で検索 | 通常文字として一致行のみ取得、DB不変 |
| D04 | service直接呼出しでItemのseller条件とCart本人条件を交差 | 一覧/countとも本人Cart限定、Item条件で所有者を上書きしない |
| D05 | 一覧実SELECT後gate、別接続で対象Cart削除commit、gate解放 | 実repeatable read/read only、独立PID、当該応答は一覧/countとも削除前、次要求は空、商品維持 |
| D06 | READ ONLY内で自作Itemへの実UPDATEを注入し再試行 | SQLSTATE 25006、count未実行、自作全行不変、次要求成功 |
| D07 | 商品順/updatedAtと異なるCart作成日時、同時刻IDをseed | Cart.createdAt DESC/id DESC、DB不変 |

## DB fixtureと安全条件

配置: test/fixtures/cart/getCartItemList/databaseSetup.ts / databaseFixtures.ts。
setupでserver/.env.testをDB import前に読み、NODE_ENV=testとPostgreSQL/test_dbを検査し、親process値へfallbackしない。dotenvの別env読込み・検証後差替えを拒否する。
アプリsequelize、Model index内sequelize、observerの全3接続で設定DB名とcurrent_database()を検査し、Cart/Item/Video/Sale/Userの列・NULL・必要型・Item status enum・FKを検査した後のみseedする。
UUIDはemail分離のためだけに使用し、期待値は既知値と作成IDで定義する。Cart→Item→Video→Sale→UserのafterCreate hookで自作IDを追跡し、FK順の限定削除と残存0を確認する。全gateと対象Promiseをfinallyで回収した後にcleanup、hook/spy解除・全接続close・env復元する。
D05は読取専用なので行ロック待機・書込みをブロックする保証は対象外。D06以外に本番DB更新・状態遷移・書込みrollback・通知・S3が存在しないため、それらの検証は対象外。COMMIT応答喪失や本番環境のDB反映は未検証であり保証しない。

## 実行・完了条件

server/から対象を明示して実行する。実行結果はレポートへ分離する。

```bash
npm run test:run -- src/validators/query/test/getCartItemList.test.ts src/controllers/cart/test/getCartItemList.test.ts src/usecases/cart/test/getCartItemList.test.ts src/services/cart/test/getCartItemList.test.ts test/integration/usecases/cart/getCartItemList/route.test.ts test/integration/usecases/cart/getCartItemList/registration.test.ts
npm run test:run -- test/integration/usecases/cart/getCartItemList/database.test.ts
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

通常lint対象外のtest/** TSは既存ESLint/typescript-eslintによる追加検査も行う。全必須ケース成功、静的検査成功、DBガード・cleanup・全接続終了、文書・ケース・コード整合が完了条件。未実装/未実行/失敗が残れば完了にしない。
