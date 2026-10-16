# createItemEditingCopy テスト設計書

## 1. 目的・根拠・作業範囲

対象は createItemEditingCopyUseCase。販売中かつ認証ユーザー所有の Item から、新しい ItemEditing をリクエストごとに作成する契約を検証する。正常系に加えて、所有権のすり抜け、コピー元の取り違え、在庫復元の漏れ、途中失敗、再試行、競合時の古いデータの利用を検出する。

根拠は[詳細設計書](../../../docs/design/backend/detail/itemEditing/createItemEditingCopy.md)の第2〜7節と、特に第8節「正常系・異常系・並行処理・境界値・条件分岐・状態遷移」。形式・検証方法は[usecase共通ルール](../../../server/test/usecases/AGENTS.md)および[updateConfirmの設計書](../../../server/test/usecases/itemEditing/updateConfirm/testArchitecture.md)に従う。参照先の2026-10-12の最新契約と[修正報告](../../../server/test/usecases/itemEditing/updateConfirm/afterFix.md)を確認し、古い観測結果や別機能の制約を本機能へ移植しない。

今回の成果物は本書のみ。テストコード、fixture、実装、設定、migration、Todo、Codexログは変更しない。以下のファイル構成・実行方法・期待結果は、後続のテスト実装に向けた設計であり、実装済み・実行済みの結果ではない。DB接続・反映済みスキーマも今回は未確認。

### 調査したファイル

以下のパスは server/ 基準。上記の詳細設計書のみリポジトリルート基準。

| 責務 | 調査対象 |
| --- | --- |
| usecase・非公開の在庫変換 | src/usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.ts：createItemEditingCopyUseCase、resetInventory |
| 取得serviceとexport経路 | src/services/items/index.ts、src/services/items/query/index.ts、src/services/items/query/relation.ts：getMyItemWithVideoSaleShipping |
| 作成service | src/services/itemEditing/command.ts：createItemEditingCopy |
| 入出力の型 | src/types/serviceType/items.ts、src/types/serviceType/itemEditing.ts、src/types/itemAttributes.ts |
| 入力検証 | src/validators/body/itemEditing.ts：createItemEditingCopyBodySchema、src/middleware/validate/validateBody.ts |
| 認証・レート制限 | src/middleware/authMiddleware.ts、src/middleware/rateLimit/itemEditingRateLimit.ts：createItemEditingCopyRateLimit |
| controller・Router・実アプリの登録 | src/controllers/itemEditing/itemEditing.ts、src/routes/itemEditing.ts、src/routes/index.ts、src/app.ts |
| エラー | src/errors.ts、src/middleware/errorHandler.ts |
| モデル・接続 | src/models/{item,item_editing,video,sale,item_shipping_profile}.ts、src/models/index.ts、src/db.ts、src/config/config.ts |
| DB定義資料 | migrations/20261005114144-create-item-editing.js、20261006044423-update-column-item-editing.js、20261002113520-add-column-item-relation.js、20261006021049-item-update-column-status.js、20260804100501-fix-item-relation-ondelete.js（すべてmigrations/配下） |
| テストの基準 | test/AGENTS.md、test/usecases/AGENTS.md、test/usecases/itemEditing/updateConfirm/{testArchitecture.md,afterFix.md,testReport.md,fixtures.ts,usecase.test.ts,route.test.ts,databaseSetup.ts,databaseFixtures.ts,databaseConcurrency.test.ts} |
| 実行・静的検査 | package.json、tsconfig.json、test/tsconfig.json、eslint.config.mjs |

対象外は公開・購入・在庫減算・ItemDraftからの生成・動画アップロード／変換・S3オブジェクトの複製・他エンドポイントの回帰全体。既存編集セッションの再利用、冪等性キー、重複排除、動画必須の再検証、商品入力の再検証は本処理にないため、保証として追加しない。

## 2. 処理順序と責務の境界

1. 実アプリでは POST /api/item-editing/copy に登録される。詳細設計の /item-editing/copy には共通の /api 接頭辞が付く。
2. Routerは authenticateToken → createItemEditingCopyRateLimit → validateBody → controller の順。ユーザー単位で10分間に5回。検証まで到達する不正bodyも消費する。
3. controllerは req.user.id と req.validatedBody.itemId のみを取り出す。usecaseの返す数値IDを201・{ itemEditingId }で返す。例外は同一オブジェクトをnextへ渡す。
4. usecaseはmanaged transactionを開始し、取得serviceへ itemId・userId・transaction を渡す。
5. transaction付き取得serviceは、まず Item.findOne に attributes: ["id"]、where: { id: itemId, seller_id: userId }、transaction、lock: transaction.LOCK.UPDATE を渡す。この検索がnullなら後続SELECTを行わない。
6. ロック取得後、同じ所有者条件・transactionでItemとVideo・Sale・ItemShippingProfileを再取得する。関連はすべて required: false。外部結合側へFOR UPDATEは指定しない。
7. usecaseは取得結果がnull、またはstatusがactive以外なら AppError("ITEM_NOT_FOUND", 404)。所有権はserviceの検索条件で担保し、usecaseでseller_idを再比較する実装ではない。
8. attributesをstructuredCloneし、商品・色・サイズそれぞれのinventory.currentだけを、そのinventory.initialへ戻す。
9. コピー対応表の値でcreateItemEditingCopyを1回呼ぶ。serviceは ItemEditing.create(data, { transaction }) を1回呼ぶ。
10. callbackは新規ItemEditing.idを返す。managed transactionのcommit完了後にusecaseがresolveする。途中の例外は伝播し、callback内の失敗はrollback対象となる。

入力schemaはusecaseの外側にある。usecaseの直接呼出しへ不正itemIdを渡しても400が返る契約にはしない。認証・レート制限・入力検証で停止するHTTPリクエストはusecase未実行、したがってtransaction未開始である。一方、404判定時はtransaction開始済み。

コピー先はitem_editingの1行であり、Video・Sale・ItemShippingProfileの新しい行は作らない。これらの値はitem_editingへ展開する。item_idは元商品IDではなくnull、マスターへの外部キーは既存IDを保持する。詳細設計の「関連レコードの外部キー」はこの構成に照らして解釈し、存在しない子テーブル作成を期待しない。

## 3. テストの分割と実処理・モックの範囲

### 2026-10-16 配置変更

以下は server/ 基準。後続の設計表のファイル名は、この配置に対応する。

