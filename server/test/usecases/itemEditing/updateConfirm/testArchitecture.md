# 商品編集中データの確定更新：テストコード設計書

## 2026-10-10 DB追加検証の設計（以下の初回設計に優先）

編集は本ディレクトリ内に限定する。実usecase・helper・service・モデルと既存PostgreSQLスキーマを使用し、S3通信のみ置換する。障害注入・並行順序制御のspyも実処理を呼び、任意のsleepは使わない。

- `databaseSetup.ts`：実dotenvで `.env.test` だけを読み、既定dotenv呼出しにもその値を返す。他ファイルの明示指定、NODE_ENV不一致、URL/Sequelize/SELECT current_database()のDB名不一致は停止する。migration、sync、truncateはしない。
- `databaseFixtures.ts`：固有名のユーザー・マスター・商品を作成。作成したIDだけを外部キーの順で削除し、別接続による再取得でcommit/rollbackを確認する。
- `database.test.ts`：N02〜N08、E01、V09〜V11、I03〜I04、ST01〜ST06・ST08、D01・D03〜D06・D08〜D10、Q01〜Q03、O01〜O02の永続化・制約・重複実行。
- `databaseTransactions.test.ts`：E12〜E13、ST07、D07、T03〜T05・T07、Q05。本体/画像更新失敗時の全列rollback、別接続可視性、再試行。
- `databaseConcurrency.test.ts`：P01〜P05・P08、O05。実SELECT後にdeferredで停止し、指定順commit、別商品並行、片方rollback、別名同時作成、所有者変更・削除を検証。SQLと最終行を併せて確認する。

初回報告から変わった契約：現行の共通helperは `src/usecases/shared/` にある。空画像はITEM_IMAGE_NULLで保存前に拒否。ブランド名検索結果・新規aliasは保存へ採用され、既存aliasを逐次再利用する。resolveBrand→createAliasesへ同じtransactionが渡されるため、T05/Q05はaliasもrollbackすることを期待する。並行作成の一意性は実DBを確認して観測として記録する。分類のnullはDBで許可された列だけに設定し、NOT NULLのlayerはnull fixtureを作らない。

境界はgender/ageの全定義値・null・不正値、画像1〜10/11件、name/title/freeTextの0/255/256文字、各IDの0/空白/負数/小数/Infinityを個別展開する。各失敗で更新前後の全列一致、必要な後続未実行を確認する。正常時は全保存項目と非対象行の不変を確認する。

実行：`server/` で対象ディレクトリのVitest、lint、アプリ/テストの型検査を行う。安全条件に違反した場合はテストを中断し、ユーザーの判断を待つ。結果と旧報告からの差分はtestReport.md/afterFix.mdへ追記する。

## 1. 目的と対象範囲

対象は `server/src/usecases/itemEditing/updateConfirm.ts` の `updateItemEditingConfirmUseCase()`。正常系、異常系、境界値、条件分岐、状態遷移、DB整合性、トランザクション、重複実行、並行処理を確認するための設計をまとめる。

本書は現行コードを根拠とする。テストコードの実装、既存コードの修正、既存エラーへの対応、マイグレーションの実行は今回の対象外とする。期待結果がコードだけでは確定しないケースは「観測」と明記し、未実装の保証を成功条件にしない。

### 調査した関連ファイル

パスは `server/` からの相対パス。

| 責務 | ファイル |
| --- | --- |
| usecase | `src/usecases/itemEditing/updateConfirm.ts` |
| URL生成・数値変換・マスター検証・ブランド解決 | `src/usecases/itemEditing/shared/{buildSignedUrls,validateNumber,validateMaster,resolveBrand}.ts` |
| 取得・更新 | `src/services/itemEditing/{query,command}.ts` |
| マスター取得 | `src/services/{categories,itemConditionOption,shippingDayOption,shippingServiceOption,todouhuken}.ts` |
| ブランド取得・別名作成 | `src/services/{brands,brandAliases}.ts` |
| controller・route | `src/controllers/itemEditing.ts`、`src/routes/itemEditing.ts`、`src/routes/index.ts` |
| 入力検証 | `src/middleware/validate/{validateBody,validateParams}.ts`、`src/validators/body/itemEditing.ts`、`src/validators/params/id.ts` |
| 認証・制限・エラー | `src/middleware/authMiddleware.ts`、`src/middleware/rateLimit/itemEditingRateLimit.ts`、`src/middleware/errorHandler.ts`、`src/errors.ts` |
| 補助処理 | `src/utils/{toNullableNumber,normalizeJapanese}.ts`、`src/utils/s3/{signedUrl,videoPresignedPost}.ts` |
| モデル・型 | `src/models/{item_editing,brand_aliases}.ts`、`src/types/serviceType/itemEditing.ts` |
| DB定義資料 | `migrations/20261005114144-create-item-editing.js`、`migrations/20261006044423-update-column-item-editing.js` |
| 既存テストの形式 | `test/usecases/shopSignup/signup2.test.ts`、`test/AGENTS.md` |

