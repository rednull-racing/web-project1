# getUploadedItemList テストレポート

2026-11-09。GET /api/items/list/uploadedの実装・検証完了。
最終実行は13ファイル202件すべて成功（対象API120件、既存回帰82件）。失敗・skip/pending・todo・未処理例外なし。lint・本番/テスト型検査・追加ESLint成功。必要ケースの未実装・未実行・仕様確認待ちはない。

[詳細設計](../../../../../../docs/design/backend/detail/items/getUploadedItemList.md) / [テスト設計](../../../architecture/items/list/getUploadedItemList.md)。以下のコードパスはserver/基準。

## 実装と確定仕様

ユーザー回答に従い、検索はitem.search_text、並びはuploaded_at DESC/id DESC、返却はJSON例の項目、関連欠落はnull、不正statusは配列/objectを含めundefinedとした。
URL・例示・DB取得列・関連include・テスト観点の矛盾を詳細設計で解消した。
実装はroutes/items.ts、middleware/rateLimit/itemsRateLimit.ts、validators/query/items.ts、controllers/items/items.ts、usecases/items/list/getUploadedItemList.ts、services/items/query/list/userItemList.ts、types/serviceType/items.ts。
認証→本人単位limiter→query検証→controller→usecaseを接続。一覧/countの所有者条件をserviceでAND固定し、同じREPEATABLE READ/READ ONLY transactionで順に取得する。usecaseで公開項目のみ選択する。
既存のcreateItem/updateItem向けモックへ新usecaseを追加してDB非接続境界を維持した。追加了承を得た既存登録テスト2ファイルはitemTrash Routerのモックを各1行補った。

## 最終実行結果

集計元はVitest JSON `/tmp/get-uploaded-item-list-results.json`（一時成果物）。assertionResultsによる実ファイル・展開後件数を集計し、再実行分は加算していない。

| ファイル                                                                 | ケースID・境界                                                      | 成功件数 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------- | -------: |
| src/validators/query/test/getUploadedItemList.test.ts                    | V01〜V03、実schema                                                  |       38 |
| src/controllers/items/test/getUploadedItemList.test.ts                   | C01〜C03、実controller/usecaseモック                                |        7 |
| src/usecases/items/list/test/getUploadedItemList.test.ts                 | U01〜U04、実usecase/normalizeJapanese、DB service/transactionモック |       21 |
| src/services/items/query/list/test/getUploadedItemList.test.ts           | S01〜S04、実service/Model・queryモック                              |        6 |
| test/integration/usecases/items/getUploadedItemList/route.test.ts        | H01〜H08/H10〜H12、実HTTP接続/usecaseモック                         |       30 |
| test/integration/usecases/items/getUploadedItemList/registration.test.ts | H09、実registerRoutes/対象外Routerモック                            |        1 |
| test/integration/usecases/items/getUploadedItemList/database.test.ts     | D01〜D06、実usecase/service/Model/DB                                |       17 |
| src/controllers/items/test/createItem.test.ts                            | 既存controller回帰                                                  |        4 |
| src/controllers/items/test/updateItem.test.ts                            | 既存controller回帰                                                  |        6 |
| test/integration/usecases/items/createItem/route.test.ts                 | 既存HTTP回帰                                                        |       33 |
| test/integration/usecases/items/createItem/registration.test.ts          | 既存登録回帰                                                        |        1 |
| test/integration/usecases/items/updateItem/route.test.ts                 | 既存HTTP回帰                                                        |       37 |
| test/integration/usecases/items/updateItem/registration.test.ts          | 既存登録回帰                                                        |        1 |
| 合計                                                                     | 13ファイル                                                          |      202 |

単体72件、対象APIのDBなしHTTP31件、実DB17件、既存回帰82件。全件成功。
実HTTPでは401/400/500/429、認証IDとvalidatedQueryの採用、raw偽装の無視、JSON公開値、成功/失敗待機を確認。50/51回・別本人・同本人のtoken/IP変更・窓59999/60000/60001ms・400/500消費・401/parser拒否非消費も成功。
単体ではpage上下限前後・keyword型・statusの全不正型、正規化/エスケープ、同じwhere/transaction、公開項目の絞込みとnull/0/false、依存ごとの失敗停止/待機・transaction完了失敗を確認した。

## 実DB・安全条件と並行処理

fixture: test/fixtures/items/getUploadedItemList/{databaseSetup,databaseFixtures}.ts。既存itemTrash/getItemTrashListのenv専用setupを再利用し、DBモジュール初期化前にserver/.env.test由来、NODE_ENV=test、PostgreSQLのtest_dbを検査した。
アプリ用sequelize・Model registry用db.sequelize・独立observerの全3接続で設定DB名とcurrent_database()=test_dbを確認。item/video/sale/userの列存在・nullable、一覧に必要な主要型とitemのseller_id/video_id/sale_idのFKを検査してからseedした。