- U/I: `src/usecases/itemEditing/createItemEditingCopy/test/{usecase,inventoryReset}.test.ts`
- V: `src/validators/body/test/createItemEditingCopy.test.ts`
- S（取得）: `src/services/items/query/test/getMyItemWithVideoSaleShipping.test.ts`
- S（作成）: `src/services/itemEditing/test/createItemEditingCopy.test.ts`
- C: `src/controllers/itemEditing/test/createItemEditingCopy.test.ts`
- 共通fixture: `src/usecases/itemEditing/createItemEditingCopy/test/fixtures.ts`。旧配置の `fixtures.ts` は結合テスト向けの再exportを維持する。
- R/Dの配置は下記「結合テストの配置」を参照。HTTP・DB用fixtureは `server/test/usecases/itemEditing/createItemEditingCopy/` に保留（リポジトリルート基準）。

移動後の単体テストは server/ で次のコマンドを実行する。結合テストは含めない。

~~~bash
npm run test:run -- src/usecases/itemEditing/createItemEditingCopy/test/ src/controllers/itemEditing/test/createItemEditingCopy.test.ts src/validators/body/test/createItemEditingCopy.test.ts src/services/items/query/test/getMyItemWithVideoSaleShipping.test.ts src/services/itemEditing/test/createItemEditingCopy.test.ts --maxWorkers=1
~~~

### 2026-10-16 結合テストの配置

以下はリポジトリルート基準。テスト内容は分割せず、ファイルの主な検証対象に従って配置する。

| 配置 | ファイル・分類理由 |
| --- | --- |
| `test/integration/backend/database/createItemEditingCopy/` | `database.test.ts`：永続化、モデル検証、実DB制約、所有権、逐次再実行 |
| `test/integration/backend/usecases/createItemEditingCopy/` | `databaseTransactions.test.ts`、`databaseConcurrency.test.ts`：usecaseのtransaction制御、失敗・再試行、競合時の業務結果 |
| 同上 | `databaseHttp.test.ts`、`route.test.ts`：バックエンド内のHTTP接続。前者は実usecase・DB、後者はusecaseをモック |
| `test/integration/backend/services/` | 専用のservice結合テストは現状なし。空ディレクトリを保持 |
| `test/integration/cross-layer/`、`test/fixtures/` | 今回は空ディレクトリを保持 |

`fixtures.ts`、`databaseFixtures.ts`、`httpFixtures.ts`、`databaseSetup.ts` は旧配置に保持し、移動したテストの相対importだけを更新する。DB関連fixtureの既存の旧usecase参照や型問題は未修正。既存のserver向け実行・型検査設定はルートtestを対象にしないため、結合テスト実行環境の対応は別Todoを参照する。今回DBテストは実行していない。

以下は初回設計時の記録であり、今回の配置変更や検証結果はCodexログを参照する。

| 記号 | 予定ファイル | 実処理／モック・証明範囲 |
| --- | --- | --- |
| U | usecase.test.ts | 実usecaseと実resetInventory。取得・作成service、sequelize.transactionをモック。引数、全コピー値、戻り値、順序、打切り、待機を確認。実SQL・rollbackの証明にはしない |
| I | inventoryReset.test.ts | 非公開resetInventoryをexportせず、実usecase経由で実行。DB依存のみモックし、在庫各階層、深い非破壊性、その他属性の保持を集中検証 |
| V | validation.test.ts | 実schemaと実validateBody。受理／拒否、変換後の値、未知キー除去、req.validatedBody、nextを確認 |
| S | services.test.ts | 実取得・作成service。Item.findOne／ItemEditing.createとモデルregistryをモック。2段階SELECT、where、include、lock、同一transaction、戻り値・例外の引渡しを確認 |
| C | controller.test.ts | 実controller、usecaseをモック。認証済みID・検証済み値、201応答、例外伝播、待機を確認 |
| R | route.test.ts | 最小ExpressアプリにJSON parserと実Router、実認証・実レート制限・実validator・実errorHandler。対象usecaseのみモックし、HTTP接続と停止位置を確認 |
| D | database.test.ts | 実usecase・service・モデル・PostgreSQLで、永続化・所有権・状態・nullable・制約・逐次再実行を確認 |
| D | databaseTransactions.test.ts | 同じ実処理で、実INSERT前後の失敗、別接続可視性、rollback後の再試行を確認 |
| D | databaseConcurrency.test.ts | 独立transaction／DBセッションを使い、実行順を制御してロック待機・再取得・競合結果を確認 |
| 共通 | fixtures.ts／databaseSetup.ts／databaseFixtures.ts | 入力factory・deferred・エラー検証／接続ガード／作成ID追跡・別接続SELECT・後片付け |

新規ライブラリは追加せずVitest・Supertestを使う。DBなしのsuiteではsrc/db.ts、モデル、他controllerのimportから実DB・AWS・cron初期化へ到達しないよう境界をモックする。controller／Routerが同時importする他usecaseも置換する。実app.tsはcronを開始するため直接importしない。

Rは /api/item-editing に実Routerを明示的にmountする。この成功だけでregisterRoutes全体・NGINX・デプロイ先への到達性を検証済みとはしない。実errorHandlerを使うので本APIのエラーJSONまで確認できる。テスト専用handlerへ変更する場合、そのケースはエラーの受渡しの証明に限定する。

## 4. 標準fixtureと共通アサーション

### 標準データ

U/I/S/C/Rでの例は所有者A=7、別ユーザーB=8、元itemId=101、新規itemEditingId=456。DBでは自動採番したIDを使い、固定IDの存在や連番に依存しない。

- bodyは { itemId: 101 }。原則として各ケースの変更は関心のある1条件だけにする。
- 元ItemはA所有・active。商品名と動画title、detailとsummary、商品画像・色画像・動画URL・サムネイルURLは互いに異なる値にする。画像は少なくとも3枚で順序を区別する。
- Item.price=7200、Sale.before_price=10000、Sale.discount_rate=28、discount_amount=2800、sale_flag=true。コピー先のpriceの取り違え、割引の持越しを検出する。priceは取得projectionに含まれないため、Uでは囮の値、Dでは実カラム値として使う。
- 商品inventoryは { initial: 20, current: 6, low_stock_ratio: 0.15 }。色は赤 { initial: 8, current: 1, low_stock_ratio: 0.25 }、青 { initial: 12, current: 5, low_stock_ratio: 0.4 }。赤のMは { initial: 3, current: 0, low_stock_ratio: 0.1 }、Lは { initial: 5, current: 1, low_stock_ratio: 0.3 }。青にも異なる初期在庫のサイズを置く。
- attributesにはuiId、色、色画像、サイズ名、複数materials、body_category、lifestyle_category、layer、fitを指定。期待値の在庫は商品20・赤8・青12・赤M3・赤L5と明示し、変換ロジックを期待値factoryへ複製しない。
- Videoは全7項目、ItemShippingProfileは全4項目、各商品マスターIDを設定。元Item・関連行のcreatedAt/updatedAtは十分過去の既知時刻とする。
- A/B各所有の別商品と既存ItemEditingを用意し、標準の成功・失敗で変更されない監視用データとする。必要に応じ元商品へitem_idで紐づく既存編集行も作り、追加生成を妨げないことを確認する。

