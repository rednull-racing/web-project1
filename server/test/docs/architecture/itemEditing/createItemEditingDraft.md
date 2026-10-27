# 下書きから商品編集セッション作成：テストコード設計書

## 2026-10-23 item_id追加契約

新規・下書き・商品コピーの作成dataへ`item_id: null`を明示する。service引数型はnullを必須とし、serviceはdataをそのままModelへ渡す。単体の完全一致と、DBの再SELECTで確認する。nullableなINTEGERとitem.idへのFK（ON UPDATE NO ACTION / ON DELETE CASCADE）は新規migrationで追加する。以下の過去のスキーマ記述より本契約を優先する。

## 2026-10-23 status追加の契約

作成dataへ`status: "normal"`を明示する。コピー元の商品状態は引き継がない。以下の旧記述と矛盾する場合は本契約を優先する。単体の完全一致期待値と、下書き作成のDB再SELECTで確認する。新規作成N01・コピーN10・既存回帰の結果は[status追加レポート](../../report/itemEditing/status.md)を参照。

## 1. 目的・根拠・作業範囲

対象は `createItemEditingDraftUseCase()`。下書きの所有者だけが編集セッションを生成でき、データコピーと元下書きの削除が原子的に実行されること、同一下書きへの並行操作が行ロックで直列化されることを確認する。

根拠は [createItemEditingDraft 詳細設計](../../../../../docs/design/backend/detail/itemEditing/createItemEditingDraft.md)、特に「8. テスト設計」と、2026-10-13 時点の本番コード。本書はテスト実装前の設計であり、実行結果を示さない。詳細設計の契約と現行挙動を区別し、不一致をテストの期待値変更で隠さない。

記述・分割・fixture・DB 検証は [テスト設計の共通ルール](../AGENTS.md)、[updateConfirm/testArchitecture.md](updateConfirm.md)、同設計書冒頭の配置表に記載された単体・結合テストと fixture を参考にする。参照元の `testReport.md`、`afterFix.md` の過去報告は現行仕様と混同せず、2026-10-12 の修正後契約を区別する。

今回編集するのは本書のみ。テストコード・fixture・報告書の作成、本番コード・詳細設計・設定・Todo の変更、DB 接続、migration 実行は対象外。フロント遷移、公開商品更新、S3 アップロード、動画変換も対象 usecase の責務ではない。

### 調査した関連ファイル

以下のパスの基準は `server/`。

| 責務                         | ファイル・関数                                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 業務処理・transaction        | `src/usecases/itemEditing/createItemEditingDraft.ts`：`createItemEditingDraftUseCase`                                                                                 |
| 所有者条件付き取得・行ロック | `src/services/itemDraft/query.ts`：`getMyItemDraft`                                                                                                                   |
| 編集セッション生成           | `src/services/itemEditing/command.ts`：`createItemEditingDraft`                                                                                                       |
| 元下書き削除                 | `src/services/itemDraft/command.ts`：`deleteItemDraft`                                                                                                                |
| 入出力の型                   | `src/types/serviceType/{itemDraft,itemEditing}.ts`、`src/types/itemAttributes.ts`                                                                                     |
| HTTP 接続                    | `src/controllers/itemEditing/itemEditing.ts`、`src/routes/itemEditing.ts`、`src/routes/index.ts`                                                                      |
| 入力検証                     | `src/validators/body/itemEditing.ts`：`createItemEditingDraftBodySchema`、`src/middleware/validate/validateBody.ts`                                                   |
| 認証・制限・エラー           | `src/middleware/authMiddleware.ts`、`src/middleware/rateLimit/itemEditingRateLimit.ts`、`src/errors.ts`、`src/middleware/errorHandler.ts`                             |
| モデル・関連付け             | `src/models/{item_draft,item_editing}.ts`、`src/models/index.ts`                                                                                                      |
| DB 初期化                    | `src/db.ts`、`src/config/config.ts`                                                                                                                                   |
| DB 定義資料                  | `migrations/20261005114144-create-item-editing.js`、`migrations/20261006044008-create-table-item-draft.js`、`migrations/20261006044423-update-column-item-editing.js` |
| 実行・検査設定               | `package.json`、`test/tsconfig.json`、`eslint.config.mjs`                                                                                                             |

実 DB の反映済みスキーマは今回未確認。実装時にモデル・migration と照合し、差があればスキーマを自動補正せず報告する。

## 2. 処理フロー・責務の境界

1. 実アプリでは Router が `/api/item-editing` に登録され、`POST /draft` を受ける。詳細設計の `/item-editing/draft` に API 共通 prefix が付く。
2. `authenticateToken` → `createItemEditingDraftRateLimit` → `validateBody(createItemEditingDraftBodySchema)` → controller の順。認証失敗は 401、同一ユーザーの 10 分間の 6 回目は 429、body 不正は `INVALID_BODY / 400`。いずれも usecase・transaction を開始しない。
3. controller は `req.user.id` と `req.validatedBody.itemDraftId` を usecase へ渡す。未検証 body や params の値は採用しない。
4. usecase は managed transaction を開始し、その callback 内で `getMyItemDraft({ itemDraftId, userId, transaction })` を await する。
5. service は `where: { id: itemDraftId, seller_id: userId }`、同一 transaction、`lock: transaction.LOCK.UPDATE` で取得する。取得列に seller_id は含めず、所有者照合は where 条件で行う。未存在・他人所有はともに null となり `ITEM_DRAFT_NOT_FOUND / 404`。status の絞り込みはない。
6. 取得値を明示した作成 data へコピーし、`createItemEditingDraft` → `ItemEditing.create(data, { transaction })` を await する。
7. 取得した同じ下書きインスタンスを `deleteItemDraft` へ渡し、`itemDraft.destroy({ transaction })` を await する。
8. callback は新規編集セッション ID を返す。managed transaction が成功してから usecase が数値 ID を返し、controller が 201・`{ itemEditingId }` を返す。

