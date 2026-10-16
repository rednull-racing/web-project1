# 商品編集中データの確定更新：テストコード設計書

## 現在の配置（2026-10-16）

以下は `server/` 基準。旧ファイル名と過去の実行コマンドは当時の記録として残す。

| 分類 | 旧ファイル | 現在の配置 |
| --- | --- | --- |
| 単体 | `usecase.test.ts` | `src/usecases/itemEditing/test/updateConfirm.test.ts` |
| 単体 | `signedUrls.test.ts` | `src/usecases/shared/test/updateConfirm.signedUrls.test.ts` |
| 単体 | `validation.test.ts` | `src/validators/body/test/updateConfirm.test.ts` |
| 単体 | `controller.test.ts` | `src/controllers/itemEditing/test/updateConfirm.test.ts` |
| 単体 | `services.test.ts` | `src/services/itemEditing/test/updateConfirm.test.ts`（5件）、`src/services/brandAliases/test/updateConfirm.brandAliases.test.ts`（5件） |
| 結合 | `masterBrand.test.ts`、`route.test.ts`、`databaseTransactions.test.ts`、`databaseConcurrency.test.ts` | `test/integration/usecases/itemEditing/updateConfirm/` |
| 結合 | `database.test.ts` | `test/integration/database/itemEditing/updateConfirm/` |
| fixture | `fixtures.ts`、`databaseFixtures.ts`、`databaseSetup.ts` | `test/fixtures/itemEditing/updateConfirm/` |
| 設計書 | `testArchitecture.md` | `test/docs/architecture/itemEditing/updateConfirm.md` |
| レポート | `testReport.md`、`afterFix.md` | `test/docs/report/itemEditing/updateConfirm.md` に統合 |

`masterBrand.test.ts` は実usecaseと複数helperを接続するため結合テストに分類した。serviceは本番コードに最も近いディレクトリへ分け、テスト内容・ケースID・期待値は維持した。
単体テストは `npm run typecheck` の本番ビルド対象から除外し、`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` が `src/**/test` と `test` の全テスト・fixtureを型検査する。出力先や本番コードの構成は変更しない。

DB非接続の対象をまとめて実行するコマンド（server/で実行）：

```bash
npm run test:run -- src/usecases/itemEditing/test/updateConfirm.test.ts src/usecases/shared/test/updateConfirm.signedUrls.test.ts src/validators/body/test/updateConfirm.test.ts src/controllers/itemEditing/test/updateConfirm.test.ts src/services/itemEditing/test/updateConfirm.test.ts src/services/brandAliases/test/updateConfirm.brandAliases.test.ts test/integration/usecases/itemEditing/updateConfirm/masterBrand.test.ts test/integration/usecases/itemEditing/updateConfirm/route.test.ts --maxWorkers=1
```

実DBテストは `test/integration/database/itemEditing/updateConfirm/database.test.ts` と `test/integration/usecases/itemEditing/updateConfirm/database{Transactions,Concurrency}.test.ts` を指定する。実行前に既存の `.env.test`・test_db の安全条件を確認する。


## 2026-10-12 P02・P05・P08 修正後の契約（最新）

先行する実装修正に合わせ、対象内のテストだけを移行する。

- P02：初回取得後の並行更新でも、transaction 内で所有者条件付き FOR UPDATE 再取得を行い、後の入力の名称・価格を保存する。初回 SELECT の待合せに再取得は含めない。
- P05：別商品の両 alias 検索を未登録で待ち合わせ、別 transaction で同じ正規化名を作成しても 1 行を共有する。同一商品だけの行ロックで成功したと判定しない。
- P08：初回取得後の削除・所有者変更は 404、ブランド解決・本体/画像更新は未実行。所有者変更の場合は変更後の全列を維持する。
- usecase では再取得の待機・最新インスタンス引渡し・null/例外での停止、service では所有者条件・transaction・ロックを検証する。既存 DB の rollback と逐次再利用も回帰確認する。

## 2026-10-10 DB 追加検証の設計（以下の初回設計に優先）

編集は本ディレクトリ内に限定する。実 usecase・helper・service・モデルと既存 PostgreSQL スキーマを使用し、S3 通信のみ置換する。障害注入・並行順序制御の spy も実処理を呼び、任意の sleep は使わない。

- `databaseSetup.ts`：実 dotenv で `.env.test` だけを読み、既定 dotenv 呼出しにもその値を返す。他ファイルの明示指定、NODE_ENV 不一致、URL/Sequelize/SELECT current_database()の DB 名不一致は停止する。migration、sync、truncate はしない。
- `databaseFixtures.ts`：固有名のユーザー・マスター・商品を作成。作成した ID だけを外部キーの順で削除し、別接続による再取得で commit/rollback を確認する。
- `database.test.ts`：N02〜N08、E01、V09〜V11、I03〜I04、ST01〜ST06・ST08、D01・D03〜D06・D08〜D10、Q01〜Q03、O01〜O02 の永続化・制約・重複実行。
- `databaseTransactions.test.ts`：E12〜E13、ST07、D07、T03〜T05・T07、Q05。本体/画像更新失敗時の全列 rollback、別接続可視性、再試行。
- `databaseConcurrency.test.ts`：P01〜P05・P08、O05。実 SELECT 後に deferred で停止し、指定順 commit、別商品並行、片方 rollback、別名同時作成、所有者変更・削除を検証。SQL と最終行を併せて確認する。