### 共通の確認

- 主要な作成dataと公開レスポンスは完全一致し、余分なid・日時・status・関連ID・秘密情報が紛れ込まないことも確認する。transactionは値比較に加えて参照同一性を確認する。
- コピー前のスナップショットと元attributes・関連データを比較する。attributes、inventory、各色、sizes、materialsは元と別参照で、コピー後の変更が元へ伝播しない。image_urlまでusecaseで深いコピーされるという保証は追加しない。
- AppErrorは型・code・statusCode、予期しない例外は同じErrorオブジェクトの伝播を確認。エラー時は後続の未実行・新規行の不在も確認する。
- DBは別接続の新規SELECTで全保存列・JSONB・配列順・キーの有無・作成件数を確認。元のモデルインスタンスをrollback判定に使わない。
- 正常な1回は編集行+1、失敗は+0。item_id=nullのため元itemIdで編集行を数えず、今回作成したID／固有seller_idを追跡し、既存行との差分を取る。
- spy・モック・fake timer・envは復元し、factoryは毎回新しいオブジェクトを返す。非同期assertはawaitし、rejectの検証を先に登録してから拒否を注入する。

## 5. コピー対応と正常系

N02は以下の全項目を対象とする。関連値の「なし」はnull／undefinedを区別してUで試す。実DBでoptional関連がない場合はnullになる。

| コピー先item_editing | 変換元・期待値 |
| --- | --- |
| item_id | 常にnull |
| seller_id | 認証済みuserId |
| name、detail、image_url、item_condition_id、first_image_url | 同名のItemカラム。null・空文字・画像順も保持 |
| gender_type、age_type、recommend | 同名のItemカラム。false・nullを勝手にdefaultへ戻さない（nullable列のみ） |
| category_id、brand_id、brand_aliases_id | 同名のItemカラム。既存マスターIDを保持 |
| attributes | Item.attributesの深い複製。3階層のinventory.currentのみ各initialへ戻し、残りを保持 |
| thumbnail_url、title、summary、duration、original_url、converted_url | 同名のVideoカラム。関連／値なしはnull。0・空文字は保持 |
| video_status | Video.status。値なしはnull |
| before_price、price | 両方Sale.before_price。Sale／値なしは両方null。Item.priceへのfallbackなし |
| discount_rate、discount_amount、sale_flag | 常にnull、null、false |
| shipping_day_id、shipping_service_id、shipping_place_id、shipping_service_free_text | 同名のItemShippingProfileカラム。関連／値なしはnull |
| id、createdAt、updatedAt | createのdataに含めず新規生成。元商品・関連レコードの値を使い回さない |

| ID | レベル | 条件／入力／手順 | 期待結果 |
| --- | --- | --- | --- |
| N01 | U/D | A所有active、関連・属性がすべてある標準fixture | Uはtransaction開始→取得→作成→transaction完了の順で各1回、戻り値456。Dは返却IDの編集行が1件永続化し、元Itemを保持 |
| N02 | U/D | 全コピー項目に区別できる値を設定 | 上表の全項目一致。作成dataは指定項目のみで、元id・日時・video_id・sale_id・shipping_id・status・views_count等を含めない |
| N03 | U/D | Item.priceとSale.before_priceを異なる値にし、元はセール中 | before_price=price=10000、割引null/null、sale_flag=false。元Item/Saleの価格・割引は不変 |
| N04 | U/D | Video／Sale／配送関連を各1つなし、すべてなし（独立展開） | 欠けた関連に対応する全項目のみnull。他の関連値は保持して成功。動画必須の再検証を追加しない |
| N05 | U/D | 各nullable商品項目・関連項目を1つずつnullにする | 対応先もnull。別項目へ値を流用しない。gender/age/attributesなどNOT NULL列は通常fixtureの対象にしない |
| N06 | U/D | detail・summary・title・配送free_textは空文字、duration・before_priceは0、recommend=false | 空文字・0・falseを保持。before_price=price=0。truthy判定によるnull化やItem.priceへのfallbackを検出 |
| N07 | U/D | Saleあり・before_price=null、Item.priceは非null | before_priceとpriceは両方null。元priceをコピーしない |
| N08 | U/D | recommend=true/false/null、gender=men/women/unisex、age=adult/kids/both | 各値をそのまま保持。3系統を独立に展開し、全組合せの機械的な水増しはしない |
| N09 | U/D | image_urlがnull／[]／1枚／10枚、first_image_urlは配列先頭と異なる値 | image_urlと順序を保持し、first_image_urlも元の独立値を保持。先頭画像からの再計算をしない |
| N10 | U/D | 新規作成と十分過去の元日時を比較 | Uはid・createdAt・updatedAtを渡さない。Dは新規idと日時が存在し、元日時を継承しない。同一時刻の別リクエストで日時が必ず異なるとはしない |
| N11 | U/D | Video.statusがnull／空文字／通常文字列、converted_urlの有無 | 値をそのままvideo_status等へ渡す。readyだけを許可する条件や再変換を追加しない |

## 6. 在庫変換・深いコピーの分岐

Iはすべて実usecase経由で確認し、private関数のテスト用exportは追加しない。D併記の行はJSONB再取得でも確認する。

