# createItemTrash 統合レポート

実施日: 2026-11-05。実行ディレクトリ: server/。
[詳細設計](../../../../../docs/design/backend/detail/itemTrash/createItemTrash.md) / [テスト設計](../../architecture/itemTrash/createItemTrash.md)

## 最新状態

検証完了。POST /api/item-trash、本番各層・Model変更・migration、単体/HTTP/実DBテスト・fixtureを整備した。
単体57件・HTTP28件・実DB13件・競合2件の計100件が最終一括実行で成功（10ファイル、skip・失敗・未処理例外なし）。静的検査も成功。
ユーザーの明示許可により今回のmigration 2件をtest_dbへ適用済み。適用後のスキーマ検査、ID限定cleanup・残存0件、全接続closeを確認した。
今回のDB適用先はtest_dbのみ。downの実行は行っていない。

## 本番変更

- 所有ItemをFOR UPDATE取得し、video→sale→shippingも順番にロックして退避。欠落関連はNULL、価格はsale.before_priceをそのまま採用。在庫・URL・任意列の値を保持。
- 同じtransactionで通報参照を明示NULL更新し、関連とItemを削除。commit後の通知は非待機、失敗を捕捉し成功を維持。
- ItemTrash.item_idのFKとItemへのassociateを廃止し、削除後も元商品IDを履歴として保持。
- Orders/PurchaseSession/ItemEditingのitem_idはnullable・SET NULL、ItemReportはnullable・NO ACTION。
- 新規migration: migrations/20261105100000-preserve-item-trash-and-related-records.js と migrations/20261105101000-make-detached-item-references-nullable.js。up/downを作成、既存migrationは変更なし。
- Sequelize 6がREFERENCES付きchangeColumnでNOT NULL解除を省略するため、追加migrationでPurchaseSession/ItemReportのitem_idを明示DROP NOT NULL。downは孤立履歴IDやNULLが旧制約に反する場合、データ補正せず失敗する。
- 旧削除/復元API、期限削除cron、S3実体処理は変更なし。

## 実行結果と保証範囲

| 対象                      | 実行コマンド・範囲                                                                          | 結果                                           |
| ------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| usecase・取得/作成service | npm run test:run -- src/usecases/itemTrash/test src/services/itemTrash/test                 | 39件成功                                       |
| 関連削除・通報更新service | 対象4ディレクトリのtest/createItemTrash.test.tsを明示                                       | 18件成功                                       |
| HTTP                      | npm run test:run -- test/integration/usecases/itemTrash/createItemTrash（競合テスト追加前） | 28件成功                                       |
| 統合後のDB非接続テスト    | 下記の8ファイル指定コマンド                                                                 | 85件成功、8ファイル成功、未処理例外なし        |
| 修正後service再確認       | video/sale/itemShippingProfileのtest/createItemTrash.test.tsを明示                          | 12件成功（85件へ重複加算しない）               |
| lint                      | npm run lint                                                                                | 成功                                           |
| 本番型                    | npm run typecheck                                                                           | 成功                                           |
| テスト型                  | ./node_modules/.bin/tsc --noEmit -p test/tsconfig.json                                      | モック型修正後に成功                           |
| 対象test/\*_/_.ts追加lint | 下記ESLint API、fixture3件・DB1件・HTTP2件・競合1件                                         | エラー/警告0                                   |
| migration構文             | node --check migrations/20261105100000-preserve-item-trash-and-related-records.js           | 成功（適用結果ではない）                       |
| 実DB                      | 下記DB/競合コマンド                                                                         | 適用後2ファイル・15件成功                      |
| 最終一括実行              | 下記最終コマンド                                                                            | 10ファイル・100件成功、skip・失敗・未処理例外0 |

```bash
npm run test:run -- src/usecases/itemTrash/test src/services/itemTrash/test src/services/video/test/createItemTrash.test.ts src/services/sale/test/createItemTrash.test.ts src/services/itemShippingProfile/test/createItemTrash.test.ts src/services/itemReport/test/createItemTrash.test.ts test/integration/usecases/itemTrash/createItemTrash/route.test.ts test/integration/usecases/itemTrash/createItemTrash/registration.test.ts
npm run test:run -- test/integration/database/itemTrash/createItemTrash test/integration/usecases/itemTrash/createItemTrash/concurrency.test.ts
```

追加lintはESLint APIのoverrideConfigへtest/\*_/_.tsを指定し、既存typescript-eslint.parser/pluginとconfigs.recommendedのrulesを使用。既存共有設定は変更しない。
実行コード（server/からnode --input-type=moduleへ渡す）:

```js
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
const eslint = new ESLint({
    overrideConfig: [
        {
            files: ["test/**/*.ts"],
            languageOptions: { parser: tseslint.parser },
            plugins: { "@typescript-eslint": tseslint.plugin },
            rules: tseslint.configs.recommended.reduce((out, c) => Object.assign(out, c.rules ?? {}), {}),
        },
    ],
});
const results = await eslint.lintFiles([
    "test/fixtures/itemTrash/createItemTrash/**/*.ts",
    "test/integration/database/itemTrash/createItemTrash/**/*.ts",
    "test/integration/usecases/itemTrash/createItemTrash/**/*.ts",
]);
process.stdout.write(await (await eslint.loadFormatter("stylish")).format(results));
process.exitCode = results.some((x) => x.errorCount || x.warningCount) ? 1 : 0;
```

