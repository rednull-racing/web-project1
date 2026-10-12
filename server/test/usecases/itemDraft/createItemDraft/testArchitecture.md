# 商品下書き作成：テストコード設計書

## 1. 目的・対象・設計時点

対象は `src/usecases/itemDraft/createItemDraft.ts` の `createItemDraftUseCase`。編集中の商品を参照して下書きを新規作成する処理について、入力・所有権・メディア・保存内容・失敗時の原子性を検証する。

2026-10-12時点のコードを調査した設計であり、テストコードは未実装、テスト・DB接続・migrationは未実行。本書でいう「期待結果」は実行結果ではない。以下のファイルパスは、特記しない限り **`server/` 基準** とする。依頼の `/test/usecases/.../testArchitecture` は、既存の空ファイル `server/test/usecases/itemDraft/createItemDraft/testArchitecture.md` に記載する。

作成する成果物は本書だけ。既存コード、既存テスト、設定は変更しない。実S3へのアップロード、動画変換、商品公開、他APIの修正、負荷試験は対象外とする。

基準は [usecaseテスト共通ルール](../../AGENTS.md) と [updateConfirmの設計例](../../itemEditing/updateConfirm/testArchitecture.md)。設計例の過去の観測を現在の仕様として転記しない。共通helperの現在の実装を読み直し、このusecase固有の作成処理・transaction境界に合わせる。

### 特に区別する現行挙動

- 実Routerは `POST /api/item-draft` に `idParamSchema` を接続しているが、パスに `:id` がない。認証・レート制限通過後はparams検証で止まる見込み。HTTPで正常作成できる前提のテストを作らず、O01として記録する。
- 作成データに `seller_id` と `item_id` を設定しない。参照元の所有者を検索することと、作成先へ所有者を保存することを分け、O02で確認する。
- `ItemEditing` は読み取るだけで、削除・更新・再ロック取得しない。取得後の所有者変更・削除との競合はO03・O04として扱う。
- 同じ入力でも毎回 `ItemDraft.create` へ進む。商品下書きの冪等性・一意性を追加仕様として要求しない。これとブランド別名の重複抑止は別の責務である。
- 上記はコードから分かる注意点であり、実測済みとはしない。今回の編集範囲は設計書に限定されるため、修正候補は本書の観測欄に残し、範囲外のTodoや実装ファイルを追加しない。

## 2. 調査対象と責務

| 対象ファイル | 確認する責務 |
| --- | --- |
| `src/usecases/itemDraft/createItemDraft.ts` | 処理順序、保存データ構築、transaction、戻り値 |
| `src/usecases/shared/{buildSignedUrls,validateNumber,validateMaster,resolveBrand,bodyType}.ts` | 署名・URL再利用、ID変換、マスター存在確認、ブランド優先順位、共有入力型 |
| `src/services/itemDraft/command.ts` | `CreateItemDraft` と `updateItemDraftImage`、transactionの伝達 |
| `src/services/itemEditing/query.ts` | `id + seller_id` による取得。transaction指定時だけロックする共通service |
| `src/services/{categories,itemConditionOption,shippingDayOption,shippingServiceOption,todouhuken}.ts` | 各マスターの主キー検索 |
| `src/services/{brands,brandAliases}.ts` | ブランド・別名検索、transaction単位のadvisory lockと別名再検索・作成 |
| `src/types/serviceType/{itemDraft,itemEditing,brands,brandAliases}.ts`、`src/types/itemAttributes.ts` | serviceの引数・戻り値、保存する属性 |
| `src/validators/body/itemDraft.ts`、`src/validators/body/utils/putItem.ts` | bodyの型・数値境界・重複uiId拒否 |
| `src/validators/params/id.ts`、`src/middleware/validate/{validateBody,validateParams}.ts` | params検証、検証済み値の格納、AppError |
| `src/controllers/itemDraft.ts`、`src/routes/{itemDraft,index}.ts` | 認証情報と検証済みbodyの引渡し、200応答、接続順、登録パス |
| `src/middleware/authMiddleware.ts`、`src/middleware/rateLimit/itemDraftRateLimit.ts` | JWT認証、ユーザー別10分5回の制限 |
| `src/errors.ts`、`src/middleware/errorHandler.ts` | AppErrorの型と共通エラー処理との境界 |
| `src/utils/{toNullableNumber,normalizeJapanese}.ts`、`src/utils/s3/{index,signedUrl,videoPresignedPost}.ts` | Number変換、名前正規化、外部署名の境界 |
| `src/models/{item_draft,item_editing,brand_aliases,brands,categories}.ts` | 列・nullable・初期値・関連・制約 |
| `src/models/{user,item,item_condition_option,shipping_day_option,shipping_service_option,todouhuken_option}.ts` | DB fixtureの親行と非対象行 |
| `src/db.ts`、`src/models/index.ts`、`src/config/config.ts` | DB接続・モデル初期化、dotenv読込み経路 |
| `migrations/20261006044008-create-table-item-draft.js`、`migrations/20261006044423-update-column-item-editing.js` | 下書きテーブルの制約資料、参照元item_idのnullable化 |
| `test/usecases/itemEditing/updateConfirm/{fixtures,databaseSetup,databaseFixtures}.ts` | fixture、deferred、接続ガード、別接続SELECT、後片付けの参考 |
| `package.json`、`eslint.config.mjs`、`test/tsconfig.json` | Vitest・Supertest、lintと型検査の対象 |

モデル・migrationは設計根拠であり、反映済みDBの証明ではない。実装時に実DBの列・制約を確認し、不一致をテスト側で補正しない。

## 3. 処理の流れと停止位置

1. Router：認証 → レート制限 → params検証 → body検証 → controller。現行の到達性はO01を参照。
2. Controller：`req.user.id` と `req.validatedBody` をusecaseへ渡す。`itemEditingId` はbody内にある。
3. `getMyItemEditing({ itemEditingId, userId })`。未取得なら `ITEM_EDITING_NOT_FOUND / 404`。この取得にはtransactionを渡していない。
4. `buildSignedUrls`：動画 → サムネイル → 商品画像の並列署名 → 色画像の並列署名。公開URLと署名情報を返す。
5. 動画URL → サムネイルURL → 商品画像の存在を確認。空画像配列も拒否する。
6. `validateNumber`：category → condition → day → service → place → brandの順に数値変換。
7. `validateMaster`：category → condition → day → service → placeの順に存在確認。null・0は検索しない。
8. managed transaction開始 → `resolveBrand({ brandId, body, transaction: t })` → `CreateItemDraft({ data, transaction: t })` → `updateItemDraftImage({ itemDraft, urls, transaction: t })` → commit。
9. transaction完了後、署名情報4項目を返す。controllerは200で返し、例外は同じオブジェクトを `next` へ渡す。

