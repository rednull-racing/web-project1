# updateItem テストレポート

## 最新結果：2026-10-23

ユーザー回答1〜4に従い、PUT /api/itemsの商品更新を実装し、詳細設計・テスト設計・各層のテストを整合させた。editセッションと商品の両方を認可し、商品/関連4行を同じIDで更新して元セッションを削除する。商品statusは更新前状態によらず復元後の商品在庫から決める。name/title空文字拒否はcreateItemにも反映した。

統合後の検証は**26ファイル1113件すべて成功**。非DB17ファイル764件、実DB9ファイル349件。各最終実行で失敗・skip/pending・todo・未処理例外0。updateItem自身は非DB337件・実DB81件、既存関連回帰は非DB427件・実DB268件で、再実行分を重複加算していない。本番lint・本番/テスト型検査・通常lint外の変更TS追加検査・差分検査も成功。

[詳細設計](../../../../../docs/design/backend/detail/items/updateItem.md)、[テスト設計](../../architecture/items/updateItem.md)、[createItemの変更記録](createItem.md)を参照。対象パスはserver/基準。DBスキーマ・migration・ライブラリ・フロントは変更していない。

## ファイル別の最終結果

| 区分 | ファイル                                                                  | 成功件数 | 判定 |
| ---- | ------------------------------------------------------------------------- | -------: | ---- |
| 非DB | `src/controllers/items/test/createItem.test.ts`                           |        4 | 成功 |
| 非DB | `src/controllers/items/test/updateItem.test.ts`                           |        6 | 成功 |
| 非DB | `src/services/itemShippingProfile/test/updateItem.test.ts`                |        3 | 成功 |
| 非DB | `src/services/sale/test/updateItem.test.ts`                               |        3 | 成功 |
| 非DB | `src/services/video/test/updateItem.test.ts`                              |        3 | 成功 |
| 非DB | `src/validators/body/test/updateItem.test.ts`                             |       28 | 成功 |
| 非DB | `src/services/items/command/test/updateItem.test.ts`                      |        3 | 成功 |
| 非DB | `src/services/items/query/test/getMyItemWithVideoSaleShipping.test.ts`    |        8 | 成功 |
| 非DB | `src/services/items/query/test/updateItem.test.ts`                        |       16 | 成功 |
| 非DB | `src/usecases/items/create/test/createItem.test.ts`                       |      366 | 成功 |
| 非DB | `src/usecases/items/update/test/updateItem.test.ts`                       |      226 | 成功 |
| 非DB | `test/integration/usecases/items/createItem/master.test.ts`               |       15 | 成功 |
| 非DB | `test/integration/usecases/items/createItem/registration.test.ts`         |        1 | 成功 |
| 非DB | `test/integration/usecases/items/createItem/route.test.ts`                |       33 | 成功 |
| 非DB | `test/integration/usecases/items/updateItem/master.test.ts`               |       11 | 成功 |
| 非DB | `test/integration/usecases/items/updateItem/registration.test.ts`         |        1 | 成功 |
| 非DB | `test/integration/usecases/items/updateItem/route.test.ts`                |       37 | 成功 |
| 実DB | `test/integration/database/items/updateItem/database.test.ts`             |       48 | 成功 |
| 実DB | `test/integration/database/items/createItem/database.test.ts`             |       24 | 成功 |
| 実DB | `test/integration/database/items/createItem/databaseValues.test.ts`       |      173 | 成功 |
| 実DB | `test/integration/usecases/items/updateItem/concurrency.test.ts`          |       19 | 成功 |
| 実DB | `test/integration/usecases/items/updateItem/databaseHttp.test.ts`         |       14 | 成功 |
| 実DB | `test/integration/usecases/items/createItem/databaseConcurrency.test.ts`  |       24 | 成功 |
| 実DB | `test/integration/usecases/items/createItem/databaseHttp.test.ts`         |       23 | 成功 |
| 実DB | `test/integration/usecases/items/createItem/databaseTransactions.test.ts` |       14 | 成功 |
| 実DB | `test/integration/usecases/items/createItem/databaseReadFailures.test.ts` |       10 | 成功 |

## 実行コマンドと集計根拠

実行ディレクトリ: `/home/conta/project/server`。全て2026-10-23に実施。次の3実行は対象ファイルが重複しない。fixture hook・接続終了のファイル間干渉を避けるためmaxWorkers=1とし、ケース内では独立transactionを並行実行した。

