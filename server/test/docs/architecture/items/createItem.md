# createItem テスト設計書

## 1. 目的・根拠・作業範囲

対象は `src/usecases/items/create/createItem.ts` の `createItemUseCase` と `POST /api/items`。所有者の編集セッションから商品・動画・セール・配送情報を原子的に生成し、成功時だけ元セッションを消費する契約を検証する。コピー漏れ、所有権のすり抜け、不正な保存データ、途中失敗、同時公開による重複生成を検出する。

根拠は[詳細設計書](../../../../../docs/design/backend/detail/items/createItem.md)の第2〜8章、本番コード、2026-10-20のユーザーによる仕様確定。変更していない契約は[初回実装時の方針記録](../../../../../docs/log_memo/codex_log.md#20261019_backend-coding_createItem本番実装)も参照する。設計形式は[共通ルール](../AGENTS.md)、[配置規則](../../../AGENTS.md)、既存の [createItemEditingCopy](../itemEditing/createItemEditingCopy.md)、[createItemDraft](../itemDraft/createItemDraft.md)、[updateConfirm](../itemEditing/updateConfirm.md) を参考にする。他機能の過去の観測やケース数を本機能の保証へ流用しない。

初回は2026-10-20に文書だけを作成し、同日の仕様確定依頼で本番usecase・本書・詳細設計書を更新した。今回のカラム削除追従では本番の残存参照と既存単体テスト・fixtureも修正し、関連単体テスト・lint・型検査を行う。Model・migrationは変更せず、DB接続・migrationは実行しない。本書の期待結果はcreateItemテストの実行結果ではない。後述のテスト配置とコマンドは将来の実装用。

### 2026-10-20 テスト実装中の仕様訂正（最新）

ユーザーの追加指示により、`brand_id` と `brand_aliases_id` はそれぞれnullを許容し、両方nullも許容する。必須IDはcategory/condition/day/service/placeの5種類。brand/aliasが非nullの場合は従来の整数範囲を維持する。過去の「7種類すべて必須」の記録より本訂正を優先する。最初は本番コード変更禁止としてnull拒否による失敗を記録した。その後ユーザーが本番コードのnull拒否修正を明示的に許可したため、公開前提検証だけを修正し再検証する。修正前後はレポートで区別する。

### 2026-10-20 カラム削除への追従

- ユーザーがModel・DBから `item.deleted_at`、`item_editing.item_id`、`item_draft.item_id` を削除済みと確認。これを現行契約とし、旧item_idのnull・非nullを用意するケースを廃止する。B01/D07は元セッションIDと新商品IDの分離・既存データ不変の確認へ更新する。
- 出品数集計はseller_idとactive/soldoutのみ。削除日時を持つ商品fixtureは作らない。作成値にもdeleted_atを含めない。
- server/src全体の残存参照を除去。ユーザー回答により旧論理削除・復元APIは503・ITEM_ARCHIVE_UNAVAILABLEで停止し、30日削除cronは登録・旧実装を削除する。item_trash移行は別対応。本公開処理の行DELETE競合ケースは維持する。
- 以下の旧仕様確定履歴は経緯であり、カラム削除後のfixture・期待値には適用しない。

### 2026-10-20 仕様確定による変更履歴

- 旧B01/D07の「item_id非nullは400」を撤回し、null・非nullとも受理して新item.idを採番する契約へ更新。元の商品・関連を更新せず、編集セッションだけを消費する。
- 旧B08/M03/O03の「関連IDがnullでも公開可能」を撤回。category/condition/day/service/place/brand/aliasの7種類は必須で、nullは400・INVALID_NUMBER。旧ケースは本文の期待値を更新し、AF-ID01〜AF-ID03で停止・再試行・競合後の判定を補う。
- patchPublishUseCaseおよび旧公開ルートはserver/srcに残存しないことを確認。cronEditingDeleteUseCaseは指示により対象外とし、旧O05の調査ケースを廃止する。独立した元行DELETEとの競合はP05/P08として維持する。

以下のパスは特記しない限り **`server/` 基準**。API記述の `/items` は実アプリで `/api/items` に登録される。テスト文書・結合テスト・fixtureの大分類は依頼に合わせて `items/createItem`、usecase単体は本番コードに近い `src/usecases/itemEditing/test/` とする。

対象外は購入・在庫減算、別API全体の回帰、フロントエンド、実S3通信、ファイルアップロード・変換・コピー・削除、通知の再送・永続化保証、負荷試験、冪等性キーの導入。クライアントの応答受信失敗やCOMMIT通信断は観測範囲を明示し、必ずrollbackできるとはしない。

### 詳細設計と現行コードの対応

詳細設計のうち今回確定した項目は以下の契約を使用する。それ以外の未決定事項は観測として分ける。明示された契約と異なる結果が出た場合は期待値を緩めず、不一致として報告する。

| 論点                       | 調査時点の根拠・扱い                                                                                                                                                                                        | 対応ケース                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 新公開APIの接続            | 新usecase・body schema・controller・10分5回の制限・POST接続が存在。旧patchPublishUseCaseの定義・import/export・ルート接続はserver/srcにない                                                                 | N01、V01〜V06、R01〜R13    |
| 編集セッションと新規採番   | item_editing/item_draftにitem_idは存在しない。item.idを新規採番し、セッションのidを作成先へ渡さない。video/sale/配送にitem_id列を追加しない                                                                 | B01、D07、N02              |
| 価格・公開データ           | name/titleの型、first_image_url、整数価格300〜1000000を確認。必須5種類はnull不可、brand/aliasはnull可。非nullの7種類は各1〜2147483647の整数とし、不正値は400・INVALID_NUMBER                                | B02〜B10、AF-ID01〜AF-ID03 |
| 在庫の構造と業務条件       | 詳細設計の構造不正500に加え、実装は各initialの負数・小数を400・`ITEM_PUBLISH_DATA_INVALID`とする。0は受理。current/ratioの値域や在庫合計の整合性は検証しない                                                | I01〜I12、O02              |
| マスター再検証             | 公開前提で必須5種類と任意brand/aliasの非null値を検証後、category/condition/day/service/placeをvalidateMasterで再検証。brand/aliasは再解決せず既存FKをコピーする。共有helperのnull省略は公開成功条件にしない | M01〜M07、O03              |
| 出品商品数                 | 作成前集計・1件加算なし。seller_idとstatus IN active/soldoutだけを条件とし、削除済みのdeleted_atを参照しない                                                                                                | N07、S05、D05              |
| 文字列・動画完了の最終要件 | name/titleは空文字を拒否しない。converted_url/duration/video_statusのnullも処理可能。必須5種類と任意brand/aliasの区別と、これら未確定の公開業務要件を分ける                                                 | N04、B08、O01、O03         |
| 削除との競合               | 対象行DELETEとの排他を検証する。cronEditingDeleteUseCaseは調査・修正・テスト対象外                                                                                                                          | P05〜P08                   |
| DB反映状態                 | モデル・migrationを参照しただけで実DBは未確認                                                                                                                                                               | 第11節、D系、P系           |

## 2. 調査対象と責務

| 責務                           | 調査対象                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 業務フロー・公開前提・在庫複製 | `src/usecases/items/create/createItem.ts`：createItemUseCase、非公開のvalidatePublishData/hasCopyableInventory/resetInventory/resetCurrentInventory                                                                                                                                                           |
| 認可取得・元行削除             | `src/services/itemEditing/{query,command}.ts`：getMyItemEditing、deleteItemEditing                                                                                                                                                                                                                            |
| マスター検証                   | `src/usecases/shared/validateMaster.ts`、`src/services/categories/categories.ts`、`src/services/itemConditionOption/itemConditionOption.ts`、`src/services/shippingDayOption/shippingDayOption.ts`、`src/services/shippingServiceOption/shippingServiceOption.ts`、`src/services/todouhuken/todouhuken.ts`    |
| 集計・出品者参照               | `src/services/users/query.ts`、`src/services/follow/follow.ts`、`src/services/items/items.count.ts`                                                                                                                                                                                                           |
| 新規作成・export経路           | `src/services/items/{index,command/index,command/create}.ts`、`src/services/video/video.ts`、`src/services/sale/sale.ts`、`src/services/itemShippingProfile/itemShippingProfile.ts`                                                                                                                           |
| 通知・正規化                   | `src/services/notification/notification.ts`、`src/utils/normalizeJapanese.ts`                                                                                                                                                                                                                                 |
| HTTP接続                       | `src/validators/body/items.ts`、`src/middleware/validate/validateBody.ts`、`src/controllers/items/items.ts`、`src/routes/{items,index}.ts`、`src/app.ts`                                                                                                                                                      |
| 認証・制限・エラー             | `src/middleware/authMiddleware.ts`、`src/middleware/rateLimit/itemsRateLimit.ts`、`src/errors.ts`、`src/middleware/errorHandler.ts`                                                                                                                                                                           |
| 型                             | `src/types/itemAttributes.ts`、`src/types/serviceType/{items,itemEditing,video,sale,itemShippingProfile,users,categories,follow}.ts`                                                                                                                                                                          |
| モデル・接続                   | `src/models/{item,item_editing,video,sale,item_shipping_profile,categories,follow}.ts`、`src/db.ts`、`src/config/config.ts`。モデル初期化・親fixtureは既存databaseFixturesも参照                                                                                                                              |
| DB定義資料                     | `migrations/20261020120909-remove-item-deleted-at-and-session-item-id.js`：item.deleted_at、item_editing/item_draft.item_idの削除。旧関連側カラム削除は `migrations/20261005062153-delete-column-item-id.js` 参照                                                                                             |
| 競合する保存                   | `src/usecases/itemEditing/updateConfirm.ts`。削除競合は自作fixtureの元行を独立transactionでDELETEして用意し、cronは使用しない                                                                                                                                                                                 |
| 既存単体・結合・fixture        | `src/usecases/itemEditing/createItemEditingCopy/test/inventoryReset.test.ts`、`src/services/itemEditing/test/updateConfirm.test.ts`、`test/integration/usecases/itemEditing/updateConfirm/databaseConcurrency.test.ts`、`test/fixtures/itemEditing/createItemEditingCopy/{databaseSetup,databaseFixtures}.ts` |
| 既存レポート・実行設定         | `test/docs/report/itemEditing/createItemEditingCopy.md`、`package.json`、`tsconfig.json`、`test/tsconfig.json`、`eslint.config.mjs`                                                                                                                                                                           |

本処理専用のcreateItemテスト・fixture・レポートは調査時点では見当たらない。既存のコピー出品・確認画面保存テストは参照資料であり、公開作成の実装済みテストとして数えない。既存レポートのCOMMIT応答喪失の未実施も、本処理の実行結果として引き継がない。

## 3. 処理順序・停止位置

1. 共通JSON parser → RouterのauthenticateToken → createItemRateLimit → validateBody(createItemBodySchema) → createItemController。JSON構文不正は認証・制限より先に停止する。
2. controllerは `req.user.id` と `req.validatedBody.itemEditingId` だけをusecaseへ渡す。params/query/bodyの所有者情報を使用しない。
3. managed transaction開始 → `getMyItemEditing({ itemEditingId, userId, transaction: t })`。serviceは `where: { id, seller_id }` と `lock: t.LOCK.UPDATE` を指定する。ItemEditingにはstatus/deleted_at条件やVideoのincludeを追加しない。
4. 未取得は404・ITEM_EDITING_NOT_FOUND。取得後はoriginal_url → thumbnail_url → image_urlの欠落/空/超過 → 必須5種類のnull/整数範囲・brand/aliasの非null整数範囲 → name/title/first_image_url/priceの順に判定する。編集セッションにitem_idは存在せず、セッションidはコピー先のIDに使わない。
5. attributes全体の構造検証 → structuredClone → 商品・各色・各サイズのinitial業務検証とcurrent復元。構造不正は500、有限数値でもinitialが負数・小数なら400。途中で失敗してもコピー元を変更しない。
6. getUser（必要な4列のみ）→ validateMaster（category→condition→day→service→place）→ parent_idがあれば親カテゴリー → countFollower → countSellItem。すべて同じt。出品者欠落はUSER_NOT_FOUND・500。
7. sort計算 → createVideo → createSale → createShipping → 公開日時生成・search_text正規化 → createItem → ロック済みModelのdeleteItemEditing。各書込みに同じt。
8. callbackが `{ itemId, name, firstImageUrl }` を返す → managed transactionのcommit完了 → transactionなしのcreateNotification開始 → itemIdを返す → controllerが201・`{ itemId }`。
9. 通知はawaitせずcatchする。通知が未完了・rejectでも公開成功を維持する。transaction開始前の拒否・404・callback失敗・transaction完了Promiseのrejectでは通知を開始しない。

異常系はエラーに加え、停止点より後の参照・集計・作成・削除・通知の未実行を確認する。先に実行された書込みが消える保証は、モックの回数だけでなくD/Tの実DB再取得で確認する。

## 4. テストレベル・配置案・モック境界

以下は将来作成するファイル案。すべてを機械的に分割せず、記載した責務があるファイルだけを作る。単体の規約は本番コードに最も近いAGENTS、結合は [usecases](../../../integration/usecases/AGENTS.md)・[database](../../../integration/database/AGENTS.md)、準備は [fixtures](../../../fixtures/AGENTS.md) に従う。

| レベル | 配置案                                                                                                                                  | 実処理・モック／確認範囲                                                                                                                                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| U      | `src/usecases/items/create/test/createItem.test.ts`                                                                                     | 実usecase・非公開公開前提検証・実normalizeJapanese。service、validateMaster、sequelize.transactionをモック。引数・変換・停止・待機・通知時点。DB原子性は保証しない |
| I      | `src/usecases/itemEditing/test/createItem.inventoryReset.test.ts`                                                                       | 非公開関数をexportせず実usecase経由で在庫処理。DB/helper境界をモックし、構造・値域・深いコピーに集中                                                               |
| H      | `test/integration/usecases/items/createItem/master.test.ts`                                                                             | 実usecase＋実validateMaster。各DB serviceとtransactionをモック。各マスター分岐・transaction引渡しと後続停止を確認                                                  |
| V      | `src/validators/body/test/createItem.test.ts`                                                                                           | 実schema・実validateBody。DBなしでparse・未知キー除去・400・validatedBodyを確認                                                                                    |
| S      | `src/services/itemEditing/test/createItem.test.ts`                                                                                      | 実getMyItemEditing/deleteItemEditing。Modelメソッドをモックし、where/lock/destroyと同一参照を確認                                                                  |
| S      | `src/services/items/command/test/createItem.test.ts`、`src/services/items/test/createItem.count.test.ts`                                | 実createItem/countSellItem、Model.create/countをモック。ID戻り値、検索条件、tを確認                                                                                |
| S      | `src/services/{video,sale,itemShippingProfile}/test/createItem.test.ts`                                                                 | 各実作成service、Model.createをモック。data/t・Model戻り値・例外伝播                                                                                               |
| S      | `src/services/{users,categories,follow,itemConditionOption,shippingDayOption,shippingServiceOption,todouhuken}/test/createItem.test.ts` | 各実参照service、モデルをモック。列指定・ID/集計条件・t対応。既存テストと重複する契約は対応IDを記録して再利用可能                                                  |
| C      | `src/controllers/items/test/createItem.test.ts`                                                                                         | 実controller、対象usecaseをモック。検証済み値・201・next・待機。他のexportの依存importも境界で止める                                                               |
| R      | `test/integration/usecases/items/createItem/route.test.ts`                                                                              | 実Router/controller/認証/制限/validator/共通errorHandler、対象usecaseをモック。JSON parserを備えた最小Express。DBに接続しない                                      |
| D      | `test/integration/database/items/createItem/database.test.ts`                                                                           | 実usecase/helper/service/モデル/PostgreSQL。通知をモックし、保存値・所有権・再送・保護対象を確認                                                                   |
| D/T    | `test/integration/usecases/items/createItem/databaseTransactions.test.ts`                                                               | 上記＋明示した障害注入・待機spy。4テーブル原子性・可視性・rollback・再試行                                                                                         |
| D/P    | `test/integration/usecases/items/createItem/databaseConcurrency.test.ts`                                                                | 上記＋独立transaction/接続、実SQLを保つgate。ロック待機・解放後の再判定・競合する保存との接続                                                                      |
| D/R    | `test/integration/usecases/items/createItem/databaseHttp.test.ts`                                                                       | 実RouterからDBまで接続。通知のみモック。正常・404・400/500の代表値、commit/rollback完了と応答を確認                                                                |
| 共通   | `test/fixtures/items/createItem/{fixtures,databaseSetup,databaseFixtures,httpFixtures}.ts`                                              | 順にfactory/具体的期待値/deferred、接続前ガード、作成ID追跡/別接続SELECT/後片付け、最小HTTP組立。空ファイルは作らない                                              |

UでvalidateMasterをモックした成功をM系の完了にしない。SはSQL引数の検証であり、実際の行ロック・制約・rollbackはD/T/Pで確認する。Rのusecase未実行はtransaction未開始の責務境界の証明であり、実DB未開始の代表ケースはD/Rでも確認する。

Routerは現行のimport経路で対象外usecaseもモックし、controllerの他のexportからDB/AWS初期化へ進まないようにする。Rで独自エラー整形を挟まず、共通errorHandlerを実行する。`src/app.ts` の直接importはcron起動を伴うため、Router結合と実登録先の確認を分ける。登録テストでは対象Routerを実処理にしてregisterRoutesを使い、無関係なRouterのimportだけを分離する。最小アプリへの手動mountだけで実登録済みとは判定しない。

## 5. 標準fixture・共通アサーション

- Uの標準は `userId=7`、`itemEditingId=11`。元行にitem_idは用意しない。作成結果はvideo.id=101、sale.id=202、shipping.id=303、createItem戻り値=456とし、IDの取り違えを検出する。Dでは実採番を使い、固定IDやIDの連続性に依存しない。
- 所有者A、別ユーザーB、Aの新規セッション、Bのセッション、Aの別セッション、既存公開商品とその3関連、既存ItemDraftを用意する。非対象行のbefore snapshotを保存する。Dの集計fixtureは作成対象とは分ける。
- 商品名 `ＴｅＳＴ カタカナ`、動画title `ＶＩＤＥＯ テスト`、子カテゴリー名 `シャツ`、親名 `ＴＯＰＳ`、user_name `ＵＳＥＲ`。detail=`説明AB`（4）、summary=`動画C`（3）、user_introduction=`紹介DE`（4）、price=12340、penalty_points=5、followerCount=2、sellItemCount=3。期待sortは両方6295、search_textは `testかたかなvideoてすとしゃつtopsuser`。本番関数で期待値を生成しない。
- original/converted/thumbnail/商品先頭/商品2枚目/色画像のURLを識別可能にする。画像順序も固定。category/condition/day/service/place/brand/aliasはそれぞれ別ID。sale入力はbefore_price=15000、discount_rate=20、discount_amount=1000、sale_flag=trueとしてリセットを検出する。
- attributesは商品inventory=`{ initial: 9, current: 2, low_stock_ratio: 0.2 }`、赤色=`5/1/0.3`、青色=`2/0/0.4`、赤M=`3/0/0.5`、赤L=`2/1/0.6`のように別値にする。uiId、色/サイズ名、色画像、materials、body_category/lifestyle_category/layer/fit、追加の入れ子JSONも用意する。初期在庫の合計一致は本処理の条件にしない。
- body/取得行/JSON/配列をfactoryで毎回新規作成する。異常値は原則1条件ずつ変更し、複数不備の優先順位は別ケースにする。unknown経由の不正構造注入はI/Uに限定し、HTTPでNaNを送れたことにしない。
- 主要作成引数・レスポンスは完全一致、t・ロック済みModelは参照同一性も確認する。禁止キー、回数、順序、後続未実行を確認。AppErrorは型/code/statusCode/publicMessage、通常例外は同一Errorの伝播を確認する。
- 在庫コピーは元attributesのbefore snapshot・深いfreeze・参照非同一性・コピー後の入れ子変更を組み合わせる。画像配列まで深いコピーされる保証を推測しない。
- 公開日時は既知の時刻に制御しuploaded_at/save_atの同一日時を確認。createdAt/updatedAtは新規行生成であり、4テーブルすべてで厳密に同じ時刻とはしない。別テーブル同士の数値IDは偶然一致し得るため「元編集IDと新itemIDが必ず異なる」とはしない。
- spy/timer/環境変数/モジュール状態/レート制限ストアをケース間で分離・復元する。deferredの開始通知と解放を分け、reject検証を先に登録し、finallyで全Promiseとtransactionを回収する。待機確認に固定sleepを使わない。

## 6. コピー・正常系・算出値

### 引渡し対応表

`e` はロック後のItemEditing。ID・作成日時を除き、表の全項目をN02で確認する。

| 保存先                | コピー元／期待値                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| itemの商品入力        | eの `name, detail, image_url, price, item_condition_id, first_image_url, gender_type, age_type, recommend, category_id, brand_id, brand_aliases_id` |
| item.seller_id        | 認証済みuserId。body内seller_id/userIdは使用しない                                                                                                  |
| item.attributes       | e.attributesの深いコピー。存在する各inventory.currentだけを同じinventory.initialへ戻す                                                              |
| itemの算出・関連      | `sort_number=sort_buzz_number=sort`、`search_text=normalizedSearchText`、`video_id=video.id, sale_id=sale.id, shipping_id=shipping.id`              |
| itemの公開管理値      | `status="active", views_count=0, early_sell=true, checked=false, report_score=0`、`uploaded_at=save_at=now`                                         |
| video                 | eの `thumbnail_url, title, summary, duration, original_url, converted_url`、`status=e.video_status, play_count=0`                                   |
| sale                  | `before_price=e.before_price, discount_rate=null, discount_amount=null, sale_flag=false`                                                            |
| item_shipping_profile | eの `shipping_day_id, shipping_service_id, shipping_place_id, shipping_service_free_text`                                                           |
| コピーしない項目      | eの `id, createdAt, updatedAt`。関連のdataへ `item_id, user_id` を追加しない。関連IDはitem側にのみ設定                                              |
| 削除対象              | getMyItemEditingが返した同じModelだけを同じtでdeleteItemEditingへ渡す                                                                               |

| ID  | レベル | 条件／入力／手順                                                                                                                                                        | 期待結果                                                                                                                                                       |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N01 | U/D/R  | 標準fixtureで公開                                                                                                                                                       | video→sale→shipping→item→元行削除を各1回。usecaseは数値456、HTTPはcommit後に201・`{ itemId: 456 }`。実DBは4テーブル各1件増・元行なし                           |
| N02 | U/D    | 全コピー項目を識別できる値にする                                                                                                                                        | 対応表の全値、関連参照方向、禁止キーを確認。新規行の採番・作成日時を使用し、既存商品/下書き/他セッションを変更しない                                           |
| N03 | U/D    | 割引設定あり／割引なし、before_priceが価格と異なる／null                                                                                                                | before_priceだけ維持し、割引2値は必ずnull、flag=false。before_priceをpriceへ置換しない                                                                         |
| N04 | U/D    | 許容される任意列を個別null：detail/summary/duration/converted_url/video_status/recommend/配送自由文                                                                     | 保存値はnullを保持し、detail/summaryだけ算出時に長さ0。brand/aliasのnullも保持。公開必須の5種類のID/name/title/画像URL/priceはnull不可                         |
| N05 | U/D    | 男女区分/年齢区分の各Model列挙値、recommend=true/false                                                                                                                  | 値を維持。取得した元データにないdefaultへの置換なし                                                                                                            |
| N06 | U      | 標準値からpenalty_pointsを4/5/6に変更。数値文字列"5"/"6"も別条件にする                                                                                                  | 4/5/"5"は6295、6/"6"は1295。Number変換と5の境界を確認する                                                                                                      |
| N07 | U/D    | follower/sell各0/1/複数、片方だけ増加                                                                                                                                   | 各件数差1でsortが10増える。作成前countを使用し、新商品の1件を独自加算しない。両sort一致                                                                        |
| N08 | U      | price=301、detail/summary/紹介文をnull/空文字/絵文字へ個別変更                                                                                                          | 小数sortを切り捨てない。文字列長はJSのUTF-16 length（例：絵文字1つは2）で加算。null/空は0                                                                      |
| N09 | U/D    | 標準の全半角/大文字/カタカナ/空白混在。別条件でname=`ＴＥＳＴ ｶﾞ`、title=`Ａ カ`、子名=`ｼｬﾂ`、parent_id=null・user_nameなし、タブ/改行/全角空白も混入。他の必須IDは正常 | 標準のsearch_text、別条件の `testがaかしゃつ` に完全一致。半角濁点もNFKCで正規化。summary/detail/ブランド名を検索文字列へ勝手に追加しない                      |
| N10 | U/H    | 子カテゴリーは存在し、親なし／親取得null、user_name=null                                                                                                                | 該当部分だけ空文字となる。親なしは親検索なし。親取得nullをCATEGORY_NOT_FOUNDへ変換しない。category_id=nullはAF-ID01、不存在はM02の拒否であり本ケースに混ぜない |
| N11 | U/D    | 商品画像・色画像・動画URLを複数用意                                                                                                                                     | URL文字列、配列順、uiIdとの対応を維持。S3コピー/削除/署名発行/動画変換処理なし                                                                                 |
| N12 | U      | createItem前に時刻を固定し元日時は過去にする                                                                                                                            | uploaded_at/save_atは同じ公開日時。作成dataに元createdAt/updatedAt/idなし                                                                                      |

## 7. 入力検証・認証前後の境界

Vはschema単体と実validateBodyの双方で確認する。schema単体のsafeParse失敗そのものにHTTPコードを期待せず、middleware/HTTPでINVALID_BODYを確認する。

| ID  | レベル | 条件／入力／手順                                                                     | 期待結果・未実行処理                                                                                               |
| --- | ------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| V01 | V/R    | itemEditingId=1/2147483646/2147483647                                                | numberのまま受理。上限行の存在は不要。Rはusecase到達を確認し、D/Rで存在しなければ404。400やINTEGER桁あふれにしない |
| V02 | V/R    | 0/-1/2147483648/MAX_SAFE_INTEGER/1.5                                                 | 400・INVALID_BODY、controller/usecase未実行、transaction未開始                                                     |
| V03 | V/R    | 未指定/undefined/null/"11"/"1e1"/"1 OR 1=1"/"../11"/空文字/boolean/配列/オブジェクト | 数値へcoerceせず400・INVALID_BODY。DB検索を含め後続なし                                                            |
| V04 | V/R    | body={} / null / [] / 数値 / 文字列、HTTP空body                                      | 400・INVALID_BODY。ただしparserが先に拒否するscalar JSONはR06でINVALID_JSONとして区別。DBなし                      |
| V05 | V/R    | 正常IDとuserId/seller_id/itemId/status/price/attributes等の未知キーを混入            | parse結果は `{ itemEditingId }` のみ。所有者・公開内容の改ざんなし                                                 |
| V06 | V      | itemEditingId=NaN/±Infinity                                                          | schema拒否。JSONでは表現できないためHTTPケースとして数えない                                                       |

## 8. 保存済み公開データ・エラー優先順位

B01は正常系であり、削除済みカラムをfixtureへ追加しない。他の各行は標準の保存データから該当列だけを変更する。B02〜B10の失敗はtransaction開始済み・元行取得後であり、公開用の参照/集計/作成/削除/通知へ進まない。属性変換より前に止まる。整数列の小数・不正型などDBで保存できない値はUで注入し、通常の保存fixtureで作れたことにしない。

| ID  | レベル | 条件／入力／手順                                                                                                              | 期待結果                                                                                                                                                                                                            |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E01 | U/D    | 不存在/他人所有/seller_id=null/先行で消費済みの元セッション。Uでは取得serviceがnullを返す境界、Dでは実whereによる未取得を確認 | いずれも404・ITEM_EDITING_NOT_FOUND、元行の内容を返さない。transaction開始済みでrollbackし、公開前提検証・属性複製・user取得以降・全作成/削除/通知なし                                                              |
| B01 | U/D    | item_idを持たない正常な編集セッションと、別の既存商品・下書きを用意                                                           | 新規公開へ進む。itemのcreate dataにid/item_id/deleted_atなし。セッションidを新商品・関連のIDへ流用せず、既存商品を更新しない                                                                                        |
| B02 | U/D    | original_url=null/空文字                                                                                                      | 400・VIDEO_URL_NULL                                                                                                                                                                                                 |
| B03 | U/D    | thumbnail_url=null/空文字                                                                                                     | 400・THUMBNAIL_URL_NULL                                                                                                                                                                                             |
| B04 | U/D    | image_url=null/[]、1枚/10枚/11枚                                                                                              | null/0枚はITEM_IMAGE_NULL、11枚はITEM_IMAGE_LIMIT_EXCEEDED、各400。1/10枚は後続へ進む。11枚のDはModel配列validatorとDB保存可能性を区別する                                                                          |
| B05 | U/D    | price=null/299/300/1000000/1000001、小数/数値文字列/NaN/Infinity（後者はU）                                                   | 300/1000000受理。他は400・ITEM_PUBLISH_DATA_INVALID                                                                                                                                                                 |
| B06 | U/D    | nameまたはtitle=null、Uではnumber/object等も注入                                                                              | 400・ITEM_PUBLISH_DATA_INVALID。空文字の扱いはO01                                                                                                                                                                   |
| B07 | U/D    | first_image_url=null/空文字                                                                                                   | 400・ITEM_PUBLISH_DATA_INVALID。image_urlから自動補完しない                                                                                                                                                         |
| B08 | U/H    | 7種類のIDの非null値を各1/2147483647にする                                                                                     | 範囲判定を通過。category/condition/day/service/placeはマスター検証へ進み、不存在ならM02の404。brand/aliasは再検索せずコピーし、実DBで存在しないFKはD08で区別。必須IDのnullはAF-ID01、brand/aliasのnullはAF-BR01〜03 |
| B09 | U      | 7種類のIDの非null不正値を各0/-1/2147483648/1.5/"1"/undefined/NaN/Infinityにする                                               | 400・INVALID_NUMBER。helperが0検索を省くことを公開APIの受理仕様にしない。getUser/validateMaster/集計/作成/削除/通知未実行                                                                                           |
| B10 | U      | 複数不備を対で投入：original+thumbnail、thumbnail+画像、画像0/11+null/不正ID、null/不正ID+price、price+属性不正               | 第3節の最初の判定のエラー。後の判定のエラーで上書きしない。画像null/空と枚数超過は別入力にする                                                                                                                      |

## 9. attributes・在庫の敵対的入力

Iは実usecase内の変換を実行する。全異常系でgetUser以降が未実行、元attributes不変。構造不正の500とinitial業務不正の400を区別する。NaN/Infinity/undefined/疎配列はJSONB保存値としては作れないか表現が変わるため、主にI/Uの防御検証とし、DはJSONBで表現可能なnull・欠落・文字列・配列・負数・小数を選ぶ。

| ID  | レベル | 条件／入力／手順                                                                                                | 期待結果                                                                                                             |
| --- | ------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| I01 | I/D    | 商品・複数色・複数サイズのcurrentをinitialと異なる値にする                                                      | 各currentだけが自分のinitialへ戻り、initial/ratio/他のJSON/配列順を完全保持。商品・色・サイズ間の値を混用しない      |
| I02 | I/D    | 各階層でinitial=0/1/複数、currentがinitialより小/同/大                                                          | current=initial。0を1へ補正しない                                                                                    |
| I03 | I/D    | `{}`、商品inventory欠落、colorVariants欠落/[]、色inventory欠落、sizes欠落/[]                                    | 欠落・空を維持し、補完しない。色inventoryなし＋サイズあり、商品inventoryなし＋色在庫ありも処理する                   |
| I04 | I      | 属性を深くfreezeし実行→コピーの各入れ子を変更                                                                   | 元不変。商品/色/サイズのinventory、配列、materials、追加オブジェクトが別参照。複製は成功し、入力freezeで失敗しない   |
| I05 | I/D    | attributes=null/配列/数値/文字列/boolean、Iではundefinedも                                                      | 500・ITEM_ATTRIBUTES_INVALID。SQL NULLがNOT NULLで作れない条件はIのみ、JSON nullとは区別                             |
| I06 | I/D    | colorVariantsまたはsizesがnull/文字列/オブジェクト/数値                                                         | 500・ITEM_ATTRIBUTES_INVALID                                                                                         |
| I07 | I/D    | 各色要素・各サイズ要素がnull/配列/数値/文字列/boolean                                                           | 500・ITEM_ATTRIBUTES_INVALID。2番目以降の不正要素でも作成なし                                                        |
| I08 | I/D    | 商品/色/サイズinventoryがnull/配列/数値/文字列、size.inventory欠落                                              | 500・ITEM_ATTRIBUTES_INVALID。商品/色inventory欠落はI03と区別                                                        |
| I09 | I/D    | 各inventoryのinitial/current/low_stock_ratioを1キーずつ欠落/null/数値文字列/booleanにする。IではNaN/±Infinityも | すべて500・ITEM_ATTRIBUTES_INVALID。初期値だけ有限でもcurrent/ratio不正を見逃さない                                  |
| I10 | I/D    | 各階層のinitial=-1/0.5、他キーは有限で正常                                                                      | 400・ITEM_PUBLISH_DATA_INVALID。商品だけでなく色/サイズ、後方要素の不正も拒否。途中までcloneを変換しても元データ不変 |
| I11 | I      | 商品initial=-1＋後方サイズのinventory欠落                                                                       | 構造検証が先なので500・ITEM_ATTRIBUTES_INVALID。全体構造が正常な負数initialだけならI10の400                          |
| I12 | I/D    | uiId/画像/色/サイズ名/materials/分類/追加のJSONに識別値、順序逆転や同一uiIdを含める                             | current以外は保持。在庫処理が重複uiIdの排除や画像再署名をしない。HTTP保存APIの重複uiId拒否と混同しない               |

## 10. 参照・helper・serviceの呼出し契約

| ID  | レベル | 条件／入力／手順                                              | 期待結果・未実行処理                                                                                                                                                      |
| --- | ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M01 | H      | 5種類すべて存在、親カテゴリーあり                             | category→condition→day→service→placeへ対応IDと同一t。返された子のparent_idで親を取得後に集計/作成。bodyの別IDは使わない                                                   |
| M02 | H      | 5種類を1種類ずつ不存在にする                                  | 順にCATEGORY_NOT_FOUND / ITEM_CONDITION_NOT_FOUND / SHIPPING_DAY_NOT_FOUND / SHIPPING_SERVICE_NOT_FOUND / PLACE_NOT_FOUND、各404。後続マスター/親/集計/作成/削除/通知なし |
| M03 | H      | 必須5種類と非nullのbrand/alias IDは正常で、子のparent_id=null | 5種類のマスター検索は実行し、親検索だけ省略して公開成功。旧null-ID受理条件はAF-ID01の拒否へ移行。共有helper単独のnull省略分岐は本公開APIの契約に含めない                  |
| M04 | H      | 各マスター検索、親検索が通常Errorでreject                     | 同一Errorを伝播、後続処理なし。親不存在のnullはN10と区別                                                                                                                  |
| M05 | U/H    | getUser=null                                                  | AppError・USER_NOT_FOUND・500。マスター/集計/作成以降なし。userIdだけから名前等を補完しない                                                                               |
| M06 | H      | 子と親の分類/名称を元attributesと異なる値にする               | 検索文字列には取得名称を使用。元attributesの分類を新マスターから再構築しない                                                                                              |
| M07 | H      | 複数マスター不存在、子存在＋condition不存在＋親検索失敗を用意 | validateMaster内の順序を維持。conditionエラーなら親検索へ到達しない                                                                                                       |
| S01 | S      | transaction指定でgetMyItemEditing、戻り値あり/null/reject     | findOneは `where:{ id:itemEditingId, seller_id:userId }, transaction:t, lock:t.LOCK.UPDATE`。include/status/deleted_atなし。Model/null/例外をそのまま返す                 |
| S02 | S      | transaction省略で同service                                    | whereは維持しlock/t指定なし。既存呼出し互換の検証であり、公開usecaseがtを省くことは許容しない                                                                             |
| S03 | S      | deleteItemEditingにロック済みModelとt、成功/reject            | そのModel.destroyへ `{ transaction:t }` を1回。再検索/別ID削除/別transactionの補償処理なし。同一Error伝播                                                                 |
| S04 | S      | createVideo/createSale/createShipping/createItemを個別に実行  | 各Model.create(data,{ transaction:t })にdata/t同一参照。前三者は作成Model、createItemはitem.idのnumber。rejectは同一Error、service自身はtransaction開始/終了しない        |
| S05 | S/D    | countSellItem、所有者A/B、active/soldoutを用意                | seller_id=Aかつstatus IN active/soldout。deleted_at条件なし。別所有者除外。現行ENUMにないstatusをDBfixtureに作らずSでwhereを完全一致検証                                  |
| S06 | S/D    | countFollowerでAをフォローする行とAがフォローする行を区別     | `follower_user_id=A`を数える。follow_user_idへ反転しない。同じtを渡す                                                                                                     |
| S07 | S      | getUserへ列指定とt、カテゴリー/各マスターへIDとt              | getUserは `id,user_name,user_introduction,penalty_points` の列指定、各findByPkへ同じt。参照系は不要なFOR UPDATEなし                                                       |
| S08 | S      | 任意t対応の参照/集計をtあり/なしで個別実行                    | tありは必ず伝達。tなしの既存呼出し形式を維持し、返値/null/rejectを伝播。これは公開処理のt必須検証とは分離                                                                 |

## 11. 実DBの前提・fixture・観測方法

将来のD/T/P実行は [DB共通ルール](../../../integration/database/AGENTS.md) の全条件に従う。今回はDBに接続せず、以下は準備要件である。

1. `server/` を実行ディレクトリとし、DB関連importより前に `server/.env.test` 由来の設定、NODE_ENV=test、PostgreSQLのDB名=test_dbを検査する。src/db.tsに加え、モデル初期化・observer・competitorの全接続を対象に、設定DB名と接続後の `SELECT current_database()` を照合してからfixtureを書き込む。
2. 引数なしdotenv.config、別envの明示読込、接続URL差替え、ガード後の変更を検出する。別env/test_db以外/読込元・接続先不明では中断してユーザー判断を待つ。値を黙って差し替えず、接続URL/認証情報をログへ出さない。接続不明のまま後片付けのDELETEもしない。
3. 用意済みの反映済みスキーマを検査する。item_editing、item、video、sale、item_shipping_profile、user、categories、follow、item_draft、5種類のマスター・ブランド/別名などfixtureの親行が必要。カテゴリのpath/layer等のNOT NULLも満たす。自動DB作成/migration/sync/truncate/全件削除は行わない。
4. itemのvideo_id/sale_id/shipping_idが各関連を参照し、関連側に旧item_idやvideo.user_idがないこと、item.deleted_atおよびitem_editing/item_draft.item_idが存在しないこと、JSONB/配列/ENUM/整数、外部キーと削除動作を実DBで照合する。現在のModelではitemの3関連FKはON DELETE SET NULL。編集セッション・下書きからitemへの旧FKは存在しない。逆方向の連鎖削除を想定してcleanupを省略しない。差があれば環境不一致を報告し、期待値を合わせない。
5. 実接続のisolationを確認し、Pの「待機後に更新/削除済み行を再判定」はREAD COMMITTEDで検証する。別isolationでserialization failure等が出た場合に404と同一視しない。集計元全体のスナップショット固定を要求しない。
6. fixtureと本処理が作ったIDを追跡する。失敗してrollbackされた関連IDも控え、observerの新規SELECTで残存0を確認する。通知は原則モックし、公開結果の検査と非同期通知のcleanup競合を避ける。既存商品・下書き・別セッションのsnapshotと行数差分も比較する。
7. rollback/commitの検査を外側のrollback専用テストtransactionで包まない。usecase自身のtransactionと独立したobserverで、commit前後/rollback後を読む。処理したインスタンスだけで保存成功を判定しない。DECIMALのraw取得は文字列になり得るため比較時の表現を統一する。
8. 終了時は全待機・Promise・transactionを解放し、作成IDだけをFK順に削除する。保護対象ItemDraftも今回用意した分だけ削除。itemを消しても3関連が消えるとは限らないので個別削除し、残存0を確認する。シーケンスを戻さず、全hook/spy/接続を閉じて環境を復元する。

JSONBとして表現できる構造破損は、属性値を対象行に保存して用意できる。11枚画像はSequelize validationを通らないため、必要なら検査済みテストDBの自作fixture行だけをパラメーター化SQLで更新し、スキーマを変更せず実現する。整数型の小数、欠落userや不正FKなどDB制約が防ぐ状態はU/Hで模擬する。無理に制約を外してDの入力にしない。

## 12. transaction・通知・途中失敗

TのUはmanaged transactionをモックし、callbackの完了とtransaction外側Promiseの解決を分けて制御する。単にcallbackを実行するモックから実commit/rollbackを保証しない。

| ID  | レベル | 条件／入力／手順                                                                                      | 期待結果・未実行処理                                                                                                                                                                                                             |
| --- | ------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01 | U/S/D  | 正常公開の参照/集計/各作成/削除                                                                       | 第3節の全DB依存に同じt、通知にはtなし。DB上も同じtransactionの可視性になる                                                                                                                                                       |
| T02 | U      | getMyItemEditing/getUser/master/親/countFollower/countSellItem/各作成/削除を順に1つずつdeferredで保留 | 依存する後続処理とusecase成功は保留。createItem完了前に削除なし、削除完了前にcallback成功なし                                                                                                                                    |
| T03 | U      | callback終了後も外側transaction Promiseを保留→resolve                                                 | 保留中は通知なし、usecase/controller成功なし。resolve後に通知1回・itemId返却                                                                                                                                                     |
| T04 | U      | transaction開始自体がreject（callback未実行）                                                         | 同一Error、元行取得も全書込み/通知/201もなし。開始済みrollbackの呼出しを要求しない                                                                                                                                               |
| T05 | U/D    | 元行取得・user参照・各マスター・親・両countのいずれかがreject                                         | 同一Error、以後停止、作成なし、通知なし。Dの実行可能な取得/集計障害では元行/保護対象不変・ロック解放                                                                                                                             |
| T06 | U/D    | video作成失敗、sale失敗、shipping失敗、item失敗を独立投入                                             | 失敗位置以降の作成/削除/通知なし。Dでは既に成功した関連INSERTもすべてrollback、4テーブル追加0、元行保持                                                                                                                          |
| T07 | U/D    | 元行削除前に失敗／実destroy成功直後に障害注入してthrow                                                | 4テーブル追加0、元行はbefore snapshotどおり復元、他行不変、通知なし。実削除後のrollbackも確認                                                                                                                                    |
| T08 | U      | callback成功後、外側transaction Promiseがreject                                                       | 成功応答・通知なし、例外伝播。DBの実COMMIT結果の保証にはしない                                                                                                                                                                   |
| T09 | D      | commit前に失敗を確定できる障害を注入する                                                              | rollback後に4テーブル残存なし・元行保持・ロック解放。注入点を明記し「COMMIT通信断」の検証済みとは書かない                                                                                                                        |
| T10 | U/R    | 通常DB Errorに内部SQL等の識別文字列を含める、AppErrorも別投入                                         | controllerは同一Errorをnextへ。HTTPは通常Errorなら固定500 `{ error:"INTERNAL_SERVER_ERROR", message:"サーバーエラーが発生しました" }`、AppErrorはstatus/code/publicMessageまたはcodeをmessageに使用。内部SQLやスタックを返さない |
| T11 | U      | 標準公開成功                                                                                          | commit後のcreateNotificationのdata完全一致：read_user_id=7、url=`/item/456`、message_image=元first_image_url、type=ITEM、messageは下記。元編集IDや別所有者を使わない                                                             |
| T12 | U/D/R  | 通知Promiseを未完了のまま保留／commit後にreject                                                       | Promise完了を待たずitemId/201。rejectをcatchし未処理rejectionなし。公開DBは維持、元行削除済み、追加rollback/補償削除/500なし。ログspyを復元し保留Promiseも回収                                                                   |
| T13 | U/D    | 404・400・構造不正500・各DB失敗の全経路                                                               | 通知0回。失敗時の再送通知や自動再試行をしない                                                                                                                                                                                    |

通知文言の期待値は `商品「${name}」を出品いただき誠にありがとうございます。商品の詳細はこちらの商品ページからご確認ください。`。expires_atは通知serviceの責務で、公開usecaseの引数へ独自に追加しない。通知をモックしたDは通知レコードの永続化を検証済みとしない。

### 保存結果・可視性

| ID  | レベル | 条件／入力／手順                                                                                                             | 期待結果                                                                                                                                                                                               |
| --- | ------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D01 | D      | 標準公開を実行しobserverで新規SELECT                                                                                         | 4テーブル各1件増、対応表の全保存値・JSONB・URL・関連FK一致、元行なし。各関連をitemから辿れる                                                                                                           |
| D02 | D/T    | 実item作成と元行削除後、callback終了直前で保留                                                                               | observerは新4行を見ず元行を参照可能。同じt内では新行あり・元行なし。解放commit後に反転し、その後HTTP成功                                                                                               |
| D03 | D/T    | T06/T07の各失敗後にobserverでSELECT                                                                                          | 全追加0、元行保持、既存4種/下書き/他セッション不変。NOWAITの再ロック等でロック解放も確認                                                                                                               |
| D04 | D/T    | 途中失敗→元行が保持されることを確認→障害を外して同じIDで再試行                                                               | 後続は1組だけ生成して成功、元行削除、通知開始は成功回だけ1回。失敗で消費されたsequence値を巻き戻さない                                                                                                 |
| D05 | D      | count対象としてAのactive/soldoutとBの行、両方向followを用意                                                                  | 第10節の条件で集計し新商品の自己加算なし。sortを独立した件数から照合。既存行のstatus等は変更しない                                                                                                     |
| D06 | D      | 成功後同じセッションIDで再送、消費済み/不存在/他人IDも比較                                                                   | 各404・ITEM_EDITING_NOT_FOUND、本文も同一。追加4行0・通知0、最初の公開商品は維持                                                                                                                       |
| D07 | D/R    | item_idを持たない編集セッションと、別の既存item・関連・下書きを用意して公開                                                  | 201で新itemと3関連が各1件。新item.idは新規採番、既存item/関連/下書き不変、元セッションだけ削除。セッションidとの数値の不一致自体は要求せず、独立した採番を確認する。新IDを通知/応答へ使用し、再送は404 |
| D08 | D/T    | モデルvalidation失敗／実DBのFK・NOT NULL等の制約失敗を作成段階へ注入                                                         | 通常Error500、全rollback・元行保持。実serviceに渡すdataだけをspyで壊す等の注入範囲を明記。既存制約を削除しない。Model拒否とDBが拒否したケースを区別                                                    |
| D09 | D/R    | 正常・不存在・URL欠落・属性構造破損・途中作成失敗・通知失敗の代表条件                                                        | HTTPとDBの双方がN/B/I/Tの契約に一致。エラー応答は開始済みtransactionのrollback後、正常応答はcommit後。モックだけのRと別集計                                                                            |
| D10 | D/R    | 実usecaseを接続したHTTPで401/429/INVALID_BODY/INVALID_JSONを個別発生させる。429は同一ユーザーの不正body5回で枠を消費して準備 | 対象公開用sequelize.transactionの呼出し0、4テーブル追加0・元行と保護対象不変・通知0。fixture準備のDB処理を呼出し数に含めず、リクエスト直前に観測を開始                                                 |

## 13. 並行処理・状態遷移

Pは実PostgreSQLで独立transaction/接続を使う。A/Bの開始・実ロック取得・待機・commit/rollback・完了を識別する。gateは実serviceを呼んだ前後に置き、取得結果や実SQLの意味を変えない。backend PIDと `pg_blocking_pids` 等でBがAにブロックされている事実を確認する。期限付きのポーリングは失敗診断用であり、sleep経過を待機成立の根拠にしない。失敗時もfinallyで解放・回収し、デッドロックをテスト側で作らない。

| ID  | レベル | 条件／入力／手順                                                                                  | 期待結果                                                                                                                        |
| --- | ------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| P01 | D/P    | 同じセッション。Aが公開ロック取得→B公開開始・実待機確認→A commit                                  | Aだけ成功、Bは待機後404。4テーブル各1件、元行なし、通知開始1回。開始順だけで勝者を決めない                                      |
| P02 | D/P    | Aロック→B実待機→Aはitem作成後に障害でrollback                                                     | Bは保持された行から成功。Aの関連行は残らず最終1組・通知1回。BがAの未コミット値を使わない                                        |
| P03 | D/P    | 確認画面保存がtransaction付きでロックし、名称・価格・画像・動画・在庫を更新→公開待機→保存commit   | 公開は更新済み全項目を一貫してコピー。事前fixtureやロック前SELECTの古い値を混ぜない                                             |
| P04 | D/P    | P03と同じ更新後、保存rollbackで公開を解放                                                         | 元の全コピー値で公開。在庫currentは元initialへ復元。未コミット画像/価格が残らない                                               |
| P05 | D/P    | 別transactionが対象ItemEditingをDELETE→公開実待機→DELETE commit／rollback                         | commitなら404・新規4行0・通知0、rollbackなら元データで公開成功。直接DELETEは削除API接続の証明とは分ける                         |
| P06 | D/P    | 別transactionでseller_idをAからBへ更新→A公開待機→commit／rollback                                 | commitなら所有者where再評価により404、rollbackならAとして成功。他ユーザーのデータを公開しない                                   |
| P07 | D/P    | 公開が先にロック→実updateConfirmが事前取得・準備まで進む→transaction内の再取得で実待機→公開commit | 保存は再取得後404、新しい公開商品/関連を更新しない。署名等のDB外準備の取消しまでは要求しない                                    |
| P08 | D/P    | 公開が先にロック→別接続DELETE待機→公開commit                                                      | 後続DELETEは元行不存在（直接SQLなら削除0件）。公開商品/3関連が削除されない。不存在時のHTTP応答はそのAPIの仕様がある場合だけ検証 |
| P09 | D/P    | A/Bが異なる自作セッションを並行公開、別ユーザーの組合せも実施                                     | 双方成功、各1組・計2組、対応する画像/在庫/関連ID/通知宛先が混ざらない。同一ユーザーの集計値は厳密な順序を固定しない             |
| P10 | D/P    | A公開の集計前後に別セッションの公開・followのcommitを制御                                         | 当該クエリ時点で読んだ件数を算式に使用。follow/他item全体をロックする保証や全参照の同時点スナップショットを要求しない           |
| P11 | D/P    | 同じセッションで片方が公開前提エラー→rollback、内容を正常に保存→再公開                            | エラー回は追加0・元行保持。正常保存後の再公開だけ成功。失敗を消費済み扱いにしない                                               |

元行の有効期限自体はcreateItemで判定されない。古いcreatedAtだけで拒否するテストは追加しない。削除競合は同じ対象行DELETEとしてP05/P08で検証する。cronEditingDeleteUseCaseはユーザー指示により対象外。

## 14. Controller・HTTP・レート制限

認証にはテスト専用鍵で生成した有効/期限切れ/不正署名のBearerトークンを用いる。req.userだけを手動設定するテストはCに限定し、Rは実authenticateTokenを通す。制限時間はDate/必要なtimerだけを制御し、HTTP I/Oを妨げない。各ケースで新しい制限状態を作り、他ケースの消費回数に依存しない。

| ID  | レベル | 条件／入力／手順                                                                         | 期待結果・未実行処理                                                                                                                                          |
| --- | ------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01 | C      | req.user.id=7、validatedBody.itemEditingId=11、req.body/params/queryには異なる値         | `{ userId:7, itemEditingId:11 }` だけで1回呼ぶ。未検証入力を渡さない                                                                                          |
| C02 | C      | usecaseを保留→456でresolve                                                               | 保留中レスポンスなし、resolve後201・`{ itemId:456 }`のみ。201を2回送らない                                                                                    |
| C03 | C      | usecaseがAppError/通常Errorでreject                                                      | 同一Errorをnextへ1回、201/json送信なし                                                                                                                        |
| R01 | R      | 正常JSON・有効認証でPOST `/api/items`                                                    | params検証を要求せず201。usecaseへ認証IDと検証済みitemEditingId                                                                                               |
| R02 | R      | トークンなし／Bearerなし／不正署名／期限切れ                                             | 401・既存message形式。制限・body validator・usecase/transactionに到達しない。固定codeを新設しない                                                             |
| R03 | R      | 同一ユーザー5回→6回目                                                                    | 5回通過、6回目429、usecase未実行。実ライブラリの応答・standard RateLimitヘッダー、超過時Retry-After、legacy X-RateLimitなしを確認。429をAppError JSONにしない |
| R04 | R      | 同じユーザーでIPだけ変更、同じIPで別ユーザー                                             | 同じユーザーは共通枠、別ユーザーは独立枠。キー生成はreq.user.id由来でbody/queryの偽装に影響されない                                                           |
| R05 | R      | 10分窓内で上限到達→窓終了直前→終了後                                                     | 直前429、終了後に再受付。10分の境界は制限ストアの起点から制御し、実時間の経過を待たない                                                                       |
| R06 | R      | 閉じ括弧不足等のraw JSON、不正なscalar JSON                                              | 400・INVALID_JSON、認証/制限/usecase/transaction未実行。同じユーザーの正常JSON枠を消費しない。共通parserとerrorHandlerを実行する                              |
| R07 | R      | 正常JSONの不正ID/bodyを5回→6回目                                                         | 最初の5回400・INVALID_BODY、6回目429。最初の400でも制限を消費し、DBは全回未開始                                                                               |
| R08 | R      | 未認証+不正body、有効認証+超過+不正body、JSON不正+未認証                                 | 順に401、429、400・INVALID_JSON。middlewareの優先順位どおりに停止                                                                                             |
| R09 | R/D    | 404や公開前提400/予期しない500を5回→6回目                                                | 失敗も回数に含め6回目429。先行の業務エラーは共通形式で返す。Rはusecaseをrejectさせ、Dは代表404で実確認                                                        |
| R10 | R      | queryだけitemEditingId指定、正常bodyとqueryが不一致                                      | body欠落は400。正常bodyがあればbodyの値だけを使う。偽装seller_id/userId/statusは除去                                                                          |
| R11 | R      | usecaseの404/公開400/属性500/通常Errorを個別reject                                       | 共通errorHandlerが契約のstatusとJSONを返す。400/404/500で成功IDや内部データを返さない。通常ErrorはT10の固定形式                                               |
| R12 | R      | 実registerRoutesからPOST、廃止予定だったPATCH `/:id/publish`/旧create exportの参照を調査 | POSTは新handlerに到達。旧公開処理が呼ばれない。旧PATCHはルート不在を確認し、404本文は共通notFoundの範囲で観測。無関係なルートの仕様変更はしない               |
| R13 | R      | 有効な認証で繰り返しschema拒否、認証拒否を挟んで再要求                                   | schema拒否だけがユーザー枠を消費し、認証拒否は消費しない。HTTP側の未実行spyは必ず到達可能な正常対照を持つ                                                     |

本APIはapplication/jsonを契約とする。現行アプリはurlencoded parserも持つが、追加の415や文字列coerce受理を推測しない。非JSON Content-Type全般の契約変更は対象外。

## 15. 観測・仕様確認を要する項目

以下はコード上の挙動を将来観測するケース。望ましい公開要件の確定・不具合修正済み・実行済みという意味ではない。今回確定したID必須化・新規採番・3カラム削除以外の仕様を独断変更せず、実装と契約が食い違う項目を本書と報告へ残す。

| ID  | レベル            | 条件／入力／手順                                                                               | 観測内容・固定しない保証                                                                                                                                                                     |
| --- | ----------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O01 | U/D               | name/titleが空文字/空白、URLが空白、first_image_urlとimage_url[0]不一致、画像要素が空文字/重複 | 現行の型/falsy/枚数判定でどこまで通るかと保存結果を記録。文字列trim、URL形式/所有S3キー/先頭画像一致/画像実体確認を行う保証はない。業務上許容する最終要件は未確定                            |
| O02 | I/D               | currentが負数/小数、ratioが負数/1超、在庫階層の合計不一致、非在庫属性の不正な追加値            | 有限numberならcurrentはinitialに戻りratioは維持。全属性schemaや階層合計の検証はない。initialの負数/小数拒否と混同しない                                                                      |
| O03 | U/H/D             | 必須5種類と非nullのbrand/alias IDを有効にし、動画未変換、brand/aliasの組合せ不整合             | 現行が受理する範囲を記録。動画変換完了/ブランド対応関係の再検証は今回追加しない。必須5種類のnull拒否はAF-ID01、brand/aliasのnull許容はAF-BR01〜03、存在しないFKは実DB制約に従いD08として分離 |
| O04 | U／将来の障害検証 | COMMIT送信後の応答喪失、commit後のHTTP接続切断                                                 | モックの外側rejectはT08に限定。実通信障害は今回は未実施で、成否不明をrollback成功にしない。既にcommit済みなら元行消費済み・再送404となり得る。公開済みDBをHTTP失敗で巻き戻せる保証なし       |
| O06 | I                 | 疎配列、明示undefined、JSONではないオブジェクトを直接注入                                      | 構造検証やstructuredCloneの実挙動を記録する防御観測。通常JSONBでは表現できない値について一律ITEM_ATTRIBUTES_INVALIDやHTTP受理を保証しない。productionの型やexportをテスト都合で変更しない    |

### 仕様確定後の追加ケース

| ID      | 元ID            | レベル  | 条件／入力／手順                                                                                                                         | 修正後の期待結果                                                                                                                                |
| ------- | --------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| AF-ID01 | B08/B09/M03/O03 | U/H/D/R | category/condition/day/service/placeを1種類ずつnull、さらに5種類全部null。他の公開データは正常。HTTPはbodyではなく保存済み元行を変更する | 400・INVALID_NUMBER。getUser/validateMaster/親/両集計/全作成/削除/通知は未実行。Dは4テーブル追加0・元行と保護対象不変・rollback完了・ロック解放 |
| AF-ID02 | AF-ID01/D04     | D/R     | null-IDで拒否→同じ元行の不足IDを有効な既存IDに保存→再公開                                                                                | 初回は400・元行保持、修復後だけ201・1組生成・元行削除・通知開始1回。初回失敗を消費済み扱いにしない                                              |
| AF-ID03 | P03/P04         | D/P     | 別transactionが元行をロックし必須IDを1種類nullへ変更→公開を実待機→更新commit/rollback。必須の各5種類を独立展開                           | commitなら最新行のnullを再判定して400・追加0・通知0・更新済み元行保持。rollbackなら正常な旧IDで公開成功。古い正常データでの公開を許さない       |

B01/D07の新規採番、N/Mの有効IDありの正常系、他の異常系を維持する。旧ITEM_EDITING_NOT_NEWとnull-ID受理の期待値は履歴欄にのみ残し、成功するようassertを弱める形にしない。

| ID      | 元ID            | レベル | 条件                                                                                                                      | 期待結果                                                                                     |
| ------- | --------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| AF-BR01 | B08/B09/N04/O03 | U      | brandのみnull、aliasのみnull、両方null。片方null＋他方の1/2147483647・不正値も独立展開。両方null＋必須5種類のnullも各検証 | 正常は456、nullを補完せずコピー。不正な非null値・必須IDのnullは400・INVALID_NUMBERで後続なし |
| AF-BR02 | AF-BR01/D01/D09 | D/R    | 保存済みbrand/aliasをnullにして実公開                                                                                     | 201・新規4行・nullの永続化・元行消費・保護行不変                                             |
| AF-BR03 | AF-BR01/M01/O03 | H      | 実resolveBrandで既存brand選択→alias=nullの結果を保存境界へ反映して公開                                                    | 公開成功。alias生成や再解決を公開側に追加しない                                              |

AF-ID01のR単独はusecaseが返す400の応答形式までとし、保存済みnullの実判定・rollbackは実DB HTTPで確認する。共有validateMasterは他APIでも使うためnull省略の実装を変更せず、本公開usecaseの事前検証で停止することを確認する。

## 16. 詳細設計8章との対応・実装優先度・完了条件

| 詳細設計の観点                                                 | 本書の対応                                          |
| -------------------------------------------------------------- | --------------------------------------------------- |
| 正常公開・全コピー・初期値・参照方向・元行削除                 | N01〜N05/N11/N12、対応表、D01/D02/D07               |
| attributes・任意階層・在庫初期化・非破壊                       | I01〜I12、O02/O06、D01/D03                          |
| sort/search_text・集計・親/任意関連欠落                        | N06〜N10、M01/M03/M06、S05/S06、D05                 |
| 通知内容・commit後開始・失敗許容                               | T03/T11〜T13、D06、P01/P02                          |
| ID上下限・不正body・JSON・認証・所有権・制限                   | V01〜V06、E01、S01、C01〜C03、R01〜R13、D06/D09/D10 |
| 価格・画像枚数・URL・その他保存データ                          | B01〜B10、M02/M05、I05〜I11、O01/O03                |
| 必須5種類のID・null拒否・修復後再試行・競合後の再判定          | B08/B09、AF-ID01〜AF-ID03                           |
| 各DB依存の失敗・全rollback・非対象不変・再試行                 | T04〜T10、D03/D04/D08/D09                           |
| 開始/commit失敗・成否不明・応答喪失                            | T04/T08/T09、O04                                    |
| 同一セッション重複/先行rollback/保存・削除・所有者変更との競合 | D06、P01〜P08/P11                                   |
| 別セッション公開・集計の並行変更                               | P09/P10                                             |

優先度は次の順とする。Pは並行ケースのID接頭辞であり、優先度P0/P1/P2とは区別する。

1. **P0**：N01〜N03/N06/N09、V全件、E01、B全件、I01/I02/I05〜I11、M05、T01〜T10/T13、D01〜D04/D06〜D10、AF-ID01/AF-ID02。所有権404・公開の原子性・入力境界・異常時停止を先に確認する。
2. **P1**：残るN/I、M全件、S全件、C/R全件、T11/T12、D05。helper実接続、各層の引渡し、通知契約を確認する。既存テスト再利用時も対象IDと残る範囲を明記する。
3. **P2**：P全件、O全件、AF-ID03。順序を制御した実ロック・重複・再試行・仕様未確定の観測を確認する。重要なP01/P02も完了条件から除外しない。

### 将来の実行方法

現在は未作成のファイル案を含む。テスト実装後、`server/` で対象を明示して実行する。DB非接続と実DBは別集計とし、Dの前に第11節のガードを満たす。createItem専用のVitestは未実装・未実行。カラム削除に伴う既存単体テストの回帰実行とlint・型検査は下記テスト計画とは別に行い、作業ログへ記録する。

```bash
# 単体の代表（Sは第4節で実装した各対象ファイルも個別指定する）
npm run test:run -- src/usecases/items/create/test/createItem.test.ts src/usecases/itemEditing/test/createItem.inventoryReset.test.ts src/validators/body/test/createItem.test.ts src/controllers/items/test/createItem.test.ts --maxWorkers=1
# DBなしのhelper/HTTP接続
npm run test:run -- test/integration/usecases/items/createItem/master.test.ts test/integration/usecases/items/createItem/route.test.ts --maxWorkers=1
# 実DB：ファイル間のfixture/hook干渉を避け1 workerで実行
npm run test:run -- test/integration/database/items/createItem/database.test.ts test/integration/usecases/items/createItem/databaseTransactions.test.ts test/integration/usecases/items/createItem/databaseConcurrency.test.ts test/integration/usecases/items/createItem/databaseHttp.test.ts --maxWorkers=1
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

test配下のTSは現行lint対象外のため、将来実装時は既存ESLint/typescript-eslintによる対象TSの追加lintも行う。共有設定やライブラリをこの目的で独断変更しない。

### 完了条件

- 設計書作成の完了：指定パス、参照先、ケースID、処理順序、期待値の根拠、異常時の停止点、詳細設計8章の対応、変更範囲を確認する。本書の作成をテスト成功として報告しない。
- 将来のテスト実装の完了：各表の複数条件を独立テストへ展開し、IDで追跡できること。実行件数は表の行数と区別し、実ランナー出力から集計する。U/H/SだけでD/T/Pの保存・rollback・ロックを完了扱いにしない。
- 新規SELECTで全コピー・非対象不変・孤立関連なし・元行の消費/復元を確認し、P01/P02では実待機とcommit/rollback後の結果を確認する。開始した全処理の回収・接続終了・自作fixture残存0も確認する。
- 観測ケース、仕様未確定、環境不備、実DB未実施、実COMMIT応答喪失未実施は成功に混ぜず、実行後は `test/docs/report/items/createItem.md` にケースID・実処理/モック範囲・根拠・残る範囲を記録する。実行結果は同レポートに記録する。

### 2026-10-20 F2解消後の実装配置

- 既存DB4ファイルを実行し、`databaseValues.test.ts`（database役割）と`databaseReadFailures.test.ts`（usecases役割）を追加した。
- VALUESは保存済みJSONB・任意値・境界・実カラム/FKの照合、READは実参照直後の障害によるrollbackとロック解放を担当する。
- 旧カラムガードに加えて全接続のREAD COMMITTEDを確認する。実行結果・F4の制約差分と未達はレポート末尾を正とし、この配置追記を成功判定へ代用しない。