ブランド解決はcallback内だが、最初のブランド・別名検索にはtransactionを渡さない。新規別名の作成経路は `createAliases` にtを渡し、同じtでロック・再検索・必要時のINSERTを行う。下書き本体・画像・この経路で新規作成した別名は同じtransactionに参加する。

署名発行はDB transactionの外側。後続が失敗しても署名取消し・S3削除・自動再試行はしない。署名が発行されたことをファイル実体の存在確認やアップロード完了と解釈しない。

## 4. テストレベルとファイル構成案

以下は将来実装するファイルの設計であり、今回作成しない。

| 記号 | ファイル案 | 実処理／モック・主な担当ケース |
| --- | --- | --- |
| U | `usecase.test.ts` | 実usecase。helper・service・managed transactionをモック。N/E/T系の引数・順序・打切り |
| H | `signedUrls.test.ts` | 実buildSignedUrls。S3境界、公開ドメイン、時刻、UUIDを制御。S系とusecaseへの代表的な接続 |
| H | `masterBrand.test.ts` | 実validateNumber・validateMaster・resolveBrand・正規化。DB serviceのみモック。I/M/B系 |
| V | `validation.test.ts` | 実schemaと実validateBody/validateParams。V系。DB接続なし |
| S | `services.test.ts` | 実service、Modelメソッドとsequelize.queryをモック。SV系。SQLの実効性はDで確認 |
| C | `controller.test.ts` | 実controller、usecaseのみモック。C系 |
| R | `route.test.ts` | 実Router・認証・レート制限・validator、usecaseモック。最小Express＋Supertest。R系・O01 |
| D | `database.test.ts` | 実usecase・helper・service・モデル・PostgreSQL、S3のみモック。D/ST/Q系・O02 |
| D | `databaseTransactions.test.ts` | 同上＋明示した障害注入・待機spy。T系の永続化、失敗後再試行 |
| D | `databaseConcurrency.test.ts` | 同上＋独立transactionとdeferredによる順序制御。P系・O03/O04 |
| 共通 | `fixtures.ts` | 標準body、取得行、署名結果のfactory、AppError検証、deferred |
| DB共通 | `databaseSetup.ts`、`databaseFixtures.ts` | import前の接続ガード、fixture作成・追跡・削除、別接続SELECT |

U/HやSの成功を実DBのrollback・制約の証明にしない。`H/U` はhelperを実処理に戻したusecase結合も行う意味であり、全helperをモックするUとは分ける。Cの成功をRの到達性の証明にしない。

### 標準fixtureと共通アサーション

- 所有者A、別ユーザーB、Aの編集中商品、Bの商品、影響してはいけない既存下書き・公開商品を用意する。Uの例はuserId=7、itemEditingId=11。Dでは採番したIDを使う。
- 標準body：価格300、商品名「下書き商品」、説明「商品説明」、動画題名「紹介動画」、summary「動画説明」、gender=`unisex`、age=`both`。カテゴリ・商品状態・配送・ブランドは存在するIDの文字列を指定する。
- 既存original_url・thumbnail_url・商品画像をそれぞれ異なるURLで用意。標準はconverted_urlなし、video/thumbnail省略、商品画像1枚を `uploaded=true` として再利用する。
- 属性：全体在庫3、色red/blue、色在庫2/1、サイズM/L、サイズ在庫2/0など取り違えを検出できる値を用意する。素材は綿70・ポリエステル30。標準入力は実schemaで検証する。
- 既存属性の在庫・色画像・素材は新入力と異なる値にする。カテゴリ分類は `top/casual/middle` など実型・DB制約を満たす値。NOT NULLのlayer/pathを欠いた親fixtureを作らない。
- body・配列・入れ子・取得行をfactoryで毎回作り直す。DB識別用の固有名以外は不要な乱数を使わない。期待オブジェクトは実装ロジックのコピーで生成せず、具体値で記述する。
- 戻り値と主要なservice引数は完全一致。同じbody・モデル・t・urlsを渡す境界は `toBe` も確認する。呼出回数・必要な順序・不要な項目の非包含も確認する。
- AppErrorは型・code・statusCode、通常例外は同一Errorを検証する。全異常系で停止位置以降の未実行とDB影響を確認する。
- mock履歴と実装をbeforeEachで戻す。spy・環境変数・timer・hookを復元する。非DBテストでdb/modelsを実importして接続しないよう依存境界をモックする。
- deferredは開始通知と解放用Promiseを分ける。reject操作前に拒否アサーションを登録し、finallyで残る処理を解放・回収する。任意のsleepや完了順の偶然に依存しない。

## 5. 正常系と保存項目

| ID | レベル | 条件／入力 | 期待結果 |
| --- | --- | --- | --- |
| N01 | U | 標準入力 | 第3節の順序で各処理を1回実行。新規モデルを画像保存へ渡し、署名4項目のみ返す |
| N02 | U/D | 全保存項目を識別可能な値で指定 | 下表の値が作成先へ渡り、commit後のSELECTでも一致する |
| N03 | U/D | detail・summaryを各null／空文字／日本語文字列 | nullだけ空文字へ補完。他の値は保持 |
| N04 | U/D | 全体・色・サイズ在庫を独立に0／1／複数へ変更 | initial=current=入力、low_stock_ratio=0.2。0を1にしない |
| N05 | U/D | 複数色・サイズ・素材、入力色の並びを変更 | 配列順を保持。画像はuiIdに対応し、配列位置と混同しない |
| N06 | U/D | colorVariants・materialsが空、ある色のsizesが空 | 前2つは作成引数上undefined、sizesは空配列。JSONBではundefinedキーが省略される |
| N07 | U/D | categoryあり／未選択、nullable分類がnull | 分類は取得したカテゴリ由来。null・カテゴリなしはundefined。layer=nullはH/Uでの防御確認に限定 |
| N08 | U/D | brandのみ／aliasのみ／両方／両方なし | 解決結果に対応するIDまたはnullを保存 |
| N09 | U/D | color省略／空文字、対応色画像なし | 省略colorと画像なしはundefined、空文字は保持。DBではundefinedキーを省略 |
| N10 | U | schema外の直接入力：各在庫null/undefined、size=null | 在庫は1、sizeはundefinedへ補完する防御分岐。HTTPの受理仕様としない |
| N11 | U/D | freeText=null／空文字／通常文字列 | そのままshipping_service_free_textへ保存 |