```bash
npm run test:run -- src/usecases/items/update/test src/services/items/query/test/updateItem.test.ts src/services/items/command/test/updateItem.test.ts src/services/video/test/updateItem.test.ts src/services/sale/test/updateItem.test.ts src/services/itemShippingProfile/test/updateItem.test.ts src/controllers/items/test/updateItem.test.ts src/validators/body/test/updateItem.test.ts test/integration/usecases/items/updateItem/route.test.ts test/integration/usecases/items/updateItem/registration.test.ts test/integration/usecases/items/updateItem/master.test.ts src/controllers/items/test/createItem.test.ts src/services/items/query/test/getMyItemWithVideoSaleShipping.test.ts src/usecases/items/create/test/createItem.test.ts test/integration/usecases/items/createItem/master.test.ts test/integration/usecases/items/createItem/route.test.ts test/integration/usecases/items/createItem/registration.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/update-item-nondb.json
npm run test:run -- test/integration/database/items/updateItem test/integration/usecases/items/updateItem/databaseHttp.test.ts test/integration/usecases/items/updateItem/concurrency.test.ts test/integration/database/items/createItem test/integration/usecases/items/createItem/databaseHttp.test.ts test/integration/usecases/items/createItem/databaseConcurrency.test.ts test/integration/usecases/items/createItem/databaseTransactions.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/update-item-db.json
npm run test:run -- test/integration/usecases/items/createItem/databaseReadFailures.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/update-item-db-read-failures.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

JSONは一時成果物であり、件数はnumTotalTests/numPassedTestsとtestResults[].assertionResultsを照合した。Vitestのsuite数をファイル数と混同していない。通常lint外の変更test/fixture TSはESLint APIのoverrideConfigへ既存のtypescript-eslint推奨ルールを適用して追加検査した（設定ファイル変更なし）。最終対象は17ファイル、error/warning 0。src配下は通常lintで検査。カバレッジ率は取得していない。

非DB764件の実行後、本番の改行・インデントだけを近接createItemの形式へ整え、該当usecase/queryの242件を追加実行して成功。この再実行は1113件へ加算していない。統合後DB349件と最終静的検査は整形後に実行している。

## ケース対応・保証した範囲

| 設計ID  | 検証        | 確認内容・結果                                                                                                                                                        |
| ------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N01/N02 | U/S/D       | 既存itemId・関連ID、全コピー列・管理列/作成日時/再生数保持。3階層currentのみ復元、元JSON不変/別参照。更新前active/soldout双方、root initial 0/1でsoldout/active。成功 |
| N03     | U/M/D/P     | 検索文字列の全半角/ひらがな/空白正規化、親なし/不在/user_name null、commit後通知開始・保留非待機・reject捕捉。成功                                                    |
| V01/H01 | V/C/H/D     | 厳密数値ID上下限/不正/未知キー、raw body/params/query/所有者偽装不採用、201、usecase待機/例外next、実registerRoutesのPUT到達。成功                                    |
| H02     | H/D         | 実JWT・parser→認証→limit→schema順、失敗消費、5/6、窓境界、ユーザー別・同ユーザーtoken/IP/ID共通枠・POST/PUT独立、公開エラー/標準header。成功                          |
| E01     | U/D/P       | 他人/不存在/消費済みセッションと商品、商品所有者null、normal/null item_id、関連欠落。所定codeと後続更新・元行消費・通知なし。成功                                     |
| E02/M01 | U/M/D       | name/title空文字拒否、必須URL欠落/画像0/10/11/価格上下限、必須/任意ID、実validateMasterの5種存在/不在/例外・t引渡し。成功                                             |
| E03     | U/D         | 商品inventory必須、色/サイズ/後方要素・配列・キー不正、各階層initial負数/小数。構造500と値域400、元データ不変。NaN/undefined等はU直接注入として確認。成功             |
| T01/S01 | U/S         | 各依存の例外・保留と後続未実行、同一t・同じinstance、外側transaction待機/例外・開始失敗、通知開始時点。Modelモックだけでrollbackを保証していない。成功                |
| D01     | D/実DB HTTP | observerの新規SELECTで保存列・保持列/同じID・元行消費・再送404。別商品/独立した関連行/他人セッション/下書き不変。成功                                                 |
| D02     | D/実DB HTTP | video/sale/shipping/item更新SQL後と元行DELETE後に実処理を通してthrow。先行SQL完了をassertし、rollback後新規SELECTで全4行と元行復元・通知なし・修復再試行成功。成功    |
| P01     | P           | 同一セッション先行commit→後続404、先行rollback→後続成功。別セッション同一商品はItemロックで直列化し後続上書き。別商品の独立ロック取得と両成功。成功                   |
| P02     | P/実DB HTTP | セッション保存/所有者変更/削除/normal変更、商品所有者変更/削除/soldout変更のcommit/rollback後再判定。commit前observer旧値・HTTP未応答/通知なし、commit後新値。成功    |

商品削除commitはitem_idのCASCADEにより元セッションも削除され、待機後はITEM_EDITING_NOT_FOUND。単体の固定null結果からこのDB挙動を推測したのではなく実際の競合で確認した。

## 実DBの安全条件・後片付け

- DB/Model初期化前にserver/.env.testの読込元、NODE_ENV=test、PostgreSQL URLのDB名test_dbを確認。dotenv引数なし読込みも検証済みparsedに限定し、別envとNODE_ENV/DATABASE_URL差替えを拒否。
- アプリ用sequelize・models/index用sequelize・observerの全3接続で接続前の設定DB名と接続後current_database()=test_dbを確認した。
- 全3接続で必要なModel列/NULL、対象ID/FKのINTEGER、attributes JSONB、item_editing.item_idのFK（DELETE CASCADE / UPDATE NO ACTION）を検査。READ COMMITTEDを確認後にだけseedした。既存createItemの旧「item_id不存在」ガードも現行のnullable INTEGER/FK検査へ整合。
- 保留中のPromise・transactionをfinallyで回収後、afterCreateで追跡した自作IDだけをFK順にcleanup。全対象IDの残存0、hook/spy解除、全3接続close、env復元を確認。既存行の一括削除・sequence巻戻し・migration/syncは実施していない。
- 実待機はtransactionのpg_backend_pidとobserverのpg_blocking_pidsでholder/waiterを照合。期限付き監視とし、固定sleep・Promise.allだけを排他の根拠としていない。

## 修正と中間実行の履歴

| 修正ID | 元ケース・現象                                | 原因と修正                                                                                                             | 修正後                                   |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| F1     | U/DB collection失敗、ケース未実行             | vi.hoisted変数の直接exportがVitest変換と競合。const定義と末尾exportへ分離                                              | U226件、DB81件成功                       |
| F2     | P01競合初回17成功/2失敗                       | 追加セッションfixtureでModel.getの戻り値からid等をdeleteし、元fixtureのIDまで変更していた。structuredCloneしてから削除 | 競合19件成功、他DBと合わせ81件再実行成功 |
| F3     | DB追加lintの未使用import1件                   | 対象テストの不要import削除。検査規則の緩和なし                                                                         | 追加lint成功                             |
| F4     | createItem関連DB fixtureの旧item_id不存在前提 | 現行Model・反映済み定義に合わせnullable INTEGER/FKを検査。スキーマ補正はしていない                                     | createItem DB268件成功                   |

sandbox内ではHTTP listen/DB接続/追加lintの子プロセスにEPERMが発生した。ガードやassertionは変えず、環境の承認手順で同じ対象を外側で再実行し成功した。統合後非DBのsandbox実行は692成功/72失敗・EPERM由来未処理例外72で、同じ764件の承認再実行は全成功・未処理例外0。これは最終失敗件数へ混ぜず、環境失敗の履歴として残す。

対象外sessionMiddlewareのuuid実行時依存不足は、HTTP fixtureで対象外sessionだけをモックして分離した。実JWT/認証/parser/limit/schema/controller/errorHandlerは維持。依存追加や本番session修正は行わず、[Todo](../../../../../docs/todo/done/resolve-session-uuid-runtime-dependency.md)へ記録した。

## 保証範囲と完了条件

必要な設計ケースと関連回帰・静的検査は成功し、未実装/未実行の必須ケース・未解決の対象内失敗はない。非対象不変の実DB検証は、対象のitem/3つのFKが指す行以外の行と、独立した関連IDを持つ別商品を対象とする。共有関連へのunique制約追加・共有データ時の新たな拒否仕様は今回導入していない。

実通知の永続化・実AWS/URL実体・動画変換・ブラウザE2E・アプリ全体起動・実COMMIT通信断/応答喪失・負荷試験は対象外。HTTP応答送信失敗からcommit済みDBの巻戻しは保証しない。最小Express/実registerRoutes接続の成功をアプリ全体起動や実外部送信の成功とは扱っていない。

## 2026-10-23 後続修正：sessionのuuid依存を解消

sessionMiddlewareをnode:cryptoのrandomUUIDへ置換し、共通HTTP fixtureのsessionモックを削除した。session単体/HTTPとcreateItem/updateItemのroute/registrationを合わせた6ファイル80件、lint・本番/テスト型検査・追加lintが成功。実DBはこの後続修正では再実行していない。詳細は[sessionレポート](../middleware/session.md)を参照。上記の未解決という記録は修正前の履歴。