実DBのスキーマは未確認。DBテストの実装時は、反映済みスキーマを確認して制約に関する期待結果を確定する。

## 2. 処理の流れと責務の境界

1. Routerの `PUT /:id` は、認証 → ユーザー単位のレート制限 → params検証 → body検証 → controller の順に処理する。
2. Controllerは `Number(req.params.id)`、`req.user.id`、`req.validatedBody` をusecaseへ渡す。
3. `getMyItemEditing` は `id` と `seller_id` の両方で検索する。未取得なら `ITEM_EDITING_NOT_FOUND / 404`。
4. `buildSignedUrls` が既存URLと新規アップロード用URLを組み立てる。
5. 動画URL、サムネイルURL、商品画像配列を順番に確認する。
6. ID文字列を数値またはnullへ変換し、カテゴリ・商品状態・配送マスターの存在を確認する。
7. ブランドを解決する。条件によってブランド別名を作成する。
8. managed transaction内で `updateConfirm`、`updateItemEditingImage` を順に実行する。
9. transaction成功後、署名情報4項目を返す。Controllerはそれを200のJSONとして返し、例外は `next(err)` に渡す。

### 設計時に区別する事項

- 入力schemaはusecaseの外側にある。usecaseを直接呼んでも `INVALID_BODY` は発生しない。
- 所有権の検索、URL生成、マスター取得、ブランド解決は商品更新transactionの外側にある。
- URL発行はファイルのアップロード完了を意味しない。S3への実アップロード・動画変換・公開処理はこのusecaseの責務ではない。
- `video_status` の絞り込み・更新はない。公開状態への遷移を期待しない。
- `if (!finalImageUrls)` は空配列を拒否しない。実helperは常に配列を返すため、`ITEM_IMAGE_NULL` は通常の入力では到達しない防御分岐である。
- Router単体テストはテスト用Expressアプリへ明示的にマウントする。調査時点の `routes/index.ts` にはこのRouterの登録がないため、Router単体の成功を実アプリのエンドポイント到達性の証明としない。

## 3. テストの分け方

| 記号 | レベル | 実処理にする範囲・確認目的 |
| --- | --- | --- |
| U | usecase単体 | usecaseを実行。service、shared helper、transactionをモックし、引数・更新値・呼出順序・例外伝播を確認 |
| H | helper単体／usecaseとの組合せ | URL生成、数値変換、マスター検証、ブランド解決を実行。DB serviceとS3署名関数をモックし、内部の分岐を確認 |
| V | validator・middleware単体 | 実schemaのsafeParseと実validateBody／validateParamsを確認 |
| C/R | controller単体／Router結合 | usecaseをモック。Cは引数とnext、Rは実validator・認証・レート制限の接続を確認 |
| D | DB結合 | 実usecase・service・Sequelize・専用PostgreSQLを使用。S3署名のみモックし、再取得した永続データを確認 |

Vitestを使用し、Router結合には既存のSupertestを使用する。新しいライブラリは追加しない。Uで全helperをモックしただけでは、所有権のSQL条件、URLの引き継ぎ、マスター検証、rollbackを検証したことにはしない。

### 共通データとアサーション

- 所有者A（例：7）、別ユーザーB（例：8）、Aの編集中商品（例：11）、Bの商品、各マスターの有効レコードを用意する。
- 標準bodyはschemaを通過させる。価格300、在庫1、gender=`unisex`、age=`both`、有効なID文字列、商品画像1枚を基本とする。
- 既存データに動画・サムネイル・商品画像の別々のURL、複数のuiIdと属性画像を用意する。変換済み動画あり／なしは別fixtureにする。
- 正常系は既存ブランドIDを用い、意図しない別名作成を避ける。ブランド関連ケースだけ専用fixtureへ差し替える。
- 各テストでbody・JSON属性・モデル相当オブジェクトを新しく作り、前のテストの変更やモック設定を引き継がない。
- 更新前後で異なる価格・名称・画像を使用する。DBテストでは元のモデルインスタンスではなく、新たなSELECTで検証する。
- AppErrorは `instanceof AppError`、`code`、`statusCode` を確認する。予期しない例外は同じErrorオブジェクトが伝播することを確認する。
- 異常系では、例外だけでなく「後続処理が実行されないこと」「書込みの有無」も確認する。
- Uのtransactionモックはcallbackへ同一のtransactionオブジェクトを渡し、そのPromiseをawaitする。rollback自体はDで検証する。

## 4. 正常系・更新データの対応