| 作成先・引渡し先 | 入力・変換元 |
| --- | --- |
| name / detail | itemMeta.name / itemMeta.detail ?? 空文字 |
| price / before_price | どちらもbody.price |
| first_image_url | finalImageUrls[0] |
| image_url | 作成後にupdateItemDraftImageへfinalImageUrls全体を渡す。最初のcreate dataには含めない |
| category_id / item_condition_id | validateNumberのcategoryId / conditionId |
| gender_type / age_type | genderAge.gender / genderAge.age |
| brand_id / brand_aliases_id | resolveBrandが返すbrand.id / alias.id、なければnull |
| attributes.inventory | allInventory ?? 1をinitial/currentに設定、low_stock_ratio=0.2 |
| attributes.colorVariants | uiId、color、色在庫、finalAttributesImageUrls[uiId]、sizesとサイズ在庫 |
| attributes.materials | name・ratioだけを入力順に保存 |
| attributesのbody_category/lifestyle_category/layer | categoryOptionの値。入力category.name/parent_id/levelから生成しない |
| title / summary | videoMeta.title / videoMeta.summary ?? 空文字 |
| original_url / thumbnail_url | buildSignedUrlsのvideoUrl / thumbnailUrl |
| shipping_day_id / shipping_service_id / shipping_place_id | validateNumberのdayId / serviceId / placeId |
| shipping_service_free_text | shipping.freeText |
| 戻り値 | videoSignedUrl、thumbnailSignedUrl、itemImageSignedUrls、attributesImageSignedUrls。下書きID・公開URL・モデルを追加しない |

`seller_id`、`item_id`、`converted_url`、`duration`、`video_status`、割引列は作成データにない。参照元の全列コピーを期待せず、保存後の初期値はD02・O02で別途確認する。

## 6. 異常系と打切り

| ID | レベル | 条件／失敗点 | 期待結果・未実行処理 |
| --- | --- | --- | --- |
| E01 | U/D | ID不存在／B所有／seller_id=null | ITEM_EDITING_NOT_FOUND・404。署名以降すべて未実行、下書き増加なし |
| E02 | H/U | videoUrl=null／空文字 | VIDEO_URL_NULL・400。数値変換以降なし。ただしhelper内の他の署名は先に実行され得る |
| E03 | H/U | 動画あり、thumbnailUrl=null／空文字 | THUMBNAIL_URL_NULL・400。数値変換以降なし |
| E04 | H/U | 確定画像0件（入力空／既存index欠落／全新規type不足） | ITEM_IMAGE_NULL・400。数値変換・transactionなし |
| E05 | U | helperモックがfinalImageUrls=null/undefinedを返す | ITEM_IMAGE_NULL・400。実helperでは到達しない防御分岐。後続なし |
| E06 | H/U | 6種のIDを個別に非数値文字列へ変更 | INVALID_NUMBER・400。マスター照合以降なし |
| E07 | H/U | カテゴリ／状態／配送日／配送サービス／発送元が個別に不存在 | 順にCATEGORY_NOT_FOUND／ITEM_CONDITION_NOT_FOUND／SHIPPING_DAY_NOT_FOUND／SHIPPING_SERVICE_NOT_FOUND／PLACE_NOT_FOUND、すべて404。該当後のマスター検索・transactionなし |
| E08 | U/H | 取得／署名／数値helper／各マスターserviceが個別にreject | 同一例外。transactionなし。署名のPromise.allで開始済みの処理の取消しは期待しない |
| E09 | U/H/D | 各ブランド検索／別名作成がreject | transaction開始後の失敗。CreateItemDraft・画像保存なし。新規別名のrollbackはT04で確認 |
| E10 | U/D | CreateItemDraft失敗 | 画像保存なし。成功結果なし。transaction内の新規別名も残らない |
| E11 | U/D | 本体INSERT後に画像save失敗 | 同一例外、成功結果なし。本体・新規別名がrollbackする |
| E12 | U | transaction開始失敗／callback成功後の完了失敗 | 元例外を伝播。開始失敗はcallback未実行。完了失敗モックだけで実commit障害のDB結果を断定しない |
| E13 | U/H | 不存在＋URL欠落、動画＋サムネイル＋画像欠落、数値不正＋マスター不在 | 所有権取得→動画→サムネイル→画像→数値→マスターの優先順で停止 |
| E14 | H/U | 動画URL欠落だが後段の商品画像署名がreject | helper完了前の署名例外が先に伝播。VIDEO_URL_NULLに変換しない。数値以降なし |

E09のDB障害注入は実際の呼出箇所を明記する。サービスをrejectするだけのUと、先行INSERT完了後に失敗させるDを混同しない。

## 7. 入力検証・境界値

各行の複数値・各階層は `it.each` 等で独立ケースへ展開する。schema受理とDB保存可否は別判定。現行Routerはparamsで止まるため、body不正は実schema・実validateBodyのVで検証し、架空のHTTP到達経路を作らない。