初回報告から変わった契約：現行の共通 helper は `src/usecases/shared/` にある。空画像は ITEM_IMAGE_NULL で保存前に拒否。ブランド名検索結果・新規 alias は保存へ採用され、既存 alias を逐次再利用する。resolveBrand→createAliases へ同じ transaction が渡されるため、T05/Q05 は alias も rollback することを期待する。並行作成の一意性は実 DB を確認して観測として記録する。分類の null は DB で許可された列だけに設定し、NOT NULL の layer は null fixture を作らない。

境界は gender/age の全定義値・null・不正値、画像 1〜10/11 件、name/title/freeText の 0/255/256 文字、各 ID の 0/空白/負数/小数/Infinity を個別展開する。各失敗で更新前後の全列一致、必要な後続未実行を確認する。正常時は全保存項目と非対象行の不変を確認する。

実行：`server/` で対象ディレクトリの Vitest、lint、アプリ/テストの型検査を行う。安全条件に違反した場合はテストを中断し、ユーザーの判断を待つ。結果と旧報告からの差分は testReport.md/afterFix.md へ追記する。

## 1. 目的と対象範囲

対象は `server/src/usecases/itemEditing/updateConfirm.ts` の `updateItemEditingConfirmUseCase()`。正常系、異常系、境界値、条件分岐、状態遷移、DB 整合性、トランザクション、重複実行、並行処理を確認するための設計をまとめる。

本書は現行コードを根拠とする。テストコードの実装、既存コードの修正、既存エラーへの対応、マイグレーションの実行は今回の対象外とする。期待結果がコードだけでは確定しないケースは「観測」と明記し、未実装の保証を成功条件にしない。

### 調査した関連ファイル

パスは `server/` からの相対パス。

| 責務                                           | ファイル                                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| usecase                                        | `src/usecases/itemEditing/updateConfirm.ts`                                                                                               |
| URL 生成・数値変換・マスター検証・ブランド解決 | `src/usecases/itemEditing/shared/{buildSignedUrls,validateNumber,validateMaster,resolveBrand}.ts`                                         |
| 取得・更新                                     | `src/services/itemEditing/{query,command}.ts`                                                                                             |
| マスター取得                                   | `src/services/{categories,itemConditionOption,shippingDayOption,shippingServiceOption,todouhuken}/<同名>.ts`                                     |
| ブランド取得・別名作成                         | `src/services/{brands,brandAliases}/<同名>.ts`                                                                                                   |
| controller・route                              | `src/controllers/itemEditing/itemEditing.ts`、`src/routes/itemEditing.ts`、`src/routes/index.ts`                                                      |
| 入力検証                                       | `src/middleware/validate/{validateBody,validateParams}.ts`、`src/validators/body/itemEditing.ts`、`src/validators/params/id.ts`           |
| 認証・制限・エラー                             | `src/middleware/authMiddleware.ts`、`src/middleware/rateLimit/itemEditingRateLimit.ts`、`src/middleware/errorHandler.ts`、`src/errors.ts` |
| 補助処理                                       | `src/utils/{toNullableNumber,normalizeJapanese}.ts`、`src/utils/s3/{signedUrl,videoPresignedPost}.ts`                                     |
| モデル・型                                     | `src/models/{item_editing,brand_aliases}.ts`、`src/types/serviceType/itemEditing.ts`                                                      |
| DB 定義資料                                    | `migrations/20261005114144-create-item-editing.js`、`migrations/20261006044423-update-column-item-editing.js`                             |
| 既存テストの形式                               | `test/usecases/shopSignup/signup2.test.ts`、`test/AGENTS.md`                                                                              |

実 DB のスキーマは未確認。DB テストの実装時は、反映済みスキーマを確認して制約に関する期待結果を確定する。

## 2. 処理の流れと責務の境界

1. Router の `PUT /:id` は、認証 → ユーザー単位のレート制限 → params 検証 → body 検証 → controller の順に処理する。
2. Controller は `Number(req.params.id)`、`req.user.id`、`req.validatedBody` を usecase へ渡す。
3. `getMyItemEditing` は `id` と `seller_id` の両方で検索する。未取得なら `ITEM_EDITING_NOT_FOUND / 404`。
4. `buildSignedUrls` が既存 URL と新規アップロード用 URL を組み立てる。
5. 動画 URL、サムネイル URL、商品画像配列を順番に確認する。
6. ID 文字列を数値または null へ変換し、カテゴリ・商品状態・配送マスターの存在を確認する。
7. ブランドを解決する。条件によってブランド別名を作成する。
8. managed transaction 内で `updateConfirm`、`updateItemEditingImage` を順に実行する。
9. transaction 成功後、署名情報 4 項目を返す。Controller はそれを 200 の JSON として返し、例外は `next(err)` に渡す。

### 設計時に区別する事項

- 入力 schema は usecase の外側にある。usecase を直接呼んでも `INVALID_BODY` は発生しない。
- 所有権の検索、URL 生成、マスター取得、ブランド解決は商品更新 transaction の外側にある。
- URL 発行はファイルのアップロード完了を意味しない。S3 への実アップロード・動画変換・公開処理はこの usecase の責務ではない。
- `video_status` の絞り込み・更新はない。公開状態への遷移を期待しない。
- `if (!finalImageUrls)` は空配列を拒否しない。実 helper は常に配列を返すため、`ITEM_IMAGE_NULL` は通常の入力では到達しない防御分岐である。
- Router 単体テストはテスト用 Express アプリへ明示的にマウントする。調査時点の `routes/index.ts` にはこの Router の登録がないため、Router 単体の成功を実アプリのエンドポイント到達性の証明としない。

