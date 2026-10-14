# 商品下書き作成：テストコード設計書

## 1. 目的・対象・設計時点

対象は `src/usecases/itemDraft/createItemDraft.ts` の `createItemDraftUseCase`。編集中の商品を参照して下書きを新規作成する処理について、入力・所有権・メディア・保存内容・失敗時の原子性を検証する。

2026-10-12 時点のコードを調査した設計であり、テストコードは未実装、テスト・DB 接続・migration は未実行。本書でいう「期待結果」は実行結果ではない。以下のファイルパスは、特記しない限り **`server/` 基準** とする。依頼の `/test/usecases/.../testArchitecture` は、既存の空ファイル `server/test/usecases/itemDraft/createItemDraft/testArchitecture.md` に記載する。

作成する成果物は本書だけ。既存コード、既存テスト、設定は変更しない。実 S3 へのアップロード、動画変換、商品公開、他 API の修正、負荷試験は対象外とする。

基準は [usecase テスト共通ルール](../../AGENTS.md) と [updateConfirm の設計例](../../itemEditing/updateConfirm/testArchitecture.md)。設計例の過去の観測を現在の仕様として転記しない。共通 helper の現在の実装を読み直し、この usecase 固有の作成処理・transaction 境界に合わせる。

### 特に区別する現行挙動

- 実 Router は `POST /api/item-draft` に `idParamSchema` を接続しているが、パスに `:id` がない。認証・レート制限通過後は params 検証で止まる見込み。HTTP で正常作成できる前提のテストを作らず、O01 として記録する。
- 作成データに `seller_id` と `item_id` を設定しない。参照元の所有者を検索することと、作成先へ所有者を保存することを分け、O02 で確認する。
- `ItemEditing` は読み取るだけで、削除・更新・再ロック取得しない。取得後の所有者変更・削除との競合は O03・O04 として扱う。
- 同じ入力でも毎回 `ItemDraft.create` へ進む。商品下書きの冪等性・一意性を追加仕様として要求しない。これとブランド別名の重複抑止は別の責務である。
- 上記はコードから分かる注意点であり、実測済みとはしない。今回の編集範囲は設計書に限定されるため、修正候補は本書の観測欄に残し、範囲外の Todo や実装ファイルを追加しない。

## 2. 調査対象と責務