| ID | レベル | 条件・入力 | 期待結果 |
| --- | --- | --- | --- |
| N01 | U | 全項目を指定して更新 | 所有権取得 → URL生成 → 数値変換 → マスター検証 → ブランド解決 → transaction → 本体更新 → 画像更新の依存順になる。戻り値は署名情報4項目のみ |
| N02 | U/D | 商品・動画・配送情報を変更 | 下表の全保存項目が一致する。更新対象ID・所有者を変更しない |
| N03 | U/D | detailとsummaryがnull／空文字／通常文字列 | nullだけ空文字へ変換。空文字と通常文字列はそのまま保存 |
| N04 | U/D | 全体・色・サイズの在庫がそれぞれ0／1／複数 | 各階層のinitialとcurrentが入力値になり、low_stock_ratioは0.2。0を1に置換しない |
| N05 | U/D | 色・サイズ・素材が複数 | 入力順、uiId、色、サイズ、在庫、素材名、比率を保持。色画像は配列順ではなくuiIdで対応する |
| N06 | U/D | colorVariants、materialsが空、ある色のsizesが空 | colorVariantsとmaterialsは更新オブジェクト上undefined、sizesは空配列。DBのJSON表現は再取得して確認 |
| N07 | U/D | カテゴリ分類あり／各分類null／カテゴリ未選択 | body_category・lifestyle_category・layerはDB取得値から設定し、nullまたはカテゴリなしはundefined |
| N08 | U/D | brand、aliasが両方あり／brandのみ／両方なし | brand_idとbrand_aliases_idが解決結果のIDまたはnullになる |
| N09 | U | 任意の色名なし、属性画像のuiIdに対応URLなし | colorとimage_urlはundefined。空文字の色名・サイズ名は空文字のまま |
| N10 | U | 型境界外の防御分岐として在庫値をnull／undefinedにしたfixture | 全体・色・サイズ在庫は1へ補完。通常HTTP経路では到達しないことを明記し、schemaの正常系とは分離 |

### 保存項目の確認表（N02の詳細）

| 保存先 | 入力・計算元 |
| --- | --- |
| name / detail | itemMeta.name / itemMeta.detail ?? 空文字 |
| price / before_price | いずれもbody.price |
| first_image_url / image_url | finalImageUrls[0] / finalImageUrls全体 |
| category_id / item_condition_id | 数値変換したcategory.id / condition.id |
| gender_type / age_type | genderAge.gender / genderAge.age |
| brand_id / brand_aliases_id | ブランド解決結果のID、なければnull |
| attributes.inventory | allInventoryからinitialとcurrent、固定値0.2 |
| attributes.colorVariants | uiId・color・色在庫・uiId対応画像・サイズとサイズ在庫 |
| attributes.materials | name・ratioのみ |
| attributesの分類3項目 | categoryOptionから取得 |
| title / summary | videoMeta.title / videoMeta.summary ?? 空文字 |
| original_url / thumbnail_url | helperが返す確定URL |
| shipping_day_id / shipping_service_id / shipping_place_id | shippingの各IDを数値変換 |
| shipping_service_free_text | shipping.freeText（null・空文字も保持） |

## 5. 異常系・処理打切り

表の各依存処理は、ほかの条件を正常にして個別に失敗させる。

| ID | レベル | 条件 | 期待結果・未実行処理 |
| --- | --- | --- | --- |
| E01 | U/D | 対象IDなし／他ユーザー所有／seller_idがnull | `ITEM_EDITING_NOT_FOUND / 404`。URL生成以降は未実行。Bの商品は変更されない |
| E02 | U/H | videoUrlがnullまたは空文字 | `VIDEO_URL_NULL / 400`。数値検証以降は未実行 |
| E03 | U/H | 動画は有効、thumbnailUrlがnullまたは空文字 | `THUMBNAIL_URL_NULL / 400`。数値検証以降は未実行 |
| E04 | U | helperモックのfinalImageUrlsをnull／undefinedにする | `ITEM_IMAGE_NULL / 400`。防御分岐専用。通常helper経由の入力ケースとは区別 |
| E05 | H/U | 各IDに非数値文字列を1項目ずつ指定 | `INVALID_NUMBER / 400`。マスター検証、ブランド解決、商品transactionは未実行。URL生成は先に完了し得る |
| E06 | H/U | カテゴリだけ存在しない | `CATEGORY_NOT_FOUND / 404`。以降のマスター・ブランド・商品更新は未実行 |
| E07 | H/U | 商品状態だけ存在しない | `ITEM_CONDITION_NOT_FOUND / 404`。配送マスター以降は未実行 |
| E08 | H/U | 配送日だけ存在しない | `SHIPPING_DAY_NOT_FOUND / 404`。配送サービス以降は未実行 |
| E09 | H/U | 配送サービスだけ存在しない | `SHIPPING_SERVICE_NOT_FOUND / 404`。発送元以降は未実行 |
| E10 | H/U | 発送元だけ存在しない | `PLACE_NOT_FOUND / 404`。ブランド以降は未実行 |
| E11 | U/H | 取得service、各S3署名、各マスターservice、各ブランドserviceでreject | 元の例外を伝播し、商品transactionを開始しない。Promise.all内ですでに開始した署名処理まで取消されるとは期待しない |
| E12 | U/D | updateConfirmがreject | 画像更新は未実行。usecaseはrejectし、DBは更新前のまま |
| E13 | U/D | 本体更新成功後、画像saveがreject | 成功戻り値を返さない。DBは本体・画像とも更新前へrollback |
| E14 | U | transactionの開始または完了でreject | 元の例外を伝播。開始失敗時はcallback未実行。commit失敗時の実DB結果は障害条件に依存するためモックでrollback成功を断定しない |
| E15 | U/H | 複数の不備を同時指定 | 商品未取得がURL不備に優先、動画不備がサムネイル不備に優先、数値不正がマスター不在に優先する |