## 3. テストの分け方

| 記号 | レベル                          | 実処理にする範囲・確認目的                                                                                  |
| ---- | ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| U    | usecase 単体                    | usecase を実行。service、shared helper、transaction をモックし、引数・更新値・呼出順序・例外伝播を確認      |
| H    | helper 単体／usecase との組合せ | URL 生成、数値変換、マスター検証、ブランド解決を実行。DB service と S3 署名関数をモックし、内部の分岐を確認 |
| V    | validator・middleware 単体      | 実 schema の safeParse と実 validateBody／validateParams を確認                                             |
| C/R  | controller 単体／Router 結合    | usecase をモック。C は引数と next、R は実 validator・認証・レート制限の接続を確認                           |
| D    | DB 結合                         | 実 usecase・service・Sequelize・専用 PostgreSQL を使用。S3 署名のみモックし、再取得した永続データを確認     |

Vitest を使用し、Router 結合には既存の Supertest を使用する。新しいライブラリは追加しない。U で全 helper をモックしただけでは、所有権の SQL 条件、URL の引き継ぎ、マスター検証、rollback を検証したことにはしない。

### 共通データとアサーション

- 所有者 A（例：7）、別ユーザー B（例：8）、A の編集中商品（例：11）、B の商品、各マスターの有効レコードを用意する。
- 標準 body は schema を通過させる。価格 300、在庫 1、gender=`unisex`、age=`both`、有効な ID 文字列、商品画像 1 枚を基本とする。
- 既存データに動画・サムネイル・商品画像の別々の URL、複数の uiId と属性画像を用意する。変換済み動画あり／なしは別 fixture にする。
- 正常系は既存ブランド ID を用い、意図しない別名作成を避ける。ブランド関連ケースだけ専用 fixture へ差し替える。
- 各テストで body・JSON 属性・モデル相当オブジェクトを新しく作り、前のテストの変更やモック設定を引き継がない。
- 更新前後で異なる価格・名称・画像を使用する。DB テストでは元のモデルインスタンスではなく、新たな SELECT で検証する。
- AppError は `instanceof AppError`、`code`、`statusCode` を確認する。予期しない例外は同じ Error オブジェクトが伝播することを確認する。
- 異常系では、例外だけでなく「後続処理が実行されないこと」「書込みの有無」も確認する。
- U の transaction モックは callback へ同一の transaction オブジェクトを渡し、その Promise を await する。rollback 自体は D で検証する。

## 4. 正常系・更新データの対応

| ID  | レベル | 条件・入力                                                      | 期待結果                                                                                                                                      |
| --- | ------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| N01 | U      | 全項目を指定して更新                                            | 所有権取得 → URL 生成 → 数値変換 → マスター検証 → ブランド解決 → transaction → 本体更新 → 画像更新の依存順になる。戻り値は署名情報 4 項目のみ |
| N02 | U/D    | 商品・動画・配送情報を変更                                      | 下表の全保存項目が一致する。更新対象 ID・所有者を変更しない                                                                                   |
| N03 | U/D    | detail と summary が null／空文字／通常文字列                   | null だけ空文字へ変換。空文字と通常文字列はそのまま保存                                                                                       |
| N04 | U/D    | 全体・色・サイズの在庫がそれぞれ 0／1／複数                     | 各階層の initial と current が入力値になり、low_stock_ratio は 0.2。0 を 1 に置換しない                                                       |
| N05 | U/D    | 色・サイズ・素材が複数                                          | 入力順、uiId、色、サイズ、在庫、素材名、比率を保持。色画像は配列順ではなく uiId で対応する                                                    |
| N06 | U/D    | colorVariants、materials が空、ある色の sizes が空              | colorVariants と materials は更新オブジェクト上 undefined、sizes は空配列。DB の JSON 表現は再取得して確認                                    |
| N07 | U/D    | カテゴリ分類あり／各分類 null／カテゴリ未選択                   | body_category・lifestyle_category・layer は DB 取得値から設定し、null またはカテゴリなしは undefined                                          |
| N08 | U/D    | brand、alias が両方あり／brand のみ／両方なし                   | brand_id と brand_aliases_id が解決結果の ID または null になる                                                                               |
| N09 | U      | 任意の色名なし、属性画像の uiId に対応 URL なし                 | color と image_url は undefined。空文字の色名・サイズ名は空文字のまま                                                                         |
| N10 | U      | 型境界外の防御分岐として在庫値を null／undefined にした fixture | 全体・色・サイズ在庫は 1 へ補完。通常 HTTP 経路では到達しないことを明記し、schema の正常系とは分離                                            |

### 保存項目の確認表（N02 の詳細）

| 保存先                                                    | 入力・計算元                                           |
| --------------------------------------------------------- | ------------------------------------------------------ |
| name / detail                                             | itemMeta.name / itemMeta.detail ?? 空文字              |
| price / before_price                                      | いずれも body.price                                    |
| first_image_url / image_url                               | finalImageUrls[0] / finalImageUrls 全体                |
| category_id / item_condition_id                           | 数値変換した category.id / condition.id                |
| gender_type / age_type                                    | genderAge.gender / genderAge.age                       |
| brand_id / brand_aliases_id                               | ブランド解決結果の ID、なければ null                   |
| attributes.inventory                                      | allInventory から initial と current、固定値 0.2       |
| attributes.colorVariants                                  | uiId・color・色在庫・uiId 対応画像・サイズとサイズ在庫 |
| attributes.materials                                      | name・ratio のみ                                       |
| attributes の分類 3 項目                                  | categoryOption から取得                                |
| title / summary                                           | videoMeta.title / videoMeta.summary ?? 空文字          |
| original_url / thumbnail_url                              | helper が返す確定 URL                                  |
| shipping_day_id / shipping_service_id / shipping_place_id | shipping の各 ID を数値変換                            |
| shipping_service_free_text                                | shipping.freeText（null・空文字も保持）                |