| ID | レベル | 条件／入力 | 期待結果 |
| --- | --- | --- | --- |
| V01 | V | itemEditingId=-1/0/1/2/1.5/文字列/null/欠落 | 正の整数numberのみ受理。自動数値変換なし |
| V02 | V | price=299/300/301/999999/1000000/1000001 | 300〜1000000を受理 |
| V03 | V | price=0/負数/小数/文字列/null/欠落/NaN/Infinity | 拒否。非JSON値はschema直接呼出しと明記 |
| V04 | V | 全体・色・サイズ在庫=-1/0/1/小数/文字列/null/欠落 | 0以上の整数だけ受理。各階層を独立検証 |
| V05 | V | material.ratio=-0.01/0/0.01/99.99/100/100.01、文字列/null/欠落 | 0〜100は小数も受理、範囲外・型不正は拒否。合計100の条件はない |
| V06 | V | category.level=0/1/2/1.5/文字列/null/欠落 | 1以上の整数のみ受理 |
| V07 | V | 必須オブジェクト・配列・各必須子フィールドを1つずつ欠落/null/別型へ変更 | optional/nullableに従い拒否。nullableでも必須のキーは省略できない |
| V08 | V | summary/detail、category.id/parent_id、gender/age、brand.id/name、shipping全項目にnull | 受理。condition.id、各nameなどnullableでない文字列のnullは拒否 |
| V09 | V | video/thumbnail省略、内部name/type省略、uploaded欠落 | 前2条件は受理、存在するfileのuploaded欠落は拒否。file自体nullは拒否 |
| V10 | V | 商品画像type=null/空文字/欠落、name=空文字/欠落 | null・空文字type、空nameは受理。type/name欠落は拒否。uploadedはboolean必須 |
| V11 | V | 色のcolor/image省略、image.type省略、sizes省略、size名空文字 | optionalは受理、sizes欠落は拒否、size名空文字は受理。colorやimageのnullは拒否 |
| V12 | V | itemImages=0/1/10/11枚、色・サイズ・素材=空/複数 | schemaは受理。画像0件はE04、確定画像11件はD05のモデル検証へ進む |
| V13 | V | uiIdが異なる／同一2件／同一3件／非隣接重複 | 一意は受理。重複は2件目以降の `attributes.colorVariants.<index>.uiId` にcustom issue。先頭だけに誤付与しない |
| V14 | V | uiId空文字1件／空文字2件、大小文字違い・空白違い | 空1件・完全一致しない値は受理、空2件は拒否。trim・正規化はしない |
| V15 | V/D | gender=men/women/unisex、age=adult/kids/both、各null/空/不正文字列 | schemaはすべて受理。定義値は保存可能。null・不正値の拒否位置はD04 |
| V16 | V/D | name/title/freeText/brand.name=0/1/2/254/255/256文字、日本語も使用 | schemaに長さ上限なし。DB文字数と別名作成閾値をD06/B07で確認 |
| V17 | V | 任意MIME、長い説明、在庫の大きな安全整数、多数の色・サイズ、在庫合計不一致 | 明示されていないMIME制限・業務上限・在庫合計一致を追加しない。実schema受理と値の保持を確認。負荷試験ではない |
| V18 | V/C | bodyと入れ子にuserId/seller_id/item_id/status/余分なキー | parseで未知キーを除去。Cではreq.user.idを使用し、未検証req.bodyを渡さない |
| V19 | V | validateBody成功／失敗 | 成功はvalidatedBodyへparse済み値＋next1回。失敗はINVALID_BODY・400をthrowし、validatedBody設定・正常nextなし |
| V20 | V | params.id="1"/"01"/"0"/"-1"/"1.5"/"abc"/欠落 | 正の整数へcoerce可能な値のみ受理。成功はvalidatedParams設定、失敗はINVALID_PARAMS・400、正常nextなし |

### 数値変換・マスター照合

| ID | レベル | 条件／入力 | 期待結果 |
| --- | --- | --- | --- |
| I01 | H/U | 6種IDを各null／空文字へ変更 | nullへ変換。condition.id=nullだけはHTTP外の防御確認 |
| I02 | H/U | 各ID="1"/"01"/" 1 "/"1e2" | 1/1/1/100を対応する引数へ渡す |
| I03 | H/D | 各ID="0"／空白だけ | 0になる。5種マスターは検索なし、保存には0を渡す。参照先0がなければFKで拒否。brandId=0はブランド検索対象で別扱い |
| I04 | H/D | 各ID="-1"/"1.5"/"Infinity"/整数列上限超過の文字列 | Number変換自体では拒否しない。後段の検索結果・DB型エラーを確認し、INVALID_NUMBERを期待しない |
| I05 | H/U | 各ID="abc"/"NaN"、複数同時不正 | INVALID_NUMBER。category→condition→day→service→place→brand順に停止 |
| M01 | H/U | 5種マスターのnull/0/有効IDを各々指定 | null/0は呼ばず、有効値は対応serviceを正しい引数名で呼ぶ。categoryOptionをそのまま返す |
| M02 | H/U | 各マスター不存在／複数不存在 | E07のcode。先行が失敗したら後続検索なし。categoryの分類値だけを保存へ渡す |
| M03 | H/U | 各マスター検索を保留／reject | 後続検索は未開始。reject時は同じError、transaction未開始 |

## 8. メディア・署名URLの条件分岐

時刻を既知値、UUIDを呼出しごとに既知の異なる値へ固定する。`suffix={itemEditingId}_{now}_{requestId}` とすると、動画は `video/original/{userId}/{suffix}`、サムネイルは `thumbnail/{userId}/{suffix}`。商品画像は `{itemEditingId}_{index}_{now}_{requestId}`、色画像は `{itemEditingId}_{uiId}_{now}_{requestId}` を各 `item-image/{userId}/`、`attributes/{userId}/` に続ける。