| ID | レベル | 条件／入力／手順 | 期待結果 |
| --- | --- | --- | --- |
| I01 | I/D | 商品・複数色・複数サイズに異なるinitial/current | currentはそれぞれ自分のinitialになる。全体値を色へ、色の値をサイズへ誤適用しない。initial/low_stock_ratioは保持 |
| I02 | I/D | 各階層でinitial=0、currentが0／正数（階層・値別に展開） | current=0。0を欠落と判定しない。全階層を1などで補完しない |
| I03 | I | 各階層でcurrentがinitialと等しい／小さい／大きい | 常に同じ階層のinitialへ置換。大小比較や差分計算を追加しない |
| I04 | I/D | attributes={}、商品inventory欠落、colorVariants欠落 | 成功し、存在しないinventory/colorVariantsを追加しない。存在する他階層は変換 |
| I05 | I/D | colorVariants=[]、色inventory欠落、sizes欠落／[]を混在 | 空配列／欠落を保持。色inventoryなしでも存在するsizesのinventoryは復元 |
| I06 | I/D | 商品在庫なし・色のみ／サイズのみ、色在庫あり・サイズなし | 指定された階層だけ復元。すべての階層の存在を必須にしない |
| I07 | I | 生成後、コピー先の各inventory・uiId・色画像・sizes・materialsを変更 | 元attributesの深い全値が変わらない。各入れ子も別参照。取得時点の元currentも変更されない |
| I08 | I/D | 複数色・サイズ・素材と分類/fit、素材ratio=0/小数 | 順序・件数・uiId・画像・サイズ名・素材・分類・fitを完全保持。low_stock_ratioを固定0.2にしない |
| I09 | I | 元attributesを入れ子までfreezeして実usecaseを実行 | 変換・作成に成功し、元のオブジェクトへ書き込まない。コピー先は変更可能 |
| I10 | I/D | 保存済みJSONBに型で列挙されないキー、inventory内の追加情報を含める | current以外のキーと値を保持。U/Iでは意図的な型境界入力と明記。JSONBはDBから再取得してキーの残存を確認 |

型が要求するsize.inventoryを欠落させる場合は正常系ではなくO01。既存データの在庫値に本処理独自の非負・整数検証があるとはしない。

## 7. 異常系・打切り・非同期の待機

| ID | レベル | 条件／入力／手順 | 期待結果・未実行処理 |
| --- | --- | --- | --- |
| E01 | U/D | 存在しないItem／B所有／seller_id=null | AppError・ITEM_NOT_FOUND・404。作成未実行、編集行+0。Bや既存行は不変。UのB/nullはserviceがnullを返す模擬と明示し、実際の所有権除外はS/Dで確認 |
| E02 | U/D | A所有のsoldout | 同じ404。作成未実行、編集行+0。attributesや関連データに不備を混ぜても状態判定を優先 |
| E03 | U | service戻り値statusをnull／undefined／未知値へ意図的に差替え | 型境界外の防御ケース。active以外は404、作成未実行。現行ENUM外を通常DB fixtureへ挿入しない |
| E04 | U | transaction開始がrejectしてcallback未実行 | 元のErrorを伝播。取得・作成未実行、成功戻り値なし |
| E05 | U/S/D | 取得serviceの最初のロックSELECTをreject | 元例外を伝播。2回目SELECTと作成は未実行。Dはtransaction終了・書込みなし・再ロック可能を確認 |
| E06 | U/S/D | ロックSELECT成功後、関連付き再取得をreject | 作成未実行、同じ例外を伝播。Dはrollback・ロック解放・編集行+0 |
| E07 | U/D | 作成service／ItemEditing.createをreject | 同じ例外を伝播、成功IDなし。元Item/関連/既存編集は不変。Dで実際のrollbackを確認 |
| E08 | U | callbackはIDを返すがtransaction全体が完了時にreject | usecaseは同じ例外でrejectし、IDを成功返却しない。実COMMIT障害でDBが必ず未保存とは断定しない（O04） |
| E09 | U/D | 取得結果nullかつ不正属性、soldoutかつ不正属性など複数不備 | ITEM_NOT_FOUNDが変換失敗より優先、作成なし。Dでは所有権不一致+soldoutも同じ404で、他人の状態を漏らさない |
| A01 | U | 取得serviceをdeferredで保留 | 作成もusecase完了も未実行。取得解放後にだけ変換・作成へ進む |
| A02 | U | 作成serviceをdeferredで保留 | callback/usecaseは未完了。解放後、作成結果のidを返す。reject時は成功へ進まない |
| A03 | U/C | callback完了後のtransaction Promise／controllerのusecase Promiseを保留 | commit相当の完了前にusecaseがresolveしない。controllerも201/status/jsonを呼ばない。完了解放後にのみ応答する |

Uのtransactionモックは同じtransactionをcallbackへ渡してawaitする。callback結果とtransaction外側の完了用deferredを分け、A03でawait漏れを検出する。モック内の擬似rollback呼出しを、実DBのrollback成功として報告しない。

## 8. 入力検証・境界値

schemaは z.object({ itemId: z.number().int().positive() })。拒否は実validateBodyでAppError・INVALID_BODY・400、validatedBody未設定、正常next未実行を確認する。Routerへは代表値を接続する。

| ID | レベル | 条件／入力／手順 | 期待結果・停止位置 |
| --- | --- | --- | --- |
| V01 | V/R | itemId=-1、0、1、2 | 1/2のみ受理し数値のまま渡す。拒否時はcontroller/usecase未実行 |
| V02 | V/R | itemId=0.5、1.5、"1"、""、" "、"1e2"、true、null、欠落 | すべて拒否。数値文字列のcoerceなし |
| V03 | V | itemId=undefined、NaN、Infinity、-Infinity、[]、{} | 拒否。undefined/NaN/Infinityはschema直接入力とし、JSON化でnullや欠落へ変わるHTTPケースと区別 |
| V04 | V/R | body={}／null／配列／文字列／数値 | 拒否。HTTPでのprimitive JSONはparser設定による拒否もあるので、schemaの拒否と混同しない。Rの代表は{} |
| V05 | V/C/R | itemId有効、userId/seller_id/itemEditingId/status/name/price/attributesをbodyに混入 | schemaの結果はitemIdのみ。controllerは認証userIdを使用。クライアント指定価格・所有者・コピー先IDを採用しない |
| V06 | V | itemId=2147483647、2147483648、Number.MAX_SAFE_INTEGER、MAX_SAFE_INTEGER+1 | 現行Zod4のintで安全整数までは受理、超過は拒否。PostgreSQL INTEGERの上限2147483647をschema独自の上限にしない。DB経路はO02で区別 |
| V07 | V | validateBody成功、req.bodyには未知キーあり | req.validatedBodyはparse結果に完全一致、nextは引数なし1回。元req.bodyの未知キーを検証済み値へ混ぜない |
| V08 | V | validateBody失敗 | 同期throwしたAppErrorを検証。next(err)する実装と取り違えない。validatedBody設定・正常nextなし |
| B01 | U/D | name/title/shipping_service_free_textは0・254・255文字、video_statusは0・254・255文字 | コピー成功・文字列保持。日本語も含める。元カラムと先カラムの実制約を確認してfixture化 |
| B02 | U/D | detail/summary/各TEXT URLに空文字と長い日本語・改行、画像10枚 | 値・改行・配列順を保持。TEXTへ架空の255文字上限を設けない。画像は10枚を許可 |
| B03 | U/D | nullable商品IDと配送IDがnull／有効な既存マスターID、brandとaliasの有無 | 各値を保持。nullableと任意関連を独立に展開し、FK値の取り違えを検出 |