## 5. 異常系・処理打切り

表の各依存処理は、ほかの条件を正常にして個別に失敗させる。

| ID  | レベル | 条件                                                                       | 期待結果・未実行処理                                                                                                              |
| --- | ------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| E01 | U/D    | 対象 ID なし／他ユーザー所有／seller_id が null                            | `ITEM_EDITING_NOT_FOUND / 404`。URL 生成以降は未実行。B の商品は変更されない                                                      |
| E02 | U/H    | videoUrl が null または空文字                                              | `VIDEO_URL_NULL / 400`。数値検証以降は未実行                                                                                      |
| E03 | U/H    | 動画は有効、thumbnailUrl が null または空文字                              | `THUMBNAIL_URL_NULL / 400`。数値検証以降は未実行                                                                                  |
| E04 | U      | helper モックの finalImageUrls を null／undefined にする                   | `ITEM_IMAGE_NULL / 400`。防御分岐専用。通常 helper 経由の入力ケースとは区別                                                       |
| E05 | H/U    | 各 ID に非数値文字列を 1 項目ずつ指定                                      | `INVALID_NUMBER / 400`。マスター検証、ブランド解決、商品 transaction は未実行。URL 生成は先に完了し得る                           |
| E06 | H/U    | カテゴリだけ存在しない                                                     | `CATEGORY_NOT_FOUND / 404`。以降のマスター・ブランド・商品更新は未実行                                                            |
| E07 | H/U    | 商品状態だけ存在しない                                                     | `ITEM_CONDITION_NOT_FOUND / 404`。配送マスター以降は未実行                                                                        |
| E08 | H/U    | 配送日だけ存在しない                                                       | `SHIPPING_DAY_NOT_FOUND / 404`。配送サービス以降は未実行                                                                          |
| E09 | H/U    | 配送サービスだけ存在しない                                                 | `SHIPPING_SERVICE_NOT_FOUND / 404`。発送元以降は未実行                                                                            |
| E10 | H/U    | 発送元だけ存在しない                                                       | `PLACE_NOT_FOUND / 404`。ブランド以降は未実行                                                                                     |
| E11 | U/H    | 取得 service、各 S3 署名、各マスター service、各ブランド service で reject | 元の例外を伝播し、商品 transaction を開始しない。Promise.all 内ですでに開始した署名処理まで取消されるとは期待しない               |
| E12 | U/D    | updateConfirm が reject                                                    | 画像更新は未実行。usecase は reject し、DB は更新前のまま                                                                         |
| E13 | U/D    | 本体更新成功後、画像 save が reject                                        | 成功戻り値を返さない。DB は本体・画像とも更新前へ rollback                                                                        |
| E14 | U      | transaction の開始または完了で reject                                      | 元の例外を伝播。開始失敗時は callback 未実行。commit 失敗時の実 DB 結果は障害条件に依存するためモックで rollback 成功を断定しない |
| E15 | U/H    | 複数の不備を同時指定                                                       | 商品未取得が URL 不備に優先、動画不備がサムネイル不備に優先、数値不正がマスター不在に優先する                                     |

## 6. 入力検証・境界値

V の拒否ケースは `INVALID_BODY / 400`（params は `INVALID_PARAMS / 400`）になり、controller/usecase が呼ばれないことまで R の代表ケースで確認する。usecase に schema 検証を追加した前提にはしない。