## 6. 入力検証・境界値

Vの拒否ケースは `INVALID_BODY / 400`（paramsは `INVALID_PARAMS / 400`）になり、controller/usecaseが呼ばれないことまでRの代表ケースで確認する。usecaseにschema検証を追加した前提にはしない。

| ID | レベル | 対象・入力値 | 期待結果 |
| --- | --- | --- | --- |
| V01 | V | price：299、300、301、999999、1000000、1000001 | 300〜1000000のみ受理 |
| V02 | V | price：0、負数、小数、数値文字列、null、欠落 | 拒否。数値文字列の自動変換なし |
| V03 | V | 全体／色／サイズのinventory：-1、0、1、小数、文字列、null、欠落 | 0以上の整数のみ受理。各階層を独立に確認 |
| V04 | V | material.ratio：-0.01、0、0.01、99.99、100、100.01 | 0〜100は小数も受理。null・欠落・文字列は拒否 |
| V05 | V | category.level：0、1、2、1.5、文字列 | 1以上の整数のみ受理 |
| V06 | V | 必須オブジェクト、配列、各必須フィールドを1つずつ欠落／型違い | 拒否。nullableなフィールドも、optionalでなければ欠落は拒否 |
| V07 | V/H | video／thumbnailを省略、name／typeを省略、uploadedを省略 | ファイル自体とname・typeの省略は受理。ファイルがある場合のuploaded欠落は拒否。URL生成条件は別途S系で検証 |
| V08 | V | category.id、brand.id/name、shipping各値、summary、detailがnull | 受理。condition.idのnullは拒否。condition.idの空文字は受理 |
| V09 | V/D | gender・age：定義済み文字列／null／任意文字列 | schemaはいずれも受理。DBはNOT NULL・ENUM制約があるため、null／不正値の永続化はDB側で拒否し商品更新をrollback |
| V10 | V/D | itemImages：0、1、10、11件 | schemaはすべて受理。実際に確定する画像URLが11件ならモデル検証で拒否。0件はO01、1・10件は保存を確認 |
| V11 | V/D | name、title、shipping.freeText：空文字、255文字、256文字 | schemaはいずれも受理。DBのVARCHAR(255)対象は256文字を拒否しrollback。日本語文字列でも確認 |
| V12 | V/H | 空のcolorVariants・sizes・materials、素材比率合計が100以外、重複uiId、空uiId | schemaには件数下限・合計値・一意性の制約なし。受理した後の現行挙動を確認し、独自の拒否を期待しない |
| V13 | V/H | 商品画像typeがnull／空文字、ファイルtypeが任意文字列 | schemaは受理。typeがfalsyなら署名を作らない。MIME許可リストの検証は行われない |
| V14 | V/C | bodyにseller_id、status等の未知キーを追加 | parse後の未知キーは除去され、req.validatedBodyへ格納。所有者にはreq.user.idを使用 |
| V15 | V/R | params.id："1"、"0"、"-1"、"1.5"、"abc" | 正の整数として変換可能な値のみ受理。正常時はvalidatedParamsに数値が入る |
| V16 | V | 成功／失敗時のvalidateBody | 成功時はparse済みデータを設定しnextを1回呼ぶ。失敗時はAppErrorをthrowし、正常系のnextを呼ばない |
| V17 | V/H | 在庫の大きな整数、長い説明文、多数の色・サイズ | 明示的な業務上限がない項目に架空の上限エラーを設定しない。代表的な複数件で値の保持を確認。負荷試験は別範囲 |

### 数値変換とマスター照合

以下はcategory.id、condition.id、shipping.day/service/place、brand.idに対し、schemaで許される型の範囲でパラメータ化する。