| ID | レベル | 条件／手順 | 期待結果 |
| --- | --- | --- | --- |
| S01 | H/U | 新規動画：name/typeあり、uploaded=false | 動画POST署名へ正しいkey・contentType・500×1024×1024を渡す。保存URLは公開ドメイン＋key |
| S02 | H | video省略／uploaded=true／name空・欠落／type空・欠落 | 署名なし。converted_url→original_url→nullのnullish優先順。converted_url空文字はoriginalへfallbackせずE02 |
| S03 | H/U | converted_urlあり＋新規動画 | 新しい公開URLをoriginal_urlへ採用。作成先converted_urlに既存値をコピーしない |
| S04 | H/U | thumbnailの新規条件成立／不成立、既存URLあり／なし | 新規は署名と新URL、不成立は既存URL。最終URL欠落はE03 |
| S05 | H/U | 商品画像に新規・既存を交互指定 | 新規は元indexを含むkey、既存は同じ入力indexの既存URL。確定配列は入力順 |
| S06 | H/U | uploaded=trueだが既存indexなし／URL空／image_url=null・非配列 | 該当画像は確定配列に入らない。nameを既存URLとして採用しない。全欠落はE04 |
| S07 | H | 新規商品画像name空、typeあり | nameの真偽を条件にしないので署名する |
| S08 | H/U | 新規商品画像type=null／空 | 署名なし。部分欠落なら残りを詰めて保存、全部欠落ならE04。署名indexは詰めた位置へ変更しない |
| S09 | H/U | 色画像name/typeあり、uploaded=false | uiId入りkey、署名辞書と確定画像辞書の対応が一致する |
| S10 | H/U | 色画像省略／uploaded=true、入力色を逆順へ変更 | 既存uiIdで再利用。存在しないuiIdは画像なし。辞書の列挙順はassertしない |
| S11 | H/U | 色画像uploaded=falseだがname/type不足 | 新規署名なし。既存画像へのfallbackもなくimage_urlを省略 |
| S12 | H/U | 色削除／uiId変更、既存colorVariantsが空・非配列 | bodyにない色は作成先へコピーしない。旧S3オブジェクトを削除する保証はない |
| S13 | H | 新規index=1のみ／1と3、署名を正順・逆順・混在で完了 | 全署名後に配列を詰める。署名は元index昇順、件数・対応・欠落・重複なし。確定画像も入力順 |
| S14 | H | 異なるuiIdの色画像署名を逆順で完了 | 全件の辞書対応を維持。全Promise完了前にhelperは返らない |
| S15 | H/U | createVideoPresignedPostがundefinedを返す | videoSignedUrl=nullだがvideoUrlは生成。URLチェックでは拒否されない観測（O05） |
| S16 | H | 動画／サムネイル／商品画像／色画像の各署名でreject | 同一例外。動画失敗なら以降なし、サムネイル失敗なら画像なし、商品画像失敗なら色画像なし。開始済み同群Promiseは回収 |
| S17 | H/U | 同一時刻・同一商品に新規アップロードを2回指定 | UUID差で全種類のkeyを区別。1呼出し内では同じnow/UUIDを共有し、別呼出しの結果が混ざらない |
| S18 | H | 動画署名／商品画像の最後の1件をdeferredで保留 | 動画保留中はサムネイルなし、商品画像保留中は色画像なし。解放後に進む |

## 9. ブランド解決とserviceの契約

| ID | レベル | 条件／入力 | 期待結果 |
| --- | --- | --- | --- |
| B01 | H/U | brandIdで既存ブランド取得、nameも指定 | IDを優先。alias・名前検索・作成なし、brandのみ採用 |
| B02 | H/U | IDなし／不在、name=null／空文字 | 両方null。名前検索・作成なし。不在IDを404にしない |
| B03 | H/U | 名前でbrand付きalias取得 | brandとaliasを採用。getBrandOne・作成なし |
| B04 | H/U | aliasなし／未紐付けaliasあり、同正規化名のブランドあり | 名前検索のブランドを採用しalias=null。未紐付けaliasより直接ブランドを優先 |
| B05 | H/U | 未紐付けaliasあり、直接ブランドなし | 既存aliasを採用。作成なし |
| B06 | H/U | alias・ブランドなし、元名長2以上 | createAliasesへ元名・正規化名・同一t。作成結果のaliasと、そのbrandがあればbrandも採用 |
| B07 | H | 元名長0/1/2、空白2つ、絵文字1個 | 0は検索なし、1は検索のみ、2以上は作成候補。判定は正規化前のJS lengthで、空白2つ・絵文字1個も2 |
| B08 | H | 全角英数字・大小文字・カタカナ・空白を含む名前（例：`ＡＢＣ カタカナ`） | NFKC→小文字化→ひらがな化→空白除去し、例では`abcかたかな`で検索。元名を保存用へ渡す |
| B09 | H/U | 各ブランドserviceを保留／reject | 優先順位に従い後段を待つ。失敗は同じError、本体・画像保存なし |

| ID | レベル | 呼出し条件 | 期待する依存呼出し |
| --- | --- | --- | --- |
| SV01 | S | getMyItemEditingにID/userId、transactionなし | ItemEditing.findOneのwhereはid＋seller_id。transaction・lock追加なし、戻り値/null/例外を伝達 |
| SV02 | S | 共通serviceへtransactionあり（補助契約） | 同じtとt.LOCK.UPDATEを指定。このusecaseがロックする証明にはしない |
| SV03 | S | CreateItemDraftにdataとt | ItemDraft.create(data,{transaction:t})を1回、戻ったモデル参照をそのまま返す |
| SV04 | S | updateItemDraftImageにモデル・urls・t | setDataValue("image_url",urls)→changed("image_url",true)→save({transaction:t})。同じ配列参照、空配列も引渡す |
| SV05 | S | create/saveがreject、save保留 | 元例外を伝達。save完了前にはserviceが完了しない |
| SV06 | S | 5種マスター・ブランド主キー・名前・別名検索 | findByPkのID、findOneのname_normalized、aliasのBrands/as="brand" includeが正しい。null/例外も伝達 |
| SV07 | S | createAliasesにt、再検索結果なし | 同じtでbind付きpg_advisory_xact_lock→別名再検索→brand_id=null・元名・正規化名でcreate |
| SV08 | S | ロック後の再検索で別名あり | 既存インスタンスを返しcreateなし。検索・作成はロック完了を待つ |
| SV09 | S | ロック／再検索／作成が個別にreject | 同じError。該当箇所より後の検索・作成なし |
| SV10 | S | createAliasesにtなし（共通serviceの補助分岐） | ロック・再検索なしでcreate。この分岐から並行時の一意性を保証しない |

## 10. DB環境・制約・永続化

### 安全条件とfixture管理

DBテストを実装・実行する段階では、既存PostgreSQLの **`test_db` のみ**を使う。`.env.test` の内容は今回読まない。