入力 schema は usecase 外であり、usecase 直接呼出しで 400 を期待しない。DB 例外は usecase で 500 の AppError へ変換されず、元の例外が伝播して controller の `next` へ渡る。HTTP 上の 500 整形は共通 errorHandler の責務として分ける。

商品画像は配列カラム、属性は JSONB でコピーする。独立した関連行の INSERT や関連行の FK 付替えは実装されていない。既存のマスター・ブランド ID は保持し、参照先を新しい編集セッション ID へ書き換えない。新規 ID は別テーブルで採番するため、元下書き ID と数値が必ず異なるとは期待しない。

## 3. テストレベル・構成・モック

### 現在の配置（2026-10-16）

以下は `server/` 基準。下表の旧ファイル名・過去の実行コマンドは初回設計時の記録として残す。

| 旧ファイル                                                                     | 現在の配置                                                                                                                                         |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usecase.test.ts`                                                              | `src/usecases/itemEditing/test/createItemEditingDraft.test.ts`                                                                                     |
| `services.test.ts`                                                             | `src/services/itemDraft/test/createItemEditingDraft.test.ts`（取得・削除）、`src/services/itemEditing/test/createItemEditingDraft.test.ts`（作成） |
| `validation.test.ts`                                                           | `src/validators/body/test/createItemEditingDraft.test.ts`                                                                                          |
| `controller.test.ts`                                                           | `src/controllers/itemEditing/test/createItemEditingDraft.test.ts`                                                                                  |
| `fixtures.ts`                                                                  | `src/usecases/itemEditing/test/createItemEditingDraft.fixtures.ts`（単体・結合テスト共通）                                                         |
| `database.test.ts`                                                             | `test/integration/database/itemEditing/createItemEditingDraft/`：永続化・制約・所有権・再実行。ファイル内のHTTP→DB検証も維持                       |
| `databaseTransactions.test.ts`、`databaseConcurrency.test.ts`、`route.test.ts` | `test/integration/usecases/itemEditing/createItemEditingDraft/`：transaction・並行処理・HTTP接続                                                   |
| DB fixture・setup                                                              | `test/fixtures/itemEditing/createItemEditingDraft/`（`databaseFixtures.ts`・`databaseSetup.ts`）                                                   |

単体テストは `npm run test:run -- src/usecases/itemEditing/test/createItemEditingDraft.test.ts src/services/itemDraft/test/createItemEditingDraft.test.ts src/services/itemEditing/test/createItemEditingDraft.test.ts src/validators/body/test/createItemEditingDraft.test.ts src/controllers/itemEditing/test/createItemEditingDraft.test.ts --maxWorkers=1` で実行する。
本番コードの `npm run typecheck` が移動先の単体テストを含む。残る結合テストの型は `./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` で確認する。

統合テストはファイル内のケースを分割せず、主な検証対象に従って配置した。専用のservice統合テストはないため、`integration/services` への移動はない。
DB非接続のRouterテストは `npm run test:run -- test/integration/usecases/itemEditing/createItemEditingDraft/route.test.ts --maxWorkers=1` で実行する。
2026-10-16の移動後確認ではlint・本番コードとテスト全体の型検査が成功。Routerテストは対象外usecaseのモック漏れによるDB設定読込みで40件とも検証前に停止し、実DBテストは未実行。対応は [Todo](../../../../../docs/todo/done/isolate-create-item-editing-draft-route-test-from-db.md) を参照。

全統合テストは `npm run test:run -- test/integration/database/itemEditing/createItemEditingDraft/ test/integration/usecases/itemEditing/createItemEditingDraft/ --maxWorkers=1` で実行する。実DBテストを含むため、第13節の接続ガード・安全条件を先に確認する。

下表は将来の実装構成。今回は各ファイルを作成しない。

| 記号    | ファイル                                  | 実処理／モックと確認範囲                                                                                                          |
| ------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| U       | `usecase.test.ts`                         | 実 usecase、3service と `src/db.ts` をモック。引数、全コピー項目、順序、await、例外伝播。実 commit/rollback・行ロックは保証しない |
| S       | `services.test.ts`                        | 実 3service、モデルの findOne/create と取得インスタンスの destroy をモック。where・取得列・UPDATE ロック・transaction の引渡し    |
| V       | `validation.test.ts`                      | 実 schema と validateBody。受理・拒否・未知キー除去・validatedBody と next。実 DB なし                                            |
| C       | `controller.test.ts`                      | 実 controller、対象 usecase をモック。認証 ID・検証済み ID、201 応答、next への伝播                                               |
| R       | `route.test.ts`                           | 最小 Express ＋ JSON parser ＋実 Router、認証・制限・validator を実処理、usecase をモック。Supertest で入口と打切りを確認         |
| D       | `database.test.ts`                        | 実 usecase・service・モデル・PostgreSQL。コピー・削除・所有権・状態・再実行を別接続の SELECT で確認                               |
| D       | `databaseTransactions.test.ts`            | 実処理を呼ぶ spy で障害・保留を注入し、commit/rollback、可視性、再試行を確認                                                      |
| D       | `databaseConcurrency.test.ts`             | 独立 transaction・接続の実ロック競合。取得、待機、commit/rollback の順を制御                                                      |
| 共通    | `fixtures.ts`                             | 標準入力／取得値 factory、AppError 検証、deferred Promise                                                                         |
| DB 共通 | `databaseSetup.ts`、`databaseFixtures.ts` | 接続ガード、fixture・行追跡、observer、後片付け                                                                                   |

対象に shared helper や署名処理はないため helper 専用ファイルは不要。C/R では同じ controller モジュールが import する他 usecase も境界でモックし、実 DB・AWS の import へ進まない。S は `src/models/index.ts` をモックし、U は service と db のモックを初期化前に適用する。

U の transaction モックは callback へ同一 t を渡し callback の Promise を await する。成功・callback 失敗・transaction 自体の失敗を別に扱い、モックで rollback 済みと報告しない。S 用 t には `LOCK.UPDATE` を用意する。

`vi.hoisted`、型付き `vi.fn`、`vi.mock`、`vi.spyOn` を使用。beforeEach で履歴・実装と fixture を初期化する。spy、時間操作、環境変数は復元し、Router のレートストアはモジュール再 import で分離する。TypeScript・ESM・相対 import `.js`、型のみ `import type` とし、新規ライブラリは追加しない。

## 4. 標準 fixture・共通アサーション

- U/S/C/R の標準値は所有者 A=7、別ユーザー B=8、下書き ID=11、返却編集 ID=456、body=`{ itemDraftId: 11 }`。DB では実採番 ID を使い、存在しない ID も fixture から不存在を確認して選ぶ。
- 全項目入り下書きに異なる name/title/detail/summary、画像 3 枚、商品・分類・ブランド・配送の有効参照 ID、動画の original/converted/thumbnail の別 URL を設定する。price=800、before_price=1200、discount_rate=25、discount_amount=400、sale_flag=true、recommend=true、duration=30 とし、再計算やデフォルト置換を検出する。
- attributes は在庫 initial=10/current=4/low_stock_ratio=0.5、色 2 件・サイズ 2 件、異なる uiId/色画像、日本語素材名・小数 ratio、分類・fit を含む。JSON の任意項目を失わず、在庫を初期化しないことを確認する。
- DB には A の別下書き、B の下書き、既存編集セッション、参照元 Item・マスター・ブランドも用意してスナップショットを保存する。元下書きの日時は十分古い既知日時とする。
- body、配列、JSON、モデル相当値はケースごとに factory で新しく作る。ケース別に対象条件だけ変え、fixture 内でコピー処理を再実装して期待値を算出しない。
- 公開応答・service への data は完全一致で検証する。transaction、削除対象インスタンス、作成 service へ渡す image_url/attributes は参照同一性も確認する。DB では JSON・配列の値と順序を新規 SELECT で確認し、参照同一性は期待しない。
- AppError は型・code・statusCode、予期しない例外は元の Error との同一性を確認する。異常系では後続未実行と全対象行の不変／不存在を確認する。
- DB の件数は fixture・作成 ID に限定する。テーブル全件数、連続 ID、下書き ID と編集 ID の不一致を成功条件にしない。

### N02：保存項目の対応表

以下の全項目を U の作成 data と D の保存値で確認する。data のキー集合も固定し、項目漏れと余分な項目を検出する。

| 保存先                                                                              | コピー元・期待する扱い                                                           |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| seller_id                                                                           | 認証済み userId。取得値や未検証 body の seller_id を採用しない                   |
| name、detail                                                                        | 同名下書き値。null を空文字へ補完しない                                          |
| image_url、first_image_url                                                          | 同名値。順序と独立した値をそのまま保持し、先頭から再計算しない                   |
| price、before_price、discount_rate、discount_amount、sale_flag                      | 同名値。価格・割引を再計算しない                                                 |
| item_condition_id、category_id、brand_id、brand_aliases_id                          | 同名参照 ID。既存の参照先を維持する                                              |
| gender_type、age_type、recommend                                                    | 同名値。許容値・false・null は列制約に応じて保持                                 |
| attributes                                                                          | JSON 全体。在庫、色、サイズ、画像、素材、分類、fit、キー有無と順序を保持         |
| thumbnail_url、title、summary、duration                                             | 同名値。空値・null・0 を補完しない                                               |
| original_url、converted_url、video_status                                           | 同名値。動画 URL の優先選択や status 変更を行わない                              |
| shipping_day_id、shipping_service_id、shipping_place_id、shipping_service_free_text | 同名値。nullable ID と空文字も保持                                               |
| id、createdAt、updatedAt                                                            | 作成 data に含めない。編集テーブルの新規採番・新規日時。元の管理値はコピーしない |

## 5. 正常系・任意項目・コピー境界

| ID  | レベル | 条件／入力／手順                                                           | 期待結果                                                                                                     |
| --- | ------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| N01 | U/D    | 所有者が全項目入り下書きから作成                                           | 取得 → 作成 → 削除、U は各 1 回・同じ t。D は編集 1 行増加・元下書き不存在、返却 ID の行がコピー結果と一致   |
| N02 | U/D    | 4 節の全保存項目を区別できる値で設定                                       | 全項目一致、余分な管理項目なし。seller_id=A、既存参照 ID 保持、価格・在庫・動画を加工しない                  |
| N03 | U/D    | nullable 列を null、attributes={}、gender/age・sale_flag は有効値          | null をそのまま保持し作成可能。空オブジェクトをデフォルトの別構造へ変えない                                  |
| N04 | U/D    | TEXT/文字列列は空文字、image_url=[]、attributes に空配列                   | 空値と空配列を保持。メディア必須チェックや空値拒否を新たに期待しない                                         |
| N05 | U/D    | price 等 nullable 数値・duration=0、recommend=false、sale_flag=false       | 0/false を欠落扱いせず保持。recommend=null は別条件にする                                                    |
| N06 | U/D    | attributes の任意キーなし／全キーあり／配列内 optional なし                | キーの有無を保持。素材・色・サイズの順と uiId 対応が一致。DB fixture は保存済み JSON を比較元にする          |
| N07 | U/D    | gender=men/women/unisex、age=adult/kids/both、video_status=null/既存文字列 | 各定義値と状態を保持し作成。status による取得制限・公開遷移なし。値ごとに独立展開                            |
| N08 | D      | brand_id・brand_aliases_id あり／片方／両方 null                           | 有効な FK または許可された null を保持。公開 Item・マスター・ブランドを新規作成／更新しない                  |
| N09 | D      | 古い元日時、既存編集セッションを併置して成功                               | 新規編集行を返し、元日時をコピーしない。日時は呼出前後の範囲で確認し、連番や異テーブル ID の大小を仮定しない |
| B01 | U/D    | name/title/video_status/shipping_service_free_text を各 0/254/255 文字     | 保存可能な最大長まで完全一致。各列個別展開、日本語も確認                                                     |
| B02 | U/D    | image_url=null/0/1/10 件                                                   | 配列順と全 URL を保持。first_image_url は元値を保持する独立カラムとして検証                                  |
| B03 | U/D    | detail/summary/各 TEXT URL に空文字・日本語を含む長文                      | 元値を保持。TEXT に未定義の最大長を追加しない                                                                |

境界外 256 文字は E07、画像 11 件は E08 に分離する。DB のコピー境界は下書きとして永続化できる値を使い、型上 NOT NULL の gender/age・attributes・sale_flag を通常 fixture で null にしない。

## 6. 異常系・停止位置

| ID  | レベル | 条件／入力／手順                                               | 期待結果・後続未実行                                                                                         |
| --- | ------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| E01 | U/D    | 下書き不存在（U は取得 null）                                  | ITEM_DRAFT_NOT_FOUND/404。作成・削除なし。D は既存編集・他下書き不変                                         |
| E02 | S/D    | B が A の下書き ID を指定                                      | 所有者 where で除外され同じ 404。A の下書き・編集は不変。存在情報を別エラーで返さない                        |
| E03 | U      | transaction 開始時に reject                                    | 元 Error 伝播、3service 未実行                                                                               |
| E04 | U/S/D  | 取得を reject（D は取得境界に障害注入）                        | 元 Error 伝播、作成・削除なし。D は transaction 終了後に下書き保持・編集増加なし                             |
| E05 | U/S/D  | 編集作成を reject（D は実 INSERT 後の throw も T03）           | 元 Error 伝播、削除なし。D は途中編集が残らず下書き全列保持                                                  |
| E06 | U/S/D  | 下書き削除を reject／実 destroy 後に throw                     | 元 Error 伝播、成功 ID・201 なし。D は編集 INSERT と削除を rollback し下書き復元（T04）                      |
| E07 | D      | 正常下書き取得後、作成直前 spy で対象文字列列を 256 文字へ変更 | 元の制約例外伝播、削除なし、編集残存なし・元下書き保持。通常の永続化済み下書きからは到達しない障害注入と明記 |
| E08 | S/D    | 下書き取得後、作成 data の image_url を 11 件へ変更            | 編集モデル validation で失敗し削除なし・rollback。DB CHECK の存在を保証しない。故意の境界外入力として分離    |
| E09 | U      | callback 成功後の transaction 完了を reject するモック         | 元 Error 伝播、成功 ID なし。実 commit 障害・接続断時の DB 成否は未検証と明記                                |

E07/E08 は実 usecase を呼ぶ service ラッパーで作成引数のみ変更し、下書き fixture の値を変更しない。DB の失敗はモデル validation・SQL 制約・注入した Error を区別して報告する。

## 7. 入力検証・ID 境界

| ID  | レベル | 条件／入力／手順                                         | 期待結果                                                                                                          |
| --- | ------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| V01 | V/R    | itemDraftId=1/2/通常の正整数                             | 受理、型変換なしで同じ数値 ID を controller/usecase へ渡す                                                        |
| V02 | V/R    | 0/-1/1.5 を各指定                                        | 拒否、INVALID_BODY/400。usecase・transaction 未実行                                                               |
| V03 | V/R    | "11"/""/true/null/配列/オブジェクト/欠落                 | 数値へ coerce せず拒否、INVALID_BODY/400。各値を独立展開                                                          |
| V04 | V      | body 自体 null/配列/undefined、itemDraftId=NaN/±Infinity | schema 拒否。NaN/Infinity/undefined は schema 直呼出しで、通常 JSON 経路と区別                                    |
| V05 | V/C/R  | 有効 ID に userId/seller_id/未知キーを追加               | schema は未知キーを除去。validatedBody は itemDraftId のみ、所有者は認証 ID                                       |
| V06 | V      | validateBody 成功／失敗を直接呼ぶ                        | 成功は parse 後値を validatedBody へ設定し next1 回。失敗は AppError を throw、validatedBody 設定・正常 next なし |
| O01 | V      | DB INTEGER 最大 2147483647 と 2147483648 等の正整数      | 業務上限未定、schema に max なし。schema の実受理結果を記録し、DB への収容可能性や 404/400 を保証しない           |

上限の直前・一致・直後の業務テストは、詳細設計 9 節で仕様が確定してから追加する。O01 は現行 schema の観測であり、DB 型上限を API の仕様上限に採用しない。

## 8. service 契約

| ID  | レベル | 条件／入力／手順                                       | 期待結果                                                                                                           |
| --- | ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| S01 | S      | getMyItemDraft に ID・userId・t を渡す。取得あり／null | findOne1 回、where 完全一致、同じ t、lock=t.LOCK.UPDATE。取得結果を同じ参照で返す                                  |
| S02 | S      | 取得 attributes を確認                                 | id ＋ N02 のコピー元 29 列を明示して取得。seller_id/createdAt/updatedAt は選択なし。不要な include/status 条件なし |
| S03 | S      | createItemEditingDraft に data・t を渡す               | ItemEditing.create(data,{transaction:t})1 回、data/t の参照維持、返却インスタンス同一。Item.create なし            |
| S04 | S      | deleteItemDraft に取得インスタンス・t を渡す           | 同インスタンス.destroy({transaction:t})1 回、完了を await し戻り値 undefined。別 ID の一括削除なし                 |
| S05 | S      | findOne/create/destroy を各 reject・保留               | 元 Error のまま伝播。保留中は service 未完了、解放後のみ完了。各依存を独立展開                                     |

S の引数検証だけで実行ロックや DB 保存結果を確認済みとしない。属性 29 列は N02 の seller_id・管理項目を除いたコピー元列と対応させる。

## 9. 状態遷移・重複実行

| ID   | レベル | 操作前 → 入力／手順                                       | 期待する保存後                                                                                            |
| ---- | ------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| ST01 | D      | 所有下書き 1 行 → 成功                                    | 下書き 0・新規編集 1。コピー値・seller・参照が一致                                                        |
| ST02 | D      | 下書き 1 行 → 取得／作成／削除で各失敗                    | 下書き全列保持・編集増加 0。処理済み INSERT/DELETE も rollback で戻る                                     |
| ST03 | R/D    | 未認証／不正 body／超過／他人所有で操作                   | 前 3 条件は R で usecase 未実行、D で同経路を実 usecase へ接続し DB 全列不変。他人所有は実 D で 404・不変 |
| ST04 | D      | 成功後、同じ userId/itemDraftId を逐次再実行              | 2 回目 404、編集追加なし。既存成功行の全列不変                                                            |
| ST05 | D      | rollback 確認後、同じ入力で障害解除して再試行             | 正常に編集 1 行生成・下書き削除。失敗回の残存なし、採番の巻戻しは期待しない                               |
| ST06 | D      | 対象と A 別下書き・B 下書き・既存編集・Item・参照先を併置 | 成功／失敗の双方で対象外全列不変。ブランド別名新規生成などはない                                          |

ST03 用の HTTP→DB 結合は database.test.ts 内に実認証・実 validator・実制限・実 controller・実 usecase を接続する最小アプリを用意する。DB ガード後に起動し、JWT 専用鍵・時間・ストアを分離する。R の usecase モックによる未実行確認と、実 DB での不変確認を分けて記録する。

## 10. transaction・await・DB 可視性

| ID  | レベル | 条件／入力／手順                                            | 期待結果                                                                                               |
| --- | ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| T01 | U/S    | 正常作成                                                    | transaction1 回。取得・作成・削除から findOne/create/destroy まで同一 t。取得は callback 内            |
| T02 | U      | 取得、作成、削除、transaction 完了を個別 gate で保留        | 取得前に作成なし、作成前に削除なし、削除・transaction 完了前に返却なし。解放後 N01 の順序              |
| T03 | D      | 実編集 INSERT 完了後に throw                                | observer で編集行なし・元下書き全列保持。INSERT 済みを transaction 内 SELECT で確認してから失敗させる  |
| T04 | D      | 実編集 INSERT 後に削除直前 throw／実 destroy 後 throw       | 各条件独立。別接続で編集なし・下書き保持。後者は transaction 内で下書き不存在を確認してから throw      |
| T05 | D      | 実 INSERT と実 destroy 完了後、callback 終了前で保留 → 解放 | transaction 内は編集あり・下書きなし、observer は編集なし・下書きあり。commit 後に編集あり・下書きなし |
| T06 | D      | E04/E05/E06 後に別接続で対象行へ FOR UPDATE NOWAIT          | rollback 後にロック取得可能。成功 commit 後は対象下書き不存在。他ケースへロックを持ち越さない          |
| T07 | D      | 作成失敗または削除失敗後、通常再試行                        | ST05 の状態を確認。自動再試行は期待しない                                                              |

managed transaction の callback 内で呼んだ事実だけで参加を保証しない。T01 の引数契約と T03〜T05 の実結果を両方確認する。全ケースを外側の transaction で包んで常に rollback する方式は使わず、実 commit と observer の可視性を維持する。commit 障害の実再現は対象外で、E09 は例外伝播のモック確認に限定する。

## 11. 並行処理・行ロック

各呼出しは独立 transaction・物理接続を使用する。任意の sleep や単なる Promise.all ではなく、開始通知・解放用 deferred を分け、実 SELECT/INSERT/DELETE 後の service ラッパーで順序を固定する。待機する処理がロック取得後に到達する gate を、先行解放条件にしない。

待機の確認は接続 PID、`pg_blocking_pids` 等で対象 transaction が先行 transaction にブロックされていることを確認し、未完了・未 INSERT も併せて確認する。検査には上限時間を設け、実行順は時刻経過で決めない。SQL で所有者条件と FOR UPDATE も確認する。観測用接続の枯渇を避けるプール構成と実分離レベルを事前検査する。特に後続 SELECT の再評価は READ COMMITTED を前提とし、異なる環境なら期待結果への影響を報告する。

| ID  | レベル | 再現する順序／条件                                                                                | 期待結果                                                                                             |
| --- | ------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| P01 | D      | A が取得・行ロック →B が同じ ID を要求し待機 →A 作成/削除 commit→B 解放。A/B の開始順を逆にも展開 | 成功 1 件、後続 ITEM_DRAFT_NOT_FOUND/404、新規編集 1 行、下書きなし。B は作成・削除未実行            |
| P02 | D      | A 取得 →B 待機 →A が実 INSERT 後に削除失敗で rollback→B 取得/作成 commit                          | A 編集なし、B 編集 1 行、下書きなし。B は rollback 後に残る全値をコピーできる                        |
| P03 | D      | 別接続 U が下書き更新・ロック保持 →A が取得待機 →U commit→A 作成                                  | A は更新後の name/price/画像/attributes を一貫してコピー。古い値の混在なし                           |
| P04 | D      | 別接続 U が下書き DELETE・ロック保持 →A 取得待機 →U commit                                        | A は 404、編集なし。削除前 snapshot から作成しない                                                   |
| P05 | D      | A 取得・ロック → 別接続 U の UPDATE が待機 →A 作成/削除 commit                                    | 編集は A がロック取得した値。U は対象行 0 件更新となり下書きは復活しない。SQL 影響行数を確認         |
| P06 | D      | A 取得・ロック → 別接続 U の DELETE が待機 →A を commit／rollback                                 | commit 時は U 削除 0 件、編集 1 行。rollback 時は U が残った下書きを削除、A 編集なし。条件を独立展開 |
| P07 | D      | U の UPDATE／DELETE が先行し A 待機 →U rollback→A 作成                                            | A は rollback 後の元値から編集 1 行作成。未 commit 変更をコピーしない                                |
| P08 | D      | 所有者変更の UPDATE が先行 →A 待機 → 所有者 B への変更 commit                                     | 所有者 where 再評価により A は 404、編集なし。B 所有の変更後下書きを保持                             |
| P09 | D      | A と B が異なる所有下書きを取得 → 片方保留中に他方 commit                                         | 両方成功、編集 2 行、元 2 行削除。値・所有者・参照先が混ざらず別行を不要にブロックしない             |

P03/P04/P07/P08 は別処理の SQL による競合を再現するもので、全更新・削除 API の結合検証済みとはしない。全 Promise は開始時に settled/reject 検証を登録し、finally で gate 解放・回収・transaction 終了・hook 解除を行う。並行処理後に observer で対象行・非対象行を再取得する。

## 12. controller・Router・レート境界

| ID  | レベル | 条件／入力／手順                                                     | 期待結果・後続未実行                                                                                                   |
| --- | ------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| C01 | C      | req.user.id=A、validatedBody の ID=11、body/params に別 ID・別所有者 | usecase へ `{ userId:A, itemDraftId:11 }` を 1 回だけ渡す                                                              |
| C02 | C/R    | usecase が 456 を返す                                                | 201、JSON 完全一致 `{ itemEditingId:456 }`。余分なコピー値・下書き ID なし、next なし                                  |
| C03 | C      | AppError／通常 Error で usecase reject                               | 同じ Error を next1 回、status/json なし                                                                               |
| C04 | C      | usecase を deferred で保留                                           | 保留中は 201 送信なし、解放後 C02                                                                                      |
| R01 | R      | トークンなし／Bearer 不正／署名不正／期限切れ                        | 実認証の 401 応答、validator・usecase 未実行。未認証はレート枠を消費しない                                             |
| R02 | R      | 正常認証で POST /api/item-editing/draft、正常 body                   | 実 middleware→controller 接続、C01/C02。params ID 検証は不要                                                           |
| R03 | R      | 認証済み＋ V02/V03 の不正 body                                       | INVALID_BODY/400、usecase 未実行。正常認証＋不正 body は枠を消費                                                       |
| R04 | R      | 同じ userId を異なるトークンで 5 回 →6 回、別 userId で送信          | 最初 5 回は 201、6 回目 429、別ユーザーは 201。同ユーザーは同じ枠。超過時 usecase 未実行                               |
| R05 | R      | 不正 body を 5 回 → 正常 body の 6 回目                              | 5 回 400、6 回目 429。成功要求だけを数えるとは期待しない                                                               |
| R06 | R      | 固定時刻で 5 回 →10 分の直前 →10 分経過時 → 直後                     | 直前 429、期間切替後は新しい枠で 201。境界ごとにストアを分離し、JWT は窓全体で有効にする                               |
| R07 | R      | 無認証＋不正 body／制限超過＋不正 body                               | それぞれ 401／429 が先。validator・usecase 未実行                                                                      |
| R08 | R      | usecase が ITEM_DRAFT_NOT_FOUND／通常 Error を reject                | controller から同じ例外がエラー middleware へ渡り成功応答なし。観測用 middleware の 404／500 整形と共通 handler を区別 |

R では `express.json()` と実 Router を `/api/item-editing` に接続する。JWT 専用鍵を生成し `vi.stubEnv` と dotenv モックで実鍵の読込みを防ぐ。時刻操作は Date・ストア interval などに限定し HTTP I/O を維持する。5 回/6 回・切替境界で呼出し数も確認し、429 はレート middleware 既定応答に合わせる。UNAUTHORIZED の AppError 形式を認証に強制しない。

共通 errorHandler は現行ソースが 3 引数のため、Express が 4 引数エラー middleware として扱うかに注意が必要。R のテスト専用 4 引数 handler で通常 Error を 500 に変換しても、実アプリの 500 契約の確認済みとはしない。この入口外の確認事項は本書へ記録し、本番コード・Todo は変更しない。

## 13. 実 DB 環境・制約・後片付け

実装時は既存の専用 PostgreSQL `test_db` と反映済みスキーマを使用する。DB 作成、migration、sync、truncate、全件削除は行わない。

1. `server/` を実行ディレクトリとし、DB モジュール import 前に `.env.test` のみを読み、NODE_ENV=test・接続 URL の DB 名=test_db を検査する。継承された env や引数なし dotenv による `.env` 読込みをそのまま信用しない。
2. `src/db.ts`、モデル初期化用 `db.sequelize`、observer、競合用の全接続を接続前に検査し、接続後の `SELECT current_database()` で test_db を確認する。全検査終了まで fixture 書込みなし。別 env 読込み・URL 差替えも停止させる。
3. item_draft/item_editing と user/item/categories/item_condition_option/brands/brand_aliases/shipping_day_option/shipping_service_option/todouhuken_option の必要列・FK を検査する。item_id 削除後の現行FK、ENUM、attributes/sale_flag の NOT NULL、STRING(255)、ARRAY・JSONB を確認する。画像 10 件上限はモデル validation であり DB CHECK と推定しない。
4. fixture 親行を依存順に作成し、固有名・作成 ID を記録する。usecase が作る編集行も追跡し、実生成 ID と返却 ID の対応を検証する。既存共有データや固定 DB ID に依存しない。
5. 結果は observer の新規 SELECT で取得する。rollback 前のインスタンスを判定に使わず、下書き・編集全列、JSON キー有無・配列順、非対象行を確認する。
6. finally で処理回収後に、作成した ID だけを編集・下書き →Item→ ブランド別名・マスター → ユーザーの FK 依存順に削除し、残存なしを確認する。全 hook/spy・接続を終了し env を復元する。失敗時も既存行は削除しない。

ガードの不一致・読込元不明は DB 処理を中断しユーザー判断へ委ねる（[DB結合テストの共通ルール](../../../integration/database/AGENTS.md)「条件に違反したときの中断」）。秘密情報・接続 URL はログに出さず、読込元パス・DB 名・検査結果のみを記録する。未確認の接続へ後片付けの削除を行わない。

## 14. 詳細設計「8. テスト設計」との対応・差分確認

本書作成後、8 節の全列挙項目を以下へ照合した。対応ありは設計への反映を意味し、実装・実行済みではない。

| 詳細設計の区分 | 観点（各箇条書き）                   | 対応ケース                  | 照合結果                                                     |
| -------------- | ------------------------------------ | --------------------------- | ------------------------------------------------------------ |
| 正常系         | 所有者が生成できる                   | N01、R02、ST01              | 対応あり                                                     |
| 正常系         | 入力データ引継ぎ                     | N02〜N08、B01〜B03          | 全コピー列を明示                                             |
| 正常系         | 元下書き削除                         | N01、ST01、T05              | commit 後 SELECT で確認                                      |
| 正常系         | 新 itemEditingId 返却                | N01、N09、C02、R02          | 新規行 ID との対応、異テーブル ID の不一致は要求しない       |
| 異常系         | 不存在 ID                            | E01                         | 404 ＋後続未実行・不変                                       |
| 異常系         | 他人 ID                              | E02                         | where 認可、同じ 404                                         |
| 異常系         | ID 型不正                            | V03/V04、R03                | schema・HTTP を分離                                          |
| 異常系         | 編集作成 DB エラー                   | E05、T03                    | 実 INSERT 後 rollback を含む                                 |
| 異常系         | 下書き削除失敗                       | E06、T04                    | DELETE 前後の失敗を分離                                      |
| 並行処理       | 同一 ID で重複生成なし               | P01                         | 実ロック待機と最終 1 件                                      |
| 並行処理       | 先行 commit 後に後続 404             | P01                         | 待機 →commit→ 再評価                                         |
| 並行処理       | 先行 rollback 後に後続成功           | P02                         | 待機 →rollback→ 取得成功                                     |
| 並行処理       | 更新・削除競合で最新コピー／404      | P03〜P07                    | 先行・後続と commit/rollback 双方                            |
| 境界値         | ID 下限・整数・上限確定後            | V01〜V04、O01               | 下限・整数は対応。業務上限は仕様未定で保留                   |
| 境界値         | レート回数・期間切替                 | R04、R06                    | 5/6 回・直前/一致/直後                                       |
| 境界値         | コピー未入力・空・最大長             | N03〜N06、B01〜B03、E07/E08 | nullable/空値/255 文字/画像 10 件を具体化、TEXT 上限は未定義 |
| 条件分岐       | 認証・入力・存在・所有者             | R01/R03/R07、V、E01/E02     | 各失敗の打切りと優先順位                                     |
| 条件分岐       | ユーザー別レート・不正入力加算       | R04/R05                     | 認証 ID の同一枠・別枠                                       |
| 条件分岐       | 任意項目有無と値の引継ぎ             | N03〜N08                    | 加工・補完しないコピー                                       |
| 条件分岐       | 各 DB 失敗 rollback                  | E04〜E06、T03/T04、ST02     | 取得・作成・削除を個別化                                     |
| 状態遷移       | 成功時下書き削除・編集生成           | ST01、T05                   | 両テーブルの commit 可視性                                   |
| 状態遷移       | 失敗時下書き保持・途中データなし     | ST02、T03/T04               | 別接続で全列確認                                             |
| 状態遷移       | 認証・入力・認可・レートエラー時不変 | ST03、E02、R01/R03/R04      | 入口の未実行と HTTP→ 実 DB 不変を分ける                      |
| 状態遷移       | 成功後再送で追加なし                 | ST04                        | 2 回目 404 と既存行不変                                      |
| 状態遷移       | rollback 後再試行                    | ST05、T07                   | 障害解除後成功、失敗回残存なし                               |
| 状態遷移       | 対象外下書き・既存編集不変           | ST06                        | 成功・失敗双方の全列比較                                     |

8 節の確定観点に対する設計上の漏れ・期待仕様の変更はなし。追加の具体化は service 引数・選択列（S）、await・commit 可視性（T）、controller/Router 接続（C/R）、所有者変更と別行競合（P08/P09）、非通常入力による保存境界障害（E07/E08）。対象業務を広げる保証は追加していない。

8 節以外を含む詳細設計との留意差分は、API 共通 prefix、所有者照合を where で実施する点、画像・属性がカラム内データで関連行コピーがない点、DB 例外が元 Error で伝播する点。成功応答は現行 controller で 201・`{ itemEditingId }` に確定している。業務 ID 上限・独立した関連レコードの移行・実アプリの共通エラー応答は、未確定／責務外／未検証の範囲を混同しない。

## 15. 優先度・実行方法・完了条件

| 優先度 | ケース群                                                                 | 理由                                                                                      |
| ------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| P0     | N01/N02、E01〜E06、V01〜V04/V06、T01〜T05、ST01〜ST03、C01〜C03、P01/P02 | 基本動作・所有権・入力境界・原子性・重複生成防止。並行処理でも必須契約 P01/P02 は先に確認 |
| P1     | 残り N、B、S、C04、R 全件、残り T/ST、E07/E08                            | コピー境界・各層接続・状態・再試行                                                        |
| P2     | P03〜P09、O01、E09、V05                                                  | 更新削除競合の詳細・観測・追加境界。必須観点のため P2 も未実施のまま全体完了にしない      |

テスト名はケース ID・日本語の条件・期待結果を含め、複数条件は `it.each` 等で独立展開する。ケース ID 数とランナーの展開後件数を分けて報告し、モック成功だけで DB 観点を完了にしない。

将来のテスト実装後、DB ガード確認を経て `server/` で実行する。

```bash
npm run test:run -- test/usecases/itemEditing/createItemEditingDraft/ --maxWorkers=1
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

