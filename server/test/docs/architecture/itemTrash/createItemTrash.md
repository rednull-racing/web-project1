# createItemTrash テスト設計

設計日: 2026-11-05。パスはserver基準。
根拠: [詳細設計](../../../../../docs/design/backend/detail/itemTrash/createItemTrash.md)とユーザー回答。
目的は元商品の消費と退避の原子性、参照を失った関連記録の保持、認可・公開応答の確認。
復元・期限削除・S3実体操作は本APIの対象外。実COMMIT応答喪失は模擬commit失敗の保証へ含めない。

## 配置と検証境界

| 配置 | 実処理・モック | 主なケース |
| --- | --- | --- |
| src/usecases/itemTrash/test/createItemTrash.test.ts | 実usecase、sequelize.transactionと各serviceをモック | U01〜U10 |
| src/services/itemTrash/test/createItemTrash.test.ts | 実取得/作成service、Modelメソッドをモック | S01〜S09 |
| src/services/{video,sale,itemShippingProfile}/test/createItemTrash.test.ts | 実削除service、渡すinstance.destroyをモック | 各S-DELETE-01〜03 |
| src/services/itemReport/test/createItemTrash.test.ts | 実通報更新service、ItemReport.updateをモック | S-REPORT-01〜03 |
| test/integration/usecases/itemTrash/createItemTrash/route.test.ts | 実Router/controller/schema/parser/errorHandler/制限、認証結果とusecaseをモック | HTTP-01〜11 |
| 同registration.test.ts | 実registerRoutesと対象Router、他Routerと認証結果/usecaseはモック | HTTP-12 |
| test/integration/database/itemTrash/createItemTrash/database.test.ts | 実usecase/service/Model/PostgreSQL、通知をモック | DB-01〜08 |
| test/integration/usecases/itemTrash/createItemTrash/concurrency.test.ts | 実DB、実取得serviceを呼ぶspyとgateで進行制御 | CC-01/02 |

単体fixtureは各テスト内のfactory。DB fixtureはtest/fixtures/itemTrash/createItemTrash/{databaseSetup,databaseFixtures,concurrencyFixtures}.ts。
単体のModel代用品はDB validationを通らない。HTTPの認証結果モックはJWT検証自体を保証しない。

## ケース・期待結果

P0は公開契約・認可・原子性・参照保持、P1は層の引渡し・待機。競合は重要な原子性としてP0とする。

