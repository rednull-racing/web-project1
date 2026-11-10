# getStockItemList テストレポート

2026-11-10。GET `/api/items/list/stock` の実装・検証完了。
20ファイル324件すべて成功（対象API122件・既存回帰202件）。失敗・skip/pending・todo・未処理例外なし。
lint・本番/テスト型検査・追加ESLint成功。必須ケースの未実装・未実行・未解決仕様はない。

[詳細設計](../../../../../../docs/design/backend/detail/items/getStockItemList.md) / [テスト設計](../../../architecture/items/list/getStockItemList.md)。コードパスはserver/基準。

## 実装と仕様

認証本人の商品のみを検索し、在庫を含むattributesと公開項目を返す専用APIを追加した。
既存normalizeJapaneseを維持し、正規化後の%・_・バックスラッシュをILIKE用にエスケープする。*等も通常文字として検索する。
ユーザー回答に従って詳細設計の本文と参考例を整合させた。既存出品一覧との共通化・置換は行わない。
専用schema・limiter・controller・usecase・service・型を追加し、既存userItemList.tsへStock用serviceを個別追加した。
一覧とcountは同一REPEATABLE READ/READ ONLY transactionで順に実行し、transaction完了後に応答する。
新usecaseのimportで既存DB非接続テストがDBを初期化しないよう、createItem/updateItem/getUploadedItemListのhttpMocksへ対象外Stock usecaseのmockを追加した。

## 最終結果

集計元: Vitest JSON `/tmp/stock-final-results.json`（一時成果物）。各assertionResultsの展開後件数。途中実行は加算していない。

| ファイル | 成功件数 |
| --- | ---: |
| `src/controllers/items/test/createItem.test.ts` | 4 |
| `src/controllers/items/test/getStockItemList.test.ts` | 7 |
| `src/controllers/items/test/getUploadedItemList.test.ts` | 7 |
| `src/controllers/items/test/updateItem.test.ts` | 6 |
| `src/validators/query/test/getStockItemList.test.ts` | 38 |
| `src/validators/query/test/getUploadedItemList.test.ts` | 38 |
| `src/usecases/items/list/test/getStockItemList.test.ts` | 21 |
| `src/usecases/items/list/test/getUploadedItemList.test.ts` | 21 |
| `test/integration/usecases/items/createItem/registration.test.ts` | 1 |
| `test/integration/usecases/items/createItem/route.test.ts` | 33 |
| `test/integration/usecases/items/getStockItemList/database.test.ts` | 18 |
| `test/integration/usecases/items/getStockItemList/registration.test.ts` | 1 |
| `test/integration/usecases/items/getStockItemList/route.test.ts` | 31 |
| `test/integration/usecases/items/getUploadedItemList/database.test.ts` | 17 |
| `test/integration/usecases/items/getUploadedItemList/registration.test.ts` | 1 |
| `test/integration/usecases/items/getUploadedItemList/route.test.ts` | 30 |
| `test/integration/usecases/items/updateItem/registration.test.ts` | 1 |
| `test/integration/usecases/items/updateItem/route.test.ts` | 37 |
| `src/services/items/query/list/test/getStockItemList.test.ts` | 6 |
| `src/services/items/query/list/test/getUploadedItemList.test.ts` | 6 |
| 合計 | 324 |

対象APIは単体72件（V01〜V03/C01〜C03/U01〜U04/S01〜S04）、DBなしHTTP32件（H01〜H13）、実DB18件（D01〜D07）。
既存回帰はgetUploadedItemList120件とcreateItem/updateItemのcontroller・route・registration82件。

- V/C/U/S: page上下限前後・型違い、keyword欠落/null/空/配列、status正規化、未知キー除去、認証ID採用、公開項目限定、関連欠落・nullable・0/false、正規化/エスケープ、同一where/transaction、依存失敗・保留・後続停止、transaction完了待機・失敗伝播が成功。
- H: 実parser/認証/schema/limiter/controller/errorHandlerを最小Expressへ接続し、401/400/429/500/200と公開内容を確認。実registerRoutesのURL到達も成功。本人単位50/51回、token/IP変更、別本人枠、59999/60000/60001ms、400/500消費・401/parser非消費、既存出品一覧との専用枠分離を確認した。
- D01/D02/D07: 本人・他人・所有者null、2status、検索列の対照、uploaded_at優先と同日時id降順、20/21件境界、空/範囲外、関連欠落・ISO日時・公開項目、商品/色/サイズの在庫JSONB・配列順・再送・非対象不変を確認。
- D03/D04: %・_・バックスラッシュ等12記号の文字検索でaXbの対照行を除外。service直接呼出しの他人seller_idでもAND本人条件を上書きできず一覧空/count0。
- D05: 実一覧SELECT後にgateを置き、repeatable read/read_only=onとobserverとのPID差を確認。別接続が自作行を削除commitしてから解放し、当該一覧/countは旧snapshot、次要求は最新状態となることを確認。
- D06: 自作行への実UPDATEを注入しSQLSTATE25006で拒否。count未実行、rollback後の新規SELECTで全自作行不変、再試行成功を確認。

