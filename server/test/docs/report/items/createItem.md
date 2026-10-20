# createItem テストレポート

## 最新結果：2026-10-20（brand/alias null許容修正後）

単体・DB非接続結合は **449件成功、失敗0、skip 0、todo 0（19ファイル）**。実DBは **4 suiteがsetup失敗、72件はケース本体未実行**。ランナーは72件をskipped/pendingと表示するが、成功・通常の意図的skipとは分ける。全設計の実DB検証完了ではない。

ユーザーは途中でbrand_id/brand_aliases_idをnull許容へ訂正し、その後、本番コードのnull拒否修正を明示的に許可した。最終的な本番変更は `src/usecases/itemEditing/createItem.ts` の公開前提検証のみ。必須5種類のnull拒否と、7種類の非null不正値の拒否を維持し、brand/aliasの片方・両方nullを許容した。DB・migration・その他の本番コードは変更していない。

設計書の117ケースIDと、it.each展開後の521件（449実行＋72未実行）は別の集計。IDが同じテストや複数IDを確認するテストがあるため、ID別件数は加算しない。件数はVitest JSONのassertionResultsから集計した。

| 区分 | 登録件数 | 成功 | 失敗 | skip/pending | todo | 判定 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 単体（src、16ファイル） | 400 | 400 | 0 | 0 | 0 | 成功 |
| DB非接続結合（H/R/REG、3ファイル） | 49 | 49 | 0 | 0 | 0 | 成功 |
| 実DB（4ファイル） | 72 | 0 | 0 | 72 | 0 | setup失敗で本体未実行 |
| 合計 | 521 | 449 | 0 | 72 | 0 | 実DBに未達あり |

非DBは単体16ファイルと結合3ファイル。

## ファイル別結果・変更範囲

以下は今回追加したテストファイル。略号は後段のケース対応表で使用する。DBのskip列はすべてsetup失敗による未実行。

| 略号 | server基準のファイル | 成功 | 失敗 | skip | todo |
| --- | --- | ---: | ---: | ---: | ---: |
| C | `src/controllers/items/test/createItem.test.ts` | 4 | 0 | 0 | 0 |
| S-categories | `src/services/categories/test/createItem.test.ts` | 2 | 0 | 0 | 0 |
| S-follow | `src/services/follow/test/createItem.count.test.ts` | 2 | 0 | 0 | 0 |
| S-itemConditionOption | `src/services/itemConditionOption/test/createItem.test.ts` | 2 | 0 | 0 | 0 |
| S-itemEditing | `src/services/itemEditing/test/createItem.test.ts` | 3 | 0 | 0 | 0 |
| S-itemShippingProfile | `src/services/itemShippingProfile/test/createItem.test.ts` | 2 | 0 | 0 | 0 |
| S-items | `src/services/items/test/createItem.count.test.ts` | 2 | 0 | 0 | 0 |
| S-sale | `src/services/sale/test/createItem.test.ts` | 2 | 0 | 0 | 0 |
| S-shippingDayOption | `src/services/shippingDayOption/test/createItem.test.ts` | 2 | 0 | 0 | 0 |
| S-shippingServiceOption | `src/services/shippingServiceOption/test/createItem.test.ts` | 2 | 0 | 0 | 0 |
| S-todouhuken | `src/services/todouhuken/test/createItem.test.ts` | 2 | 0 | 0 | 0 |
| S-users | `src/services/users/test/createItem.test.ts` | 3 | 0 | 0 | 0 |
| S-video | `src/services/video/test/createItem.test.ts` | 2 | 0 | 0 | 0 |
| U | `src/usecases/itemEditing/test/createItem.test.ts` | 340 | 0 | 0 | 0 |
| V | `src/validators/body/test/createItem.test.ts` | 28 | 0 | 0 | 0 |
| S-items-create | `src/services/items/command/test/createItem.test.ts` | 2 | 0 | 0 | 0 |
| H | `test/integration/usecases/items/createItem/master.test.ts` | 15 | 0 | 0 | 0 |
| REG | `test/integration/usecases/items/createItem/registration.test.ts` | 1 | 0 | 0 | 0 |
| R | `test/integration/usecases/items/createItem/route.test.ts` | 33 | 0 | 0 | 0 |
| DB | `test/integration/database/items/createItem/database.test.ts` | 0 | 0 | 24 | 0 |
| CON | `test/integration/usecases/items/createItem/databaseConcurrency.test.ts` | 0 | 0 | 24 | 0 |
| HTTP-DB | `test/integration/usecases/items/createItem/databaseHttp.test.ts` | 0 | 0 | 13 | 0 |
| TX | `test/integration/usecases/items/createItem/databaseTransactions.test.ts` | 0 | 0 | 11 | 0 |