`--maxWorkers=1` は DB fixture/hook・レート状態のファイル間干渉を抑えるため。ケース内の独立 transaction による並行処理は P で実行する。lint の実対象を確認し、テスト TS が対象外なら既存 ESLint/typescript-eslint による追加検査方法を報告し、設定は独断で変更しない。

実装完了条件は、全確定観点のケースとテストファイルの対応、コピー全項目、後続未実行、await、別接続の commit/rollback、ロック待機と再評価、非対象行不変、後片付けの確認が追えること。未実装・未実行・環境制約・観測・仕様保留を成功と混ぜず、DB 非接続検査と DB 検査の結果を分ける。

**今回の完了範囲は本設計書の作成、詳細設計 8 節との照合、リンク・ケース対応・編集範囲の確認のみ。テスト・lint・型検査の実行および DB 接続は行っていない。**

## 2026-10-16 RouterのDB設定依存解消

移動後確認で検出したモック漏れを修正済み。`createItemEditingCopy/createItemEditingCopy.js`を他の対象外usecaseと同様にモックし、dotenvの無効化を維持する。既存R01〜R08・AF-R01〜05等の40件の入力・期待値は変更しない。実Router・認証・validator・レート制限・controller・共通errorHandlerの検証範囲も維持する。

検証結果は [最新レポート](../../report/itemEditing/createItemEditingDraft.md#route-db-isolation-20261016) を参照。