256文字、11枚、不正ENUM等のコピー元は通常の元モデル作成経路で用意できない場合がある。コピーusecaseへの入力400を期待せず、D05/D06の保存先制約とO01の破損データとして層を分ける。

## 9. serviceの呼出し契約

| ID | レベル | 条件／入力／手順 | 期待結果・未実行処理 |
| --- | --- | --- | --- |
| S01 | S | transaction付きで取得 | 1回目はattributes=["id"]、where={id:itemId,seller_id:userId}、同一transaction、LOCK.UPDATEの完全一致。関連includeをロックSELECTへ含めない |
| S02 | S | 1回目成功→2回目で実データ | 2回目も同じwhere/transaction、下表のprojection/includeが完全一致。2回目へlockを付けない。最初のidだけの結果を返さず2回目のオブジェクトをそのまま返す |
| S03 | S | 1回目がnull | null返却、2回目SELECTなし |
| S04 | S | 1回目成功、2回目がnull | null返却。usecaseとの接続で404・作成なしも確認 |
| S05 | S | 1回目SELECTをdeferredで保留 | 2回目未実行、service未完了。解放後に再取得。reject時は同じ例外で停止 |
| S06 | S | 2回目SELECTをdeferredで保留／reject | serviceは待機し、解放後の同一オブジェクトを返す。rejectは同一例外を伝播 |
| S07 | S | transaction省略で既存の取得serviceを呼ぶ | ロック用SELECTなし、whereは所有者込み、従来の3関連include、attributesはundefined。コピー経路はこの分岐を使わないとUで確認。共通serviceの既存呼出しを狭めない |
| S08 | S | createItemEditingCopyにdata/transactionを渡す | ItemEditing.create(data,{transaction})を1回。dataとtransactionは同一参照。作成結果の同一オブジェクトを返す |
| S09 | S | ItemEditing.createをreject | 同じ例外を伝播。別transaction開始・個別commit・元Item更新・別レコード作成なし |

### transaction付き2回目SELECTのprojection

| 対象 | attributesと関連条件 |
| --- | --- |
| Item | id、seller_id、status、name、detail、image_url、item_condition_id、first_image_url、gender_type、age_type、recommend、category_id、brand_id、brand_aliases_id、attributes |
| Video | thumbnail_url、title、summary、duration、original_url、converted_url、status。required=false |
| Sale | before_priceのみ。required=false |
| ItemShippingProfile | shipping_day_id、shipping_service_id、shipping_place_id、shipping_service_free_text。required=false |

Sはオプションの契約を検証する。実際に他ユーザーが除外されること、nullableな外部結合でロックエラーが起きないこと、ロック待機中に旧データを利用しないことはD/Pで確認する。

## 10. controller・Router・エラーの接続

| ID | レベル | 条件／入力／手順 | 期待結果・未実行処理 |
| --- | --- | --- | --- |
| C01 | C | user.id=7、validatedBody.itemId=101、raw body.itemId=999と他人のseller_id | usecaseへ{userId:7,itemId:101}のみ1回。raw bodyを利用しない |
| C02 | C/R | usecaseが456を返す | 201、JSONは{itemEditingId:456}のみ。モデル・元商品・所有者・日時・署名URLを返さない |
| C03 | C | usecaseがAppError／通常Errorでreject | 同じ例外をnextへ1回。status/jsonを呼ばない |
| R01 | R | テスト生成鍵で署名したAの有効JWT・標準body | 実認証→検証→controllerが接続し、usecase引数と201応答が一致 |
| R02 | R | tokenなし／Bearer空／不正署名／期限切れ、かつbody={} | 認証の401が優先。既存認証のmessage形式を確認。usecase未実行。AppErrorのJSON形式を強制しない |
| R03 | R | 有効JWT・不正body（欠落/0/文字列） | 400・{code:"INVALID_BODY",message:"INVALID_BODY"}。usecase未実行 |
| R04 | R | usecaseがITEM_NOT_FOUND/404、通常Errorをそれぞれthrow | 前者は{code:"ITEM_NOT_FOUND",message:"ITEM_NOT_FOUND"}、後者は500・{error:"INTERNAL_SERVER_ERROR",message:"サーバーエラーが発生しました"}。内部例外のmessage/SQL等を漏らさず、201なし |
| R05 | R | 同一ユーザーが同じ時間窓に1〜5回→6回 | 最初の5回は201でusecase5回、6回目429・usecase追加呼出しなし。7回目も拒否。standardHeadersあり、legacyのX-RateLimit系はなし |
| R06 | R | Aで枠を使い切る→同じIPのBで呼ぶ／同じAの別商品を呼ぶ | Bは別枠で通過。AはitemIdを変えても429。IPや商品ごとの枠ではない |
| R07 | R | Aで5回消費、時間窓開始から599999ms→600000ms→600001ms | 直前は429、リセット時刻到達後は通過して新しい窓の件数になる。各境界は独立fixtureで確認。HTTP I/Oをfake timerで止めない |
| R08 | R | 正常JSONの不正bodyを5回→6回、通常Error/404の5回→6回（各独立） | 最初は400／500／404、6回目はすべて429。成功以外も消費し、6回目はvalidator/usecaseへ進まない |
| R09 | R | 未認証を繰返した後、有効JWTのAで5回→6回 | 未認証はユーザーAの枠を消費せず、有効な最初の5回は通過。6回目429 |
| R10 | R | Aの枠を使い切り、不正bodyで送る | 429が400より優先。同じく未認証+不正bodyは401が優先。usecase未実行 |
| R11 | R | bodyに別userId/seller_id、コピー先ID・価格・在庫を混入 | usecaseへ渡るのは認証userIdと検証済みitemIdのみ。別ユーザーへの成り代わり／値の上書きは起こらない |