| ID | レベル | 入力 | 期待結果 |
| --- | --- | --- | --- |
| I01 | H | null、空文字 | nullへ変換。condition.idのnullはHTTPでは到達しない |
| I02 | H | "1"、"01"、" 1 "、"1e2" | Numberの結果である1、1、1、100を渡す |
| I03 | H/D | "0"、空白だけの文字列 | 0へ変換。5種類のマスター照合はスキップするが保存値は0。参照先ID=0がなければDB外部キー制約で拒否 |
| I04 | H/D | "-1"、"1.5"、"Infinity" | 変換関数はNaN以外を拒否しない。後続serviceへ渡る値を確認。DBの取得結果・型制約に応じた失敗を観測し、INVALID_NUMBERと断定しない |
| I05 | H | "abc"、"NaN" | INVALID_NUMBER。複数不正時はcategory→condition→day→service→place→brandの順に停止 |
| I06 | H | 各マスターIDがnull／0／有効値 | nullと0は取得なし、有効値は対応serviceへ正しいキー名で1回渡す。brandId=0はresolveBrandではgetBrandの対象となる |

## 7. 署名URL・既存画像の条件分岐

Date.nowを固定し、公開S3ドメインと署名関数をモックする。署名文字列そのもののAWS実装をusecaseテストで再現しない。

| ID | レベル | 条件 | 期待結果 |
| --- | --- | --- | --- |
| S01 | H/U | 動画のname・typeあり、uploaded=false | POST署名へ `video/original/{userId}/{itemEditingId}_{now}`、contentType、上限 `500 * 1024 * 1024` を渡す。original_urlは対応する公開URL |
| S02 | H | 動画省略／uploaded=true／nameが空・欠落／typeが空・欠落 | 署名なし。converted_url → original_url → nullの順に採用。空文字はnullish fallbackの対象外で、最終チェックで拒否される |
| S03 | H | 変換済み動画がある状態で新規動画を指定 | 新規URLをoriginal_urlに使用。converted_url自体のクリアやvideo_status変更はこのusecaseでは行わない |
| S04 | H | サムネイルの新規指定／既存利用／必須情報不足 | 新規なら `thumbnail/{userId}/{itemEditingId}_{now}` を署名。それ以外は既存thumbnail_urlを利用し、なければE03 |
| S05 | H | 商品画像の新規・既存を交互に指定 | 新規は `item-image/{userId}/{itemEditingId}_{index}_{now}`。既存はDBの同じ入力indexのURL。確定画像は入力順に並ぶ |
| S06 | H | uploaded=trueでDBの該当indexがない／image_urlがnull | 対応画像は確定配列に追加しない。ユーザーのnameを既存URLとして使用しない |
| S07 | H | 商品画像nameが空、typeあり、uploaded=false | 商品画像の署名条件はnameを参照しないため署名される |
| S08 | H | 新規商品画像typeがnull／空文字 | 署名せず確定URLにも追加しない。全画像が該当する場合はO01へ |
| S09 | H | 色画像name・typeあり、uploaded=false | `attributes/{userId}/{itemEditingId}_{uiId}_{now}` を署名。署名辞書と確定URL辞書のキーがuiIdに一致 |
| S10 | H | 色画像省略／uploaded=true、色配列を並び替え | 既存のuiIdが一致する画像を引き継ぐ。該当uiIdに既存画像がなければundefined |
| S11 | H | 色画像uploaded=falseだがname／typeが不足 | 新規署名なし。既存画像へのfallbackもなく、確定属性画像辞書に入らない |
| S12 | H | 色を削除／新しいuiIdに置換 | 今回bodyにない色画像は保存属性へ含まれない。S3上の旧オブジェクト削除は実行しない |
| S13 | H | 商品画像署名を逆順完了、index=1のみ新規、複数の離れたindexが新規 | 確定画像の入力順を確認。返却署名は元indexとURLの対応・件数・欠落・重複を観測する。非同期完了順に対する配列の保証はO03で扱う |
| S14 | H | 色画像署名を逆順完了 | 一意uiIdなら辞書の対応は維持。オブジェクトの列挙順はassertしない |
| S15 | H | 動画POST署名関数がundefinedを返す | videoSignedUrlはnullだが新規videoUrlは組み立てられる。署名がnullであることだけを理由にVIDEO_URL_NULLとはならない |

## 8. ブランド解決の条件分岐

`resolveBrand` の戻り値と別名作成の副作用を分けて確認する。新規作成したaliasがそのまま商品へ関連付くとは限らない。