| ID・優先度 | 条件・手順 | 期待結果 |
| --- | --- | --- |
| U01 P0 | 全項目・価格0・在庫ありの元商品から実usecase | 全保存列一致、source不変、同一transaction、各削除順、保存済み退避ID/値で通知 |
| U02 P0 | 関連video/sale/shippingすべてnull | 対応列null、関連削除なし、Item削除あり |
| U03 P0 | before_price=null、Item.priceは値あり | price=null、fallbackしない |
| U04 P0 | 取得結果null | 404 ITEM_NOT_FOUND、作成/更新/削除/通知なし |
| U05 P0 | 取得・退避・通報・関連3件・Item削除の各段階をreject | 元例外参照の伝播、後続と通知なし |
| U06 P0 | transaction開始reject | DB操作・通知なし |
| U07 P0 | callback完了後に外側transaction reject | 成功扱いせず通知なし |
| U08 P0 | 外側transactionをdeferred保留 | 完了まで通知・成功なし |
| U09 P0 | 通知を保留後reject | 通知を待たず成功、reject捕捉、再削除なし |
| U10 P1 | 各依存段階をdeferred保留 | 後続未実行、解放後に処理完了 |
| S01 P0 | 所有Itemと関連3行あり | where/全取得列/同一transaction/FOR UPDATEと取得順を照合 |
| S02 P0 | Itemなし | 関連取得なし、null返却 |
| S03 P1 | 関連FKすべてnull | 関連検索なし、関連値null |
| S04 P1 | 各関連検索がnull | 欠落を伝達して後続取得は継続 |
| S05/S06 P1 | 取得各段階のreject/保留 | 元例外伝播/待機、後続未実行 |
| S07〜09 P1 | createの正常/reject/保留 | data・transaction参照保持、保存結果返却、完了待機 |
| S-DELETE-01〜03 P1 | video/sale/shippingのdestroy正常/reject/保留 | 指定instanceだけ1回、同一transaction、待機・元例外 |
| S-REPORT-01〜03 P0 | 更新件数0/1/3、reject/保留 | where.item_id限定でitem_idのみnull更新、同一transaction、待機・元例外 |
| HTTP-01 P0 | itemId=1/2147483646/2147483647と偽装userId等 | 検証済みitemIdと認証IDのみusecaseへ渡し201、未知キー漏出なし |
| HTTP-02/03 P0 | 欠落/null/文字列/0/負数/小数/上限超え/配列/辞書、queryのみ | 400 INVALID_BODY、usecaseなし |
| HTTP-04 P0 | 未認証かつ不正body | 認証401優先、制限非消費 |
| HTTP-05 P0 | 壊れたJSON/JSON primitive | parser400 INVALID_JSON優先、認証と制限前に停止 |
| HTTP-06 P0 | usecaseがAppError404/内部Errorを返す | 公開応答404/500、内部情報非公開 |
| HTTP-07 P0 | usecase完了保留 | 解放まで成功応答なし |
| HTTP-08〜11 P0 | 10回後11回目、別ユーザー、schema/業務失敗、窓599999/600000/600001ms | 429とRetry-After、ユーザー別枠、失敗も消費、10分後再開 |
| HTTP-12 P0 | 実registerRoutes経由POST /api/item-trash | 実対象controllerへ接続し201 |
| DB-01 P0 | active/soldoutそれぞれ全値保存 | 退避全列一致、新ID/日時、元Itemと関連削除、非対象保持 |
| DB-02 P0 | video/sale/shipping各FKをnull | 対応する退避列nullで成功 |
| DB-03 P0 | before_price=null/0/24000、Item.price=999 | before_priceをそのまま保存 |
| DB-04 P0 | 別ユーザーで削除要求 | 404、元・非対象・退避・通知不変 |
| DB-05 P0 | 自作して消したID、成功後の再送 | 404、退避と通知の重複なし |
| DB-06 P0 | 注文・購入セッション・編集・通報を持つ商品 | 記録保持、item_idのみnull（通報のupdatedAtは既定更新）、非対象通報不変 |
| DB-07 P0 | 最後のItem削除直前に実SELECT 1/0のSQLSTATE22012 | 退避/関連削除/通報解除rollback、元参照保持、修復後1回成功 |
| DB-08 P0 | 通報付きItemの直接削除後、実API | 直接削除はFK23503で拒否、APIは明示null更新後成功 |
| CC-01/02 P0 | 独立transactionで同一Item削除、先行commit/rollback | pg_blocking_pidsで実待機確認、後続は404/成功、退避・通知1件 |

保存済みJSONBは変換・値域拒否しないため、新たな破損構造拒否テストは追加しない。退避値一致・非破壊で保証する。
単体のsourceは価格やIDを区別する値で構築。DB fixtureはUUID接頭辞、所有者・他人・元/保護行を区別し、inventoryを含む属性とURLの保存値を照合する。

## DB前提と完了条件

.env.testをDB import前に読み、NODE_ENV=test、URLのDB名test_dbを確認。他env読込みと値の差替えを拒否する。
sequelize・models用sequelize・observerの全接続で設定DB名とSELECT current_database()を照合する。
必要Model列/nullable、変更対象item_id FKの削除アクション、item_trash.item_idのFK不在を検査し、全検査成功までsafe=falseとして書込みを禁止する。
READ COMMITTED前提で競合のPIDとLock待機を観測し、5秒のlock_timeoutと3秒の待機観測上限を設ける。全gateをfinallyで解放してPromiseを回収する。
afterCreate hookで自作IDを追跡し、処理回収後にそのIDだけをFK順で削除・残存0確認。ガード停止時はDELETEなし。全接続closeとenv復元を行う。
migration/sync/全件削除でスキーマを補正しない。

## 実行方法（server/）

```bash
npm run test:run -- src/usecases/itemTrash/test src/services/itemTrash/test src/services/video/test/createItemTrash.test.ts src/services/sale/test/createItemTrash.test.ts src/services/itemShippingProfile/test/createItemTrash.test.ts src/services/itemReport/test/createItemTrash.test.ts test/integration/usecases/itemTrash/createItemTrash/route.test.ts test/integration/usecases/itemTrash/createItemTrash/registration.test.ts
npm run test:run -- test/integration/database/itemTrash/createItemTrash test/integration/usecases/itemTrash/createItemTrash/concurrency.test.ts
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

通常lint対象外のtest/**/*.tsは既存ESLint APIとtypescript-eslintのparser/plugin/recommendedで対象fixture・結合テストだけを追加検査する。設定変更なし。
全必須ケース成功、静的検査成功、cleanup/close確認が完了条件。実行結果と未達は[レポート](../../report/itemTrash/createItemTrash.md)へ記録する。