## 実DBの安全条件と後片付け

DB初期化前にenv専用setupがserver/.env.test由来・NODE_ENV=test・PostgreSQL/test_dbを検査。
アプリsequelize・Model registryのdb.sequelize・独立observerの全3接続で設定DB名とcurrent_database()=test_dbを確認後、item/video/sale/userの列・nullable、主要型（attributesのJSONBを含む）とseller_id/video_id/sale_idのFKを照合してseedした。
全gate/Promise/transactionを回収後、追跡した自作IDのみをItem→Video→Sale→User順にcleanupし各残存0件を確認。hook/spy解除、全3接続close、env復元も成功。
同時実行のfixture/hook干渉を避けるためファイル間はmaxWorkers=1とした。D05内の独立接続による並行操作は実行している。
migration・sync・DB作成・全件削除・sequence巻戻しは行っていない。

## 実行コマンド

実行ディレクトリ: /home/conta/project/server。Node.js v20.20.2、Vitest 4.1.12。指定Node26環境での実行は未実施。

```bash
npm run test:run -- src/validators/query/test/getStockItemList.test.ts src/controllers/items/test/getStockItemList.test.ts src/usecases/items/list/test/getStockItemList.test.ts src/services/items/query/list/test/getStockItemList.test.ts test/integration/usecases/items/getStockItemList/ src/validators/query/test/getUploadedItemList.test.ts src/controllers/items/test/getUploadedItemList.test.ts src/usecases/items/list/test/getUploadedItemList.test.ts src/services/items/query/list/test/getUploadedItemList.test.ts test/integration/usecases/items/getUploadedItemList/ src/controllers/items/test/createItem.test.ts src/controllers/items/test/updateItem.test.ts test/integration/usecases/items/createItem/route.test.ts test/integration/usecases/items/createItem/registration.test.ts test/integration/usecases/items/updateItem/route.test.ts test/integration/usecases/items/updateItem/registration.test.ts --maxWorkers=1 --reporter=json --outputFile=/tmp/stock-final-results.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
./node_modules/.bin/eslint --config /tmp/stock-eslint.config.mjs test/fixtures/items/getStockItemList/*.ts test/fixtures/items/createItem/httpMocks.ts test/fixtures/items/updateItem/httpMocks.ts test/fixtures/items/getUploadedItemList/httpMocks.ts test/integration/usecases/items/getStockItemList/*.ts
```

全コマンドexit0。本番tsconfigが除外するtestはテスト用tsconfigで検査。通常lint対象外TSは既存ESLint/typescript-eslint recommended規則を適用する次の一時configで追加検査し、共有設定は変更していない。

```js
import eslint from "/home/conta/project/server/node_modules/@eslint/js/src/index.js";
import tseslint from "/home/conta/project/server/node_modules/typescript-eslint/dist/index.js";
export default tseslint.config({
    files: ["**/*.ts"],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
});
```

## 実行履歴・修正

初回の既存回帰120件はsandbox内で17件成功・HTTP103件失敗。Supertestの待受が制限されserverAddressでport取得に失敗し、listen EPERMも発生。承認手順で同じHTTPテストを制限外実行し120件成功（/tmp/stock-regression.json）。製品コードの失敗ではない。
その後、対象122件と既存回帰202件を上記コマンドで一括実行し324件成功。テスト起因の修正・仕様変更・skipによる回避は不要だった。

## 保証範囲・対象外

対象APIの必須設計ケースと影響する回帰を完了。実HTTP接続と実DB usecaseを分けて検証し、HTTPから実DBまでの一貫通テストは実施していない。
実アプリ全体/cron起動・本番deploy/DB・Node26・カバレッジ数値は未確認。読取APIのため業務状態遷移・通知・S3は対象外。
ページ間snapshot共有、行ロック、実通信断時rollback成功は保証しない。git diff --checkと変更文書の参照先確認も成功。