| ID | レベル | 条件 | 現行コードに基づく期待結果 |
| --- | --- | --- | --- |
| B01 | H/U | 指定brandIdが存在、brand.nameも指定 | IDのブランドを採用。別名検索・名前検索・作成は行わない |
| B02 | H/U | ID未指定または見つからず、nameもnull／空文字 | brand・aliasともnull。ブランド不在を404にはしない |
| B03 | H | 名前検索へ進む、対応brand付きaliasあり | そのbrand・aliasを返す。その後getBrandOneも実行する |
| B04 | H | 全角英数字、大小文字、カタカナ、空白を含む名前 | NFKC → 小文字化 → ひらがな化 → 空白除去した値で両検索を行う。createAliasesには元名と正規化名を渡す |
| B05 | H/U | aliasなし、getBrandOneでブランドが見つかる | 作成なし。現行処理ではその検索結果をbrandResultへ代入しないため戻り値は両方null |
| B06 | H/U | ブランドなし、名前長0／1／2文字 | 0は名前検索なし。1は検索するが作成なし。2以上はcreateAliasesを1回呼ぶが、作成結果はbrandResultへ反映されない |
| B07 | H | brandを持たないaliasあり、getBrandOneはnull | 名前が2文字以上なら別名作成へ進む。既存の未紐付けaliasがあるだけでは作成を抑止しない |
| B08 | H | brand付きaliasあり、getBrandOneはnull | 既存aliasのブランドを返しつつ、名前が2文字以上なら別名作成も行う |
| B09 | H | 元の名前が空白2文字／絵文字1個 | 判定は正規化前のJavaScript文字列length。正規化後の長さや見た目の文字数による下限と混同しない |
| B10 | H/U | getBrand、getAliasOne、getBrandOne、createAliasesが個別にreject | 元の例外が伝播。商品更新transactionは開始しない |

## 9. 状態遷移

ここでいう状態は、編集中データ・メディア・在庫の保存前後を指す。公開処理の状態機械は含めない。

| ID | レベル | 更新前 → 操作 | 期待する保存後 |
| --- | --- | --- | --- |
| ST01 | D | 未入力の編集中データ → 必要なメディアと項目を入力 | 同じitem_editing行に保存。行数増加・Itemの新規作成はない |
| ST02 | D | 保存済み → 名称・価格・画像・配送を変更 | 指定値へ上書き。before_priceも今回価格。seller_id、item_id、createdAtは維持 |
| ST03 | U/D | 在庫initial=10、current=4 → inventory=8 | initial・currentとも8になる。以前の消費差分を引き継ぐとは期待しない |
| ST04 | D | 複数色・素材あり → 空配列で更新 | attributes全体が今回の構造に置換され、旧色・素材が残らない。JSONのundefinedキーは保存表現で確認 |
| ST05 | H/D | メディア保持 → 一部だけ差し替え | 差替え対象のみ新規URLへ変更。ただし動画未変更時はconverted_urlがoriginal_urlより優先される |
| ST06 | U/D | video_statusがnull／既存の異なる値 | 取得に状態条件がなく、値によらず同じ更新経路。video_status・converted_url・durationは変更しない |
| ST07 | D | 任意の保存済み状態 → 更新途中で失敗 | item_editingの更新対象カラムは更新前へ戻る。ブランド別名はT05の別範囲 |
| ST08 | D | sale_flag・割引値あり → 価格変更 | priceとbefore_priceを更新。sale_flag・discount_rate・discount_amountは現状維持で、再計算を期待しない |

## 10. DB整合性・service契約

| ID | レベル | 確認内容 | 期待結果 |
| --- | --- | --- | --- |
| D01 | service単体/D | getMyItemEditingの検索条件 | whereはidとseller_idの両方。他ユーザーの行を返さない。取得transaction・lock・status条件は追加されない |
| D02 | service単体 | updateConfirm | 受け取ったitemEditing.updateへdataと同じtransactionを渡す |
| D03 | service単体/D | updateItemEditingImage | setDataValue("image_url", urls) → changed("image_url", true) → save({ transaction })。配列変更がDBへ永続化される |
| D04 | D | 画像1〜10件の更新 | image_urlの順序が一致し、first_image_urlがその先頭と一致。画像専用の別行を追加する設計ではない |
| D05 | D | JSONBの更新 | 在庫0・素材小数・日本語文字列・uiIdと画像対応を保持。undefinedはDB再取得でキー省略になる点を区別 |
| D06 | D | 有効な外部キー／nullable ID | 各参照が有効、許容列はnullで保存。入力のcategory.name・parent_id・levelを根拠にDB分類を上書きしない |
| D07 | D | 参照マスターを検証後・更新前に削除 | 書込み時に参照が消えていれば制約エラーとなり、商品更新全体がrollbackする。検証済みという理由で成功扱いにしない |
| D08 | D | 他の編集中商品と対応Itemを併置 | 対象以外の行、公開側Item、所有者・関連商品IDを変更しない |
| D09 | D | 画像11件、長さ超過、不正ENUMをそれぞれ保存 | モデル／DB制約の発生点を確認し、途中の本体更新が残らない。11件制限はモデルvalidatorでありDB CHECKと断定しない |
| D10 | D | item_idあり／null | 反映済みDBがnullableなら両方更新可能。テスト開始時に適用済みスキーマを確認し、モデルだけで判断しない |