| ID  | レベル | 対象・入力値                                                                      | 期待結果                                                                                                            |
| --- | ------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| V01 | V      | price：299、300、301、999999、1000000、1000001                                    | 300〜1000000 のみ受理                                                                                               |
| V02 | V      | price：0、負数、小数、数値文字列、null、欠落                                      | 拒否。数値文字列の自動変換なし                                                                                      |
| V03 | V      | 全体／色／サイズの inventory：-1、0、1、小数、文字列、null、欠落                  | 0 以上の整数のみ受理。各階層を独立に確認                                                                            |
| V04 | V      | material.ratio：-0.01、0、0.01、99.99、100、100.01                                | 0〜100 は小数も受理。null・欠落・文字列は拒否                                                                       |
| V05 | V      | category.level：0、1、2、1.5、文字列                                              | 1 以上の整数のみ受理                                                                                                |
| V06 | V      | 必須オブジェクト、配列、各必須フィールドを 1 つずつ欠落／型違い                   | 拒否。nullable なフィールドも、optional でなければ欠落は拒否                                                        |
| V07 | V/H    | video／thumbnail を省略、name／type を省略、uploaded を省略                       | ファイル自体と name・type の省略は受理。ファイルがある場合の uploaded 欠落は拒否。URL 生成条件は別途 S 系で検証     |
| V08 | V      | category.id、brand.id/name、shipping 各値、summary、detail が null                | 受理。condition.id の null は拒否。condition.id の空文字は受理                                                      |
| V09 | V/D    | gender・age：定義済み文字列／null／任意文字列                                     | schema はいずれも受理。DB は NOT NULL・ENUM 制約があるため、null／不正値の永続化は DB 側で拒否し商品更新を rollback |
| V10 | V/D    | itemImages：0、1、10、11 件                                                       | schema はすべて受理。実際に確定する画像 URL が 11 件ならモデル検証で拒否。0 件は O01、1・10 件は保存を確認          |
| V11 | V/D    | name、title、shipping.freeText：空文字、255 文字、256 文字                        | schema はいずれも受理。DB の VARCHAR(255)対象は 256 文字を拒否し rollback。日本語文字列でも確認                     |
| V12 | V/H    | 空の colorVariants・sizes・materials、素材比率合計が 100 以外、重複 uiId、空 uiId | schema には件数下限・合計値・一意性の制約なし。受理した後の現行挙動を確認し、独自の拒否を期待しない                 |
| V13 | V/H    | 商品画像 type が null／空文字、ファイル type が任意文字列                         | schema は受理。type が falsy なら署名を作らない。MIME 許可リストの検証は行われない                                  |
| V14 | V/C    | body に seller_id、status 等の未知キーを追加                                      | parse 後の未知キーは除去され、req.validatedBody へ格納。所有者には req.user.id を使用                               |
| V15 | V/R    | params.id："1"、"0"、"-1"、"1.5"、"abc"                                           | 正の整数として変換可能な値のみ受理。正常時は validatedParams に数値が入る                                           |
| V16 | V      | 成功／失敗時の validateBody                                                       | 成功時は parse 済みデータを設定し next を 1 回呼ぶ。失敗時は AppError を throw し、正常系の next を呼ばない         |
| V17 | V/H    | 在庫の大きな整数、長い説明文、多数の色・サイズ                                    | 明示的な業務上限がない項目に架空の上限エラーを設定しない。代表的な複数件で値の保持を確認。負荷試験は別範囲          |

### 数値変換とマスター照合

以下は category.id、condition.id、shipping.day/service/place、brand.id に対し、schema で許される型の範囲でパラメータ化する。

| ID  | レベル | 入力                             | 期待結果                                                                                                                             |
| --- | ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| I01 | H      | null、空文字                     | null へ変換。condition.id の null は HTTP では到達しない                                                                             |
| I02 | H      | "1"、"01"、" 1 "、"1e2"          | Number の結果である 1、1、1、100 を渡す                                                                                              |
| I03 | H/D    | "0"、空白だけの文字列            | 0 へ変換。5 種類のマスター照合はスキップするが保存値は 0。参照先 ID=0 がなければ DB 外部キー制約で拒否                               |
| I04 | H/D    | "-1"、"1.5"、"Infinity"          | 変換関数は NaN 以外を拒否しない。後続 service へ渡る値を確認。DB の取得結果・型制約に応じた失敗を観測し、INVALID_NUMBER と断定しない |
| I05 | H      | "abc"、"NaN"                     | INVALID_NUMBER。複数不正時は category→condition→day→service→place→brand の順に停止                                                   |
| I06 | H      | 各マスター ID が null／0／有効値 | null と 0 は取得なし、有効値は対応 service へ正しいキー名で 1 回渡す。brandId=0 は resolveBrand では getBrand の対象となる           |

## 7. 署名 URL・既存画像の条件分岐

Date.now を固定し、公開 S3 ドメインと署名関数をモックする。署名文字列そのものの AWS 実装を usecase テストで再現しない。

| ID  | レベル | 条件                                                                | 期待結果                                                                                                                                   |
| --- | ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| S01 | H/U    | 動画の name・type あり、uploaded=false                              | POST 署名へ `video/original/{userId}/{itemEditingId}_{now}`、contentType、上限 `500 * 1024 * 1024` を渡す。original_url は対応する公開 URL |
| S02 | H      | 動画省略／uploaded=true／name が空・欠落／type が空・欠落           | 署名なし。converted_url → original_url → null の順に採用。空文字は nullish fallback の対象外で、最終チェックで拒否される                   |
| S03 | H      | 変換済み動画がある状態で新規動画を指定                              | 新規 URL を original_url に使用。converted_url 自体のクリアや video_status 変更はこの usecase では行わない                                 |
| S04 | H      | サムネイルの新規指定／既存利用／必須情報不足                        | 新規なら `thumbnail/{userId}/{itemEditingId}_{now}` を署名。それ以外は既存 thumbnail_url を利用し、なければ E03                            |
| S05 | H      | 商品画像の新規・既存を交互に指定                                    | 新規は `item-image/{userId}/{itemEditingId}_{index}_{now}`。既存は DB の同じ入力 index の URL。確定画像は入力順に並ぶ                      |
| S06 | H      | uploaded=true で DB の該当 index がない／image_url が null          | 対応画像は確定配列に追加しない。ユーザーの name を既存 URL として使用しない                                                                |
| S07 | H      | 商品画像 name が空、type あり、uploaded=false                       | 商品画像の署名条件は name を参照しないため署名される                                                                                       |
| S08 | H      | 新規商品画像 type が null／空文字                                   | 署名せず確定 URL にも追加しない。全画像が該当する場合は O01 へ                                                                             |
| S09 | H      | 色画像 name・type あり、uploaded=false                              | `attributes/{userId}/{itemEditingId}_{uiId}_{now}` を署名。署名辞書と確定 URL 辞書のキーが uiId に一致                                     |
| S10 | H      | 色画像省略／uploaded=true、色配列を並び替え                         | 既存の uiId が一致する画像を引き継ぐ。該当 uiId に既存画像がなければ undefined                                                             |
| S11 | H      | 色画像 uploaded=false だが name／type が不足                        | 新規署名なし。既存画像への fallback もなく、確定属性画像辞書に入らない                                                                     |
| S12 | H      | 色を削除／新しい uiId に置換                                        | 今回 body にない色画像は保存属性へ含まれない。S3 上の旧オブジェクト削除は実行しない                                                        |
| S13 | H      | 商品画像署名を逆順完了、index=1 のみ新規、複数の離れた index が新規 | 確定画像の入力順を確認。返却署名は元 index と URL の対応・件数・欠落・重複を観測する。非同期完了順に対する配列の保証は O03 で扱う          |
| S14 | H      | 色画像署名を逆順完了                                                | 一意 uiId なら辞書の対応は維持。オブジェクトの列挙順は assert しない                                                                       |
| S15 | H      | 動画 POST 署名関数が undefined を返す                               | videoSignedUrl は null だが新規 videoUrl は組み立てられる。署名が null であることだけを理由に VIDEO_URL_NULL とはならない                  |