1. `server/` を実行ディレクトリとし、DBモジュールの初期化前に `.env.test` を読み、NODE_ENV=testとURLのDB名を検査する。シェルの接続先をそのまま使わない。
2. 引数なしdotenv呼出しが `.env` を開かないよう、参考databaseSetupの方式で検証済み値だけを返す。別ファイル指定・接続設定の後書き換えも拒否する。
3. `src/db.ts`、models/indexの接続、observerなど全接続の設定DB名を接続前に検査し、接続後 `SELECT current_database()` でtest_dbを確認する。それまではfixtureを書き込まない。
4. 読込元・接続先不明、別env、DB名不一致なら中断し、秘密情報を出さず事実・停止位置・書込み有無を報告する。ガードを外したり黙って設定を差し替えたりしない。通信拒否は設定違反と分ける。
5. 必要テーブルはuser、item、item_editing、item_draft、categories、item_condition_option、shipping_day_option、shipping_service_option、todouhuken_option、brands、brand_aliases。関連・NOT NULL・ENUM・文字数・初期値・索引を確認する。DB作成、sync、migration、truncate、全件削除はしない。
6. テストごとの固有名と作成IDで対象を追跡する。usecaseは下書きIDを返さずseller_idも保存しないため、ユーザー条件で下書きを特定しない。テスト用afterCreate hookでIDを記録するか、固有名＋記録済みIDを使う。
7. 途中失敗・rollback済みIDも管理し、Promise/transaction回収後、下書き→編集中商品→公開商品→別名→ブランド・各マスター→ユーザーの依存順で自分が作った行だけ削除する。実際の参照関係に合わせ、残存0件を確認する。採番値を戻さない。
8. observerから新規SELECTで検証する。全ケースを外側transactionで囲ってrollbackする方法だけでは実commitを検証できない。接続・hook・spyを終了し、最後に環境を復元する。

### 主要制約の根拠

| 対象 | モデル／migration上の内容 | テストで区別する点 |
| --- | --- | --- |
| gender_type / age_type | NOT NULL、ENUM、既定unisex/both | 明示nullは既定値にならない。schemaはnullable |
| image_url | nullableなTEXT配列。モデルvalidatorは最大10件 | DB migrationには配列長CHECKがない。モデル拒否だけでDB制約と呼ばない |
| name/title/shipping_service_free_text | nullable VARCHAR(255) | schemaに上限なし。256文字はDB経路で確認 |
| attributes | NOT NULL JSONB、既定{} | undefinedキー省略、0・小数・日本語・配列順を再取得 |
| item_id / seller_id | nullable FK、削除はCASCADE / NO ACTION | このusecaseは値を渡さない。認証成功と所有者保存を混同しない |
| category/condition/配送3種 | nullable FK、削除・更新NO ACTION | 検証後に参照先が消えた場合も書込み時制約が働く |
| brand_id / brand_aliases_id | nullable FK、削除SET NULL、更新NO ACTION | 削除後の関連付けを直接SELECTで確認 |
| brand_aliases.name_normalized | モデルにunique指定なし | この経路のロック＋再検索による抑止と、DB全体の一意制約は別 |

| ID | レベル | 条件／手順 | 期待結果 |
| --- | --- | --- | --- |
| D01 | D | 標準bodyで実usecase成功、observerで新規取得 | 下書き1行増加、N02の全項目・画像順・先頭一致。参照元・他行は不変 |
| D02 | D | 参照元に動画変換済み情報・sale/recommend/割引値を設定して作成 | 作成先sale_flag/recommend=false、duration/converted_url/video_status/割引列はnull。既存値をコピーしない。seller_id/item_idはO02 |
| D03 | D | N04〜N09とI01のnullable ID | JSONBの省略・空配列・在庫0・素材小数・日本語、nullable FKのnullを再取得で確認 |
| D04 | D | gender/ageの全定義値、個別null/不正文字列 | 定義値は保存、null/不正値は拒否・新規行なし。Sequelize validationかDB ENUM/NOT NULLか発生点を記録 |
| D05 | D | 確定画像1/9/10/11件。入力11件だが確定10件も用意 | 1〜10は保存。11は画像saveのモデルvalidationで失敗し本体もrollback。入力枚数でなく確定枚数を判定 |
| D06 | D | name/title/freeTextを各0/254/255/256文字、未登録ブランド名255/256文字 | VARCHAR範囲内を保存、超過は該当書込みで失敗。新規別名・下書き残存なし。日本語でも確認 |
| D07 | D | nullableマスター未選択、0/空白、不存在ID | nullは保存。0が存在しないことを先に確認しFK失敗。通常の不存在は事前404。既存ID=0を削除して準備しない |
| D08 | D | 作成後、fixtureの未紐付けaliasを削除／aliasなしbrandを削除 | 下書きの該当FKだけSET NULL。他の値を維持。独立ケースで他FKの妨害を避ける |
| D09 | D | 独立fixtureに直接SQLでNOT NULL/不正ENUM/存在しないFKを指定 | 実DB制約の型・コードを確認。バインド使用、失敗後rollback。通常usecaseやモデル検証と分けて報告 |
| D10 | D | 参照元item_idあり／null、他ユーザー行・既存下書きを併置 | 所有者一致なら両方から作成可能。参照元・公開商品・既存下書き全列が不変 |

## 11. 状態遷移

このusecaseに「下書き→公開」のstatus遷移はない。状態は新規下書きの生成と、参照元から引き継ぐ／引き継がない値で表す。

| ID | レベル | 操作前 → 操作 | 期待する保存後 |
| --- | --- | --- | --- |
| ST01 | D | 下書きなし → 作成成功 | 新規下書き1行。ItemEditingは残り、Itemの新規作成なし |
| ST02 | D | 既存下書きあり → 同じ参照元から再作成 | 既存行を更新せず別行追加。既存行の全列不変 |
| ST03 | U/D | 参照元在庫initial=10/current=4 → body在庫8 | 新規下書きinitial=current=8、比率0.2。参照元在庫は不変 |
| ST04 | H/D | 変換済み動画あり → 既存利用／新規動画指定 | 既存利用はconverted URLを新下書きoriginal_urlへ、新規は新URL。参照元メディア・状態は不変 |
| ST05 | D | 参照元に色・素材あり → bodyは空 | 新規下書きに旧色・素材を持ち込まない。参照元属性は残る |
| ST06 | D | 参照元video_status=null／任意の既存文字列 | 検索にstatus条件なし。所有権・他条件が満たされれば作成経路へ進む。架空の公開可否エラーを追加しない |
| ST07 | D | 下書き作成途中 → 画像保存失敗 | 下書きは0増加、transaction内の新規別名も0増加、参照元不変 |

## 12. トランザクションと非同期処理