Rではusecase未実行までを証明する。実DB状態不変はD07の代表HTTP結合で確認する。レート制限の429本文は既存ライブラリの既定規約に従い、架空のAppErrorコードを定義しない。

時刻はDateと制限ストアのintervalだけを制御し、module再importでMemoryStoreをケースごとに分離する。JWT期限は窓境界テストより十分長くし、期限切れとの混同を避ける。鍵はテスト生成し、dotenv既定読込みを遮断、NEXTAUTH_SECRETをvi.stubEnvで与える。実認証のconsole出力はspyで抑え、終了時に復元する。

不正JSONはexpress.jsonがRouterより前で拒否し得るため、「不正入力も枠を消費する」の検証はparse可能なJSONを使う。parser由来の構文エラーまで認証・制限が先行すると解釈しない。

## 11. 実DBの環境・制約・fixture運用

DBテストはserver/を実行ディレクトリとし、server/.env.test由来のPostgreSQL test_dbだけを使用する。今回はenv内容の読込み・接続・書込みは行っていない。

1. databaseSetup.tsをDB・モデル関連モジュールより先に評価する。実dotenv.parse等で.env.testのみを読み、NODE_ENV=test、DATABASE_URLのDB名=test_dbを検査して採用する。引継ぎ環境変数やNODE_ENVだけを信用しない。
2. models/index.ts・config/config.tsの引数なしdotenv.config()が.envを開かないよう、検証済み.env.testの値だけを返す。別envファイルの明示指定、接続URLの変更、読込元不明を検知して停止する。
3. src/db.tsのsequelize、models/index.tsが生成するsequelize、observer、追加競合接続すべてで、接続前にgetDatabaseName()、接続後にSELECT current_database()を確認する。全接続がtest_dbと確認できるまでfixture作成・更新・削除を禁止する。
4. 不一致・確認不能は実行中断とし、読込元・DB名・停止位置・書込み有無だけを報告して続行判断をユーザーへ委ねる。URL全体・認証情報を出さない。接続拒否と安全ガード違反は分けて報告する。
5. 反映済みスキーマの列型・NULL・default・ENUM・FK・index/uniqueを照合する。特にitem_editing.item_idは初回migrationではNOT NULL、その後のmigrationでnullableになる。不足をsyncやmigration実行で補正しない。

必要テーブルはuser、item、item_editing、video、sale、item_shipping_profile、item_condition_option、categories、brands、brand_aliases、shipping_day_option、shipping_service_option、todouhuken_option。親・マスターはモデルの必須列を満たして作成する。NOT NULLのuploaded_at、gender/age/attributes等を省略・null化した不適切なfixtureで対象処理の成否を判定しない。

作成したIDをhook等で記録し、usecase作成分・競合処理分・fixture準備途中の行も含める。固有ユーザー／識別子で他テストと分離する。後片付けは保留Promiseとtransactionを終了させてから、編集行→商品→動画/セール/配送→別名→ブランド/カテゴリ/マスター→ユーザーの外部キー依存順で、記録したIDだけを削除する。カテゴリ階層を作る場合は子から削除する。残存0件と全接続closeを確認し、hook・SQL記録・envも解除する。

全件削除・truncate・シーケンス巻戻し・DB作成・migration実行・sequelize.sync()はしない。実commitや別接続可視性を確認するため、テスト全体を外側transactionに包んで一律rollbackしない。

## 12. 永続化・状態遷移・保存制約

| ID | レベル | 条件／入力／手順 | 期待結果・DB状態 |
| --- | --- | --- | --- |
| D01 | D | 標準fixtureから作成、別接続で再SELECT | 全コピー項目一致、新規編集行+1、item_id=null、seller_id=A。item/関連は全列・日時を含め不変。item/Video/Sale/配送の新規作成・削除もなく、既存編集とBの行も不変 |
| D02 | D | 関連なし／1つずつ欠落、nullable/空値/0、全画像境界 | N04〜N09/I04〜I06/B01〜B03の保存表現を確認。外部結合nullable側をロックしてPostgreSQLエラーにしない |
| D03 | D | JSONBの多階層在庫・追加キー・素材/分類/fit | I01/I02/I08/I10の値・キー・順序を新規SELECTで確認し、元JSONBのcurrentは消費済みのまま |
| D04 | D | 不在／B所有／seller_id=null／soldout | 404、新規行+0、コピー元/関連/既存編集の全列不変。B所有かつsoldoutでも同じ公開エラー |
| D05 | D | 実反映スキーマのNULL・ENUM・FK・VARCHARを調査し、テスト行限定で制約違反を注入 | item_id=nullは成功。seller_id等の不正FK、gender/age/attributesのnull、不正ENUM、name/title/free_text/video_statusの256文字は対応制約で拒否。モデル検証とDB拒否を分けて記録し、保存なし。直接SQLはバインドしてテストtransactionをrollback |
| D06 | D | 作成serviceへ画像11枚を渡す／10枚を渡す | 11枚はItemEditingモデルのmaxArrayLength検証で拒否、10枚は成功。DBのARRAY自体に10枚CHECKがあるとは主張しない。通常コピー元の上限テストとは分離 |
| D07 | D/R | 実usecaseへつなぐ限定HTTP結合：401/400/429/404 | 401/400/429はtransaction spyも0回、編集行+0、元・関連・既存編集不変。404は開始済みtransactionがrollback。429準備で成功した5件は基準snapshotへ含め、拒否された6回目だけ+0 |
| D08 | D | コピー後に新編集行の在庫・名称を編集、元商品・他編集行を再取得 | 作成時点の値が保存され、以降は独立して変更できる。元商品/関連/既存編集へ変更が波及しない |

D05は制約の責務を切り分ける検証であり、userからitemIdだけを受け取る通常APIがこれらの値に400を返すという意味ではない。DB反映との差があれば不一致として報告し、期待値を弱めたり環境を補正したりしない。

## 13. transaction・ロールバック・再試行