## 8. ブランド解決の条件分岐

`resolveBrand` の戻り値と別名作成の副作用を分けて確認する。新規作成した alias がそのまま商品へ関連付くとは限らない。

| ID  | レベル | 条件                                                              | 現行コードに基づく期待結果                                                                                            |
| --- | ------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| B01 | H/U    | 指定 brandId が存在、brand.name も指定                            | ID のブランドを採用。別名検索・名前検索・作成は行わない                                                               |
| B02 | H/U    | ID 未指定または見つからず、name も null／空文字                   | brand・alias とも null。ブランド不在を 404 にはしない                                                                 |
| B03 | H      | 名前検索へ進む、対応 brand 付き alias あり                        | その brand・alias を返す。その後 getBrandOne も実行する                                                               |
| B04 | H      | 全角英数字、大小文字、カタカナ、空白を含む名前                    | NFKC → 小文字化 → ひらがな化 → 空白除去した値で両検索を行う。createAliases には元名と正規化名を渡す                   |
| B05 | H/U    | alias なし、getBrandOne でブランドが見つかる                      | 作成なし。現行処理ではその検索結果を brandResult へ代入しないため戻り値は両方 null                                    |
| B06 | H/U    | ブランドなし、名前長 0／1／2 文字                                 | 0 は名前検索なし。1 は検索するが作成なし。2 以上は createAliases を 1 回呼ぶが、作成結果は brandResult へ反映されない |
| B07 | H      | brand を持たない alias あり、getBrandOne は null                  | 名前が 2 文字以上なら別名作成へ進む。既存の未紐付け alias があるだけでは作成を抑止しない                              |
| B08 | H      | brand 付き alias あり、getBrandOne は null                        | 既存 alias のブランドを返しつつ、名前が 2 文字以上なら別名作成も行う                                                  |
| B09 | H      | 元の名前が空白 2 文字／絵文字 1 個                                | 判定は正規化前の JavaScript 文字列 length。正規化後の長さや見た目の文字数による下限と混同しない                       |
| B10 | H/U    | getBrand、getAliasOne、getBrandOne、createAliases が個別に reject | 元の例外が伝播。商品更新 transaction は開始しない                                                                     |

## 9. 状態遷移

ここでいう状態は、編集中データ・メディア・在庫の保存前後を指す。公開処理の状態機械は含めない。

| ID   | レベル | 更新前 → 操作                                     | 期待する保存後                                                                                           |
| ---- | ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ST01 | D      | 未入力の編集中データ → 必要なメディアと項目を入力 | 同じ item_editing 行に保存。行数増加・Item の新規作成はない                                              |
| ST02 | D      | 保存済み → 名称・価格・画像・配送を変更           | 指定値へ上書き。before_price も今回価格。seller_id、item_id、createdAt は維持                            |
| ST03 | U/D    | 在庫 initial=10、current=4 → inventory=8          | initial・current とも 8 になる。以前の消費差分を引き継ぐとは期待しない                                   |
| ST04 | D      | 複数色・素材あり → 空配列で更新                   | attributes 全体が今回の構造に置換され、旧色・素材が残らない。JSON の undefined キーは保存表現で確認      |
| ST05 | H/D    | メディア保持 → 一部だけ差し替え                   | 差替え対象のみ新規 URL へ変更。ただし動画未変更時は converted_url が original_url より優先される         |
| ST06 | U/D    | video_status が null／既存の異なる値              | 取得に状態条件がなく、値によらず同じ更新経路。video_status・converted_url・duration は変更しない         |
| ST07 | D      | 任意の保存済み状態 → 更新途中で失敗               | item_editing の更新対象カラムは更新前へ戻る。ブランド別名は T05 の別範囲                                 |
| ST08 | D      | sale_flag・割引値あり → 価格変更                  | price と before_price を更新。sale_flag・discount_rate・discount_amount は現状維持で、再計算を期待しない |

## 10. DB 整合性・service 契約