| ID | レベル | 手順／失敗点 | 期待結果 |
| --- | --- | --- | --- |
| T01 | U/S | 正常作成 | managed transaction1回。同じtがresolveBrand→createAliases、CreateItemDraft→Model.create、画像service→saveへ渡る |
| T02 | U | 取得・署名・数値・マスター・ブランド・本体・画像を順番に個別保留 | 各前段完了まで依存する後続なし。transaction完了自体を別gateで保留するとusecaseも未完了 |
| T03 | D | 実本体INSERT完了後、画像保存前に停止 | transaction内では下書きが見え、observerでは見えない。解放して画像保存・commit後は完全な1行が見える |
| T04 | D | 実別名INSERT後に本体作成失敗／実本体INSERT後に画像save失敗 | 別接続で新規別名・下書きとも不存在。作成前からあった別名は残る。各障害を独立ケースにする |
| T05 | D | 実画像save完了後、ラッパーから意図的にthrow | 画像保存まで実行済みでも本体・新規別名はrollback。元モデルの値では判定しない |
| T06 | D | 正常な新規別名＋本体＋画像をcommit前で保留→解放 | observerはcommit前に新規2行を見ず、後に両方を見る。FKと画像が対応する |
| T07 | D | T04のrollback後、同じbodyで正常再試行 | 失敗回の残存なし、成功回の下書き1行・必要な別名1行。ID連番や採番巻戻しは期待しない |
| T08 | U/H | URL／数値／マスター不正 | transaction0回。発行済み署名の取消し・S3削除なし |
| T09 | D | マスター検証完了後に対象マスターを別接続で削除→本体INSERT | 本体がまだ参照していないfixtureで削除commitを確認。以後のFK書込みは失敗し、新規別名もrollback。カテゴリ・状態・配送を個別展開 |

commit障害そのものの再現、ネットワーク切断時のcommit成否不明状態は今回の通常DBテストに含めない。E12は例外伝播だけのモック検証と報告する。

## 13. 重複実行・並行処理

| ID | レベル | 条件／手順 | 期待結果 |
| --- | --- | --- | --- |
| Q01 | U/D | 既存メディアの同一bodyを逐次2回 | 毎回create、下書き2行。業務入力値は一致、別ID。応答にIDは含まれない |
| Q02 | H/D | 新規メディアの同一bodyを同一時刻・別UUIDで逐次2回 | 別キー・別URLの下書き2行。署名・URLを使い回す冪等性なし |
| Q03 | D | 未登録ブランド名で逐次2回 | 下書き2行が同じaliasを参照、別名1行。2回目は既存alias再利用 |
| Q04 | D | 1回目を画像保存失敗、2回目を成功 | T07。失敗時に署名済みでもDB行は成功回のみ。自動再試行はしない |
| Q05 | C/D | サーバー側成功後に応答を失った状況を想定し同bodyを再送 | usecase直接再実行ではもう1行作る。通信障害を実再現したとは報告せず、再送時の非冪等な結果を確認 |

P系は実処理を呼ぶserviceラッパーやhookで待ち合わせる。異なる接続のtransactionを使い、プール枯渇でobserverが待たない構成にする。テストファイルを直列実行しても、ケース内部の競合は明示的に作る。

実行時はtransactionの分離レベルも記録する。P04/P05のロック解除後の再検索はREAD COMMITTEDを前提とするため、実DBの設定を先に確認する。異なる場合は設定を黙って変更せず、期待結果への影響と未確認範囲を報告する。

| ID | レベル | 再現する順序 | 期待結果／観測内容 |
| --- | --- | --- | --- |
| P01 | D | 同じItemEditingをA/Bとも実SELECT→A作成commit→B作成commit（逆順も） | 別下書き2行。異なる名前・価格・属性・画像が各行で対応。参照元不変 |
| P02 | D | 別ユーザー・別ItemEditingで作成を交差させる | 両方成功し入力・URLが混ざらない。保存先所有者はO02の現行挙動を別途記録 |
| P03 | D | A/Bで作成、Aだけ実本体作成後に画像失敗、Bはcommit | A行なし・B行あり。片方rollbackが他方commitを取り消さない。ブランドは既存または別名を分ける |
| P04 | D | 別商品・同正規化名で両方の初期alias検索を未取得→Aがロック・別名INSERT→Bがロック待ち→A commit→B再検索 | 下書き2行、alias1行、双方同じalias ID。Bはロック解除後の再検索結果を採用 |
| P05 | D | P04のAを画像保存でrollback→Bのロック解除・再検索・作成 | A下書き・aliasなし。Bが新規aliasを作って成功し、最終的に下書き1行・alias1行 |
| P06 | D | 異なる正規化名。hashtext値も異なることを確認→Aがロック保持中にBを完了 | BはAの同名ロック待ちを受けず完了、別aliasを参照。ハッシュ衝突がないfixtureでの確認に限定 |
| P07 | D | Aが実ItemEditing取得→別接続でメディア/属性更新commit→Aを解放 | Aの既存再利用は取得済みsnapshot由来。最新値再取得の保証なし。B更新は保持。O04として記録 |
| P08 | D | Aが実取得→別接続でseller変更／ItemEditing削除commit→A作成 | 再認可・再取得がない現行経路をO03として観測。404を当然の期待値にしない |
| P09 | D | resolveBrand取得後、採用するbrand／aliasを別接続で削除commit→下書きINSERT | 書込み時のFK不在で失敗、下書き残存なし。削除対象に他fixtureの参照がないよう用意 |
| P10 | H | 2呼出しの署名を交差、商品画像を逆順、色を逆順で完了 | S13/S14/S17。元index/uiId/リクエストと結果が対応、欠落・上書きなし |

P04/P05では「両方がロック取得後に到達するgate」を置かない。Bはロック待ちのままAのcommit/rollbackを待つ必要がある。ロック要求開始の通知とAの解放を分け、全処理をfinallyで回収する。共通serviceを経由しない任意INSERTまで別名重複を防げるとは主張しない。

## 14. Controller・Router