| 対象ファイル                                                                                                      | 確認する責務                                                              |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/usecases/itemDraft/createItemDraft.ts`                                                                       | 処理順序、保存データ構築、transaction、戻り値                             |
| `src/usecases/shared/{buildSignedUrls,validateNumber,validateMaster,resolveBrand,bodyType}.ts`                    | 署名・URL 再利用、ID 変換、マスター存在確認、ブランド優先順位、共有入力型 |
| `src/services/itemDraft/command.ts`                                                                               | `CreateItemDraft` と `updateItemDraftImage`、transaction の伝達           |
| `src/services/itemEditing/query.ts`                                                                               | `id + seller_id` による取得。transaction 指定時だけロックする共通 service |
| `src/services/{categories,itemConditionOption,shippingDayOption,shippingServiceOption,todouhuken}.ts`             | 各マスターの主キー検索                                                    |
| `src/services/{brands,brandAliases}.ts`                                                                           | ブランド・別名検索、transaction 単位の advisory lock と別名再検索・作成   |
| `src/types/serviceType/{itemDraft,itemEditing,brands,brandAliases}.ts`、`src/types/itemAttributes.ts`             | service の引数・戻り値、保存する属性                                      |
| `src/validators/body/itemDraft.ts`、`src/validators/body/utils/putItem.ts`                                        | body の型・数値境界・重複 uiId 拒否                                       |
| `src/validators/params/id.ts`、`src/middleware/validate/{validateBody,validateParams}.ts`                         | params 検証、検証済み値の格納、AppError                                   |
| `src/controllers/itemDraft.ts`、`src/routes/{itemDraft,index}.ts`                                                 | 認証情報と検証済み body の引渡し、200 応答、接続順、登録パス              |
| `src/middleware/authMiddleware.ts`、`src/middleware/rateLimit/itemDraftRateLimit.ts`                              | JWT 認証、ユーザー別 10 分 5 回の制限                                     |
| `src/errors.ts`、`src/middleware/errorHandler.ts`                                                                 | AppError の型と共通エラー処理との境界                                     |
| `src/utils/{toNullableNumber,normalizeJapanese}.ts`、`src/utils/s3/{index,signedUrl,videoPresignedPost}.ts`       | Number 変換、名前正規化、外部署名の境界                                   |
| `src/models/{item_draft,item_editing,brand_aliases,brands,categories}.ts`                                         | 列・nullable・初期値・関連・制約                                          |
| `src/models/{user,item,item_condition_option,shipping_day_option,shipping_service_option,todouhuken_option}.ts`   | DB fixture の親行と非対象行                                               |
| `src/db.ts`、`src/models/index.ts`、`src/config/config.ts`                                                        | DB 接続・モデル初期化、dotenv 読込み経路                                  |
| `migrations/20261006044008-create-table-item-draft.js`、`migrations/20261006044423-update-column-item-editing.js` | 下書きテーブルの制約資料、参照元 item_id の nullable 化                   |
| `test/usecases/itemEditing/updateConfirm/{fixtures,databaseSetup,databaseFixtures}.ts`                            | fixture、deferred、接続ガード、別接続 SELECT、後片付けの参考              |
| `package.json`、`eslint.config.mjs`、`test/tsconfig.json`                                                         | Vitest・Supertest、lint と型検査の対象                                    |

モデル・migration は設計根拠であり、反映済み DB の証明ではない。実装時に実 DB の列・制約を確認し、不一致をテスト側で補正しない。

## 3. 処理の流れと停止位置

1. Router：認証 → レート制限 → params 検証 → body 検証 → controller。現行の到達性は O01 を参照。
2. Controller：`req.user.id` と `req.validatedBody` を usecase へ渡す。`itemEditingId` は body 内にある。
3. `getMyItemEditing({ itemEditingId, userId })`。未取得なら `ITEM_EDITING_NOT_FOUND / 404`。この取得には transaction を渡していない。
4. `buildSignedUrls`：動画 → サムネイル → 商品画像の並列署名 → 色画像の並列署名。公開 URL と署名情報を返す。
5. 動画 URL → サムネイル URL → 商品画像の存在を確認。空画像配列も拒否する。
6. `validateNumber`：category → condition → day → service → place → brand の順に数値変換。
7. `validateMaster`：category → condition → day → service → place の順に存在確認。null・0 は検索しない。
8. managed transaction 開始 → `resolveBrand({ brandId, body, transaction: t })` → `CreateItemDraft({ data, transaction: t })` → `updateItemDraftImage({ itemDraft, urls, transaction: t })` → commit。
9. transaction 完了後、署名情報 4 項目を返す。controller は 200 で返し、例外は同じオブジェクトを `next` へ渡す。

ブランド解決は callback 内だが、最初のブランド・別名検索には transaction を渡さない。新規別名の作成経路は `createAliases` に t を渡し、同じ t でロック・再検索・必要時の INSERT を行う。下書き本体・画像・この経路で新規作成した別名は同じ transaction に参加する。

署名発行は DB transaction の外側。後続が失敗しても署名取消し・S3 削除・自動再試行はしない。署名が発行されたことをファイル実体の存在確認やアップロード完了と解釈しない。

## 4. テストレベルとファイル構成案

以下は将来実装するファイルの設計であり、今回作成しない。

| 記号    | ファイル案                                | 実処理／モック・主な担当ケース                                                                |
| ------- | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| U       | `usecase.test.ts`                         | 実 usecase。helper・service・managed transaction をモック。N/E/T 系の引数・順序・打切り       |
| H       | `signedUrls.test.ts`                      | 実 buildSignedUrls。S3 境界、公開ドメイン、時刻、UUID を制御。S 系と usecase への代表的な接続 |
| H       | `masterBrand.test.ts`                     | 実 validateNumber・validateMaster・resolveBrand・正規化。DB service のみモック。I/M/B 系      |
| V       | `validation.test.ts`                      | 実 schema と実 validateBody/validateParams。V 系。DB 接続なし                                 |
| S       | `services.test.ts`                        | 実 service、Model メソッドと sequelize.query をモック。SV 系。SQL の実効性は D で確認         |
| C       | `controller.test.ts`                      | 実 controller、usecase のみモック。C 系                                                       |
| R       | `route.test.ts`                           | 実 Router・認証・レート制限・validator、usecase モック。最小 Express ＋ Supertest。R 系・O01  |
| D       | `database.test.ts`                        | 実 usecase・helper・service・モデル・PostgreSQL、S3 のみモック。D/ST/Q 系・O02                |
| D       | `databaseTransactions.test.ts`            | 同上＋明示した障害注入・待機 spy。T 系の永続化、失敗後再試行                                  |
| D       | `databaseConcurrency.test.ts`             | 同上＋独立 transaction と deferred による順序制御。P 系・O03/O04                              |
| 共通    | `fixtures.ts`                             | 標準 body、取得行、署名結果の factory、AppError 検証、deferred                                |
| DB 共通 | `databaseSetup.ts`、`databaseFixtures.ts` | import 前の接続ガード、fixture 作成・追跡・削除、別接続 SELECT                                |

U/H や S の成功を実 DB の rollback・制約の証明にしない。`H/U` は helper を実処理に戻した usecase 結合も行う意味であり、全 helper をモックする U とは分ける。C の成功を R の到達性の証明にしない。

### 標準 fixture と共通アサーション

- 所有者 A、別ユーザー B、A の編集中商品、B の商品、影響してはいけない既存下書き・公開商品を用意する。U の例は userId=7、itemEditingId=11。D では採番した ID を使う。
- 標準 body：価格 300、商品名「下書き商品」、説明「商品説明」、動画題名「紹介動画」、summary「動画説明」、gender=`unisex`、age=`both`。カテゴリ・商品状態・配送・ブランドは存在する ID の文字列を指定する。
- 既存 original_url・thumbnail_url・商品画像をそれぞれ異なる URL で用意。標準は converted_url なし、video/thumbnail 省略、商品画像 1 枚を `uploaded=true` として再利用する。
- 属性：全体在庫 3、色 red/blue、色在庫 2/1、サイズ M/L、サイズ在庫 2/0 など取り違えを検出できる値を用意する。素材は綿 70・ポリエステル 30。標準入力は実 schema で検証する。
- 既存属性の在庫・色画像・素材は新入力と異なる値にする。カテゴリ分類は `top/casual/middle` など実型・DB 制約を満たす値。NOT NULL の layer/path を欠いた親 fixture を作らない。
- body・配列・入れ子・取得行を factory で毎回作り直す。DB 識別用の固有名以外は不要な乱数を使わない。期待オブジェクトは実装ロジックのコピーで生成せず、具体値で記述する。
- 戻り値と主要な service 引数は完全一致。同じ body・モデル・t・urls を渡す境界は `toBe` も確認する。呼出回数・必要な順序・不要な項目の非包含も確認する。
- AppError は型・code・statusCode、通常例外は同一 Error を検証する。全異常系で停止位置以降の未実行と DB 影響を確認する。
- mock 履歴と実装を beforeEach で戻す。spy・環境変数・timer・hook を復元する。非 DB テストで db/models を実 import して接続しないよう依存境界をモックする。
- deferred は開始通知と解放用 Promise を分ける。reject 操作前に拒否アサーションを登録し、finally で残る処理を解放・回収する。任意の sleep や完了順の偶然に依存しない。

## 5. 正常系と保存項目

| ID  | レベル | 条件／入力                                            | 期待結果                                                                                         |
| --- | ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| N01 | U      | 標準入力                                              | 第 3 節の順序で各処理を 1 回実行。新規モデルを画像保存へ渡し、署名 4 項目のみ返す                |
| N02 | U/D    | 全保存項目を識別可能な値で指定                        | 下表の値が作成先へ渡り、commit 後の SELECT でも一致する                                          |
| N03 | U/D    | detail・summary を各 null／空文字／日本語文字列       | null だけ空文字へ補完。他の値は保持                                                              |
| N04 | U/D    | 全体・色・サイズ在庫を独立に 0／1／複数へ変更         | initial=current=入力、low_stock_ratio=0.2。0 を 1 にしない                                       |
| N05 | U/D    | 複数色・サイズ・素材、入力色の並びを変更              | 配列順を保持。画像は uiId に対応し、配列位置と混同しない                                         |
| N06 | U/D    | colorVariants・materials が空、ある色の sizes が空    | 前 2 つは作成引数上 undefined、sizes は空配列。JSONB では undefined キーが省略される             |
| N07 | U/D    | category あり／未選択、nullable 分類が null           | 分類は取得したカテゴリ由来。null・カテゴリなしは undefined。layer=null は H/U での防御確認に限定 |
| N08 | U/D    | brand のみ／alias のみ／両方／両方なし                | 解決結果に対応する ID または null を保存                                                         |
| N09 | U/D    | color 省略／空文字、対応色画像なし                    | 省略 color と画像なしは undefined、空文字は保持。DB では undefined キーを省略                    |
| N10 | U      | schema 外の直接入力：各在庫 null/undefined、size=null | 在庫は 1、size は undefined へ補完する防御分岐。HTTP の受理仕様としない                          |
| N11 | U/D    | freeText=null／空文字／通常文字列                     | そのまま shipping_service_free_text へ保存                                                       |

| 作成先・引渡し先                                          | 入力・変換元                                                                                                                |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| name / detail                                             | itemMeta.name / itemMeta.detail ?? 空文字                                                                                   |
| price / before_price                                      | どちらも body.price                                                                                                         |
| first_image_url                                           | finalImageUrls[0]                                                                                                           |
| image_url                                                 | 作成後に updateItemDraftImage へ finalImageUrls 全体を渡す。最初の create data には含めない                                 |
| category_id / item_condition_id                           | validateNumber の categoryId / conditionId                                                                                  |
| gender_type / age_type                                    | genderAge.gender / genderAge.age                                                                                            |
| brand_id / brand_aliases_id                               | resolveBrand が返す brand.id / alias.id、なければ null                                                                      |
| attributes.inventory                                      | allInventory ?? 1 を initial/current に設定、low_stock_ratio=0.2                                                            |
| attributes.colorVariants                                  | uiId、color、色在庫、finalAttributesImageUrls[uiId]、sizes とサイズ在庫                                                     |
| attributes.materials                                      | name・ratio だけを入力順に保存                                                                                              |
| attributes の body_category/lifestyle_category/layer      | categoryOption の値。入力 category.name/parent_id/level から生成しない                                                      |
| title / summary                                           | videoMeta.title / videoMeta.summary ?? 空文字                                                                               |
| original_url / thumbnail_url                              | buildSignedUrls の videoUrl / thumbnailUrl                                                                                  |
| shipping_day_id / shipping_service_id / shipping_place_id | validateNumber の dayId / serviceId / placeId                                                                               |
| shipping_service_free_text                                | shipping.freeText                                                                                                           |
| 戻り値                                                    | videoSignedUrl、thumbnailSignedUrl、itemImageSignedUrls、attributesImageSignedUrls。下書き ID・公開 URL・モデルを追加しない |

`seller_id`、`item_id`、`converted_url`、`duration`、`video_status`、割引列は作成データにない。参照元の全列コピーを期待せず、保存後の初期値は D02・O02 で別途確認する。

## 6. 異常系と打切り

| ID  | レベル | 条件／失敗点                                                          | 期待結果・未実行処理                                                                                                                                                       |
| --- | ------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E01 | U/D    | ID 不存在／B 所有／seller_id=null                                     | ITEM_EDITING_NOT_FOUND・404。署名以降すべて未実行、下書き増加なし                                                                                                          |
| E02 | H/U    | videoUrl=null／空文字                                                 | VIDEO_URL_NULL・400。数値変換以降なし。ただし helper 内の他の署名は先に実行され得る                                                                                        |
| E03 | H/U    | 動画あり、thumbnailUrl=null／空文字                                   | THUMBNAIL_URL_NULL・400。数値変換以降なし                                                                                                                                  |
| E04 | H/U    | 確定画像 0 件（入力空／既存 index 欠落／全新規 type 不足）            | ITEM_IMAGE_NULL・400。数値変換・transaction なし                                                                                                                           |
| E05 | U      | helper モックが finalImageUrls=null/undefined を返す                  | ITEM_IMAGE_NULL・400。実 helper では到達しない防御分岐。後続なし                                                                                                           |
| E06 | H/U    | 6 種の ID を個別に非数値文字列へ変更                                  | INVALID_NUMBER・400。マスター照合以降なし                                                                                                                                  |
| E07 | H/U    | カテゴリ／状態／配送日／配送サービス／発送元が個別に不存在            | 順に CATEGORY_NOT_FOUND／ITEM_CONDITION_NOT_FOUND／SHIPPING_DAY_NOT_FOUND／SHIPPING_SERVICE_NOT_FOUND／PLACE_NOT_FOUND、すべて 404。該当後のマスター検索・transaction なし |
| E08 | U/H    | 取得／署名／数値 helper／各マスター service が個別に reject           | 同一例外。transaction なし。署名の Promise.all で開始済みの処理の取消しは期待しない                                                                                        |
| E09 | U/H/D  | 各ブランド検索／別名作成が reject                                     | transaction 開始後の失敗。CreateItemDraft・画像保存なし。新規別名の rollback は T04 で確認                                                                                 |
| E10 | U/D    | CreateItemDraft 失敗                                                  | 画像保存なし。成功結果なし。transaction 内の新規別名も残らない                                                                                                             |
| E11 | U/D    | 本体 INSERT 後に画像 save 失敗                                        | 同一例外、成功結果なし。本体・新規別名が rollback する                                                                                                                     |
| E12 | U      | transaction 開始失敗／callback 成功後の完了失敗                       | 元例外を伝播。開始失敗は callback 未実行。完了失敗モックだけで実 commit 障害の DB 結果を断定しない                                                                         |
| E13 | U/H    | 不存在＋ URL 欠落、動画＋サムネイル＋画像欠落、数値不正＋マスター不在 | 所有権取得 → 動画 → サムネイル → 画像 → 数値 → マスターの優先順で停止                                                                                                      |
| E14 | H/U    | 動画 URL 欠落だが後段の商品画像署名が reject                          | helper 完了前の署名例外が先に伝播。VIDEO_URL_NULL に変換しない。数値以降なし                                                                                               |

E09 の DB 障害注入は実際の呼出箇所を明記する。サービスを reject するだけの U と、先行 INSERT 完了後に失敗させる D を混同しない。

## 7. 入力検証・境界値

各行の複数値・各階層は `it.each` 等で独立ケースへ展開する。schema 受理と DB 保存可否は別判定。現行 Router は params で止まるため、body 不正は実 schema・実 validateBody の V で検証し、架空の HTTP 到達経路を作らない。

| ID  | レベル | 条件／入力                                                                               | 期待結果                                                                                                                  |
| --- | ------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| V01 | V      | itemEditingId=-1/0/1/2/1.5/文字列/null/欠落                                              | 正の整数 number のみ受理。自動数値変換なし                                                                                |
| V02 | V      | price=299/300/301/999999/1000000/1000001                                                 | 300〜1000000 を受理                                                                                                       |
| V03 | V      | price=0/負数/小数/文字列/null/欠落/NaN/Infinity                                          | 拒否。非 JSON 値は schema 直接呼出しと明記                                                                                |
| V04 | V      | 全体・色・サイズ在庫=-1/0/1/小数/文字列/null/欠落                                        | 0 以上の整数だけ受理。各階層を独立検証                                                                                    |
| V05 | V      | material.ratio=-0.01/0/0.01/99.99/100/100.01、文字列/null/欠落                           | 0〜100 は小数も受理、範囲外・型不正は拒否。合計 100 の条件はない                                                          |
| V06 | V      | category.level=0/1/2/1.5/文字列/null/欠落                                                | 1 以上の整数のみ受理                                                                                                      |
| V07 | V      | 必須オブジェクト・配列・各必須子フィールドを 1 つずつ欠落/null/別型へ変更                | optional/nullable に従い拒否。nullable でも必須のキーは省略できない                                                       |
| V08 | V      | summary/detail、category.id/parent_id、gender/age、brand.id/name、shipping 全項目に null | 受理。condition.id、各 name など nullable でない文字列の null は拒否                                                      |
| V09 | V      | video/thumbnail 省略、内部 name/type 省略、uploaded 欠落                                 | 前 2 条件は受理、存在する file の uploaded 欠落は拒否。file 自体 null は拒否                                              |
| V10 | V      | 商品画像 type=null/空文字/欠落、name=空文字/欠落                                         | null・空文字 type、空 name は受理。type/name 欠落は拒否。uploaded は boolean 必須                                         |
| V11 | V      | 色の color/image 省略、image.type 省略、sizes 省略、size 名空文字                        | optional は受理、sizes 欠落は拒否、size 名空文字は受理。color や image の null は拒否                                     |
| V12 | V      | itemImages=0/1/10/11 枚、色・サイズ・素材=空/複数                                        | schema は受理。画像 0 件は E04、確定画像 11 件は D05 のモデル検証へ進む                                                   |
| V13 | V      | uiId が異なる／同一 2 件／同一 3 件／非隣接重複                                          | 一意は受理。重複は 2 件目以降の `attributes.colorVariants.<index>.uiId` に custom issue。先頭だけに誤付与しない           |
| V14 | V      | uiId 空文字 1 件／空文字 2 件、大小文字違い・空白違い                                    | 空 1 件・完全一致しない値は受理、空 2 件は拒否。trim・正規化はしない                                                      |
| V15 | V/D    | gender=men/women/unisex、age=adult/kids/both、各 null/空/不正文字列                      | schema はすべて受理。定義値は保存可能。null・不正値の拒否位置は D04                                                       |
| V16 | V/D    | name/title/freeText/brand.name=0/1/2/254/255/256 文字、日本語も使用                      | schema に長さ上限なし。DB 文字数と別名作成閾値を D06/B07 で確認                                                           |
| V17 | V      | 任意 MIME、長い説明、在庫の大きな安全整数、多数の色・サイズ、在庫合計不一致              | 明示されていない MIME 制限・業務上限・在庫合計一致を追加しない。実 schema 受理と値の保持を確認。負荷試験ではない          |
| V18 | V/C    | body と入れ子に userId/seller_id/item_id/status/余分なキー                               | parse で未知キーを除去。C では req.user.id を使用し、未検証 req.body を渡さない                                           |
| V19 | V      | validateBody 成功／失敗                                                                  | 成功は validatedBody へ parse 済み値＋ next1 回。失敗は INVALID_BODY・400 を throw し、validatedBody 設定・正常 next なし |
| V20 | V      | params.id="1"/"01"/"0"/"-1"/"1.5"/"abc"/欠落                                             | 正の整数へ coerce 可能な値のみ受理。成功は validatedParams 設定、失敗は INVALID_PARAMS・400、正常 next なし               |

### 数値変換・マスター照合

| ID  | レベル | 条件／入力                                         | 期待結果                                                                                                                 |
| --- | ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| I01 | H/U    | 6 種 ID を各 null／空文字へ変更                    | null へ変換。condition.id=null だけは HTTP 外の防御確認                                                                  |
| I02 | H/U    | 各 ID="1"/"01"/" 1 "/"1e2"                         | 1/1/1/100 を対応する引数へ渡す                                                                                           |
| I03 | H/D    | 各 ID="0"／空白だけ                                | 0 になる。5 種マスターは検索なし、保存には 0 を渡す。参照先 0 がなければ FK で拒否。brandId=0 はブランド検索対象で別扱い |
| I04 | H/D    | 各 ID="-1"/"1.5"/"Infinity"/整数列上限超過の文字列 | Number 変換自体では拒否しない。後段の検索結果・DB 型エラーを確認し、INVALID_NUMBER を期待しない                          |
| I05 | H/U    | 各 ID="abc"/"NaN"、複数同時不正                    | INVALID_NUMBER。category→condition→day→service→place→brand 順に停止                                                      |
| M01 | H/U    | 5 種マスターの null/0/有効 ID を各々指定           | null/0 は呼ばず、有効値は対応 service を正しい引数名で呼ぶ。categoryOption をそのまま返す                                |
| M02 | H/U    | 各マスター不存在／複数不存在                       | E07 の code。先行が失敗したら後続検索なし。category の分類値だけを保存へ渡す                                             |
| M03 | H/U    | 各マスター検索を保留／reject                       | 後続検索は未開始。reject 時は同じ Error、transaction 未開始                                                              |

## 8. メディア・署名 URL の条件分岐

時刻を既知値、UUID を呼出しごとに既知の異なる値へ固定する。`suffix={itemEditingId}_{now}_{requestId}` とすると、動画は `video/original/{userId}/{suffix}`、サムネイルは `thumbnail/{userId}/{suffix}`。商品画像は `{itemEditingId}_{index}_{now}_{requestId}`、色画像は `{itemEditingId}_{uiId}_{now}_{requestId}` を各 `item-image/{userId}/`、`attributes/{userId}/` に続ける。

| ID  | レベル | 条件／手順                                                        | 期待結果                                                                                                            |
| --- | ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| S01 | H/U    | 新規動画：name/type あり、uploaded=false                          | 動画 POST 署名へ正しい key・contentType・500×1024×1024 を渡す。保存 URL は公開ドメイン＋ key                        |
| S02 | H      | video 省略／uploaded=true／name 空・欠落／type 空・欠落           | 署名なし。converted_url→original_url→null の nullish 優先順。converted_url 空文字は original へ fallback せず E02   |
| S03 | H/U    | converted_url あり＋新規動画                                      | 新しい公開 URL を original_url へ採用。作成先 converted_url に既存値をコピーしない                                  |
| S04 | H/U    | thumbnail の新規条件成立／不成立、既存 URL あり／なし             | 新規は署名と新 URL、不成立は既存 URL。最終 URL 欠落は E03                                                           |
| S05 | H/U    | 商品画像に新規・既存を交互指定                                    | 新規は元 index を含む key、既存は同じ入力 index の既存 URL。確定配列は入力順                                        |
| S06 | H/U    | uploaded=true だが既存 index なし／URL 空／image_url=null・非配列 | 該当画像は確定配列に入らない。name を既存 URL として採用しない。全欠落は E04                                        |
| S07 | H      | 新規商品画像 name 空、type あり                                   | name の真偽を条件にしないので署名する                                                                               |
| S08 | H/U    | 新規商品画像 type=null／空                                        | 署名なし。部分欠落なら残りを詰めて保存、全部欠落なら E04。署名 index は詰めた位置へ変更しない                       |
| S09 | H/U    | 色画像 name/type あり、uploaded=false                             | uiId 入り key、署名辞書と確定画像辞書の対応が一致する                                                               |
| S10 | H/U    | 色画像省略／uploaded=true、入力色を逆順へ変更                     | 既存 uiId で再利用。存在しない uiId は画像なし。辞書の列挙順は assert しない                                        |
| S11 | H/U    | 色画像 uploaded=false だが name/type 不足                         | 新規署名なし。既存画像への fallback もなく image_url を省略                                                         |
| S12 | H/U    | 色削除／uiId 変更、既存 colorVariants が空・非配列                | body にない色は作成先へコピーしない。旧 S3 オブジェクトを削除する保証はない                                         |
| S13 | H      | 新規 index=1 のみ／1 と 3、署名を正順・逆順・混在で完了           | 全署名後に配列を詰める。署名は元 index 昇順、件数・対応・欠落・重複なし。確定画像も入力順                           |
| S14 | H      | 異なる uiId の色画像署名を逆順で完了                              | 全件の辞書対応を維持。全 Promise 完了前に helper は返らない                                                         |
| S15 | H/U    | createVideoPresignedPost が undefined を返す                      | videoSignedUrl=null だが videoUrl は生成。URL チェックでは拒否されない観測（O05）                                   |
| S16 | H      | 動画／サムネイル／商品画像／色画像の各署名で reject               | 同一例外。動画失敗なら以降なし、サムネイル失敗なら画像なし、商品画像失敗なら色画像なし。開始済み同群 Promise は回収 |
| S17 | H/U    | 同一時刻・同一商品に新規アップロードを 2 回指定                   | UUID 差で全種類の key を区別。1 呼出し内では同じ now/UUID を共有し、別呼出しの結果が混ざらない                      |
| S18 | H      | 動画署名／商品画像の最後の 1 件を deferred で保留                 | 動画保留中はサムネイルなし、商品画像保留中は色画像なし。解放後に進む                                                |

## 9. ブランド解決と service の契約

| ID  | レベル | 条件／入力                                                              | 期待結果                                                                                                |
| --- | ------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| B01 | H/U    | brandId で既存ブランド取得、name も指定                                 | ID を優先。alias・名前検索・作成なし、brand のみ採用                                                    |
| B02 | H/U    | ID なし／不在、name=null／空文字                                        | 両方 null。名前検索・作成なし。不在 ID を 404 にしない                                                  |
| B03 | H/U    | 名前で brand 付き alias 取得                                            | brand と alias を採用。getBrandOne・作成なし                                                            |
| B04 | H/U    | alias なし／未紐付け alias あり、同正規化名のブランドあり               | 名前検索のブランドを採用し alias=null。未紐付け alias より直接ブランドを優先                            |
| B05 | H/U    | 未紐付け alias あり、直接ブランドなし                                   | 既存 alias を採用。作成なし                                                                             |
| B06 | H/U    | alias・ブランドなし、元名長 2 以上                                      | createAliases へ元名・正規化名・同一 t。作成結果の alias と、その brand があれば brand も採用           |
| B07 | H      | 元名長 0/1/2、空白 2 つ、絵文字 1 個                                    | 0 は検索なし、1 は検索のみ、2 以上は作成候補。判定は正規化前の JS length で、空白 2 つ・絵文字 1 個も 2 |
| B08 | H      | 全角英数字・大小文字・カタカナ・空白を含む名前（例：`ＡＢＣ カタカナ`） | NFKC→ 小文字化 → ひらがな化 → 空白除去し、例では`abcかたかな`で検索。元名を保存用へ渡す                 |
| B09 | H/U    | 各ブランド service を保留／reject                                       | 優先順位に従い後段を待つ。失敗は同じ Error、本体・画像保存なし                                          |

| ID   | レベル | 呼出し条件                                         | 期待する依存呼出し                                                                                           |
| ---- | ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| SV01 | S      | getMyItemEditing に ID/userId、transaction なし    | ItemEditing.findOne の where は id ＋ seller_id。transaction・lock 追加なし、戻り値/null/例外を伝達          |
| SV02 | S      | 共通 service へ transaction あり（補助契約）       | 同じ t と t.LOCK.UPDATE を指定。この usecase がロックする証明にはしない                                      |
| SV03 | S      | CreateItemDraft に data と t                       | ItemDraft.create(data,{transaction:t})を 1 回、戻ったモデル参照をそのまま返す                                |
| SV04 | S      | updateItemDraftImage にモデル・urls・t             | setDataValue("image_url",urls)→changed("image_url",true)→save({transaction:t})。同じ配列参照、空配列も引渡す |
| SV05 | S      | create/save が reject、save 保留                   | 元例外を伝達。save 完了前には service が完了しない                                                           |
| SV06 | S      | 5 種マスター・ブランド主キー・名前・別名検索       | findByPk の ID、findOne の name_normalized、alias の Brands/as="brand" include が正しい。null/例外も伝達     |
| SV07 | S      | createAliases に t、再検索結果なし                 | 同じ t で bind 付き pg_advisory_xact_lock→ 別名再検索 →brand_id=null・元名・正規化名で create                |
| SV08 | S      | ロック後の再検索で別名あり                         | 既存インスタンスを返し create なし。検索・作成はロック完了を待つ                                             |
| SV09 | S      | ロック／再検索／作成が個別に reject                | 同じ Error。該当箇所より後の検索・作成なし                                                                   |
| SV10 | S      | createAliases に t なし（共通 service の補助分岐） | ロック・再検索なしで create。この分岐から並行時の一意性を保証しない                                          |

## 10. DB 環境・制約・永続化

### 安全条件と fixture 管理

DB テストを実装・実行する段階では、既存 PostgreSQL の **`test_db` のみ**を使う。`.env.test` の内容は今回読まない。

1. `server/` を実行ディレクトリとし、DB モジュールの初期化前に `.env.test` を読み、NODE_ENV=test と URL の DB 名を検査する。シェルの接続先をそのまま使わない。
2. 引数なし dotenv 呼出しが `.env` を開かないよう、参考 databaseSetup の方式で検証済み値だけを返す。別ファイル指定・接続設定の後書き換えも拒否する。
3. `src/db.ts`、models/index の接続、observer など全接続の設定 DB 名を接続前に検査し、接続後 `SELECT current_database()` で test_db を確認する。それまでは fixture を書き込まない。
4. 読込元・接続先不明、別 env、DB 名不一致なら中断し、秘密情報を出さず事実・停止位置・書込み有無を報告する。ガードを外したり黙って設定を差し替えたりしない。通信拒否は設定違反と分ける。
5. 必要テーブルは user、item、item_editing、item_draft、categories、item_condition_option、shipping_day_option、shipping_service_option、todouhuken_option、brands、brand_aliases。関連・NOT NULL・ENUM・文字数・初期値・索引を確認する。DB 作成、sync、migration、truncate、全件削除はしない。
6. テストごとの固有名と作成 ID で対象を追跡する。usecase は下書き ID を返さず seller_id も保存しないため、ユーザー条件で下書きを特定しない。テスト用 afterCreate hook で ID を記録するか、固有名＋記録済み ID を使う。
7. 途中失敗・rollback 済み ID も管理し、Promise/transaction 回収後、下書き → 編集中商品 → 公開商品 → 別名 → ブランド・各マスター → ユーザーの依存順で自分が作った行だけ削除する。実際の参照関係に合わせ、残存 0 件を確認する。採番値を戻さない。
8. observer から新規 SELECT で検証する。全ケースを外側 transaction で囲って rollback する方法だけでは実 commit を検証できない。接続・hook・spy を終了し、最後に環境を復元する。

### 主要制約の根拠

| 対象                                  | モデル／migration 上の内容                           | テストで区別する点                                                       |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| gender_type / age_type                | NOT NULL、ENUM、既定 unisex/both                     | 明示 null は既定値にならない。schema は nullable                         |
| image_url                             | nullable な TEXT 配列。モデル validator は最大 10 件 | DB migration には配列長 CHECK がない。モデル拒否だけで DB 制約と呼ばない |
| name/title/shipping_service_free_text | nullable VARCHAR(255)                                | schema に上限なし。256 文字は DB 経路で確認                              |
| attributes                            | NOT NULL JSONB、既定{}                               | undefined キー省略、0・小数・日本語・配列順を再取得                      |
| item_id / seller_id                   | nullable FK、削除は CASCADE / NO ACTION              | この usecase は値を渡さない。認証成功と所有者保存を混同しない            |
| category/condition/配送 3 種          | nullable FK、削除・更新 NO ACTION                    | 検証後に参照先が消えた場合も書込み時制約が働く                           |
| brand_id / brand_aliases_id           | nullable FK、削除 SET NULL、更新 NO ACTION           | 削除後の関連付けを直接 SELECT で確認                                     |
| brand_aliases.name_normalized         | モデルに unique 指定なし                             | この経路のロック＋再検索による抑止と、DB 全体の一意制約は別              |

| ID  | レベル | 条件／手順                                                                 | 期待結果                                                                                                                            |
| --- | ------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| D01 | D      | 標準 body で実 usecase 成功、observer で新規取得                           | 下書き 1 行増加、N02 の全項目・画像順・先頭一致。参照元・他行は不変                                                                 |
| D02 | D      | 参照元に動画変換済み情報・sale/recommend/割引値を設定して作成              | 作成先 sale_flag/recommend=false、duration/converted_url/video_status/割引列は null。既存値をコピーしない。seller_id/item_id は O02 |
| D03 | D      | N04〜N09 と I01 の nullable ID                                             | JSONB の省略・空配列・在庫 0・素材小数・日本語、nullable FK の null を再取得で確認                                                  |
| D04 | D      | gender/age の全定義値、個別 null/不正文字列                                | 定義値は保存、null/不正値は拒否・新規行なし。Sequelize validation か DB ENUM/NOT NULL か発生点を記録                                |
| D05 | D      | 確定画像 1/9/10/11 件。入力 11 件だが確定 10 件も用意                      | 1〜10 は保存。11 は画像 save のモデル validation で失敗し本体も rollback。入力枚数でなく確定枚数を判定                              |
| D06 | D      | name/title/freeText を各 0/254/255/256 文字、未登録ブランド名 255/256 文字 | VARCHAR 範囲内を保存、超過は該当書込みで失敗。新規別名・下書き残存なし。日本語でも確認                                              |
| D07 | D      | nullable マスター未選択、0/空白、不存在 ID                                 | null は保存。0 が存在しないことを先に確認し FK 失敗。通常の不存在は事前 404。既存 ID=0 を削除して準備しない                         |
| D08 | D      | 作成後、fixture の未紐付け alias を削除／alias なし brand を削除           | 下書きの該当 FK だけ SET NULL。他の値を維持。独立ケースで他 FK の妨害を避ける                                                       |
| D09 | D      | 独立 fixture に直接 SQL で NOT NULL/不正 ENUM/存在しない FK を指定         | 実 DB 制約の型・コードを確認。バインド使用、失敗後 rollback。通常 usecase やモデル検証と分けて報告                                  |
| D10 | D      | 参照元 item_id あり／null、他ユーザー行・既存下書きを併置                  | 所有者一致なら両方から作成可能。参照元・公開商品・既存下書き全列が不変                                                              |

## 11. 状態遷移

この usecase に「下書き → 公開」の status 遷移はない。状態は新規下書きの生成と、参照元から引き継ぐ／引き継がない値で表す。

| ID   | レベル | 操作前 → 操作                                 | 期待する保存後                                                                                       |
| ---- | ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| ST01 | D      | 下書きなし → 作成成功                         | 新規下書き 1 行。ItemEditing は残り、Item の新規作成なし                                             |
| ST02 | D      | 既存下書きあり → 同じ参照元から再作成         | 既存行を更新せず別行追加。既存行の全列不変                                                           |
| ST03 | U/D    | 参照元在庫 initial=10/current=4 → body 在庫 8 | 新規下書き initial=current=8、比率 0.2。参照元在庫は不変                                             |
| ST04 | H/D    | 変換済み動画あり → 既存利用／新規動画指定     | 既存利用は converted URL を新下書き original_url へ、新規は新 URL。参照元メディア・状態は不変        |
| ST05 | D      | 参照元に色・素材あり → body は空              | 新規下書きに旧色・素材を持ち込まない。参照元属性は残る                                               |
| ST06 | D      | 参照元 video_status=null／任意の既存文字列    | 検索に status 条件なし。所有権・他条件が満たされれば作成経路へ進む。架空の公開可否エラーを追加しない |
| ST07 | D      | 下書き作成途中 → 画像保存失敗                 | 下書きは 0 増加、transaction 内の新規別名も 0 増加、参照元不変                                       |

## 12. トランザクションと非同期処理

| ID  | レベル | 手順／失敗点                                                     | 期待結果                                                                                                                             |
| --- | ------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| T01 | U/S    | 正常作成                                                         | managed transaction1 回。同じ t が resolveBrand→createAliases、CreateItemDraft→Model.create、画像 service→save へ渡る                |
| T02 | U      | 取得・署名・数値・マスター・ブランド・本体・画像を順番に個別保留 | 各前段完了まで依存する後続なし。transaction 完了自体を別 gate で保留すると usecase も未完了                                          |
| T03 | D      | 実本体 INSERT 完了後、画像保存前に停止                           | transaction 内では下書きが見え、observer では見えない。解放して画像保存・commit 後は完全な 1 行が見える                              |
| T04 | D      | 実別名 INSERT 後に本体作成失敗／実本体 INSERT 後に画像 save 失敗 | 別接続で新規別名・下書きとも不存在。作成前からあった別名は残る。各障害を独立ケースにする                                             |
| T05 | D      | 実画像 save 完了後、ラッパーから意図的に throw                   | 画像保存まで実行済みでも本体・新規別名は rollback。元モデルの値では判定しない                                                        |
| T06 | D      | 正常な新規別名＋本体＋画像を commit 前で保留 → 解放              | observer は commit 前に新規 2 行を見ず、後に両方を見る。FK と画像が対応する                                                          |
| T07 | D      | T04 の rollback 後、同じ body で正常再試行                       | 失敗回の残存なし、成功回の下書き 1 行・必要な別名 1 行。ID 連番や採番巻戻しは期待しない                                              |
| T08 | U/H    | URL／数値／マスター不正                                          | transaction0 回。発行済み署名の取消し・S3 削除なし                                                                                   |
| T09 | D      | マスター検証完了後に対象マスターを別接続で削除 → 本体 INSERT     | 本体がまだ参照していない fixture で削除 commit を確認。以後の FK 書込みは失敗し、新規別名も rollback。カテゴリ・状態・配送を個別展開 |

commit 障害そのものの再現、ネットワーク切断時の commit 成否不明状態は今回の通常 DB テストに含めない。E12 は例外伝播だけのモック検証と報告する。

## 13. 重複実行・並行処理

| ID  | レベル | 条件／手順                                               | 期待結果                                                                                          |
| --- | ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Q01 | U/D    | 既存メディアの同一 body を逐次 2 回                      | 毎回 create、下書き 2 行。業務入力値は一致、別 ID。応答に ID は含まれない                         |
| Q02 | H/D    | 新規メディアの同一 body を同一時刻・別 UUID で逐次 2 回  | 別キー・別 URL の下書き 2 行。署名・URL を使い回す冪等性なし                                      |
| Q03 | D      | 未登録ブランド名で逐次 2 回                              | 下書き 2 行が同じ alias を参照、別名 1 行。2 回目は既存 alias 再利用                              |
| Q04 | D      | 1 回目を画像保存失敗、2 回目を成功                       | T07。失敗時に署名済みでも DB 行は成功回のみ。自動再試行はしない                                   |
| Q05 | C/D    | サーバー側成功後に応答を失った状況を想定し同 body を再送 | usecase 直接再実行ではもう 1 行作る。通信障害を実再現したとは報告せず、再送時の非冪等な結果を確認 |

P 系は実処理を呼ぶ service ラッパーや hook で待ち合わせる。異なる接続の transaction を使い、プール枯渇で observer が待たない構成にする。テストファイルを直列実行しても、ケース内部の競合は明示的に作る。

実行時は transaction の分離レベルも記録する。P04/P05 のロック解除後の再検索は READ COMMITTED を前提とするため、実 DB の設定を先に確認する。異なる場合は設定を黙って変更せず、期待結果への影響と未確認範囲を報告する。

| ID  | レベル | 再現する順序                                                                                                 | 期待結果／観測内容                                                                               |
| --- | ------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| P01 | D      | 同じ ItemEditing を A/B とも実 SELECT→A 作成 commit→B 作成 commit（逆順も）                                  | 別下書き 2 行。異なる名前・価格・属性・画像が各行で対応。参照元不変                              |
| P02 | D      | 別ユーザー・別 ItemEditing で作成を交差させる                                                                | 両方成功し入力・URL が混ざらない。保存先所有者は O02 の現行挙動を別途記録                        |
| P03 | D      | A/B で作成、A だけ実本体作成後に画像失敗、B は commit                                                        | A 行なし・B 行あり。片方 rollback が他方 commit を取り消さない。ブランドは既存または別名を分ける |
| P04 | D      | 別商品・同正規化名で両方の初期 alias 検索を未取得 →A がロック・別名 INSERT→B がロック待ち →A commit→B 再検索 | 下書き 2 行、alias1 行、双方同じ alias ID。B はロック解除後の再検索結果を採用                    |
| P05 | D      | P04 の A を画像保存で rollback→B のロック解除・再検索・作成                                                  | A 下書き・alias なし。B が新規 alias を作って成功し、最終的に下書き 1 行・alias1 行              |
| P06 | D      | 異なる正規化名。hashtext 値も異なることを確認 →A がロック保持中に B を完了                                   | B は A の同名ロック待ちを受けず完了、別 alias を参照。ハッシュ衝突がない fixture での確認に限定  |
| P07 | D      | A が実 ItemEditing 取得 → 別接続でメディア/属性更新 commit→A を解放                                          | A の既存再利用は取得済み snapshot 由来。最新値再取得の保証なし。B 更新は保持。O04 として記録     |
| P08 | D      | A が実取得 → 別接続で seller 変更／ItemEditing 削除 commit→A 作成                                            | 再認可・再取得がない現行経路を O03 として観測。404 を当然の期待値にしない                        |
| P09 | D      | resolveBrand 取得後、採用する brand／alias を別接続で削除 commit→ 下書き INSERT                              | 書込み時の FK 不在で失敗、下書き残存なし。削除対象に他 fixture の参照がないよう用意              |
| P10 | H      | 2 呼出しの署名を交差、商品画像を逆順、色を逆順で完了                                                         | S13/S14/S17。元 index/uiId/リクエストと結果が対応、欠落・上書きなし                              |

P04/P05 では「両方がロック取得後に到達する gate」を置かない。B はロック待ちのまま A の commit/rollback を待つ必要がある。ロック要求開始の通知と A の解放を分け、全処理を finally で回収する。共通 service を経由しない任意 INSERT まで別名重複を防げるとは主張しない。

## 14. Controller・Router

| ID  | レベル | 条件／入力                                                | 期待結果                                                                                                                      |
| --- | ------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| C01 | C      | req.user.id=A、validatedBody あり、req.body/params に別値 | `{ userId:A, body:req.validatedBody }` を 1 回。同じ body 参照。ID は body に残し、params から別 itemEditingId を組み立てない |
| C02 | C      | usecase 成功：署名値あり／null・空配列・空辞書            | status(200)と 4 項目 JSON 完全一致。下書き ID など追加なし。next なし                                                         |
| C03 | C      | usecase が AppError／通常 Error を reject                 | 同じ Error を next へ 1 回。status/json なし                                                                                  |
| C04 | C      | usecase を deferred で保留                                | 完了前に 200 を送らない。解放後は C02                                                                                         |
| R01 | R      | トークンなし／Bearer 不正／署名不正／期限切れ             | 認証実装の 401 メッセージ。usecase 未実行。認証失敗はレート枠を消費しない                                                     |
| R02 | R      | 正常認証・正常 body で POST /api/item-draft               | O01。実 params は空で INVALID_PARAMS・400。body 検証・controller・usecase 未実行                                              |
| R03 | R      | 正常認証＋不正 body、body/query に id を追加              | params 不足が優先し INVALID_PARAMS。body/query は params の代替にならない                                                     |
| R04 | R      | 同一ユーザー 5 回 →6 回、別ユーザー、10 分経過後          | 最初 5 回は制限通過後に params で 400、6 回目 429。別ユーザーと時間窓更新後は再び params400。usecase は全回未実行             |
| R05 | R      | 不正 body を 5 回繰返す → 正常 body で 6 回目             | params/body より制限が先のため 6 回目 429。成功要求だけを数えるとは期待しない                                                 |
| R06 | R      | 無認証＋不正入力／制限超過＋不正入力                      | それぞれ 401／429 が優先。validator・usecase に到達しない                                                                     |
| R07 | R      | POST /api/item-draft/11                                   | 現行 Router の定義外で 404。`:id`を足せば使える API として設計しない                                                          |

テスト用 Express には JSON parser と実 Router を同じ登録パスで接続する。エラー観測用に 4 引数 middleware を置き、AppError の code/statusCode を確認する。その結果を実アプリ共通 errorHandler の検証済みとしない。共通 errorHandler 自体の変更・検証拡大は今回行わない。

JWT 鍵はテスト専用の値を生成し、dotenv を制御して実環境の鍵を読まない。レートストアは各テストで分離し、時間操作は Date/interval など必要な対象に限定して HTTP I/O を妨げない。現在の R には成功 200 や INVALID_BODY まで到達するケースを置けないため、C/V/U/D でそれぞれの責務を検証する。Router 修正が別途指示された時点で、変更根拠と新しい期待結果を追記する。

## 15. 観測事項と未確定の契約

観測ケースの成功は「現行挙動を再現できた」意味に限定する。望ましい仕様や修正済みの保証にしない。下表の見込みはソース読解によるもので、実測結果は将来の testReport へ分けて記録する。

| ID  | レベル | 関連ケース・入力／手順                                  | 確認する現行挙動と残る判断                                                                                                                                                           |
| --- | ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| O01 | R      | R02/R03、正しい認証・body で実パスへ送信                | `/:id`なしと id 必須検証が不整合。INVALID_PARAMS で作成不能の見込み。修正する場合の params 検証の扱いは別タスクで決める                                                              |
| O02 | U/D    | N02/D02、参照元に seller_id/item_id がある状態で作成    | create data に両 ID なし、モデル・migration 上は nullable なので DB では null の見込み。所有者保存・元商品との関連が必要かを仕様として確定する。認証しただけで関連付いたと判定しない |
| O03 | D      | P08、初回所有権取得後に所有者変更／参照元削除           | 再取得なし、作成先に参照元 FK なしのため作成継続の見込み。最終行と取得・変更・commit 順を記録。競合時の再認可・中断を保証しない                                                      |
| O04 | D      | P07、取得後に参照元メディアを別接続で更新               | 古い取得値を使う見込み。参照元の最新状態を自動採用する仕様はない                                                                                                                     |
| O05 | H/U    | S15、動画 POST 署名境界が undefined                     | 署名 null でも公開 URL を組み立てて作成へ進む。実アップロード可能性は未確認、署名欠落時の業務仕様は未確定                                                                            |
| O06 | H/D    | I04、schema を通る負数・小数・Infinity 相当の ID 文字列 | 変換後の検索・DB 型・制約のどこで失敗するかを記録。実 DB 未確認のエラー名・HTTP 応答を固定しない                                                                                     |

## 16. 実装順序・実行方法・完了条件

優先度は次のとおり。同一 ID が複数値を持つ場合は独立テストへ展開し、設計 ID 数と実行件数を別集計する。

| 優先度 | ケース群                                                                     | 先に確認する理由                                                     |
| ------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| P0     | N01〜N04、E 全件、V01〜V08/V13/V19、D01/D04/D05、T01〜T05、C01〜C03、O01/O02 | 基本保存、所有権、重要境界、停止・rollback、入口と所有者保存の不整合 |
| P1     | 残りの N/V、I01/I02/I05、M/B/S/SV 全件、残り D/T、ST 全件、C04/R 全件        | helper・層間の引渡し、メディア対応、制約、保存状態                   |
| P2     | I03/I04、Q/P 全件、O03〜O06                                                  | 重複・順序制御した競合・実環境に依存する観測                         |

実装時は既存 Vitest/Supertest を使い、TypeScript・ESM・相対 import `.js` とする。テスト名に ID と日本語の条件・結果を含める。型は既存型・Parameters/ReturnType・型付き mock を優先し、意図的な不正入力と Express 境界以外で型アサーションを増やさない。

将来の実装後は、DB の接続ガードを確認してから `server/` で以下を実行する。

```bash
npm run test:run -- test/usecases/itemDraft/createItemDraft/ --maxWorkers=1
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

`--maxWorkers=1` は DB fixture/hook とレート制限状態のファイル間干渉を抑えるため。ケース内の並行実行は別途 P 系で制御する。DB 非接続の検査と DB 検査を分けて結果を記録する。

現在の ESLint の TypeScript 設定は `src/**/*.ts` が対象であり、npm run lint だけでテスト TS を検査済みとしない。実装時は既存 ESLint・typescript-eslint を用いたテスト対象の追加検査方法と結果を記録し、そのためだけに既存設定を変更しない。

テスト実装の完了条件は、ケース ID とテストファイルの対応が追え、正常値・後続未実行・await の待機・別接続からの DB 結果・並行順序・後片付けが確認できること。環境不足・スキーマ不一致・未実装・未実行・観測を成功へ混ぜない。報告書には各コマンド、展開後件数、各 ID の実施範囲、モック/実処理、DB 読込元と DB 名だけの安全確認結果、残る検証を記録する。

**今回の完了範囲は本設計書の作成と記載・リンク・ケース対応・変更範囲の確認まで。テストコードの実装、テスト・lint・型検査・DB 接続は行っていない。**