| ID  | レベル         | 確認内容                                       | 期待結果                                                                                                            |
| --- | -------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| D01 | service 単体/D | getMyItemEditing の検索条件                    | where は id と seller_id の両方。他ユーザーの行を返さない。取得 transaction・lock・status 条件は追加されない        |
| D02 | service 単体   | updateConfirm                                  | 受け取った itemEditing.update へ data と同じ transaction を渡す                                                     |
| D03 | service 単体/D | updateItemEditingImage                         | setDataValue("image_url", urls) → changed("image_url", true) → save({ transaction })。配列変更が DB へ永続化される  |
| D04 | D              | 画像 1〜10 件の更新                            | image_url の順序が一致し、first_image_url がその先頭と一致。画像専用の別行を追加する設計ではない                    |
| D05 | D              | JSONB の更新                                   | 在庫 0・素材小数・日本語文字列・uiId と画像対応を保持。undefined は DB 再取得でキー省略になる点を区別               |
| D06 | D              | 有効な外部キー／nullable ID                    | 各参照が有効、許容列は null で保存。入力の category.name・parent_id・level を根拠に DB 分類を上書きしない           |
| D07 | D              | 参照マスターを検証後・更新前に削除             | 書込み時に参照が消えていれば制約エラーとなり、商品更新全体が rollback する。検証済みという理由で成功扱いにしない    |
| D08 | D              | 他の編集中商品と対応 Item を併置               | 対象以外の行、公開側 Item、所有者・関連商品 ID を変更しない                                                         |
| D09 | D              | 画像 11 件、長さ超過、不正 ENUM をそれぞれ保存 | モデル／DB 制約の発生点を確認し、途中の本体更新が残らない。11 件制限はモデル validator であり DB CHECK と断定しない |
| D10 | D              | item_id あり／null                             | 反映済み DB が nullable なら両方更新可能。テスト開始時に適用済みスキーマを確認し、モデルだけで判断しない            |

## 11. トランザクション

| ID  | レベル | 操作・失敗点                           | 期待結果                                                                                                  |
| --- | ------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| T01 | U      | 正常更新                               | managed transaction を 1 回開始し、両更新 service へ同一 t を渡す                                         |
| T02 | U      | 本体更新を保留して後で resolve         | resolve 前に画像更新を開始しない。画像更新と transaction 完了前に usecase が成功しない                    |
| T03 | D      | 本体更新後、画像更新を意図的に失敗     | 新しい接続または新規 SELECT で価格・名称・attributes・URL・画像がすべて更新前であることを確認             |
| T04 | D      | 両更新成功                             | commit 後に別接続から両方の変更が見える                                                                   |
| T05 | H/D    | 未登録名から別名作成後、商品更新を失敗 | 商品は rollback するが、別名作成は商品 transaction 外のため残り得る。全関連テーブルの原子性は保証されない |
| T06 | U/H    | 数値／マスター検証で失敗               | 商品 transaction は 0 回。署名は検証前に発行済みの場合がある。署名の取消しや S3 削除は期待しない          |
| T07 | D      | rollback 後に同じ内容で再試行          | 商品の部分更新が残らず、次の正常操作が成立する。別名件数は別途 Q03 で観測                                 |

DB テストを外側の transaction で一律に囲むと、transaction 外の別名作成や別接続からの可視性を誤認しやすい。専用 DB・テストごとの識別子・明示的な後片付けを使い、実際の transaction 境界を維持する。S3、通知、ジョブの実行は不要。

## 12. 重複実行

| ID  | レベル | 操作                                                 | 期待結果・観測内容                                                                                                                              |
| --- | ------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Q01 | H/D    | 既存 URL を使う同じ body を逐次 2 回実行             | 同じ行を 2 回更新。行数は増えない。converted_url なし、既存ブランド ID ありの fixture では業務値は一致。updatedAt や SQL 回数まで不変とはしない |
| Q02 | H/D    | 新規アップロード指定の同じ body を異なる時刻で再実行 | 時刻に応じた新規キーと署名を発行し、後の URL で上書きする。署名結果を再利用する冪等性はない                                                     |
| Q03 | H/D    | 同じ未登録ブランド名で再実行                         | 条件を満たすたび createAliases へ進み得る。モデルに正規化名の unique 指定はない。実 DB の制約確認後、別名件数と商品への関連付けを観測           |
| Q04 | H      | 同一商品・同一ミリ秒で新規メディアを指定             | 同じ種類・index・uiId のキーが一致する。リクエストごとに必ず一意とは期待しない                                                                  |
| Q05 | D      | 初回が画像保存で失敗し、再実行                       | 商品は成功した回の内容になる。初回別名の残存と追加件数を確認し、自動再試行や重複排除は期待しない                                                |
| Q06 | R      | 同一ユーザーが 10 分間に 6 回送信                    | 最初の 5 回は後続へ進める。6 回目は 429 で usecase 未実行。重複排除の保証とレート制限を混同しない                                               |

## 13. 並行処理

単純な `Promise.all` と待ち時間だけでは再現性が足りない。deferred Promise やテスト側の service ラッパーで「両方の取得完了」「A の commit 完了」等を待ち合わせ、開始・完了の順序を制御する。実装側へテスト用処理を追加しない。