| ID | レベル | 条件／入力／手順 | 期待結果・未実行処理／DB状態 |
| --- | --- | --- | --- |
| T01 | U/S/D | 正常処理の取得・作成を追跡 | U/Sで同じtransactionがusecase→両service→各Modelへ渡る。Dでは実commitと別接続の編集行+1を確認 |
| T02 | D | 実INSERT後、作成serviceラッパーをdeferredで保留しcallbackを未完了にする | transaction内で返却IDの行が存在し、別接続からは未可視。usecase未完了。解放してcommit後に別接続で全列が可視 |
| T03 | D | 作成前に例外：ロックSELECT失敗／再取得失敗／作成service失敗を独立注入 | 編集行+0、元・関連・既存編集不変。transactionは終了してロックを解放し、正常再試行が成功 |
| T04 | D | ラッパーが実createをawaitし、transaction内で行の存在を確認してから意図的にthrow | usecaseはreject、別接続の新規行は不在。採番されたIDとhookに残る値を保存成功と混同しない。元・関連・既存編集不変 |
| T05 | D | T04の失敗後、同じitemId/userIdで再試行 | 失敗分の部分行なし、成功分だけ+1、新IDを返す。採番欠番は許容。ロック残留なし |
| T06 | D | 作成を保留中、別transactionで対象ItemのFOR UPDATE NOWAITを試す→成功/失敗で先行終了→再度試す | 保留中はロック取得不可、commit後とrollback後は取得可能。NOWAIT失敗したtransactionはrollbackしてから次を試す。ロック保持を呼出オプションだけで判定しない |

障害注入は「元の実serviceを実行するラッパー」「Modelでの保存前失敗」「保存後のcallback失敗」を区別する。実INSERT後の失敗がなければT04を完了扱いにしない。COMMIT応答喪失の扱いはO04に分離し、擬似完了失敗を実DB障害の確認として数えない。

## 14. 逐次再実行・状態の再評価

| ID | レベル | 条件／入力／手順 | 期待結果 |
| --- | --- | --- | --- |
| Q01 | U/D | 同じItemを2回逐次コピー | 2回とも取得・作成し、異なるID、編集行+2。初回行を返す／上書きする／409にすることはない |
| Q02 | D | 元Itemへitem_idで紐づく既存編集行、以前のコピー行がある | 既存行の有無にかかわらず新規+1、既存全列不変。item_id=nullのコピー行を元商品へ付け替えない |
| Q03 | D | 1回成功→元Item/関連の入力値・在庫initial/currentを変更→再実行 | 2回目は新しい値をコピー・新initialへ復元。1回目の編集行は初回snapshotのまま |
| Q04 | D | 1回成功→soldout／所有者Bへ変更／物理削除→Aで再実行 | 再実行は404で追加行なし。初回コピー行はitem_id=nullなので元商品削除のCASCADE対象にならない。競合操作自身による他行への影響は別に扱う |
| Q05 | D/R | 同一ユーザー・同じitemIdを時間窓内5回→6回、窓更新後再実行 | 成功ごとに新規IDで計5件、6回目は429で追加なし。新窓で再び+1。DBの重複排除とレート制限を混同しない |

Q04の基準snapshotは元商品に対する意図的変更後に取り直す。削除により元商品へ紐づく既存編集行がCASCADE削除される場合、その削除をコピー処理の副作用として扱わない。

## 15. 順序を制御する実DB並行テスト

同じItemの行ロックを検証する際、A/B両方の「取得完了」を待つとBがロック待ちで停止するため誤ったバリアになる。次の境界を使い、任意のsleepやPromise.allだけで排他を判断しない。

1. Aの実取得完了後、作成前または実INSERT後のserviceラッパーで停止し、ロックを保持する。
2. Bを開始し、BのロックSELECT発行をquery hookで通知する。独立observerからpg_blocking_pids等を期限付きで照会し、Bが実際にAを待っている状態を確認する。Bのtransactionに対応するbackend PIDを関連付け、無関係な待機を数えない。
3. 待機中はBの関連付き再取得・作成・成功返却が未実行であることを確認する。Aを解放し、commit/rollback完了とBの取得→作成→終了を追跡する。
4. ロック・競合更新側・observerへ十分な独立接続を割当て、connection poolの空き待ちを行ロック待ちと取り違えない。実DBの分離レベルを確認し、既定READ COMMITTEDで行う。意図せず別の分離レベルなら前提不一致として記録する。
5. try/finallyで全deferredを解放し、Promise.allSettled等で全処理回収、開いているtransaction終了、hook除去、fixture削除を行う。上限時間はハング検出用で、経過時間だけを正しさの根拠にしない。

| ID | レベル | 再現する順序／条件 | 期待結果・未実行処理 |
| --- | --- | --- | --- |
| P01 | D | 同一Item：Aロック→B待機確認→A commit→B commit | 各成功につき編集行1件、異なるIDで計+2。Bは解放まで関連SELECT/作成なし。元商品/関連不変。A/Bの先行を入れ替えたケースも独立実行 |
| P02 | D | 同一Item：Aが実INSERT→B待機→Aを保存後例外でrollback→B commit | A行は不在、B行のみ+1、元商品は保持。BのIDや成功がAの未commit行に依存しない |
| P03 | D | 更新側WがItemをロックし、商品名・画像・属性と関連データを更新→コピーC待機→W commit→C取得 | Cは更新後の各値・新しい関連FK・initialを使用。更新前のsnapshotで編集行を作らない |
| P04 | D | WがItemロック→statusをsoldoutへ変更→C待機→W commit | Cはロック後の状態で404、編集行+0、作成なし。activeに見えていた古い値で成功しない |
| P05 | D | WがItemロック→seller_idをBへ変更→Aのコピー待機→W commit | 所有者条件で除外し404、関連付き再取得/作成なし。変更後のB所有行を保持。W rollbackの対照ではAのコピーが成功 |
| P06 | D | WがItemロック→物理削除→コピー待機→W commit | 404、追加行なし、古い取得結果から復活させない。W rollbackの対照では元商品から作成成功 |
| P07 | D | WがItemロック→名称/属性/status/関連FKを変更→コピー待機→W rollback | コピーはrollback前の確定済みデータから成功。不成立の変更値やsoldoutを持ち込まない |
| P08 | D | 別Item・別ユーザーのA/Bを並行、各作成前まで到達させ逆順に解放 | 一方のItemロックで他方の取得を妨げない。各1件でID・所有者・価格・在庫・URLが混ざらない |
| P09 | D | コピーAが先にItemロック→更新/削除Wが待機→A commit→W commit | Aは取得時の確定値で成功、その後Wが進む。将来の更新を先読みする保証はない。元商品が後で削除されてもコピー行はitem_id=nullで保持 |

P03では「元Itemもロックして関連を更新する競合」を用いる。関連テーブルだけの独立更新へ同じ排他・整合snapshot保証を拡大しない（O03）。B/削除競合の結果を、開始時刻順や採番順から推測しない。

## 16. 通常契約と区別する観測ケース