共通fixture・モック・ガードは `test/fixtures/items/createItem/{fixtures,usecaseMocks,httpFixtures,httpMocks,databaseSetup,databaseFixtures}.ts` を追加。設計書 `test/docs/architecture/items/createItem.md` は最新のnull許容とAF-BR01〜03を反映した。本番変更はF1、作業ログは `/docs/log_memo/codex_log.md`、既存の型エラーは `/docs/todo/P1-bug/refreshToken-jwt-payload-typecheck.md` へ記録。

## 再現コマンド・静的検査

実行ディレクトリは `/home/conta/project/server`。HTTPのローカルlistenとPostgreSQL接続はサンドボックス内でEPERMとなったため、承認された同じテストを制限外で再実行した。別のDBへの切替やガード緩和はしていない。ファイル間のfixture/hook干渉を避け `--maxWorkers=1` とし、ケース内の独立transactionによる競合とは分けた。

```bash
# 以下の正規表現は今回の19ファイルだけを選ぶ。
mapfile -t targets < <(rg --files src test/integration | rg '(^src/.*/test/createItem(\.count)?\.test\.ts$|^test/integration/usecases/items/createItem/(master|route|registration)\.test\.ts$)')
npm run test:run -- "${targets[@]}" --maxWorkers=1 --reporter=json --outputFile=/tmp/create-item-unit-final.json
npm run test:run -- test/integration/database/items/createItem/database.test.ts test/integration/usecases/items/createItem/databaseTransactions.test.ts test/integration/usecases/items/createItem/databaseConcurrency.test.ts test/integration/usecases/items/createItem/databaseHttp.test.ts --maxWorkers=1 --reporter=json --outputFile=/tmp/create-item-db-final.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

| 確認 | 結果 |
| --- | --- |
| 単体・DB非接続結合 | exit 0、449/449成功 |
| 実DB | exit 1、全4 suiteが同じスキーマガードで停止 |
| npm run lint | exit 0 |
| npm run typecheck | exit 0 |
| test/tsconfig.jsonの型検査 | exit 2。既存refreshToken.ts:43のTS2339のみ。今回追加コードの診断0 |
| test配下の追加lint | exit 0。既存ESLint/typescript-eslint recommendedで今回のfixtureと結合TSを検査 |
| サブエージェントレビュー | 読取専用レビュー。重大な問題の指摘なし。DB未検証の明記を確認 |

追加lintは共有設定を変更せず、次の一時設定を `/tmp/create-item-eslint.config.mjs` に置いて実行した。

```js
import eslint from '/home/conta/project/server/node_modules/@eslint/js/src/index.js';
import tseslint from '/home/conta/project/server/node_modules/typescript-eslint/dist/index.js';
export default tseslint.config({files:['**/*.ts'],extends:[eslint.configs.recommended,...tseslint.configs.recommended]});
```

```bash
./node_modules/.bin/eslint --config /tmp/create-item-eslint.config.mjs test/fixtures/items/createItem test/integration/usecases/items/createItem test/integration/database/items/createItem
```

カバレッジは取得していない。今回追加テストを対象指定し、別API全体の回帰やAWS通信は実行していない。

## 実処理とモック境界

- U/I：公開usecase内の前提検証・在庫構造確認・structuredClone・全階層current初期化・sort・実normalizeJapaneseを実行。DB service、validateMaster、managed transactionはモック。全コピー引数、元データ非破壊、同一transaction、停止・待機・通知時点を検証した。Uのtransactionはcommit/rollbackの実証ではない。
- H：実usecase・実validateMaster・実normalizeJapaneseを接続し、service/transactionだけをモック。AF-BR03は実resolveBrandの既存ブランド選択がalias=nullを返すことを確認し、updateConfirmが保存するID値を取得fixtureへ反映して公開。保存自体を実行した証明にはしない。
- S：実serviceを実行しModelメソッドだけをモック。where/lock/attributes、data/t参照、返値/null/同一Error、destroyの完了待ちを確認。実SQLや実ロックを検証済みとはしない。
- V/C：実schema/validateBody、実controllerを実行。controllerのusecaseはモックし、検証済みbodyと認証ID・201・完了待ち・同一Errorのnext伝播を確認した。
- R/REG：実JSON parser、Router、controller、authenticateToken、express-rate-limit、validator、共通errorHandler。対象usecaseと、対象外controller export・isAdminのimport依存だけを分離。テスト専用JWT鍵を生成。REGは無関係Routerだけを分離して実registerRoutesを実行した。
- DB/TX/CON/HTTP-DB：本来は実モデル/service/helper/usecase/PostgreSQLを実行する構成だが、今回ケース本体は全件未実行。通知はモック。CONの確認画面保存では実updateConfirmを接続し、buildSignedUrlsだけを固定メディアURLに置換。SQL・INSERT・DELETEの実処理を呼んだ前後にgate/障害注入spyを配置した。模擬障害を実COMMIT通信断と扱わない。

## DB接続・停止理由と未確認事項

- 読込元は `/home/conta/project/server/.env.test`。dotenvの引数なし読込みもこのファイル由来の値に固定し、別envの明示指定とDATABASE_URL差替えを拒否する。
- NODE_ENV=test、設定上DB名=test_db、アプリ用sequelize・モデルindex側sequelize・observerの実接続先がSELECT current_database()でtest_dbであることを確認した。認証情報・URL全体は記録しない。
- 次のinformation_schema検査で `DB_TEST_SCHEMA_MISMATCH: item.deleted_at remains` が発生。設計書は同カラム削除済みを前提とするため、安全側で停止した。最初の差分で停止しており、ほかの旧カラム・FK・型・isolationの一致は未確認。
- safeフラグ有効化、fixture hook登録、fixture作成より前に停止した。今回テスト作成データは0件で、cleanup用DELETEも実行しない。全接続のclose処理は終了し、ガードは迂回していない。
- 元行消費、新4行の永続化・関連、observer可視性、rollback後の再取得、NOWAITロック再取得、pg_blocking_pidsによる待機・commit/rollback順、実DB制約、保護行不変は **いずれも未検証**。schemaの不一致をF1の修正成功や別の本番不具合と混同しない。
- DBコードでは作成IDをafterCreate hookで記録し、rollbackされたINSERTも追跡する。cleanupは自作IDのみをFK順に削除・残存0を確認し、sequenceを戻さない。これは実装した手順であり、今回cleanup成功を実行確認したという意味ではない。
- 実DBは代表入力のテストを用意した。単体の全不正型・全階層組合せをそのままDBへ移植していない。N04/N05の全任意値、Iの全JSONB変種、O01/O02の永続化、各マスターに対する実取得障害などの網羅は、DB反映状態確認後に補完・再実行する。JSONで表現できないNaN/Infinity/疎配列等はUで扱う。

## ケースID別の対応

「成功」は記載した非DB責務の確認範囲。D/Pを設計レベルに持つIDでも非DB成功だけでDB完了にしない。DB列にIDが付く代表テストは用意したが、すべて本体未実行。O04は設計書どおり将来の実通信障害であり今回未実装・未実行。

| ID | 判定 | 対応ファイル略号 | 確認範囲・残る範囲 |
| --- | --- | --- | --- |
| N01 | 成功（非DB） | U, DB | DB未実行 |
| N02 | 成功（非DB） | U, DB | DB未実行 |
| N03 | 成功（非DB） | U, DB | DB未実行 |
| N04 | 成功（非DB） | U | 実DBへの保証なし |
| N05 | 成功（非DB） | U | 実DBへの保証なし |
| N06 | 成功（非DB） | U | 実DBへの保証なし |
| N07 | 成功（非DB） | U | 実DBへの保証なし |
| N08 | 成功（非DB） | U | 実DBへの保証なし |
| N09 | 成功（非DB） | U, H, DB | DB未実行 |
| N10 | 成功（非DB） | U | 実DBへの保証なし |
| N11 | 成功（非DB） | U | 実DBへの保証なし |
| N12 | 成功（非DB） | U | 実DBへの保証なし |
| V01 | 成功（非DB） | V, R | 実DBへの保証なし |
| V02 | 成功（非DB） | V, R | 実DBへの保証なし |
| V03 | 成功（非DB） | V, R | 実DBへの保証なし |
| V04 | 成功（非DB） | V, R | 実DBへの保証なし |
| V05 | 成功（非DB） | V, R | 実DBへの保証なし |
| V06 | 成功（非DB） | V | 実DBへの保証なし |
| E01 | 成功（非DB） | U, DB | DB未実行 |
| B01 | 成功（非DB） | U | 実DBへの保証なし |
| B02 | 成功（非DB） | U, DB | DB未実行 |
| B03 | 成功（非DB） | U, DB | DB未実行 |
| B04 | 成功（非DB） | U, DB | DB未実行 |
| B05 | 成功（非DB） | U, DB | DB未実行 |
| B06 | 成功（非DB） | U, DB | DB未実行 |
| B07 | 成功（非DB） | U, DB | DB未実行 |
| B08 | 成功（非DB） | U | 実DBへの保証なし |
| B09 | 成功（非DB） | U | 実DBへの保証なし |
| B10 | 成功（非DB） | U | 実DBへの保証なし |
| I01 | 成功（非DB） | U, DB | DB未実行 |
| I02 | 成功（非DB） | U | 実DBへの保証なし |
| I03 | 成功（非DB） | U | 実DBへの保証なし |
| I04 | 成功（非DB） | U | 実DBへの保証なし |
| I05 | 成功（非DB） | U, DB | DB未実行 |
| I06 | 成功（非DB） | U, DB | DB未実行 |
| I07 | 成功（非DB） | U | 実DBへの保証なし |
| I08 | 成功（非DB） | U, DB | DB未実行 |
| I09 | 成功（非DB） | U, DB | DB未実行 |
| I10 | 成功（非DB） | U, DB | DB未実行 |
| I11 | 成功（非DB） | U | 実DBへの保証なし |
| I12 | 成功（非DB） | U, DB | DB未実行 |
| M01 | 成功（非DB） | H | 実DBへの保証なし |
| M02 | 成功（非DB） | H | 実DBへの保証なし |
| M03 | 成功（非DB） | H | 実DBへの保証なし |
| M04 | 成功（非DB） | H | 実DBへの保証なし |
| M05 | 成功（非DB） | U | 実DBへの保証なし |
| M06 | 成功（非DB） | H | 実DBへの保証なし |
| M07 | 成功（非DB） | H | 実DBへの保証なし |
| S01 | 成功（非DB） | S-itemEditing | 実DBへの保証なし |
| S02 | 成功（非DB） | S-itemEditing | 実DBへの保証なし |
| S03 | 成功（非DB） | S-itemEditing | 実DBへの保証なし |
| S04 | 成功（非DB） | S-itemShippingProfile, S-sale, S-video, S-items-create | 実DBへの保証なし |
| S05 | 成功（非DB） | S-follow, S-items, DB | DB未実行 |
| S06 | 成功（非DB） | S-follow, S-items, DB | DB未実行 |
| S07 | 成功（非DB） | S-categories, S-itemConditionOption, S-shippingDayOption, S-shippingServiceOption, S-todouhuken, S-users | 実DBへの保証なし |
| S08 | 成功（非DB） | S-categories, S-follow, S-itemConditionOption, S-items, S-shippingDayOption, S-shippingServiceOption, S-todouhuken, S-users | 実DBへの保証なし |
| T01 | 成功（非DB） | U, TX | DB未実行 |
| T02 | 成功（非DB） | U | 実DBへの保証なし |
| T03 | 成功（非DB） | U | 実DBへの保証なし |
| T04 | 成功（非DB） | U | 実DBへの保証なし |
| T05 | 成功（非DB） | U | 実DBへの保証なし |
| T06 | 成功（非DB） | U, TX | DB未実行 |
| T07 | 成功（非DB） | U, TX | DB未実行 |
| T08 | 成功（非DB） | U | 実DBへの保証なし |
| T09 | 未実行 | TX | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| T10 | 成功（非DB） | C | 実DBへの保証なし |
| T11 | 成功（非DB） | U | 実DBへの保証なし |
| T12 | 成功（非DB） | U, TX | DB未実行 |
| T13 | 成功（非DB） | U | 実DBへの保証なし |
| D01 | 未実行 | DB | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| D02 | 未実行 | TX | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| D03 | 未実行 | TX | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| D04 | 未実行 | TX | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| D05 | 未実行 | DB | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| D06 | 未実行 | DB, HTTP-DB | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| D07 | 未実行 | DB | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| D08 | 未実行 | TX | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| D09 | 未実行 | HTTP-DB | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| D10 | 未実行 | HTTP-DB | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| P01 | 未実行 | CON | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| P02 | 未実行 | CON | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| P03 | 未実行 | CON | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| P04 | 未実行 | CON | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| P05 | 未実行 | CON | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| P06 | 未実行 | CON | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| P07 | 未実行 | CON | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| P08 | 未実行 | CON | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| P09 | 未実行 | CON | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| P10 | 未実行 | CON | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| P11 | 未実行 | CON | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| C01 | 成功（非DB） | C | 実DBへの保証なし |
| C02 | 成功（非DB） | C | 実DBへの保証なし |
| C03 | 成功（非DB） | C | 実DBへの保証なし |
| R01 | 成功（非DB） | R | 実DBへの保証なし |
| R02 | 成功（非DB） | R | 実DBへの保証なし |
| R03 | 成功（非DB） | R | 実DBへの保証なし |
| R04 | 成功（非DB） | R | 実DBへの保証なし |
| R05 | 成功（非DB） | R | 実DBへの保証なし |
| R06 | 成功（非DB） | R | 実DBへの保証なし |
| R07 | 成功（非DB） | R | 実DBへの保証なし |
| R08 | 成功（非DB） | R | 実DBへの保証なし |
| R09 | 成功（非DB） | R, HTTP-DB | DB未実行 |
| R10 | 成功（非DB） | R | 実DBへの保証なし |
| R11 | 成功（非DB） | R | 実DBへの保証なし |
| R12 | 成功（非DB） | REG, R | 実DBへの保証なし |
| R13 | 成功（非DB） | R | 実DBへの保証なし |
| O01 | 観測成功 | U | 実DBへの保証なし |
| O02 | 観測成功 | U | 実DBへの保証なし |
| O03 | 観測成功 | U | 実DBへの保証なし |
| O04 | 未実装・未実行 |  | 実COMMIT応答喪失/HTTP切断は今回対象外。外側Promise rejectはT08のみ |
| O06 | 観測成功 | U | 実DBへの保証なし |
| AF-ID01 | 成功（非DB） | U, DB, HTTP-DB | DB未実行 |
| AF-ID02 | 未実行 | DB, HTTP-DB | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| AF-ID03 | 未実行 | CON | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| AF-BR01 | 成功（非DB） | U | 実DBへの保証なし |
| AF-BR02 | 未実行 | DB, HTTP-DB | スキーマ検査で停止。保存・rollback・並行制御は未検証 |
| AF-BR03 | 成功（非DB） | H | 実resolveBrand接続成功。updateConfirmのDB保存は未検証 |

## F1：brand/alias null拒否（修正・非DB再検証済み）

- 対象：`src/usecases/itemEditing/createItem.ts` のvalidatePublishData。
- 修正前：正常fixtureのbrand_idだけnull、brand_aliases_idだけnull、両方nullの3条件で、期待456に対し400・INVALID_NUMBER。実resolveBrandの既存ブランド選択→alias=nullでも同じ拒否が再現した。
- 原因：必須5種類と任意brand/aliasを一つの配列に入れ、すべてに `id === null` の拒否条件を適用していた。updateConfirmはresolveBrandのalias=nullをそのまま保存するため、通常のブランド選択でも公開できなかった。
- 許可後の修正：必須5種類の配列を維持し、brand/aliasを別配列へ分離。任意側は `id !== null && (...)` で非null値のみを整数・1〜2147483647で確認する。undefined、文字列、0、負数、小数、範囲超過、NaN/Infinityは従来どおり拒否する。
- 新契約：片方または両方nullでも他条件が正常なら公開し、nullをそのまま商品へコピーする。公開時のalias生成・ブランド再解決・共有validateMasterの変更は対象外。
- 検証：AF-BR01の3成功条件と片方null＋他方0の2拒否条件、AF-BR03の実helper接続成功を確認。B08/B09、AF-ID01、在庫・コピー・HTTP等も維持し449件すべて成功。
- 未達：AF-BR02の実保存・HTTP DBはスキーマ不一致で未実行。修正後にDB成功を確認したとはしない。

| 修正後ケース | 元ケース | レベル | 入力・手順 | 期待・現在の結果 |
| --- | --- | --- | --- | --- |
| AF-BR01 | B08/B09/N04/O03 | U | 片方/両方null、片方null＋他方0 | null許容・不正非null拒否。成功 |
| AF-BR02 | AF-BR01/D01/D09 | D/R | 保存済み任意ID nullから公開・新規SELECT | 201とnull保存・元行消費。未実行 |
| AF-BR03 | M01/O03 | H | 実resolveBrandのalias=nullを取得fixtureへ渡す | 公開成功。成功 |

旧null拒否テストは任意IDのnullだけ成功契約へ移行し、必須5種類のnull拒否と全非null不正値のassertは維持した。旧挙動を通すためのskip/todo化・assert緩和はしていない。

## 環境修正案・残る仕様確認

**F2（提案のみ）：テストDBと反映済み仕様を照合する。** 設計書ではitem.deleted_at等は削除済みだが、今回のtest_dbには少なくともitem.deleted_atが残存する。DB管理手順で反映状態・正しい検証環境を確認し、承認された別作業で必要なスキーマ反映を行った後、同じガードのままDB72件を再実行する。テスト都合で既存migration変更、sync、全件削除、ガード解除を行わない。残る旧カラムやFKの不一致は現時点で断定しない。

**F3（対象外・未修正）：テスト用型検査の既存エラー。** `src/usecases/auth/refreshToken.ts:43`でstring | JwtPayloadのid参照がTS2339となる。JWT payloadの実行時検証と型絞り込みを別作業で行う案をTodoへ記録した。今回変更に起因する型エラーは検出していない。

**未決定・観測のみ：** name/titleの空文字・空白、空白URL、先頭画像と配列先頭の不一致・空画像要素・重複をUで受理する。URL形式・所有S3キー・ファイル実体・trimの要否は未確定。有限な負数/小数currentや範囲外ratioは受理されcurrentのみinitialへ戻るが、その業務許容範囲と階層合計の整合性は別途決定する。動画変換未完了も受理する。brand/aliasのnull許容は今回確定したため未決定事項には含めない。疎配列のTypeError、function追加属性のDataCloneError等は非JSONの防御観測であり、HTTP JSONB入力の保証にしない。

## 同日中の実行履歴

1. 初期仕様（7種類必須）で単体・HTTPを作成。初回のテスト自身のimport/mock順、validateBodyのthrow境界、resetModules後のAppError参照を修正し、設定上の失敗を除去した。
2. null許容のユーザー訂正を反映した修正前実行：447件中443成功・4失敗、skip/todo 0。4失敗はいずれもINVALID_NUMBERで、AF-BR01の3条件とAF-BR03。これがF1の再現結果。
3. 本番変更の明示許可後にF1を修正。片方null＋他方0の拒否2件を追加し、最新449件すべて成功。実DBは最新72件が全件setup停止、4 suite失敗。
4. 最終lint・本番typecheck・追加lint成功。テスト用typecheckはF3のみ残存。実DB、実COMMIT応答喪失、別API全体の回帰は完了扱いにしていない。