## 11. トランザクション

| ID | レベル | 操作・失敗点 | 期待結果 |
| --- | --- | --- | --- |
| T01 | U | 正常更新 | managed transactionを1回開始し、両更新serviceへ同一tを渡す |
| T02 | U | 本体更新を保留して後でresolve | resolve前に画像更新を開始しない。画像更新とtransaction完了前にusecaseが成功しない |
| T03 | D | 本体更新後、画像更新を意図的に失敗 | 新しい接続または新規SELECTで価格・名称・attributes・URL・画像がすべて更新前であることを確認 |
| T04 | D | 両更新成功 | commit後に別接続から両方の変更が見える |
| T05 | H/D | 未登録名から別名作成後、商品更新を失敗 | 商品はrollbackするが、別名作成は商品transaction外のため残り得る。全関連テーブルの原子性は保証されない |
| T06 | U/H | 数値／マスター検証で失敗 | 商品transactionは0回。署名は検証前に発行済みの場合がある。署名の取消しやS3削除は期待しない |
| T07 | D | rollback後に同じ内容で再試行 | 商品の部分更新が残らず、次の正常操作が成立する。別名件数は別途Q03で観測 |

DBテストを外側のtransactionで一律に囲むと、transaction外の別名作成や別接続からの可視性を誤認しやすい。専用DB・テストごとの識別子・明示的な後片付けを使い、実際のtransaction境界を維持する。S3、通知、ジョブの実行は不要。

## 12. 重複実行

| ID | レベル | 操作 | 期待結果・観測内容 |
| --- | --- | --- | --- |
| Q01 | H/D | 既存URLを使う同じbodyを逐次2回実行 | 同じ行を2回更新。行数は増えない。converted_urlなし、既存ブランドIDありのfixtureでは業務値は一致。updatedAtやSQL回数まで不変とはしない |
| Q02 | H/D | 新規アップロード指定の同じbodyを異なる時刻で再実行 | 時刻に応じた新規キーと署名を発行し、後のURLで上書きする。署名結果を再利用する冪等性はない |
| Q03 | H/D | 同じ未登録ブランド名で再実行 | 条件を満たすたびcreateAliasesへ進み得る。モデルに正規化名のunique指定はない。実DBの制約確認後、別名件数と商品への関連付けを観測 |
| Q04 | H | 同一商品・同一ミリ秒で新規メディアを指定 | 同じ種類・index・uiIdのキーが一致する。リクエストごとに必ず一意とは期待しない |
| Q05 | D | 初回が画像保存で失敗し、再実行 | 商品は成功した回の内容になる。初回別名の残存と追加件数を確認し、自動再試行や重複排除は期待しない |
| Q06 | R | 同一ユーザーが10分間に6回送信 | 最初の5回は後続へ進める。6回目は429でusecase未実行。重複排除の保証とレート制限を混同しない |

## 13. 並行処理

単純な `Promise.all` と待ち時間だけでは再現性が足りない。deferred Promiseやテスト側のserviceラッパーで「両方の取得完了」「Aのcommit完了」等を待ち合わせ、開始・完了の順序を制御する。実装側へテスト用処理を追加しない。

| ID | レベル | 再現する順序 | 期待結果・観測内容 |
| --- | --- | --- | --- |
| P01 | D | 同じ商品をA/Bが取得 → Aが全更新をcommit → Bが全更新をcommit | 楽観ロック・競合409の実装はない。異なる名称・価格・画像を双方で指定し、通常の上書き結果と完了順を確認。要求の開始順だけで勝者を決めない |
| P02 | D | 取得時は同じ旧データ → Aだけが変える項目とBだけが変える項目を含め更新 | Sequelizeの変更検知により更新SQLの列が異なり得る。単純な「後勝ちでbody全体置換」を保証せず、混在・更新喪失の有無をO05として観測 |
| P03 | D | Aの商品とBの商品を別接続で同時更新 | 双方の正しい行へ保存され、他方の画像・属性・所有者が混ざらない |
| P04 | D | 同じ商品へ2件、片方だけ画像保存で失敗 | 失敗transactionの変更は残らず、成功transactionの変更は残る。片方のrollbackが他方のcommitを取り消さない |
| P05 | H/D | 同じ未登録名で両方の検索が「なし」→ 別名作成 | 重複作成または実DB制約エラーを観測。排他・upsert・一意性を勝手に仮定しない |
| P06 | H | 商品画像署名の完了順を正順／逆順／混在に制御 | URLと元indexの対応・件数が期待どおりか確認。O03の観測結果として記録 |
| P07 | H | 同一uiIdの色を2つ指定し、属性署名を並行完了 | 辞書のキーが共有される現行結果を観測。一意な画像割当てや重複uiId拒否は保証されない |
| P08 | D | 所有権確認後、別接続で対象削除／所有者変更してから更新 | 取得後の再認可・更新行数検証は実装されていない。成功／例外と最終DBを観測し、404や変更阻止を保証として書かない |