以下は未実装の保証を追加せず、現行の責務・限界を調べるためのケース。静的調査に基づく見込みと実行結果を区別し、今回の設計作成を実測結果として扱わない。確定した詳細設計との不一致が出た場合は期待値を実装へ合わせず、入力・順序・実結果を報告する。

| ID | レベル | 条件／手順 | 観測事項・扱い |
| --- | --- | --- | --- |
| O01 | I/D | JSONBのsize.inventory欠落／null、属性の不正構造を意図的に作る | ItemAttributes型を満たさない保存済みデータの防御観測。resetInventoryはsize.inventoryを直接参照するため例外になり得る。元の例外・作成未実行・DB残存なしを記録。新たな400やinventory補完を期待しない |
| O02 | V/D | schemaで受理される2147483648以上の安全整数itemIdを実DB取得へ渡す | PostgreSQL INTEGER範囲外の取得がnull/DB例外のどこに至るかを記録。schema受理とDBでの有効性を分け、根拠なくINVALID_BODY/400またはITEM_NOT_FOUND/404へ固定しない |
| O03 | D | Itemだけをロックしてコピー再取得の前後で停止し、別transactionがVideo/Sale/配送だけを更新 | 関連だけの更新はItemロックで排他されない。再取得前のcommitはそのSELECTの可視性に従い、取得後の更新はコピー済み値を変えない。関連全体をtransaction終了までロックする保証は記載しない |
| O04 | U/D | COMMIT送信前の擬似拒否と、実COMMIT送信後の応答喪失を区別 | UのE08では成功返却の抑止だけを確認。実通信障害は未実施として残し、接続障害時の結果不明を「必ずrollback済み」と報告しない。再確認時は新規行を別接続で調べる |
| O05 | U/D | status=activeかつdeleted_at非nullの元データ | 現行取得はdeleted_atを条件にせず、usecaseもstatusだけを判定する。現行結果を観測し、論理削除状態の扱いが本機能の契約かを別途確認する。soldout拒否と混同せず、勝手な404条件を追加しない |

観測中に不具合を確認しても本番コードを修正しない。今回は本書以外編集禁止のため、対応が必要な未解決事項は本書または最終回答へ残し、Todo・ログ用の別ファイルは作成しない。

## 17. 詳細設計第8節との対応・実装優先度

| 詳細設計の観点 | 対応ケース |
| --- | --- |
| 所有者が作成、データ継承、新規ID | N01〜N11、I01〜I10、D01〜D03 |
| 不在・他人・型不正・作成中DBエラー | E01〜E09、V01〜V08、D04〜D07、T03〜T05 |
| 同一Item同時成功、先行commit/rollback後の後続成功 | P01、P02、T06 |
| 更新・削除競合、ロック後の再確認 | S01〜S06、P03〜P09 |
| itemId下限・整数、レート制限上限・時間窓 | V01〜V06、R05〜R10、Q05 |
| 任意項目・未入力・空値・最大長 | N04〜N11、I04〜I10、B01〜B03、D02、D05、D06 |
| 条件分岐とエラー優先、DB失敗時の打切り | E01〜E09、A01〜A03、V07/V08、S03〜S06、R02〜R04/R08〜R10 |
| 成功/失敗時の状態、再リクエスト、再試行、コピー元・既存編集不変 | D01〜D08、T01〜T06、Q01〜Q05、P01/P02/P08/P09 |

ケース表の複数条件はit.each等で独立テストへ展開し、ケースID・対象項目・値をテスト名に含める。設計項目数と展開後テスト件数は別に集計する。UとD併記の行は両方の責務があり、モック成功だけでDB確認を済ませたことにしない。

1. P0：N01〜N03、I01/I02/I07、E01/E02/E04〜E09、A01〜A03、V01〜V03/V07/V08、S01〜S06/S08/S09、D01/D04、T01〜T05。基本コピー・所有権・状態・価格/在庫・失敗時停止と原子性を先に固める。
2. P1：残りのN/I/V/B/S、全C、R01〜R04/R11、D02/D03/D05〜D08、T06。nullableや各層の接続、実DB制約・非対象データ不変を補完する。
3. P2：R05〜R10、Q01〜Q05、P01〜P09、O01〜O05。順序制御と時間制御が必要な再実行・競合・観測を実装する。P2は省略可能を意味せず、詳細設計が要求する並行ケースも完了判定に含む。

## 18. 実行方法と完了条件

後続のテスト実装時はserver/で以下を実行する。DBファイルを含む全体実行の前に第11節のガードを適用する。

~~~bash
npm run test:run -- test/usecases/itemEditing/createItemEditingCopy/ --maxWorkers=1
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
~~~

maxWorkers=1はファイル間のDB負荷・hook競合を抑える指定であり、P系のケース内並行transactionを直列へ変える指定ではない。DBなしのU/I/V/S/C/Rを先行実行する場合は該当テストファイルを明示し、DBモジュールが初期化されないことを確認する。

現行eslint.config.mjsのTypeScript向け設定はsrc/**/*.ts、アプリのtsconfigもsrcが対象。テストTSは別tsconfigで検査し、既存ESLint APIとtypescript-eslintのrecommended設定による対象テストの追加lintも行う。検査のためだけに既存設定を変更しない。

テスト実装後は次を満たす範囲で完了とする。

- 通常契約の各IDに実装ファイル・実行結果が対応し、入力値違いを含む未実施範囲が明確。観測ケースは通常回帰の成功と分ける。
- 全コピー項目、current復元とinitial/その他属性の保持、元データ非破壊、所有権・状態の除外、非同期待機、異常時の後続未実行を確認する。
- 実DBでは別接続のcommit可視性、実INSERT後rollback、失敗後再試行、既存行不変、並行時の実待機と解放後の再確認まで確認する。
- DB名・読込元・ガード結果・接続終了・作成IDの残存0件を記録する。安全ガード停止、接続拒否、スキーマ不足、fixture不備、契約不一致を区別する。
- testReport.md等が後続で許可された際、コマンド・実行日・ファイル別件数・成功/失敗/未実行・ID対応・モック境界・SQL/注入した失敗・未解決事項を報告する。過去の別usecaseの成功件数や既知エラーを今回の結果へ流用しない。

今回の設計書作成ではテスト・lint・型検査・DB接続は実行しない。記載した本番コードの責務、参照リンク、ケースID対応、Markdown、変更範囲を確認する。設計完了とテスト実装・検証完了を区別する。