- D01/D02: 本人・他人・所有者null、active/soldout、検索列が異なる対照、21件/20件の境界、uploaded_at優先と同日時id降順、空/範囲外、関連あり/欠落null、全公開列・ISO日時を確認。新規SELECTのsnapshotで全自作データ不変。
- D03: `%`・`_`・バックスラッシュ等12種類を通常文字として照合し、aXbの対照行が混ざらないことを確認。
- D04: serviceのwhereへ他人seller_idを渡しても本人条件を上書きできず、一覧空・count0・DB不変。
- D05: 実SELECT後のgateで実isolation=repeatable read、transaction_read_only=on、observerと異なる接続PIDを確認。observerが自作itemを削除commitしてからgate解放。既取得一覧と後続countは旧snapshotで一致し、次要求は空・0ページ。行ロックなしの読取APIでありロック待機の保証は対象外。
- D06: 実transactionへ自作行UPDATEを注入しSQLSTATE25006で拒否。count未実行、rollback後の新規SELECTで本人/他人含む全自作行不変、再試行成功。

全処理/gateを回収後、追跡した自作IDだけをItem→Video→Sale→User順にcleanupし、各テーブルの残存0件を確認。hook/spy解除、全3接続close成功、env復元も成功。
migration・sync・DB作成・全件削除・sequence巻戻しは実施していない。

## 実行コマンド

実行ディレクトリ: /home/conta/project/server。実行環境Node.js 20.20.2、Vitest 4.1.12。リポジトリ指定Node.js 26.12.1での実行は今回実施していない。

```bash
npm run test:run -- src/validators/query/test/getUploadedItemList.test.ts src/controllers/items/test/getUploadedItemList.test.ts src/usecases/items/list/test/getUploadedItemList.test.ts src/services/items/query/list/test/getUploadedItemList.test.ts test/integration/usecases/items/getUploadedItemList/ src/controllers/items/test/createItem.test.ts src/controllers/items/test/updateItem.test.ts test/integration/usecases/items/createItem/route.test.ts test/integration/usecases/items/createItem/registration.test.ts test/integration/usecases/items/updateItem/route.test.ts test/integration/usecases/items/updateItem/registration.test.ts --reporter=json --outputFile=/tmp/get-uploaded-item-list-results.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
./node_modules/.bin/eslint --config /tmp/uploaded-http-eslint.config.mjs test/fixtures/items/getUploadedItemList/*.ts test/fixtures/items/createItem/httpMocks.ts test/fixtures/items/updateItem/httpMocks.ts test/integration/usecases/items/getUploadedItemList/*.ts test/integration/usecases/items/createItem/registration.test.ts test/integration/usecases/items/updateItem/registration.test.ts
```

全コマンドexit0。通常lintはsrc対象、追加ESLintは通常対象外testのTSへ既存@eslint/js/typescript-eslint recommended規則を適用した一時configを使用（共有設定変更なし）。再現用config内容は次のとおり。

```js
import eslint from "/home/conta/project/server/node_modules/@eslint/js/src/index.js";
import tseslint from "/home/conta/project/server/node_modules/typescript-eslint/dist/index.js";
export default tseslint.config({
    files: ["**/*.ts"],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
});
```

本番tsconfigはtestを除外し、test/tsconfig.jsonで単体・結合の型も検査した。git diff --check・変更文書のリンク確認も成功。

## 初回失敗・修正履歴（同日、最終実行ですべて解消）

| ID  | 元ケース/対象                       | 観測・原因・修正と検証                                                                                                                                                                             |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | C01〜C03/H01等、httpMocks.ts        | 新usecaseを既存createItem fixtureでもmockしたため、再利用した対象APIの個別mockを上書き。対象用fixtureは対象外依存だけを明示mockし、対象mockを個別テストに維持。最終38件（controller7＋HTTP31）成功 |
| F2  | service型検査                       | Model registryのItemではSale関連が推論されない。広いunknown/anyへ逃げず、取得結果の具体型をInstanceType<typeof Item>とのintersectionへ限定してcast。本番/テスト型検査成功                          |
| F3  | H10                                 | 実行環境Node20にPromise.withResolversなし。既存形式の型付きdeferredへ置換し、resolve/reject双方の待機契約を維持。H10成功                                                                           |
| F4  | 既存createItem/updateItem登録テスト | 修正前baselineの別worktreeでも2件同じdb.ts TypeErrorを再現。対象外itemTrash Routerのモック不足。ユーザーが修正追加を了承し、各ファイル1行追加。既存回帰82件成功                                    |

初回sandbox内HTTPはlisten EPERM、DBはconnect EPERMで停止（DB本体17件未実行）。承認手順で同じガード付きコマンドを制限外で実行し成功した。通信許可に伴う接続先変更はない。
単体初回59件成功→追加controller/service込み72件成功、HTTP修正後31件成功、DB17件成功、回帰修正後82件成功を経て、最後に全13ファイル202件を一括再検証した。

## 保証範囲

対象APIの必須設計ケースは完了。最小Expressと実registerRoutesまでを検証し、アプリ全体/cron起動・本番deploy・本番DB・Node26での実行・カバレッジ数値は未確認。HTTPから実DBへの一貫通テストは行わず、実HTTP接続と実DB usecaseを分けて保証する。
更新APIでないため業務状態遷移/通知/S3は対象外。ページ間snapshot共有や実通信断時のrollback成功は保証していない。