| ID  | レベル | 再現する順序                                                             | 期待結果・観測内容                                                                                                                        |
| --- | ------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| P01 | D      | 同じ商品を A/B が取得 → A が全更新を commit → B が全更新を commit        | 楽観ロック・競合 409 の実装はない。異なる名称・価格・画像を双方で指定し、通常の上書き結果と完了順を確認。要求の開始順だけで勝者を決めない |
| P02 | D      | 取得時は同じ旧データ → A だけが変える項目と B だけが変える項目を含め更新 | Sequelize の変更検知により更新 SQL の列が異なり得る。単純な「後勝ちで body 全体置換」を保証せず、混在・更新喪失の有無を O05 として観測    |
| P03 | D      | A の商品と B の商品を別接続で同時更新                                    | 双方の正しい行へ保存され、他方の画像・属性・所有者が混ざらない                                                                            |
| P04 | D      | 同じ商品へ 2 件、片方だけ画像保存で失敗                                  | 失敗 transaction の変更は残らず、成功 transaction の変更は残る。片方の rollback が他方の commit を取り消さない                            |
| P05 | H/D    | 同じ未登録名で両方の検索が「なし」→ 別名作成                             | 重複作成または実 DB 制約エラーを観測。排他・upsert・一意性を勝手に仮定しない                                                              |
| P06 | H      | 商品画像署名の完了順を正順／逆順／混在に制御                             | URL と元 index の対応・件数が期待どおりか確認。O03 の観測結果として記録                                                                   |
| P07 | H      | 同一 uiId の色を 2 つ指定し、属性署名を並行完了                          | 辞書のキーが共有される現行結果を観測。一意な画像割当てや重複 uiId 拒否は保証されない                                                      |
| P08 | D      | 所有権確認後、別接続で対象削除／所有者変更してから更新                   | 取得後の再認可・更新行数検証は実装されていない。成功／例外と最終 DB を観測し、404 や変更阻止を保証として書かない                          |

## 14. Controller・Route との接続

| ID  | レベル | 条件                                                  | 期待結果                                                                                                                        |
| --- | ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| R01 | C      | req.params.id="11"、req.user.id=7、validatedBody あり | `{ itemEditingId: 11, userId: 7, body: req.validatedBody }` を 1 回渡す。req.body の未検証値は渡さない                          |
| R02 | C/R    | usecase 成功                                          | 200、videoSignedUrl・thumbnailSignedUrl・itemImageSignedUrls・attributesImageSignedUrls のみの JSON。null、空配列、空辞書も保持 |
| R03 | C      | AppError／通常 Error で usecase が reject             | 同一エラーを next へ 1 回渡し、200 レスポンスを送らない                                                                         |
| R04 | R      | トークンなし／不正／期限切れ                          | 401。usecase 未実行。認証 middleware 自身のレスポンスを確認し、AppError 形式を強制しない                                        |
| R05 | R      | ID 不正／body 不正／両方不正                          | params 検証が body 検証より先。controller 未実行。観測した AppError の code・statusCode を確認                                  |
| R06 | R      | 同一ユーザー 5 回 →6 回、別ユーザー、時間窓更新       | 5 回まで通過、6 回目は 429、別ユーザーは別枠、10 分窓経過後は再び通過。各テストでストアを分離                                   |
| R07 | R      | 不正 body を繰り返す                                  | レート制限が validator より前なので不正 body のリクエストもカウントされる                                                       |
| R08 | C/R    | body に別の userId や seller_id を混入                | usecase へ渡す所有者は常に認証ユーザーの ID                                                                                     |

Router テストでは最小の Express アプリに JSON parser と対象 Router を接続する。エラー観測にテスト専用の 4 引数 error middleware を使う場合、その結果は Router がエラーを渡した証明に限定し、実アプリ共通 errorHandler の結合保証と区別する。既存の共通エラー処理や登録状態は今回修正しない。

## 15. 期待結果を固定する前に観測するケース

以下は実装から注意が必要と分かる箇所であり、今回の修正対象ではない。望ましい仕様を推測してテストを赤くしたままにせず、現状確認と将来の仕様確定を分ける。

| ID  | 関連ケース    | 観測する内容・扱い                                                                                                                                                         |
| --- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O01 | E04、V10、S08 | finalImageUrls=[]でも ITEM_IMAGE_NULL にはならず、first_image_url へ undefined が渡る。既存先頭画像あり／なしの両方で DB 保存結果を確認し、「画像 0 件は必ず 400」としない |
| O02 | B05〜B08、Q03 | 名前で見つけたブランド・新規 alias が戻り値に採用されない経路と、別名の追加件数を記録。自動関連付けを期待しない                                                            |
| O03 | S13、P06      | 商品画像の署名配列は index へ代入するたび filter される。疎な index・逆順完了で上書きや欠落がないか、件数・各 index の一意性・URL 対応で確認。配列順だけの比較で済ませない |
| O04 | Q04、P07      | 時刻と uiId によるキーの共有・衝突を記録。現行コードにない一意性保証を通常回帰テストへ持ち込まない                                                                         |
| O05 | P01、P02、P08 | stale なモデルインスタンスからの更新、所有権の変更・削除競合について実 SQL と最終行を観測。排他制御や再認可がある前提にしない                                              |

## 16. 実装順序と完了判定

1. **優先度 P0**：U の正常更新・所有権・エラー伝播・呼出順序・同一 transaction、V の価格／在庫／必須項目、D の本体・画像 rollback を実装する。
2. **優先度 P1**：H の URL 再利用・マスター・ブランド分岐、状態遷移、C/R の接続、DB 制約を実装する。
3. **優先度 P2**：重複実行と順序を制御した並行処理、観測ケースを実装する。実 DB が必要なケースをモックの成功だけで完了扱いにしない。

テスト名にはケース ID と日本語の条件・結果を含める。表の「各項目」「複数値」は `it.each` 等で独立したテストに展開し、失敗した条件を特定できるようにする。S 系・B 系を全モックした U だけで分岐カバレッジを満たしたと判断しない。

完了判定は、必須ケースの期待結果に加え、異常系の後続未実行、再取得した DB 状態、並行処理の再現手順が確認できることとする。テスト DB 未準備・既存エラーで実行できない項目は理由を記録し、成功扱いにしない。