| ID | レベル | 条件／入力 | 期待結果 |
| --- | --- | --- | --- |
| C01 | C | req.user.id=A、validatedBodyあり、req.body/paramsに別値 | `{ userId:A, body:req.validatedBody }` を1回。同じbody参照。IDはbodyに残し、paramsから別itemEditingIdを組み立てない |
| C02 | C | usecase成功：署名値あり／null・空配列・空辞書 | status(200)と4項目JSON完全一致。下書きIDなど追加なし。nextなし |
| C03 | C | usecaseがAppError／通常Errorをreject | 同じErrorをnextへ1回。status/jsonなし |
| C04 | C | usecaseをdeferredで保留 | 完了前に200を送らない。解放後はC02 |
| R01 | R | トークンなし／Bearer不正／署名不正／期限切れ | 認証実装の401メッセージ。usecase未実行。認証失敗はレート枠を消費しない |
| R02 | R | 正常認証・正常bodyでPOST /api/item-draft | O01。実paramsは空でINVALID_PARAMS・400。body検証・controller・usecase未実行 |
| R03 | R | 正常認証＋不正body、body/queryにidを追加 | params不足が優先しINVALID_PARAMS。body/queryはparamsの代替にならない |
| R04 | R | 同一ユーザー5回→6回、別ユーザー、10分経過後 | 最初5回は制限通過後にparamsで400、6回目429。別ユーザーと時間窓更新後は再びparams400。usecaseは全回未実行 |
| R05 | R | 不正bodyを5回繰返す→正常bodyで6回目 | params/bodyより制限が先のため6回目429。成功要求だけを数えるとは期待しない |
| R06 | R | 無認証＋不正入力／制限超過＋不正入力 | それぞれ401／429が優先。validator・usecaseに到達しない |
| R07 | R | POST /api/item-draft/11 | 現行Routerの定義外で404。`:id`を足せば使えるAPIとして設計しない |

テスト用ExpressにはJSON parserと実Routerを同じ登録パスで接続する。エラー観測用に4引数middlewareを置き、AppErrorのcode/statusCodeを確認する。その結果を実アプリ共通errorHandlerの検証済みとしない。共通errorHandler自体の変更・検証拡大は今回行わない。

JWT鍵はテスト専用の値を生成し、dotenvを制御して実環境の鍵を読まない。レートストアは各テストで分離し、時間操作はDate/intervalなど必要な対象に限定してHTTP I/Oを妨げない。現在のRには成功200やINVALID_BODYまで到達するケースを置けないため、C/V/U/Dでそれぞれの責務を検証する。Router修正が別途指示された時点で、変更根拠と新しい期待結果を追記する。

## 15. 観測事項と未確定の契約

観測ケースの成功は「現行挙動を再現できた」意味に限定する。望ましい仕様や修正済みの保証にしない。下表の見込みはソース読解によるもので、実測結果は将来のtestReportへ分けて記録する。

| ID | レベル | 関連ケース・入力／手順 | 確認する現行挙動と残る判断 |
| --- | --- | --- | --- |
| O01 | R | R02/R03、正しい認証・bodyで実パスへ送信 | `/:id`なしとid必須検証が不整合。INVALID_PARAMSで作成不能の見込み。修正する場合のparams検証の扱いは別タスクで決める |
| O02 | U/D | N02/D02、参照元にseller_id/item_idがある状態で作成 | create dataに両IDなし、モデル・migration上はnullableなのでDBではnullの見込み。所有者保存・元商品との関連が必要かを仕様として確定する。認証しただけで関連付いたと判定しない |
| O03 | D | P08、初回所有権取得後に所有者変更／参照元削除 | 再取得なし、作成先に参照元FKなしのため作成継続の見込み。最終行と取得・変更・commit順を記録。競合時の再認可・中断を保証しない |
| O04 | D | P07、取得後に参照元メディアを別接続で更新 | 古い取得値を使う見込み。参照元の最新状態を自動採用する仕様はない |
| O05 | H/U | S15、動画POST署名境界がundefined | 署名nullでも公開URLを組み立てて作成へ進む。実アップロード可能性は未確認、署名欠落時の業務仕様は未確定 |
| O06 | H/D | I04、schemaを通る負数・小数・Infinity相当のID文字列 | 変換後の検索・DB型・制約のどこで失敗するかを記録。実DB未確認のエラー名・HTTP応答を固定しない |

## 16. 実装順序・実行方法・完了条件

優先度は次のとおり。同一IDが複数値を持つ場合は独立テストへ展開し、設計ID数と実行件数を別集計する。

| 優先度 | ケース群 | 先に確認する理由 |
| --- | --- | --- |
| P0 | N01〜N04、E全件、V01〜V08/V13/V19、D01/D04/D05、T01〜T05、C01〜C03、O01/O02 | 基本保存、所有権、重要境界、停止・rollback、入口と所有者保存の不整合 |
| P1 | 残りのN/V、I01/I02/I05、M/B/S/SV全件、残りD/T、ST全件、C04/R全件 | helper・層間の引渡し、メディア対応、制約、保存状態 |
| P2 | I03/I04、Q/P全件、O03〜O06 | 重複・順序制御した競合・実環境に依存する観測 |

実装時は既存Vitest/Supertestを使い、TypeScript・ESM・相対import `.js` とする。テスト名にIDと日本語の条件・結果を含める。型は既存型・Parameters/ReturnType・型付きmockを優先し、意図的な不正入力とExpress境界以外で型アサーションを増やさない。

将来の実装後は、DBの接続ガードを確認してから `server/` で以下を実行する。

```bash
npm run test:run -- test/usecases/itemDraft/createItemDraft/ --maxWorkers=1
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

`--maxWorkers=1` はDB fixture/hookとレート制限状態のファイル間干渉を抑えるため。ケース内の並行実行は別途P系で制御する。DB非接続の検査とDB検査を分けて結果を記録する。

現在のESLintのTypeScript設定は `src/**/*.ts` が対象であり、npm run lintだけでテストTSを検査済みとしない。実装時は既存ESLint・typescript-eslintを用いたテスト対象の追加検査方法と結果を記録し、そのためだけに既存設定を変更しない。

テスト実装の完了条件は、ケースIDとテストファイルの対応が追え、正常値・後続未実行・awaitの待機・別接続からのDB結果・並行順序・後片付けが確認できること。環境不足・スキーマ不一致・未実装・未実行・観測を成功へ混ぜない。報告書には各コマンド、展開後件数、各IDの実施範囲、モック/実処理、DB読込元とDB名だけの安全確認結果、残る検証を記録する。

**今回の完了範囲は本設計書の作成と記載・リンク・ケース対応・変更範囲の確認まで。テストコードの実装、テスト・lint・型検査・DB接続は行っていない。**