## 14. Controller・Routeとの接続

| ID | レベル | 条件 | 期待結果 |
| --- | --- | --- | --- |
| R01 | C | req.params.id="11"、req.user.id=7、validatedBodyあり | `{ itemEditingId: 11, userId: 7, body: req.validatedBody }` を1回渡す。req.bodyの未検証値は渡さない |
| R02 | C/R | usecase成功 | 200、videoSignedUrl・thumbnailSignedUrl・itemImageSignedUrls・attributesImageSignedUrlsのみのJSON。null、空配列、空辞書も保持 |
| R03 | C | AppError／通常Errorでusecaseがreject | 同一エラーをnextへ1回渡し、200レスポンスを送らない |
| R04 | R | トークンなし／不正／期限切れ | 401。usecase未実行。認証middleware自身のレスポンスを確認し、AppError形式を強制しない |
| R05 | R | ID不正／body不正／両方不正 | params検証がbody検証より先。controller未実行。観測したAppErrorのcode・statusCodeを確認 |
| R06 | R | 同一ユーザー5回→6回、別ユーザー、時間窓更新 | 5回まで通過、6回目は429、別ユーザーは別枠、10分窓経過後は再び通過。各テストでストアを分離 |
| R07 | R | 不正bodyを繰り返す | レート制限がvalidatorより前なので不正bodyのリクエストもカウントされる |
| R08 | C/R | bodyに別のuserIdやseller_idを混入 | usecaseへ渡す所有者は常に認証ユーザーのID |

Routerテストでは最小のExpressアプリにJSON parserと対象Routerを接続する。エラー観測にテスト専用の4引数error middlewareを使う場合、その結果はRouterがエラーを渡した証明に限定し、実アプリ共通errorHandlerの結合保証と区別する。既存の共通エラー処理や登録状態は今回修正しない。

## 15. 期待結果を固定する前に観測するケース

以下は実装から注意が必要と分かる箇所であり、今回の修正対象ではない。望ましい仕様を推測してテストを赤くしたままにせず、現状確認と将来の仕様確定を分ける。

| ID | 関連ケース | 観測する内容・扱い |
| --- | --- | --- |
| O01 | E04、V10、S08 | finalImageUrls=[]でもITEM_IMAGE_NULLにはならず、first_image_urlへundefinedが渡る。既存先頭画像あり／なしの両方でDB保存結果を確認し、「画像0件は必ず400」としない |
| O02 | B05〜B08、Q03 | 名前で見つけたブランド・新規aliasが戻り値に採用されない経路と、別名の追加件数を記録。自動関連付けを期待しない |
| O03 | S13、P06 | 商品画像の署名配列はindexへ代入するたびfilterされる。疎なindex・逆順完了で上書きや欠落がないか、件数・各indexの一意性・URL対応で確認。配列順だけの比較で済ませない |
| O04 | Q04、P07 | 時刻とuiIdによるキーの共有・衝突を記録。現行コードにない一意性保証を通常回帰テストへ持ち込まない |
| O05 | P01、P02、P08 | staleなモデルインスタンスからの更新、所有権の変更・削除競合について実SQLと最終行を観測。排他制御や再認可がある前提にしない |

## 16. 実装順序と完了判定

1. **優先度P0**：Uの正常更新・所有権・エラー伝播・呼出順序・同一transaction、Vの価格／在庫／必須項目、Dの本体・画像rollbackを実装する。
2. **優先度P1**：HのURL再利用・マスター・ブランド分岐、状態遷移、C/Rの接続、DB制約を実装する。
3. **優先度P2**：重複実行と順序を制御した並行処理、観測ケースを実装する。実DBが必要なケースをモックの成功だけで完了扱いにしない。

テスト名にはケースIDと日本語の条件・結果を含める。表の「各項目」「複数値」は `it.each` 等で独立したテストに展開し、失敗した条件を特定できるようにする。S系・B系を全モックしたUだけで分岐カバレッジを満たしたと判断しない。

完了判定は、必須ケースの期待結果に加え、異常系の後続未実行、再取得したDB状態、並行処理の再現手順が確認できることとする。テストDB未準備・既存エラーで実行できない項目は理由を記録し、成功扱いにしない。
