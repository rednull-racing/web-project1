# 商品下書き作成：テストコード設計書

## 契約の更新（2026-10-22）

[基本設計 createItemDraft](../../../../../docs/design/backend/itemUpload.md) と [元編集セッション残存の修正指示](../../../../../docs/todo/P1-bug/create-item-draft-retains-editing-session.md) に合わせ、下書き本体・画像の保存後、再認可・ロック取得した元 `item_editing` を同じ transaction で削除する。成功後の同一編集 ID 再送は `ITEM_EDITING_NOT_FOUND / 404` とし、下書きを追加しない。失敗時は作成先を rollback し、元行を保持する。

本書は現行契約を記載する。元行保持・同一 ID から複数作成・所有者未保存・再認可なし・旧 Router 不整合などの初回観測は、[統合レポートの初回結果](../../report/itemDraft/createItemDraft.md#initial-report) と [改善・再実行履歴](../../report/itemDraft/createItemDraft.md#follow-up) を参照する。旧結果を現在の期待値として扱わない。`item_draft` / `item_editing` の削除済み `item_id` を保存・取得・FK・nullable 参照として要求しない。未知入力の除去・非混入の確認は維持する。

## 現在の配置

以下は `server/` 基準。旧ファイル名はケースと現在の配置の対応を示す。

| 分類     | 旧ファイル                                                                                            | 現在の配置                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 単体     | `usecase.test.ts`                                                                                     | `src/usecases/itemDraft/test/createItemDraft.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 単体     | `controller.test.ts`                                                                                  | `src/controllers/itemDraft/test/createItemDraft.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 単体     | `validation.test.ts`                                                                                  | `src/validators/body/test/createItemDraft.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 単体     | `signedUrls.test.ts`                                                                                  | `src/usecases/shared/test/createItemDraft.signedUrls.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 単体     | `videoPresignedPost.test.ts`                                                                          | `src/utils/s3/test/createItemDraft.videoPresignedPost.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 単体     | `services.test.ts`                                                                                    | `src/services/itemDraft/test/createItemDraft.test.ts`（作成・画像保存6件）、`src/services/itemEditing/test/createItemDraft.test.ts`（取得5件）、`src/services/categories/test/createItemDraft.test.ts`、`src/services/itemConditionOption/test/createItemDraft.test.ts`、`src/services/shippingDayOption/test/createItemDraft.test.ts`、`src/services/shippingServiceOption/test/createItemDraft.test.ts`、`src/services/todouhuken/test/createItemDraft.test.ts`、`src/services/brands/test/createItemDraft.test.ts`、`src/services/brandAliases/test/createItemDraft.test.ts`（合計30件） |
| 結合     | `masterBrand.test.ts`、`route.test.ts`、`databaseTransactions.test.ts`、`databaseConcurrency.test.ts` | `test/integration/usecases/itemDraft/createItemDraft/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 結合     | `database.test.ts`                                                                                    | `test/integration/database/itemDraft/createItemDraft/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| fixture  | `fixtures.ts`、`databaseFixtures.ts`、`databaseSetup.ts`                                              | `test/fixtures/itemDraft/createItemDraft/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 設計書   | `testArchitecture.md`                                                                                 | `test/docs/architecture/itemDraft/createItemDraft.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| レポート | `testReport.md`、`afterFix.md`                                                                        | `test/docs/report/itemDraft/createItemDraft.md` に統合                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

実usecaseと複数helperを接続する `masterBrand.test.ts` は結合テストに分類した。マスター取得・別名作成のserviceテストは、各本番コードと同じフォルダ内のtestへ分割配置する。配置変更の履歴はレポートを参照する。今回の期待値変更は本文に反映する。

DB非接続の単体・結合テストの実行コマンド（server/で実行）：

```bash
npm run test:run -- src/usecases/itemDraft/test/createItemDraft.test.ts src/controllers/itemDraft/test/createItemDraft.test.ts src/validators/body/test/createItemDraft.test.ts src/usecases/shared/test/createItemDraft.signedUrls.test.ts src/utils/s3/test/createItemDraft.videoPresignedPost.test.ts src/services/itemDraft/test/createItemDraft.test.ts src/services/itemEditing/test/createItemDraft.test.ts src/services/categories/test/createItemDraft.test.ts src/services/itemConditionOption/test/createItemDraft.test.ts src/services/shippingDayOption/test/createItemDraft.test.ts src/services/shippingServiceOption/test/createItemDraft.test.ts src/services/todouhuken/test/createItemDraft.test.ts src/services/brands/test/createItemDraft.test.ts src/services/brandAliases/test/createItemDraft.test.ts test/integration/usecases/itemDraft/createItemDraft/masterBrand.test.ts test/integration/usecases/itemDraft/createItemDraft/route.test.ts --maxWorkers=1
```

本番コードの型は `npm run typecheck`、単体・結合テスト全体は `./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` で確認する。実DBテストは第10節の接続ガード・安全条件を確認したうえで、`test/integration/database/itemDraft/createItemDraft/database.test.ts`、`test/integration/usecases/itemDraft/createItemDraft/databaseTransactions.test.ts`、同 `databaseConcurrency.test.ts` を指定する。

## 1. 目的・対象・設計時点

対象は `src/usecases/itemDraft/createItemDraft.ts` の `createItemDraftUseCase`。2026-10-22 時点の基本設計・修正指示、現行コード・テスト・fixture と既存レポート全文を照合した。入力・所有権・メディア・保存内容に加え、元編集行の消費、失敗時の原子性、再送・行ロック競合を検証する。以下は特記しない限り **`server/` 基準**。

今回の成果物は既存 usecase のバグ修正、影響するテスト・fixture、設計書・統合レポート・Todo・ログの更新。API の URL・入力・応答は変更せず、既存の `itemDraftId` と署名 4 項目を返す。実 S3 アップロード、動画変換処理自体、商品公開、他 API の仕様変更、負荷試験、既存の残存編集行の一括削除は対象外。実行結果は [レポート](../../report/itemDraft/createItemDraft.md) に記録し、本書の期待結果と区別する。

## 2. 関連ファイルと責務

| ファイル | 責務 |
| --- | --- |
| `src/usecases/itemDraft/createItemDraft.ts` | 処理順序、再認可、保存データ、元行消費、transaction・戻り値 |
| `src/usecases/shared/{buildSignedUrls,validateNumber,validateMaster,resolveBrand,bodyType}.ts` | メディア再利用・署名、ID 変換、マスター照合、ブランド解決・共有入力型 |
| `src/services/itemDraft/command.ts` | 本体作成・画像保存への transaction 引渡し |
| `src/services/itemEditing/{query,command}.ts` | 所有者付き取得・transaction 指定時の UPDATE lock、取得モデルの destroy |
| `src/services/{categories,itemConditionOption,shippingDayOption,shippingServiceOption,todouhuken,brands,brandAliases}/` | マスター・ブランド取得、別名作成と advisory lock |
| `src/types/serviceType/{itemDraft,itemEditing,brands,brandAliases}.ts`、`src/types/itemAttributes.ts` | 保存 DTO、モデル・transaction の境界 |
| `src/validators/body/itemDraft.ts`、`src/validators/body/utils/putItem.ts` | body・ENUM・文字数・在庫・uiId 重複検証 |
| `src/controllers/itemDraft/itemDraft.ts`、`src/routes/{itemDraft,index}.ts` | 認証 ID・検証済み body の引渡し、登録パス・200 応答 |
| `src/middleware/authMiddleware.ts`、`src/middleware/rateLimit/itemDraftRateLimit.ts`、`src/middleware/validate/` | 認証、ユーザー別 10 分 5 回の制限、検証済み値の格納 |
| `src/errors.ts`、`src/middleware/errorHandler.ts` | AppError と共通 HTTP エラー処理の境界 |
| `src/utils/normalizeJapanese.ts`、`src/utils/s3/`、`src/infra/aws/` | 名前正規化、署名境界、公開ドメイン・bucket |
| `src/models/`、`migrations/` | 現在のカラム・制約・関連の資料。古い migration 単体を現行スキーマとみなさない |
| `src/db.ts`、`src/models/index.ts`、`src/config/config.ts` | DB 初期化・dotenv 読込み |
| `test/fixtures/itemDraft/createItemDraft/` | body/モデル factory、DB 接続ガード、fixture 追跡・後片付け |
| `package.json`、`eslint.config.mjs`、`test/tsconfig.json` | テスト・静的検査の対象 |

## 3. 処理順序と停止位置

1. `POST /api/item-draft`：認証 → レート制限 → body 検証 → controller。作成 route に params 検証はない。
2. Controller は `req.user.id` と `req.validatedBody` を usecase に渡す。編集 ID は body の `itemEditingId`。
3. transaction 外で所有者条件付き `getMyItemEditing`。不存在・他人所有・所有者 null は `ITEM_EDITING_NOT_FOUND / 404`、署名以降なし。
4. `buildSignedUrls` は動画 → サムネイル → 商品画像の並列署名 → 色画像の並列署名。既存再利用は初回取得 snapshot を使う。
5. 動画 URL、サムネイル URL、確定商品画像 1〜10 件を確認。確定 0 件は `ITEM_IMAGE_NULL / 400`、11 件以上は `ITEM_IMAGE_LIMIT_EXCEEDED / 400`。
6. category → condition → day → service → place → brand の順に ID を変換し、5 種マスターを照合する。
7. managed transaction 開始。`getMyItemEditing({ itemEditingId, userId, transaction:t })` で再取得し UPDATE lock。null なら同じ 404 でブランド・作成・削除を開始しない。
8. 同じ t でブランド解決・必要な別名作成 → `CreateItemDraft` → `updateItemDraftImage` → **`deleteItemEditing({ itemEditing:currentItemEditing, transaction:t })`**。初回 snapshot や新下書きのモデルを削除対象にしない。
9. callback は下書き ID を返す。削除完了・transaction 完了の両方を待ち、`itemDraftId` と署名 4 項目を返す。controller は 200。例外は同じオブジェクトを `next` へ渡す。

ブランド初期検索は transaction 外の service 呼出しだが、新規別名の lock・再検索・作成は同じ t。元編集行のロックは commit/rollback まで保持する。署名発行は transaction 外であり、DB 失敗時に署名取消し・S3 削除・自動再試行はしない。DB 行消費は S3 実体の削除を意味しない。

## 4. テストレベル・fixture・共通アサーション

| 記号 | 対象と境界 |
| --- | --- |
| U | 実 usecase。helper・service・managed transaction をモックし、引数・順序・待機・停止を確認 |
| H | 実 shared helper。DB/S3 境界をモック。実 usecase と接続する場合は H/U とする |
| V | 実 schema・validateBody/validateParams。DB 非接続。params は共有 validator の単体責務 |
| S | 実 service。Model メソッドと SQL 呼出しをモック。実 DB の原子性の証明にしない |
| C | 実 controller、usecase のみモック |
| R | 実 Router・JWT・レート制限・validator、usecase モック。最小 Express ＋ Supertest |
| D | 実 usecase・helper・service・モデル・PostgreSQL。S3 のみモックし、必要な障害/保留 spy を追加 |

- 所有者 A、別ユーザー B、各編集行、非対象の編集行・既存下書き・公開商品を作る。元行消費後に複数成功が必要なテストは **独立した編集 ID** を用意し、同じ ID を使う再送/競合テストと区別する。
- 標準 body は価格 300、商品名「下書き商品」、説明・動画題名・summary・gender/age、実在マスター ID を指定し、実 schema で parse。既存動画/サムネイル/商品画像を再利用し、変換済み URL は別値にする。
- 在庫は全体 3、色 2/1、サイズ 2/0、素材 70/30 など、入力・元属性・別要求の値を区別する。カテゴリ分類・色画像 uiId を対応させる。nullable と NOT NULL の親 fixture を混同しない。
- body・配列・取得行は factory で再作成。同じ body・モデル・t・urls を渡す境界は完全一致と参照一致を確認し、呼出回数・順序・余分な列の非包含も確認する。
- 正常時は作成先の全保存値・所有者・返却 ID・元行不存在、異常時は停止位置・後続未実行・元行保持・作成先/新規別名の rollback、全ケースで非対象行不変を確認する。
- AppError は型・code・statusCode、通常例外は同一参照を確認。deferred は開始通知と解放を分け、finally で全 gate を開放し Promise を回収する。mock/spy/hook/env/timer を復元する。

## 5. 正常系と保存項目

| ID | レベル | 条件 | 期待結果 |
| --- | --- | --- | --- |
| N01 | U | 標準入力 | 第3節の順序・回数。画像保存後に再取得モデルを同じ t で削除し、ID＋署名4項目を返す |
| N02 | U/D | 全項目を識別可能な値で指定 | 下表の保存値・返却ID・認証所有者一致。commit後の元行不存在、非対象行不変 |
| N03 | U/D | detail/summary が null・空・日本語 | null だけ空文字へ補完 |
| N04 | U/D | 各階層の在庫 0/1/複数 | initial=current=入力、low_stock_ratio=0.2、0を1にしない |
| N05 | U/D | 複数色・サイズ・素材、色順変更 | 入力順保持、色画像は uiId 対応 |
| N06 | U/D | 色・素材空、ある色の sizes 空 | 前2つは作成引数 undefined/JSONBキー省略、sizes=[]は保持 |
| N07 | U/D | カテゴリあり/なし、nullable分類null | 実取得カテゴリ由来の分類。欠落はキー省略。layer=nullはUの防御分岐 |
| N08 | U/D | brand/alias/両方/両方なし | 解決したIDまたはnull |
| N09 | U/D | color省略/空、対応色画像なし | 省略はundefined/DBキー省略、空文字は保持 |
| N10 | U | HTTP外の在庫null/undefined、size=null/undefined | 在庫1、size undefinedへの防御補完。HTTP受理契約としない |
| N11 | U/D | freeText null/空/文字列 | そのまま保存 |

| 保存先・戻り値 | 入力・変換元 |
| --- | --- |
| seller_id | 認証済み userId。bodyや元モデルから任意所有者を採用しない |
| name/detail、title/summary | itemMeta/videoMeta。detail/summaryのnullだけ空文字 |
| price/before_price | body.price |
| first_image_url、image_url | finalImageUrls[0]、画像serviceへ配列全体。create dataにimage_urlは含めない |
| category_id、item_condition_id、配送3種ID | validateNumberの対応値 |
| gender_type/age_type | genderAge.gender ?? unisex、age ?? both |
| brand_id/brand_aliases_id | resolveBrandの結果、なければnull |
| attributes | 入力の在庫・色・サイズ・素材、uiId対応画像、取得カテゴリの分類 |
| original_url/thumbnail_url | helperが確定した動画・サムネイルURL |
| shipping_service_free_text | shipping.freeText |
| 戻り値 | itemDraftId、videoSignedUrl、thumbnailSignedUrl、itemImageSignedUrls、attributesImageSignedUrls |

converted_url・duration・video_status・割引列はコピーしない。sale_flag/recommendはfalse、変換情報/割引列はnullの既定値をD02で確認する。

## 6. 異常系と打切り

| ID | レベル | 条件 | 期待結果・未実行 |
| --- | --- | --- | --- |
| E01 | U/D | 不存在/他人所有/所有者null | 404、署名以降なし、元/非対象行不変、下書き増加なし |
| E02 | H/U | videoUrl null/空 | VIDEO_URL_NULL・400、数値以降なし |
| E03 | H/U | 動画あり・thumbnailUrl null/空 | THUMBNAIL_URL_NULL・400、数値以降なし |
| E04 | H/U/D | 確定画像0件 | ITEM_IMAGE_NULL・400、transactionなし |
| E05 | U | helperモックが確定配列null/undefined | 同じ画像400の防御分岐、後続なし |
| E06 | H/U | 各IDに非数値/範囲外/非整数 | INVALID_NUMBER・400、マスター以降なし |
| E07 | H/U/D | 5種マスターの個別不存在 | CATEGORY_NOT_FOUND/ITEM_CONDITION_NOT_FOUND/SHIPPING_DAY_NOT_FOUND/SHIPPING_SERVICE_NOT_FOUND/PLACE_NOT_FOUND・404、後続なし |
| E08 | U/H | 初回取得/署名/数値/マスターreject | 同一例外、transactionなし。開始済み署名を取り消す保証なし |
| E09 | U/H/D | ブランド検索/別名作成reject | 再認可後、transaction内で停止。本体/画像/元行削除なし、作成済み別名rollback |
| E10 | U/D | 本体作成失敗 | 画像/元行削除なし、作成済み別名rollback |
| E11 | U/D | 本体INSERT後の画像保存失敗 | 元行削除なし、本体/新規別名rollback、元行保持 |
| E12 | U | transaction開始失敗/完了Promiseの模擬reject | 同一例外・成功応答なし。実COMMIT通信障害のDB成否は断定しない |
| E13 | U/H | 複数の不正条件 | 所有権→動画→サムネイル→画像→数値→マスターの停止優先順位 |
| E14 | H/U | 動画URLなし・helper内部の商品画像署名reject | helper例外が先に伝播、数値以降なし |

再認可のnull/rejectはAF-AUTH01〜03、元行削除の失敗・待機はAF-CONSUME02/03で分ける。serviceのrejectだけのUを実DB rollbackと同一視しない。

## 7. 入力検証・境界

各値・各階層を独立ケースへ展開する。HTTP JSONで表現できないNaN/Infinity/undefined等の直接注入はschema単体と明記する。

| ID | レベル | 入力 | 期待結果 |
| --- | --- | --- | --- |
| V01 | V | 編集ID -1/0/1/2/小数/文字列/null/欠落 | 正の整数numberだけ受理、自動変換なし |
| V02 | V | price 299/300/301/999999/1000000/1000001 | 300〜1000000受理 |
| V03 | V | price 0/負数/小数/文字列/null/欠落/非有限 | 拒否 |
| V04 | V | 全体/色/サイズ在庫の負数/0/正数/小数/別型/null/欠落 | 0以上の整数のみ |
| V05 | V | ratio -0.01/0/0.01/99.99/100/100.01/別型/null/欠落 | 0〜100は小数も可、合計100制約なし |
| V06 | V | level 0/1/2/小数/別型/null/欠落 | 1以上整数 |
| V07 | V | 必須オブジェクト/配列/子キーの欠落/null/別型 | optional/nullableに従う。nullable必須キーの省略は拒否 |
| V08 | V | nullable文字列・gender/age等のnull | 定義したnullableのみ受理、通常文字列null拒否 |
| V09 | V | 動画/サムネイル省略、name/type省略、uploaded欠落 | 前2条件可、file自体null・uploaded欠落は拒否 |
| V10 | V | 商品画像type null/空/欠落、name空/欠落 | null/空type・空name可、キー欠落不可、uploaded boolean必須 |
| V11 | V | 色/画像/type省略、sizes欠落、size空 | optional可、null不可、sizes必須、空size可 |
| V12 | V/H/U | 画像0/1/10/11、色/サイズ/素材空 | schema受理。確定0/11はusecaseで400、入力11/確定10は受理 |
| V13 | V | uiId一意/2〜3件/非隣接重複 | 重複位置にcustom issue、先頭へ誤付与なし |
| V14 | V | 空uiId1/2件、大小文字/空白差 | 完全一致の重複だけ拒否、trim/正規化なし |
| V15 | V/U/D | gender/age全ENUM・null・空・不正 | ENUM/nullのみschema受理、nullはunisex/both、空/不正は400 |
| V16 | V/H/D | name/title/freeText/新規brand 0/1/2/254/255/256文字 | 保存文字列は255まで。brandは新規保存経路で元名・正規化名を検査。補助平面文字も文字数基準 |
| V17 | V | 任意MIME/長い説明/大きな在庫/多数の色サイズ/在庫不一致 | 未定義のMIME制限・上限・在庫合計一致を追加しない |
| V18 | V/C | 所有者/旧列/status等の未知入力 | parse除去、認証ID使用、旧列を保存へ混入しない |
| V19 | V | validateBody成功/失敗 | validatedBodyとnext1回、失敗はINVALID_BODY・400/正常nextなし |
| V20 | V | 共有params.id 1/01/0/負数/小数/abc/欠落 | 正整数coerce・格納、失敗INVALID_PARAMS・400。作成routeにparams検証を要求しない |

| ID | レベル | 数値・マスター条件 | 期待結果 |
| --- | --- | --- | --- |
| I01 | H/U/D | 6種ID null/空/空白 | nullへ変換。condition null直接注入はHTTP外 |
| I02 | H/U/D | 1/01/空白付き1/1e2 | 1/1/1/100、1〜2147483647の整数を受理 |
| I03 | H/U/D | 0/空白 | 0はINVALID_NUMBER、空白はnull。0をFK保存しない |
| I04 | H/U/D | 負数/小数/Infinity/2147483648 | INVALID_NUMBER・400、DB検索/保存前に停止 |
| I05 | H/U | abc/NaN、複数不正 | category→condition→day→service→place→brand順に停止 |
| M01 | H/U | 5種master null/0/有効ID | helper直接入力null/0は検索しない、有効IDの引数名・返却参照一致。正常ID変換から0は来ない |
| M02 | H/U | 各/複数マスター不存在 | 最初の該当404、後続検索なし |
| M03 | H/U | 各検索保留/reject | 完了まで後続なし、同一例外、transactionなし |

## 8. メディア・署名

時刻とUUIDを固定し、suffix=`{itemEditingId}_{now}_{requestId}`。動画`video/original/{userId}/{suffix}`、サムネイル`thumbnail/{userId}/{suffix}`、商品画像`item-image/{userId}/{itemEditingId}_{index}_{now}_{requestId}`、色画像`attributes/{userId}/{itemEditingId}_{uiId}_{now}_{requestId}`を確認する。

| ID | レベル | 条件 | 期待結果 |
| --- | --- | --- | --- |
| S01 | H/U | 新規動画name/typeあり・uploaded=false | POST署名key/MIME/500MiB・公開URL一致 |
| S02 | H | 新規条件不成立 | converted→original→nullのnullish再利用。converted空文字はfallbackせずE02 |
| S03 | H/U | 変換済み動画＋新規指定 | 新URLをoriginalへ、convertedはコピーなし |
| S04 | H/U | サムネイル新規/既存/欠落 | 対応署名/URL、最終欠落はE03 |
| S05 | H/U | 新規/既存商品画像混在 | 元indexで再利用・署名、確定配列は入力順 |
| S06 | H/U | uploadedだが既存index/URL欠落・非配列 | 確定配列に入れず、nameをURL採用しない。全欠落E04 |
| S07 | H | 新規商品画像name空・typeあり | 署名する |
| S08 | H/U | 新規type null/空 | 署名なし、残りを詰めて保存、署名indexは元位置 |
| S09 | H/U | 新規色画像 | uiId入りkeyと両辞書の対応 |
| S10 | H/U | 省略/uploaded色画像・色順変更 | 既存uiId再利用、不存在は画像なし |
| S11 | H/U | 新規色画像name/type不足 | 署名・既存fallbackなし |
| S12 | H/U | 色削除/uiId変更/既存色非配列 | bodyにない色を持ち込まない、S3削除保証なし |
| S13 | H | 新規index1のみ/1と3、署名完了順変更 | 全完了後圧縮、署名は元index昇順、欠落/重複なし |
| S14 | H | 色署名逆順完了 | 全完了待機、辞書対応維持 |
| S15 | H/U | 新規動画POST署名undefined | VIDEO_SIGNED_URL_UNAVAILABLE・500、後続署名・数値・transactionなし |
| S16 | H | 各署名reject | 同一例外・次段階なし、開始済み同群Promise回収 |
| S17 | H/U | 同時刻・別UUIDで2要求 | 全種類のkey分離、1要求内now/UUID共有、結果非混在。helperの独立検証と同ID保存成功を混同しない |
| S18 | H | 動画/最後の商品署名を保留 | 次段階未開始、解放後進行 |

## 9. ブランドとservice

| ID | レベル | 条件 | 期待結果 |
| --- | --- | --- | --- |
| B01 | H/U | 有効brandId＋名前 | ID優先、不要検索/作成なし。不在IDは名前fallback |
| B02 | H/U | ID未指定/不在、名前null/空 | 両関連null、名前検索なし |
| B03 | H/U | brand付きalias | 両方採用、後段なし |
| B04 | H/U | aliasなし/未紐付あり、直接brandあり | brandのみ採用 |
| B05 | H/U | 未紐付aliasあり・brandなし | 既存alias再利用 |
| B06 | H/U | 未登録名・元JS length2以上 | 同じtでcreateAliases、結果のbrand/alias採用 |
| B07 | H | 元名0/1/2・空白2・絵文字1 | 0検索なし、1検索のみ、JS length2以上は作成候補。保存長検証は別 |
| B08 | H | 全角/大小文字/カタカナ/空白 | NFKC→小文字→ひらがな→空白除去、元名と正規化名区別 |
| B09 | H/U | 各brand依存保留/reject | 優先順位・待機・同一例外、本体/画像/削除なし |
| SV01 | S | 初回getMyItemEditing | where id＋seller_id、transaction/lockなし、返却/null/例外伝達 |
| SV02 | S/U | t付きgetMyItemEditing | 同じtとt.LOCK.UPDATE。usecase再認可の呼出しはAF-AUTH01 |
| SV03 | S | CreateItemDraft data/t | Model.createへ同じdata/t、モデル参照を返す |
| SV04 | S | 画像モデル/urls/t | setDataValue→changed→save、同じ配列/t、空配列も引渡し |
| SV05 | S | create/save reject/保留 | 同一例外、完了待機 |
| SV06 | S | マスター/ブランド/別名検索 | ID/name_normalized/includeの引数、返却/null/例外 |
| SV07 | S | 新規alias・tあり | bind付きadvisory lock→再検索→必要ならcreate |
| SV08 | S | ロック後aliasあり | 既存モデル返却、createなし |
| SV09 | S | ロック/再検索/作成reject | 同一例外、後続なし |
| SV10 | S | tなしalias作成 | ロック/再検索なし。並行一意性を保証しない |

元行destroyは既存 `deleteItemEditing` を使い、同じモデル/t・await・例外伝播をAF-CONSUME01〜03で検証する。共通service自体の無関係な仕様変更はしない。

## 10. 実DB・制約・永続化

`.env.test`由来のPostgreSQL **test_dbのみ**を使う。DB import前にNODE_ENVと接続DB名を検査し、dotenv既定読込みも検証済み値に限定する。アプリ・models・observer・競合用の全接続で設定と`SELECT current_database()`を確認してからseedする。秘密値を出力しない。

現行Model列と必要な型・NULL・ENUM・FK・既定値を確認する。削除済み列を旧migrationから要求しない。不足/不一致は中断し、migration・sync・DB作成・全件削除・TRUNCATE・sequence巻戻しで補正しない。fixtureとafterCreate hookで自作IDを追跡し、rollback済みIDも含めて記録する。処理回収後に下書き→編集→公開商品→別名/ブランド/マスター→ユーザーの実FK順で自作IDだけを削除し、残存0・hook/spy解除・全接続closeまで確認する。

commit/rollback後の新規SELECTを使い、変更済みモデルだけで結果を断定しない。gender/ageのNOT NULL・ENUM、画像最大10件のモデル検証（DB配列長CHECKとは区別）、VARCHAR255、JSONB、所有者/マスター/ブランドFKを直接検証とusecase経路に分ける。

| ID | レベル | 条件 | 期待結果 |
| --- | --- | --- | --- |
| D01 | D | 標準成功・observer再取得 | 下書き1行・全保存値・返却ID・画像一致、元編集行なし、非対象行不変 |
| D02 | D | 元行に変換/sale/recommend/割引値 | 作成先は所定既定値、seller_idは認証ユーザー、元行消費 |
| D03 | D | nullable/属性境界 | JSONB省略・空配列・0・小数・日本語・nullableFK再取得 |
| D04 | D/V | gender/age全値/null/不正、直接Model/SQL | schema受理値保存・null補完、不正は保存前拒否。直接NOT NULL/ENUM拒否も維持 |
| D05 | D | 確定1/9/10/11、入力11/確定10 | 1〜10保存、確定11はINSERT前400、service直接画像11はモデル拒否 |
| D06 | D/V/H | 保存文字列/新規brand255/256 | schema/helperで保存前拒否、直接モデル/SQLのVARCHAR制約も維持 |
| D07 | D/H | nullable/空白/0/範囲外/不存在ID | null/空白はnull保存、不正数は400、実在しない有効IDは対応404 |
| D08 | D | 作成後alias/brand削除 | 対象FKだけSET NULL、他列不変 |
| D09 | D | SQLでNOT NULL/不正ENUM/不存在FK | 実DB制約の型/code確認、bind・rollback・非対象行不変 |
| D10 | D | 非対象編集/下書き/公開商品併置 | 操作した元編集行のみ消費、他行全列不変。削除済み列の有無を入力条件にしない |

## 11. 状態遷移

| ID | レベル | 操作 | 期待結果 |
| --- | --- | --- | --- |
| ST01 | D | 下書きなし→作成成功 | 下書き1行、元編集行なし、公開Item増加なし |
| ST02 | D | 既存下書きあり→成功後同ID再送 | 404、別行追加なし、先行下書き・既存行不変 |
| ST03 | U/D | 元initial10/current4、入力8 | 新下書きinitial=current8・比率0.2、元行消費 |
| ST04 | H/D | 変換済み再利用/新規指定 | 確定URLを保存、元行消費。helper単体では取得行を変更しない |
| ST05 | D | 元に色/素材、入力は空 | 作成先へ旧属性を持ち込まず、元行消費 |
| ST06 | U/D | 元video_status null/任意既存値 | statusで作成可否を追加しない、成功時元行消費 |
| ST07 | D | 画像保存失敗 | 下書き/新規別名増分0、元行保持 |

## 12. transaction・非同期・元行消費の追加ケース

| ID | レベル | 条件/手順 | 期待結果 |
| --- | --- | --- | --- |
| T01 | U/S | 正常 | 同じtを再取得/別名/本体/画像/元行削除へ、managed transaction1回 |
| T02 | U | 各依存・削除・transaction完了を個別保留 | 前段完了まで後続なし。削除とcommit完了まで成功結果なし |
| T03 | D | 本体INSERT後・画像前保留 | t内で下書き可視、observerでは不可。commit後下書き可視・元行不可視 |
| T04 | D | 別名INSERT後本体失敗/本体INSERT後画像失敗 | 本体/新規別名rollback、既存別名・元行保持 |
| T05 | D | 画像save後に意図的throw | 本体/新規別名rollback、元行保持 |
| T06 | D | 新別名＋本体＋画像をcommit前保留 | observerは新規行を見ず元行を見る。解放後下書き/別名可視・元行なし |
| T07 | D | rollback後同body再試行 | 成功回だけ下書き/別名1行、元行消費。採番巻戻しなし |
| T08 | U/H | URL/数値/master不正 | transaction0回、署名取消し/S3削除なし |
| T09 | D | master照合後別接続削除→INSERT | FK失敗、新規別名/下書きrollback、元行保持 |
| AF-CONSUME01 | U/D | 正常画像保存後に元行削除 | 再認可モデルを同じtで1回削除、保存値/返却ID維持、commit後元行なし |
| AF-CONSUME02 | U/D | deleteItemEditingがreject | 同一例外・成功結果なし、本体/画像/新規別名rollback、元行保持 |
| AF-CONSUME03 | U | deleteItemEditingをdeferred保留 | callback/usecase未完了、解放後もtransaction完了まで応答しない |
| AF-CONSUME04 | D | 成功後同編集ID/body再送 | 初回取得で404、署名/transactionなし、下書き/別名増分0、先行保存値不変 |
| AF-CONSUME05 | D | 実destroy完了後ラッパーthrow | t内元行なしを確認後rollback。observer再SELECTで元行全列復元、本体/新規別名なし |
| AF-CONSUME06 | D | 同一IDの先行が行ロック保持・後続実待機→先行commit | 先行1件だけ保存・元行消費、後続再認可null/404、追加下書き/別名なし |
| AF-CONSUME07 | D | 同一IDの先行が行ロック保持・後続実待機→先行rollback | 元行削除rollbackで再認可可能、後続だけ成功・消費、失敗側本体/別名なし |

実COMMIT応答喪失・通信切断時の成否不明状態は通常DB試験から保証しない。transaction Promiseの模擬rejectは例外伝播だけのUとして報告する。

## 13. 再送・並行処理

| ID | レベル | 条件 | 期待結果 |
| --- | --- | --- | --- |
| Q01 | U/D | 同じ編集ID/bodyで逐次2回 | 1回目成功、2回目404、保存行1件。helper値の再現検証は別編集IDで行う |
| Q02 | H/D | 同時刻・別UUID、独立編集IDで新規メディアを2回保存 | 別URL/署名の2行、色画像まで返却署名と対応。同一編集ID再送はQ01 |
| Q03 | D | 独立編集ID2件・同じ未登録ブランド名で逐次作成 | 下書き2行でalias1行共有、各元行消費 |
| Q04 | D | 画像失敗後同ID再試行 | T07、成功回だけ保存 |
| Q05 | D | サーバー成功後の応答喪失を想定し同ID再送 | 404、重複なし。成功応答の再返却や実通信断再現を保証しない |
| P01 | D | 同一元行を両初回取得、A/B各先行順でロック競合 | 先行commitのみ成功、後続404、保存1行。AF-CONSUME06 |
| P02 | D | 別所有者/別編集行を交差 | 両成功、所有者/全JSONB/メディア非混在、両元行消費 |
| P03 | D | 同一元行、先行保存後rollback・後続待機 | 後続だけcommit、保存1行、元行消費。AF-CONSUME07 |
| P04 | D | 別編集行/同正規化名、A別名lock→B実待機→Acommit | 下書き2行・alias1行、B再検索で共有、両元行消費 |
| P05 | D | P04でA画像失敗rollback | A元行保持・作成先なし、Bは別名を新規作成して成功/元行消費 |
| P06 | D | 別編集行/異なるhashtext、Aロック保持中B完了 | 別名ロックでBを妨げず別alias、B元行消費 |
| P07 | D | 初回取得後メディア/属性を別接続で更新commit | Aは初回snapshot再利用で保存、成功後更新済み元行も消費。最新値採用保証なし |
| P08 | D | 初回取得後所有者変更/元行削除commit | 再認可404、下書き/新規別名なし、他者所有行を削除しない |
| P09 | D | 解決後brand/aliasを別接続削除→INSERT | FK失敗、作成先rollback、元行保持 |
| P10 | H | 2要求の署名を交差・画像/色逆順完了 | 元index/uiId/request対応、非混在・欠落なし |

独立transaction/接続でロック取得→後続開始→`pg_stat_activity`/`pg_blocking_pids`等による実待機確認→解放→回収を制御する。READ COMMITTEDの実設定、pool・上限時間を確認し、固定sleep/Promise.allだけで排他を証明しない。両方がロック取得した後のgateを置かない。finallyで全処理を解放・回収してから自作IDをcleanupする。別名の共通serviceを通さない任意INSERTまで一意性を保証しない。

## 14. Controller・Router

| ID | レベル | 条件 | 期待結果 |
| --- | --- | --- | --- |
| C01 | C | 認証A・validatedBodyあり、未検証body/paramsに別値 | `{userId:A,body:req.validatedBody}`同一参照を1回 |
| C02 | C | usecase成功・署名値/null/空配列/辞書 | 200、itemDraftId＋署名4項目完全一致、nextなし |
| C03 | C | AppError/通常Error | 同じErrorをnext1回、成功応答なし |
| C04 | C | usecase保留 | 完了前応答なし |
| R01 | R | tokenなし/Bearer不正/不正署名/期限切れ | 401、usecaseなし、レート枠未消費 |
| R02 | R | 正常認証/正常body | 200、認証ID/parse済body、5項目返却 |
| R03 | R | 不正body、body/queryにidを追加 | INVALID_BODY・400、usecaseなし。未知idはparamsの代替にならない |
| R04 | R | 同一ユーザー5回→6回、別ユーザー、10分経過 | 正常5回200→429、別枠・時間更新後再開 |
| R05 | R | 不正body5回→正常6回目 | 不正も枠消費、6回目429 |
| R06 | R | 無認証/制限超過＋不正入力 | 401/429優先、validator/usecaseなし |
| R07 | R | POST /api/item-draft/11 | 定義外404 |

最小Express＋実Router・JSON parserで検証する。観測用error middlewareは共通errorHandlerの実接続を保証しない。JWTはテスト専用、実環境鍵を読まない。レートストアを分離しtimer操作をHTTP I/Oから分ける。HTTP成功対照を設け、Cだけでroute到達性を保証しない。

## 15. 旧観測・追加ケースとの対応

| ID | 現在の扱い |
| --- | --- |
| O01 | 旧params400観測は履歴。R02/R03・AF-R01〜05へ移行し正常POSTを確認 |
| O02 | 旧所有者null/旧列観測は履歴。N02/D02・AF-OWN01〜03で認証所有者保存・偽装除去・rollbackを確認。旧AF-OWN04の削除済み列継承検証は廃止 |
| O03 | 旧再認可なし観測は履歴。P08・AF-AUTH01〜04で再認可・ロック・404を確認 |
| O04 | 初回メディアsnapshot利用は維持。ただし成功後元行を残す期待は撤回しP07/AF-AUTH05で消費確認 |
| O05 | 旧署名欠落でも作成の観測は履歴。S15・AF-SIGN01〜04で500/停止、既存動画署名null許容 |
| O06 | 旧不正IDがDBへ到達する観測は履歴。I01〜04・AF-I01/02で未選択null/正整数範囲/400 |

AF-V01/02はENUM/null補完・文字数、AF-IMG01は確定画像上限、AF-DB01はQ02色画像対応、AF-P01はP02全属性非混在、AF-SAFE01/AF-NAME01/AF-GUARD01は待機回収・ケース識別・ロック診断の補強。既存IDの責務を維持し、今回の元行消費はAF-CONSUME01〜07と対応付ける。旧Q01/Q05/P01の複数行作成期待は撤回し、Q02/Q03の2成功は独立編集IDに限定する。履歴・実行件数はレポートへ集約する。

## 16. 実行計画・完了条件

元行消費・再送404・失敗rollback・非対象行不変・行ロックcommit/rollback競合をP0とする。既存の入力・所有権・保存・署名・HTTP/helper/service回帰を影響範囲に応じて実行する。ケースID数と展開後テスト件数は分けて集計する。

非DBコマンドは配置節、実DBは安全ガード確認後 `server/` で以下を実行する。

```bash
npm run test:run -- test/integration/database/itemDraft/createItemDraft/database.test.ts test/integration/usecases/itemDraft/createItemDraft/databaseTransactions.test.ts test/integration/usecases/itemDraft/createItemDraft/databaseConcurrency.test.ts --maxWorkers=1
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

ファイル間fixture/hook干渉を避けるため1workerとし、ケース内競合は維持する。lint通常対象外の変更test配下TSは既存ESLint/typescript-eslintで追加検査し、共有設定は変えない。設計/コード/fixture/報告の整合、対象テスト・静的検査成功、全接続のDBガード・cleanup・終了、必須ケース未実施なしを完了条件とする。文書更新だけで実行成功とみなさず、実S3/AWS・実COMMIT通信断・ブラウザE2E未検証を区別してレポートへ残す。