U01〜10、S01〜09、3対象のS-DELETE-01〜03、S-REPORT-01〜03、HTTP-01〜12が検証済み。
DB-01〜08、CC-01/02も実DBで成功。保存値・元行消費・原子性・実ロック・関連記録保持・再試行を検証した。
認証結果モックを用いたHTTPでありJWT署名検証・実アプリcron起動は対象外。実registerRoutesの対象経路も確認済み。
通知はservice境界でモックし、引数・commit後開始・非待機・失敗捕捉まで保証。実通知保存/送信、実COMMIT応答喪失は未検証。カバレッジ未取得。

## 初回の実DBガード結果（解消済み履歴）

.env.testを読込元としNODE_ENV=test、設定URLのDB名test_dbをDB import前に検査した。
sequelize・models用sequelize・observerの全接続で設定名test_dbと実SELECT current_database()=test_dbを確認した。
必要Model列/nullable検査で `DB_TEST_STOP: model columns/NULL differ: purchase_session.item_id` となり停止した。
それ以降のitem_id FK検査、fixture作成、対象APIのDB処理、競合検証は未実施。
safe=falseのためcleanup DELETEなし。fixture INSERT/UPDATE/DELETEなし。afterAllで全3接続close成功（close失敗なし）、envを復元した。
スキーマをmigration/sync/全件削除で自動補正していない。

## 初回障害・修正履歴

| ID            | 対象・原因                                                                  | 対応と再検証                                                                                        |
| ------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| ENV-HTTP      | ローカル待受がsandboxでEPERM、初回28件失敗と28未処理例外                    | 同じコマンドを権限手順で再実行して28件成功。後の統合85件でも未処理例外なし                          |
| F1 / DB全体   | Vitestがexport const notification = vi.hoistedを変換できず、2suite no tests | ローカルconst宣言とexportを分離。再実行でガードまで進行                                             |
| ENV-DB        | 接続がsandboxでEPERM、2suite失敗・15件skip                                  | 同じtest_dbガード付きコマンドを権限手順で再実行し接続成功                                           |
| BLOCK-SCHEMA  | purchase_session.item_idのnullable未反映                                    | 初回は停止。ユーザー許可後にmigrationを適用し、F3修正後に15件成功                                   |
| F2 / S-DELETE | テスト用destroyモックをModelへ直接assertしたためTS2352                      | Model.destroyから型を取り、Pickによる部分instance境界を明示。テスト型成功、変更12件再成功、lint成功 |

テスト件数は最終の異なるケースのみを集計し、途中の再実行分は加算していない。

## 許可後のDB反映・最終検証

ユーザーからtest_dbへのmigration適用と残り検証の明示許可を受け、以下を実施した。

1. 20261105100000を`--env test --name`指定で単独適用。初回sandbox接続EPERMは同じコマンドを権限手順で再実行し成功。
2. 再検証でPurchaseSession.item_idのNOT NULLが残存。test_dbの対象カラムのみ読取り照合し、Sequelize 6のpostgres query-generator.changeColumnQueryのREFERENCES分岐にDROP NOT NULLがないことを確認した（F3）。
3. 適用済みmigrationは書き換えず、20261105101000を追加。upでPurchaseSession/ItemReportのitem_idを明示DROP NOT NULL、downで逆順にSET NOT NULL。固定テーブル/カラムのみ、全体transaction。
4. 追加migrationを同じtest_dbへ単独適用し成功。DB/競合15件が成功。
5. 全対象の一括実行で100件成功。DB接続前/接続後のtest_dbガード、Model列/nullable・対象FKアクション・退避FK不在の検査に成功。自作IDだけをcleanupし残存0件、全3接続close成功、hook/spy/env復元。CC-01/02はpg_blocking_pidsとLockイベントによる実待機、先行commit後404/rollback後成功を確認。

```bash
npm run migration:run -- --env test --name 20261105100000-preserve-item-trash-and-related-records.js
npm run migration:run -- --env test --name 20261105101000-make-detached-item-references-nullable.js
npm run test:run -- src/usecases/itemTrash/test src/services/itemTrash/test src/services/video/test/createItemTrash.test.ts src/services/sale/test/createItemTrash.test.ts src/services/itemShippingProfile/test/createItemTrash.test.ts src/services/itemReport/test/createItemTrash.test.ts test/integration/database/itemTrash/createItemTrash test/integration/usecases/itemTrash/createItemTrash
```

追加migrationは`node --check`成功。本番TS・テストTSは前回成功した状態から変更なし。新たな未達事項はない。
既存API停止・復元/期限削除の後続開発、test_db以外へのmigration適用、通知実送信、実COMMIT応答喪失、down実行は今回の完了範囲に含めない。

## 初回停止時の再開条件（過去の記録）

ユーザーがDB反映を明示許可するか、必要スキーマを用意した後、DB/競合の同じコマンドを再実行する。
停止時に提示した1件のみtest_dbへ反映するコマンド候補は以下（その後、上記のとおり実行済み）。CLIの--nameが単一migrationのみを実行すること、config/config.jsのtest設定が.env.testとtest_dbだけを採用することを確認済み。

```bash
npm run migration:run -- --env test --name 20261105100000-preserve-item-trash-and-related-records.js
```

他のスキーマ不足が見つかっても過去migrationの一括適用やデータ補正を無断実施しない。
DB必須15件成功、cleanupとclose確認、最終差分確認の後にdevelop統合と作業ブランチ削除を行う。
