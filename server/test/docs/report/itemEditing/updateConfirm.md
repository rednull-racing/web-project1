# updateConfirm テスト報告・修正記録

<a id="contracts-20261016"></a>

## 2026-10-16 共有契約の移行・DB非接続境界の修正（最新）

関連10ファイル・542件すべて成功（失敗・skip・todo・未処理例外0件）。updateConfirmは8ファイル533件、Draft/Copyのcontroller回帰は2ファイル9件。DB接続・migration・本番コード変更なし。以下の古い結果は当時の履歴として残す。

### 原因と対応

- 事前再現ではDraft/Copy/updateConfirmのcontrollerは4/5/5件成功した。ただしupdateConfirmは対象外Draft/Copyのモック漏れがあり、成功しても実DB設定を読み込む構成だった。Draftは既に対象外usecaseをモック済みで変更不要。旧Todoのtest/usecases配下のDraft/controllerは削除済みで、現配置のsrc/controllers/itemEditing/test/createItemEditingDraft.test.tsで確認した。
- updateConfirmのRouterは22件すべて読込み時に失敗。dotenv.configを無効化しているのにCopy経由で実db.tsへ到達し、直近のDB初期化修正後は`undefined.error`のTypeErrorとなった。DB設定追加では分離できないため、controller/Routerに対象外Draft・Copyの実パスのモックを追加した。
- signedUrlsのS15は1件、masterBrandのI03/I04等は34件失敗を再現。根拠は2026-10-12の`e31f97a6`と [createItemDraft修正報告](../itemDraft/createItemDraft.md) のF4/F5。共有helperの確定済み契約に移行し、本番コードは変更していない。
- S15はundefined/nullをVIDEO_SIGNED_URL_UNAVAILABLE/500とし、後続画像署名の未実行も検証（1→2件）。masterBrandは空白=null、0/負数/小数/Infinity/上限超過の400拒否と後続停止へ移行し、INTEGER上限直前・一致を6種IDへ追加（152→171件）。有効IDの互換性・ブランド解決・transactionの既存期待値は維持した。

### ケース対応と結果

パスはserver/基準。

| ファイル | 成功 | ケース・確認範囲 |
| --- | ---: | --- |
| src/usecases/itemEditing/test/updateConfirm.test.ts | 53 | usecase、所有権再確認、更新値、transaction引渡し・待機・例外 |
| src/usecases/shared/test/updateConfirm.signedUrls.test.ts | 61 | S15の署名欠落拒否、既存S/AF-S/K系の署名・index・キー生成 |
| src/validators/body/test/updateConfirm.test.ts | 211 | 既存V/AF-V系の入力境界 |
| src/controllers/itemEditing/test/updateConfirm.test.ts | 5 | R01/R02/R08・AF-S06の引渡し・応答・例外伝播 |
| src/services/itemEditing/test/updateConfirm.test.ts | 5 | 既存serviceの取得・ロック・保存引数 |
| src/services/brandAliases/test/updateConfirm.brandAliases.test.ts | 5 | 既存別名作成・再利用の呼出し契約 |
| test/integration/usecases/itemEditing/updateConfirm/masterBrand.test.ts | 171 | I01〜I06・E05/E15/T06、既存B/AF-B等の実helper接続 |
| test/integration/usecases/itemEditing/updateConfirm/route.test.ts | 22 | 既存R/AF-S/Q系の認証・validator・レート制限・controller接続 |
| src/controllers/itemEditing/test/createItemEditingDraft.test.ts | 4 | C01〜C04等のcontroller回帰 |
| src/controllers/itemEditing/test/createItemEditingCopy.test.ts | 5 | Copyのcontroller回帰 |
| 合計 | 542 | 全件成功 |

controllerは実処理で全usecaseをモック。Routerは実認証・validator・レート制限・controllerを使用し、全usecase・dotenvをモックする。Routerのエラーmiddlewareは例外観測用であり、実アプリ共通errorHandlerの検証ではない。署名テストはS3と時刻/UUID、実helper接続はDB service/transactionとS3をモック。実保存・commit/rollbackの成功は示さない。

### 実行と検査

server/で以下を実行した。1 workerはTodoの再現条件を維持するため。

```bash
npm run test:run -- src/usecases/itemEditing/test/updateConfirm.test.ts src/usecases/shared/test/updateConfirm.signedUrls.test.ts src/validators/body/test/updateConfirm.test.ts src/controllers/itemEditing/test/updateConfirm.test.ts src/services/itemEditing/test/updateConfirm.test.ts src/services/brandAliases/test/updateConfirm.brandAliases.test.ts test/integration/usecases/itemEditing/updateConfirm/masterBrand.test.ts test/integration/usecases/itemEditing/updateConfirm/route.test.ts src/controllers/itemEditing/test/createItemEditingDraft.test.ts src/controllers/itemEditing/test/createItemEditingCopy.test.ts --maxWorkers=1
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

すべて成功。修正後のサンドボックス内実行はRouter22件のみHTTP待受け制限（listen EPERMとport参照失敗）で失敗し、許可後の全体実行で542件成功。JSON結果は/tmp/item-editing-verified.jsonへ出力した。

通常lint対象外の変更結合TS2ファイルは、ESLint APIのoverrideConfigFile:trueと対象files指定、@eslint/js・typescript-eslintのrecommended設定で追加検査。初回はRouterの既存未使用_nextが1件報告された。4引数を維持してvoid参照を加え、追加lintエラー0・警告0。変更後のRouter22件も再実行して成功した（542件へ重複加算しない）。共有lint設定は変更していない。

実DBテスト106件、DB保存、実アプリへのRouter登録、実S3通信、カバレッジは今回未検証。DB結合テストの旧I03/I04観測は本件の実行・編集範囲に含めていない。


## 2026-10-16 service配置変更の補足

service直下の単一TSを同名フォルダへ移動し、呼出し元・モックの参照を更新した。services共通testを対象コードのtestへ移動・分割した。以下の過去の実行表・コマンドは当時の配置と件数を示す。現配置は [設計書](../../architecture/itemEditing/updateConfirm.md) を参照する。

旧services/test/updateConfirm.brandAliases.test.tsの5件はsrc/services/brandAliases/test/updateConfirm.brandAliases.test.tsへ移動した。

service単体テスト全体は移動前9ファイル・移動後15ファイルで、ともに72件すべて成功。Vitest JSONの全テスト名と成否が一致した。DB接続・実DBテスト・migrationは未実施。


初回・DB追加検証報告と修正記録を統合した。以下は各実行時点の履歴であり、移動前の最新結果は後半の「2026-10-12 P02・P05・P08 修正後のテスト結果（最新）」を参照する。


## 2026-10-16 配置変更後の確認

ファイルを5分類に移動し、serviceの2分割とレポート統合を行った。移動前の元ファイルを同じコード・環境で比較実行した結果、全テスト名・成否が一致した。期待値や本番コードは変更していない。下記は今回の結果であり、過去の619件成功とは区別する。

| 対象（server/基準） | 成功 | 失敗 | その他 |
| --- | ---: | ---: | --- |
| `src/usecases/itemEditing/test/updateConfirm.test.ts` | 53 | 0 | |
| `src/usecases/shared/test/updateConfirm.signedUrls.test.ts` | 59 | 1 | S15：動画署名undefinedの旧期待値 |
| `src/validators/body/test/updateConfirm.test.ts` | 211 | 0 | |
| `src/controllers/itemEditing/test/updateConfirm.test.ts` | 0 | 0 | DB設定読込みでsuite収集失敗。過去の5件は今回は未収集 |
| `src/services/itemEditing/test/updateConfirm.test.ts` | 5 | 0 | |
| `src/services/test/updateConfirm.brandAliases.test.ts` | 5 | 0 | |
| `test/integration/usecases/itemEditing/updateConfirm/masterBrand.test.ts` | 118 | 34 | I03/I04等：数値変換・接続の旧期待値 |
| `test/integration/usecases/itemEditing/updateConfirm/route.test.ts` | 0 | 22 | 対象外usecaseのモック漏れでRouter読込み時に停止 |
| 合計 | 451 | 57 | skip・todo 0件。controllerは未収集 |

比較結果は `/tmp/update-confirm-baseline-results.json`（移動前）と `/tmp/update-confirm-layout-results.json`（移動後）のVitest JSONから集計した。実行コマンドは [設計書の配置表と実行案内](../../architecture/itemEditing/updateConfirm.md) を参照。比較用に復元した元ファイルは実行後に削除した。

lint・本番コードのtypecheck・単体/結合テスト全体の型検査とgit diff --checkは成功。全相対import・mock参照先と移動したテスト・fixture・文書の内容保持も確認した。実DBテスト106件・DB接続・migrationは未実施。対象外の既存不一致は [Todo](../../../../../docs/todo/done/reconcile-update-confirm-test-contracts.md) に記録し、今回修正していない。

---

<a id="initial-report"></a>

# 商品編集中データの確定更新：テスト実装・結果報告

## 2026-10-10 DB 追加検証の結果（最新）

**10 ファイル・606 件がすべて成功。追加 DB テスト 104 件、既存回帰 502 件。失敗・skip・todo は 0 件。** 初回報告の「一部実施」27 項目と「対象外（DB）」22 項目の計 49 項目について、未確認だった DB 部分を実装・実行した。以下の旧報告は履歴として残すが、最新の判定は本節と[afterFix.md の DB 追加検証](#2026-10-10-db追加検証レポート)を優先する。

### 安全条件・変更範囲

`server/.env.test` を実 dotenv の parse で読み、その DATABASE_URL の DB 名が `test_db` であることを初期化前に確認した。実行時にはアプリ・モデル index・確認用の 3 つの Sequelize 接続について、設定 DB 名と `SELECT current_database()` がすべて `test_db` であることを確認してから fixture を作成した。

`databaseSetup.ts` が dotenv の既定呼出しを検証済み `.env.test` の値へ限定するため、モデル index/config が引数なしで config()を呼んでも `.env` は開かない。別ファイルの明示指定、接続 URL 変更、DB 名不一致は `DB_TEST_STOP` で停止する。今回、安全条件違反は発生しなかった。最初の接続はサンドボックスの EPERM で停止し、ローカル接続許可後に実行した。

変更は本ディレクトリ内のみ。追加は `databaseSetup.ts`、`databaseFixtures.ts` と下表の DB テスト 3 ファイル。既存の `usecase.test.ts`・`masterBrand.test.ts`・`signedUrls.test.ts` は、共通 helper の移動後の参照先と、現行の transaction 引数の完全一致期待値を更新した。設計書と本報告書・afterFix.md も更新した。アプリ、モデル、設定、migration、他機能テスト、docs/todo は編集していない。

実 usecase・helper・service・モデル・PostgreSQL を使用。S3 公開ドメインと署名通信をモックし、実アップロードは行っていない。障害注入では本体/画像 service を失敗させ、並行試験では実 SELECT 結果を deferred で保留する。スキーマ変更、sync、migration、truncate は行わず、テストごとに作成 ID だけを外部キー順に削除し、残存 0 件も assert した。シーケンス採番値は戻さない。

### 実行件数

Vitest JSON レポートから集計。全ファイルで失敗・skip・todo は 0 件。

| ファイル                                                       | 成功件数 | 対象                                                 |
| -------------------------------------------------------------- | -------: | ---------------------------------------------------- |
| [database.test.ts](../../../integration/database/itemEditing/updateConfirm/database.test.ts)                         |       91 | 永続化、JSONB、制約、状態遷移、ブランド、逐次再実行  |
| [databaseTransactions.test.ts](../../../integration/usecases/itemEditing/updateConfirm/databaseTransactions.test.ts) |        6 | rollback、commit 可視性、マスター削除、再試行        |
| [databaseConcurrency.test.ts](../../../integration/usecases/itemEditing/updateConfirm/databaseConcurrency.test.ts)   |        7 | 更新競合、別商品並行、片方失敗、別名重複、所有権競合 |
| controller.test.ts                                             |        5 | 既存回帰                                             |
| masterBrand.test.ts                                            |      150 | 既存回帰                                             |
| route.test.ts                                                  |       22 | 既存回帰                                             |
| services.test.ts                                               |        4 | 既存回帰                                             |
| signedUrls.test.ts                                             |       60 | 既存回帰                                             |
| usecase.test.ts                                                |       50 | 既存回帰                                             |
| validation.test.ts                                             |      211 | 既存回帰                                             |
| **合計**                                                       |  **606** | **追加 104 ＋既存 502**                              |

### 未実施 DB 項目との対応

P ＝ database.test.ts、T ＝ databaseTransactions.test.ts、C ＝ databaseConcurrency.test.ts。観測の成功は不具合修正や安全性の保証を意味しない。

| 元ケース ID         | 最新判定           | 対応 | DB で確認した内容                                                                                                                 |
| ------------------- | ------------------ | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| N02                 | 成功               | P    | 全保存項目の一致、対象外行・公開 Item・所有者・item_id・createdAt の不変                                                          |
| N03                 | 成功               | P    | detail/summary の null・空文字・日本語文字列を再取得                                                                              |
| N04・ST03           | 成功               | P    | 全体・色・サイズ在庫 0/1/8、initial/current 再設定                                                                                |
| N05・D05            | 成功               | P    | 複数色・サイズ・素材、uiId 画像対応、JSONB の日本語・小数・順序                                                                   |
| N06・ST04           | 成功               | P    | 空配列更新で旧色・素材が消え、undefined キーは省略。sizes=[]を保持                                                                |
| N07                 | 成功               | P    | 実カテゴリ分類を採用。nullable 分類 null とカテゴリ未選択を検証。現行 layer は NOT NULL なので全分類 null の fixture は作成しない |
| N08・O02            | 成功               | P・C | ID/名前/紐付 alias/未紐付 alias/新規 alias/なしの関連 ID、逐次再利用と並行重複                                                    |
| E01・D01            | 成功               | P    | 他人所有行を実 SQL で除外。404、transaction 未開始、非対象行不変                                                                  |
| E12・E13・ST07・T03 | 成功               | P・T | 本体失敗・画像失敗・画像 11 件で全列 rollback。画像失敗前の本体更新完了も確認                                                     |
| V09                 | 成功               | P    | gender/age 全定義値、モデルの null 拒否、直接 SQL で DB NOT NULL 違反 23502、不正 ENUM の 22P02                                   |
| V10・D03・D04       | 成功               | P    | 画像 1〜10 件の順序と先頭一致、11 件はモデル validator が拒否して全体 rollback                                                    |
| V11・D09            | 成功               | P    | name/title/freeText の日本語 0/255/256 文字。256 文字は DB の 22001、後続画像更新なし。ENUM と画像上限も個別検証                  |
| I03・I04            | 成功（観測を含む） | P    | 6 種 ID×0/空白/負数/小数/Infinity。詳細は下記                                                                                     |
| ST01・D10           | 成功               | P    | item_id=null の未入力行へメディア・項目を保存し行数不変。item_id ありの場合も維持                                                 |
| ST02・D08           | 成功               | P    | 保存済み名称・価格・画像・配送更新、公開 Item と他ユーザー行の不変                                                                |
| ST05                | 成功               | P    | サムネイル差替え、converted 動画優先、商品画像の継承                                                                              |
| ST06                | 成功               | P    | video_status=null/pending/completed で更新可、status・converted_url・duration は維持                                              |
| ST08                | 成功               | P    | price/before_price のみ更新し sale_flag・割引値は維持                                                                             |
| D06                 | 成功               | P    | 実在外部キーおよび nullable ID の null 保存、入力カテゴリ表示値を分類に採用しない                                                 |
| D07                 | 成功               | T    | 実マスター検証後に別接続でカテゴリ削除、書込み時 FK 違反、全列 rollback                                                           |
| T04                 | 成功               | T    | 本体更新後・画像保存前は別接続から旧値、両更新 commit 後に新値が見える                                                            |
| T05                 | 成功（現行契約）   | T    | 新規 alias も商品 transaction に参加。本体/画像失敗・実 DB 制約違反で alias も 0 件へ rollback                                    |
| T07・Q05            | 成功               | T    | 初回 rollback 後の同一 body 再試行で商品と alias1 行を commit                                                                     |
| Q01                 | 成功               | P    | 同一入力の逐次 2 回で業務値一致、商品行数不変                                                                                     |
| Q02                 | 成功               | P    | 異なる固定時刻で動画/サムネイル/商品/属性画像を再発行し後の URL で上書き                                                          |
| Q03                 | 成功（現行契約）   | P    | 新規 alias を逐次 2 回で再利用。DB1 行・同じ関連 ID                                                                               |
| P01・P02・O05       | 成功（観測）       | C    | 両取得 →A commit→B commit。変更列に応じた上書き・混在を実 SQL と最終行で確認                                                      |
| P03                 | 成功               | C    | 異なるユーザーの商品を別 transaction で同時更新、画像・在庫・所有者が混ざらない                                                   |
| P04                 | 成功               | C    | 同じ旧行の A commit 後に B 画像更新が失敗しても、A の全列を維持                                                                   |
| P05                 | 成功（観測）       | C    | 同名 alias の両実検索が未登録 → 解放 → 両 commit で 2 行作成、片方を商品へ関連付け                                                |
| P08                 | 成功（観測）       | C    | 所有権照合後に別接続で削除/所有者変更。再認可・更新件数検証のない現行動作を確認                                                   |
| O01                 | 成功（修正後契約） | P    | 旧先頭画像あり/なしの両方で空画像を ITEM_IMAGE_NULL で拒否、全列不変                                                              |

### DB で確認した観測・旧報告との差分

- T05/Q05：過去の「別名が残り得る」と異なり、現行実装は resolveBrand→createAliases→Model.create へ transaction を渡す。実 DB でも商品と別名の rollback を確認した。
- Q03/P05：逐次再実行は既存 alias を再利用し 1 行。両検索が未登録の並行実行では同名 2 行が commit される。重複防止を保証しない。
- P02：A は名称を変更、B は取得時の旧名称のまま価格を変更。A→B の commit 後は A 名称/B 価格が混在。B の UPDATE SET 句に name がないことを確認した。
- P08：取得後削除では UPDATE 対象 0 行でも usecase は成功し、最終行は存在しない。取得後所有者変更では他ユーザー所有となった行に更新が反映された。両 UPDATE の WHERE は id だけで seller_id を含まない。これらは修正していない。
- I03/I04：マスター 5 種類の 0/空白は FK 違反。負数・1.5 はマスター未検出の 404。ブランドの 0/空白/負数/1.5 は未検出から名前なしへ fallback し関連 ID=null で保存。Infinity は 6 種類とも DB エラー。INVALID_NUMBER や一律の型エラーとは扱わない。
- V09/V10：null は通常経路ではモデル validation で拒否される。直接 SQL でも NOT NULL 制約を確認した。画像 11 件はモデル validator であり、DB CHECK を確認したものではない。

### 実行・静的検査

`server/` で実行。JSON は集計後に削除した一時生成物であり、以下のコマンドで再生成できる。

```bash
npm run test:run -- test/usecases/itemEditing/updateConfirm/ --maxWorkers=1 --reporter=default --reporter=json --outputFile=test/usecases/itemEditing/updateConfirm/.test-results.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

| 検査                                       | 結果                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 対象 Vitest                                | 606/606 成功、10 ファイル、skip/todo なし                                                          |
| npm run lint                               | 対象外の src/types/serviceType/items.ts の未使用 import3 件で失敗                                  |
| npm run typecheck                          | 対象外の src/services/items/command/index.ts の updateItem 未 export1 件で失敗                     |
| テスト tsconfig                            | 対象外の shopSignup/signup1.test.ts・signup5.test.ts の参照先不在 2 件で失敗。対象内の型エラーなし |
| 変更 TS8 ファイルの ESLint API 追加検査    | typescript-eslint recommended、エラー/警告 0 件                                                    |
| 対象全 TS13 ファイルの ESLint API 追加検査 | 未変更 route.test.ts:44 の\_next 未使用 1 件のみ。修正せず                                         |

追加 lint は既存 ESLint 設定を変更せず、`new ESLint({ overrideConfigFile: true, overrideConfig: tseslint.config(...tseslint.configs.recommended) })` の `lintFiles` に `database*.ts` と `masterBrand.test.ts`・`signedUrls.test.ts`・`usecase.test.ts` を渡した。これらはすべて本ディレクトリ配下。

初回 EPERM による suite 失敗（102 件未実行）、fixture の公開 Item 必須 uploaded_at 不足、I04 の観測期待値、SQL 取得 hook の修正を経て再実行した。最終結果に途中の未実行/失敗を混ぜていない。アプリの不具合・対象外 lint/型エラーは修正せず、本節へ記録した。DB 接続条件違反、実 S3、実 commit 障害、負荷試験、未知の競合順序への保証は検証対象外。今回カバレッジは再計測していない。

## 初回報告（2026-10-09、以下は履歴）

## 結果

2026-10-09 時点で、**7 テストファイル・436 テストがすべて成功**した。失敗 0、skip/todo 0。DB 接続が必要なテストは、依頼に従って作成・実行していない。

設計書の P0 → P1 → P2 の順で、usecase 単体・入力検証、helper/service/controller/Router、DB を使わない重複実行・並行処理のテストを実装した。設計書の 125 項目と、パラメータ展開後の 436 テストは数え方が異なる。1 つのテストが複数項目を確認する場合もある。

今回の追加はこのディレクトリのテスト 7 ファイル、共通 fixture、報告書のみ。設計書と既存のテストファイル、`server/src`、その他の既存コード、既知のエラーは変更していない。

### 完了判定

- 成功：76 項目。設計上の対象を DB なしで確認した。
- 一部実施：27 項目。単体・モック境界の確認は成功。DB 側の期待結果は未検証。
- 対象外（DB）：22 項目。今回はテストコードも作成していない。

**DB を使わない範囲の実装・検証は完了。設計書全体の完了ではない。** rollback、commit 後の可視性、DB 制約、更新競合による最終行状態は別途 DB テストが必要。モックが成功しただけで永続化を保証した扱いにはしていない。

## ファイル構成と実行件数

表中の略号を、後続の設計項目一覧でも使用する。

| 略号 | ファイル                                     | 成功数 | 実処理にした範囲                                                           |
| ---- | -------------------------------------------- | -----: | -------------------------------------------------------------------------- |
| C    | [controller.test.ts](../../../../src/controllers/itemEditing/test/updateConfirm.test.ts)   |      4 | 実 controller。usecase をモック。                                          |
| M    | [masterBrand.test.ts](../../../integration/usecases/itemEditing/updateConfirm/masterBrand.test.ts) |    130 | 実 usecase と 4 つの実 helper。DB service・S3 署名・transaction をモック。 |
| R    | [route.test.ts](../../../integration/usecases/itemEditing/updateConfirm/route.test.ts)             |      9 | 実 Router・認証・validator・レート制限。usecase をモック。                 |
| D    | [services.test.ts](../../../../src/services/itemEditing/test/updateConfirm.test.ts)       |      4 | 実 query/command。モデルメソッドをモックし DB に接続しない。               |
| S    | [signedUrls.test.ts](../../../../src/usecases/shared/test/updateConfirm.signedUrls.test.ts)   |     52 | 実 buildSignedUrls。S3 署名と時刻をモック。                                |
| U    | [usecase.test.ts](../../../../src/usecases/itemEditing/test/updateConfirm.test.ts)         |     44 | usecase。依存 helper/service と transaction を Vitest でモック。           |
| V    | [validation.test.ts](../../../../src/validators/body/test/updateConfirm.test.ts)   |    193 | 実 schema、validateBody、validateParams。                                  |

[fixtures.ts](../../../fixtures/itemEditing/updateConfirm/fixtures.ts) は標準 body・編集中データ・AppError 検証・deferred Promise を提供する。fixture はテストごとに新規生成し、Vitest のモック・時刻・環境変数をリセットする。テスト名には設計書のケース ID を付与した。

## 実行方法と確認結果

`server/` ディレクトリで実行する。

```bash
npm run test:run -- test/usecases/itemEditing/updateConfirm/
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

| 確認                                                         | 結果                  | 補足                                                                                                                               |
| ------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 対象ディレクトリの Vitest                                    | 成功：436/436         | 対象外の既存テストは実行していない                                                                                                 |
| transaction 参照同一性の assert 追加後、usecase 単体を再実行 | 成功：44/44           | 追加 assert 後の対象ファイルも確認済み                                                                                             |
| `npm run lint`                                               | 成功                  | 既存 ESLint 設定ではテスト TS が主な検査対象に含まれないため、下記の追加検査も実施                                                 |
| 追加 TS ファイルの ESLint 検査                               | 成功                  | インストール済み ESLint の API から typescript-eslint recommended を対象ディレクトリだけに適用。既存設定ファイルは変更なし         |
| `npm run typecheck`                                          | 失敗：既存エラー 5 件 | `src/controllers/items.ts`の未 export 関数参照 1 件、`src/usecases/items/upload/uploadDraft.ts`の shared 参照先不在 4 件。変更せず |
| テスト用 tsconfig の型チェック                               | 失敗：既存エラー 2 件 | `test/usecases/shopSignup/signup1.test.ts`と`signup5.test.ts`の参照先不在。今回追加したファイルの型エラーは 0 件                   |

初回の Router テストはサンドボックス内で Supertest 用のローカル HTTP サーバーを起動できず失敗した。ローカル通信を許可した実行では 9/9 が成功し、その後のカバレッジ付き全対象実行でも 436/436 が成功した。ネットワーク制約による初回失敗を実装の成功・失敗と混同していない。

### モックと外部アクセス

- モックはすべて Vitest の `vi.mock`、`vi.fn`、`vi.spyOn` を使用。
- DB service/モデルと AWS 署名の境界をモックし、DB 作成・接続・マイグレーション・実 S3 操作は行っていない。
- Router はテスト用 Express アプリに明示的にマウント。Supertest のローカル HTTP 接続だけを使用する。
- 認証はテストごとに生成した鍵と実 JWT を使用し、dotenv をモック。実環境の認証情報は使用しない。
- Router のエラーはテスト専用 4 引数 middleware で観測。実アプリの Router 登録状態や共通 errorHandler の動作を検証したことにはしない。
- レート制限は実装を使用し、モジュールを再読み込みしてストアを分離。Date と interval のみ fake timer で制御し、HTTP I/O は実行する。
- 並行テストは deferred Promise で開始・完了順を制御。任意の sleep や実時間待ちには依存しない。

## カバレッジ（V8）

436 テストをカバレッジ付きで実行した結果。割合は DB に対する保証の代替ではない。

| 対象                                   |      行 |    分岐 |
| -------------------------------------- | ------: | ------: |
| updateConfirm usecase                  |    100% |  95.65% |
| buildSignedUrls                        |    100% |  92.98% |
| resolveBrand                           |    100% |    100% |
| validateNumber                         |    100% |    100% |
| validateMaster                         |    100% |    100% |
| validateBody / validateParams          | 各 100% | 各 100% |
| itemEditing query                      |    100% |    100% |
| itemEditing command（ファイル全体）    |   87.5% |    100% |
| itemEditing controller（ファイル全体） |  64.28% |    100% |
| itemEditing Router / body schema       | 各 100% | 各 100% |

command/controller の未実行行は今回対象外の作成 API。usecase/helper には、通常 schema から到達しない欠落値等の未実行分岐が残る。対象外の機能や不正 fixture を追加して 100%にすることは目的としていない。

## 設計項目ごとの結果

「成功」は記載したテスト範囲の assert が通ったという意味。特に O 系の観測テストは、現行挙動を再現したものであり、その挙動が望ましい仕様であることや不具合の修正完了を意味しない。

### 正常系

| ID  | 判定     | テスト | 結果・残る範囲                                                                          |
| --- | -------- | ------ | --------------------------------------------------------------------------------------- |
| N01 | 成功     | M・U   | 保存項目の全体一致、依存順序、署名 4 項目の返却を確認。                                 |
| N02 | 一部実施 | U      | 更新 service へ渡す全項目・配送自由文を確認。永続化と他行への影響は未検証。             |
| N03 | 一部実施 | U      | null のみ空文字へ変換。保存後の DB 値は未検証。                                         |
| N04 | 一部実施 | U      | 全体・色・サイズ在庫の 0/1/8 を確認。DB 再取得は未実施。                                |
| N05 | 一部実施 | U      | 複数色・サイズ・素材の順序と値、uiId と画像対応を確認。DB 再取得は未実施。              |
| N06 | 一部実施 | U      | undefined と空配列の更新引数を確認。JSONB 保存表現は未検証。                            |
| N07 | 一部実施 | M・U   | DB 取得相当の分類値を利用し、null 分類・カテゴリなしを undefined へ変換。実 DB 未使用。 |
| N08 | 一部実施 | U      | brand・alias の有無 3 通りの ID/null を確認。実 DB 未使用。                             |
| N09 | 成功     | U      | 色名省略・空文字、空サイズ名、属性画像なしの引数を確認。                                |
| N10 | 成功     | U      | HTTP では到達しない null/undefined 在庫の防御分岐を確認。                               |

### 異常系・打切り

| ID  | 判定     | テスト  | 結果・残る範囲                                                                                                |
| --- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| E01 | 一部実施 | U       | 取得 null 時 404 と後続未実行を確認。所有権 where は D01 で確認、実行結果としての他人所有行の除外は DB 待ち。 |
| E02 | 成功     | U       | null・空動画 URL の AppError と打切りを確認。                                                                 |
| E03 | 成功     | S・U    | null・空サムネイル URL の AppError と打切りを確認。                                                           |
| E04 | 成功     | U       | 通常 helper から返らない null/undefined 配列をモックし、防御分岐を確認。                                      |
| E05 | 成功     | M       | 6 種類の ID それぞれ abc/NaN で停止。先に署名されても transaction 未開始。                                    |
| E06 | 成功     | M       | カテゴリ不在で 404。後続マスター・ブランド・書込みなし。                                                      |
| E07 | 成功     | M       | 商品状態不在で 404。後続マスター・ブランド・書込みなし。                                                      |
| E08 | 成功     | M       | 配送日不在で 404。後続マスター・ブランド・書込みなし。                                                        |
| E09 | 成功     | M       | 配送サービス不在で 404。後続マスター・ブランド・書込みなし。                                                  |
| E10 | 成功     | M       | 発送元不在で 404。ブランド・書込みなし。                                                                      |
| E11 | 成功     | M・S・U | 各取得・署名・マスター・ブランド例外の同一性と後続停止を確認。                                                |
| E12 | 一部実施 | U       | 本体更新 reject と画像更新未実行を確認。DB rollback は対象外。                                                |
| E13 | 一部実施 | U       | 画像更新 reject 時に usecase が reject することを確認。DB rollback は対象外。                                 |
| E14 | 成功     | U       | transaction 開始・callback 完了後の失敗をモックし伝播を確認。実 commit 障害の再現ではない。                   |
| E15 | 成功     | M・U    | 未取得 →URL、動画 → サムネイル、数値 → マスターのエラー優先順位を確認。                                       |

### 入力検証・境界値

| ID  | 判定     | テスト | 結果・残る範囲                                                             |
| --- | -------- | ------ | -------------------------------------------------------------------------- |
| V01 | 成功     | V      | 価格 299/300/301/999999/1000000/1000001 の境界を確認。                     |
| V02 | 成功     | V      | 0・負数・小数・文字列・null・undefined を拒否。                            |
| V03 | 成功     | V      | 全体・色・サイズの各在庫を独立に検証。                                     |
| V04 | 成功     | V      | 比率 0〜100 の小数を含む境界と型不正を検証。                               |
| V05 | 成功     | V      | level の整数・下限を検証。                                                 |
| V06 | 成功     | V      | 必須オブジェクト・配列・入れ子フィールドごとに欠落と型不正を検証。         |
| V07 | 成功     | V      | 動画・サムネイルと name/type の省略を受理し uploaded 省略を拒否。          |
| V08 | 成功     | V      | nullable 各値と condition.id の null 拒否・空文字受理を確認。              |
| V09 | 一部実施 | V      | schema の null・任意文字列受理を確認。NOT NULL/ENUM の保存制約は DB 待ち。 |
| V10 | 一部実施 | V      | schema の 0/1/10/11 件受理を確認。モデル保存時の 10 件制約は今回対象外。   |
| V11 | 一部実施 | V      | 日本語 0/255/256 文字を schema が受理。DB の長さ制限・rollback は未検証。  |
| V12 | 成功     | V      | 空配列、素材合計 100 以外、空・重複 uiId の受理を確認。                    |
| V13 | 成功     | V      | 任意 MIME と商品画像 type null/空文字を受理。署名スキップは S08 で確認。   |
| V14 | 成功     | R・V   | トップレベル・入れ子の未知キー除去と認証 ID の採用を確認。                 |
| V15 | 成功     | V      | params の正数受理・数値変換と不正値拒否を確認。                            |
| V16 | 成功     | V      | parse 済み body 格納・next1 回、失敗時 throw・next 未実行を確認。          |
| V17 | 成功     | V      | 安全な大整数、長文、20 色 ×20 サイズの受理と保持を確認。負荷試験ではない。 |

### 数値変換・マスター

| ID  | 判定     | テスト | 結果・残る範囲                                                                                |
| --- | -------- | ------ | --------------------------------------------------------------------------------------------- |
| I01 | 成功     | M      | 各 ID の null/空文字を null へ変換。condition.id の null は防御的な直接呼出し。               |
| I02 | 成功     | M      | 各 ID の通常数値・先頭 0・空白・指数表記を Number 変換。                                      |
| I03 | 一部実施 | M      | 0 変換、マスター照合スキップ、保存引数 0 を確認。外部キー制約は未検証。                       |
| I04 | 一部実施 | M      | 負数・小数・Infinity が変換され service へ渡ることを確認。DB 型制約は未検証。                 |
| I05 | 成功     | M      | 各 ID の abc/NaN 拒否と、condition 不正時に category→condition で読み取り停止する順序を確認。 |
| I06 | 成功     | M      | 各マスターの null/0/有効値と引数、brandId=0 の検索を確認。                                    |

### 署名 URL

| ID  | 判定 | テスト | 結果・残る範囲                                                                   |
| --- | ---- | ------ | -------------------------------------------------------------------------------- |
| S01 | 成功 | S      | 動画のキー・contentType・500MiB 上限と公開 URL を確認。                          |
| S02 | 成功 | S      | 動画省略・既存利用・情報不足と converted/original/null/空文字の優先順位を確認。  |
| S03 | 成功 | S      | 新規動画は converted_url より優先し、元オブジェクトの converted_url は維持。     |
| S04 | 成功 | S      | サムネイル新規・既存・情報不足・既存なしを確認。                                 |
| S05 | 成功 | S      | 新規/既存交互の入力 index と確定画像順序を確認。                                 |
| S06 | 成功 | S      | 既存配列なし・範囲外 index をスキップし、入力 name は URL にしない。             |
| S07 | 成功 | S      | 商品画像 name 空文字でも type があれば署名する現状を確認。                       |
| S08 | 成功 | S      | type null/空文字は署名せず、全件該当時は空配列を返す。                           |
| S09 | 成功 | S      | 属性画像のキーと uiId 辞書の対応を確認。                                         |
| S10 | 成功 | S      | 画像省略/既存指定、色並べ替え、uiId 不一致、既存属性なしを確認。                 |
| S11 | 成功 | S      | 新規画像の情報不足時は既存画像にも fallback しない。                             |
| S12 | 成功 | S      | 色削除・uiId 変更後の辞書から旧画像が除かれることを確認。S3 への実アクセスなし。 |
| S13 | 成功 | S      | 順序制御 6 パターンを確認。署名の欠落を観測した詳細は後述。                      |
| S14 | 成功 | S      | 属性署名を逆順完了しても一意 uiId との対応を保持。                               |
| S15 | 成功 | S      | POST 署名 undefined でも videoSignedUrl=null と新規公開 URL を返す現状を確認。   |

### ブランド

| ID  | 判定 | テスト | 結果・残る範囲                                                       |
| --- | ---- | ------ | -------------------------------------------------------------------- |
| B01 | 成功 | M      | 有効 ID で名前検索・作成を行わない。                                 |
| B02 | 成功 | M      | ID なし/見つからない、名前 null/空文字の組合せを確認。               |
| B03 | 成功 | M      | brand 付き alias を採用し、その後もブランド名検索を呼ぶ。            |
| B04 | 成功 | M      | 全半角・大小文字・カタカナ・空白の正規化と検索/作成引数を確認。      |
| B05 | 成功 | M      | 名前で見つかったブランドを戻り値・保存引数に採用しない現状を確認。   |
| B06 | 成功 | M      | 名前 0/1/2 文字による検索・作成の回数と新規 alias 未採用を確認。     |
| B07 | 成功 | M      | 未紐付け alias が存在しても再作成へ進む現状を確認。                  |
| B08 | 成功 | M      | 既存 alias のブランド採用と新規 alias 作成が同時に起こる現状を確認。 |
| B09 | 成功 | M      | 空白 2 文字/絵文字で正規化前 length による判定を確認。               |
| B10 | 成功 | M      | 4 種類のブランド service 例外と後続停止・transaction 未開始を確認。  |

### 状態遷移

| ID   | 判定         | テスト | 結果・残る範囲                                                                                  |
| ---- | ------------ | ------ | ----------------------------------------------------------------------------------------------- |
| ST01 | 対象外（DB） | —      | 未入力の編集中データ → 必要なメディアと項目を入力。専用 DB がないため作成・実行とも対象外。     |
| ST02 | 対象外（DB） | —      | 保存済み → 名称・価格・画像・配送を変更。専用 DB がないため作成・実行とも対象外。               |
| ST03 | 一部実施     | U      | 更新引数の initial/current 再設定を確認。永続化は未検証。                                       |
| ST04 | 対象外（DB） | —      | 複数色・素材あり → 空配列で更新。専用 DB がないため作成・実行とも対象外。                       |
| ST05 | 一部実施     | S      | サムネイルだけ差替え時の動画・商品画像引継ぎを確認。DB 保存は未検証。                           |
| ST06 | 一部実施     | U      | status null/pending/completed で同じ経路。状態・動画変換関連値を更新引数に含めない。DB 未検証。 |
| ST07 | 対象外（DB） | —      | 任意の保存済み状態 → 更新途中で失敗。専用 DB がないため作成・実行とも対象外。                   |
| ST08 | 対象外（DB） | —      | sale_flag・割引値あり → 価格変更。専用 DB がないため作成・実行とも対象外。                      |

### DB 整合性・service 契約

| ID  | 判定         | テスト | 結果・残る範囲                                                                           |
| --- | ------------ | ------ | ---------------------------------------------------------------------------------------- |
| D01 | 一部実施     | D      | findOne の where に id と seller_id のみ渡す契約を確認。SQL の実行結果は未検証。         |
| D02 | 成功         | D      | update へ data と transaction を同じ参照で渡すことを確認。                               |
| D03 | 一部実施     | D      | setDataValue→changed→save の順序と transaction を確認。画像の永続化は未検証。            |
| D04 | 対象外（DB） | —      | 画像 1〜10 件の更新。専用 DB がないため作成・実行とも対象外。                            |
| D05 | 対象外（DB） | —      | JSONB の更新。専用 DB がないため作成・実行とも対象外。                                   |
| D06 | 対象外（DB） | —      | 有効な外部キー／nullable ID。専用 DB がないため作成・実行とも対象外。                    |
| D07 | 対象外（DB） | —      | 参照マスターを検証後・更新前に削除。専用 DB がないため作成・実行とも対象外。             |
| D08 | 対象外（DB） | —      | 他の編集中商品と対応 Item を併置。専用 DB がないため作成・実行とも対象外。               |
| D09 | 対象外（DB） | —      | 画像 11 件、長さ超過、不正 ENUM をそれぞれ保存。専用 DB がないため作成・実行とも対象外。 |
| D10 | 対象外（DB） | —      | item_id あり／null。専用 DB がないため作成・実行とも対象外。                             |

### トランザクション

| ID  | 判定         | テスト | 結果・残る範囲                                                                                               |
| --- | ------------ | ------ | ------------------------------------------------------------------------------------------------------------ |
| T01 | 成功         | U      | transaction1 回、両更新へ同じ transaction 参照を渡すことを確認。                                             |
| T02 | 成功         | U      | 本体・画像・transaction 完了を個別の deferred で保留し、usecase が早期成功しないことを確認。                 |
| T03 | 対象外（DB） | —      | 本体更新後、画像更新を意図的に失敗。専用 DB がないため作成・実行とも対象外。                                 |
| T04 | 対象外（DB） | —      | 両更新成功。専用 DB がないため作成・実行とも対象外。                                                         |
| T05 | 一部実施     | M      | 別名作成が商品 transaction より前で、transaction 引数も渡さないことを確認。rollback 後の別名残存は DB 待ち。 |
| T06 | 成功         | M・U   | 数値/マスター不正で transaction0 回。数値検証前の署名発行も確認。                                            |
| T07 | 対象外（DB） | —      | rollback 後に同じ内容で再試行。専用 DB がないため作成・実行とも対象外。                                      |

### 重複実行

| ID  | 判定         | テスト | 結果・残る範囲                                                                               |
| --- | ------------ | ------ | -------------------------------------------------------------------------------------------- |
| Q01 | 一部実施     | M      | 実 helper 経由の逐次 2 回実行で同一業務値と既存 URL を渡すことを確認。行数・永続化は未検証。 |
| Q02 | 一部実施     | S      | 再実行時の時刻変更による全メディアの URL 変更・再発行を確認。DB 上書きは未検証。             |
| Q03 | 一部実施     | M      | 未登録名の逐次実行で別名作成 2 回、関連 ID は null となる現状を確認。DB 件数は未検証。       |
| Q04 | 成功         | S      | 同じ時刻では全メディアのキーと URL が一致する現状を確認。                                    |
| Q05 | 対象外（DB） | —      | 初回が画像保存で失敗し、再実行。専用 DB がないため作成・実行とも対象外。                     |
| Q06 | 成功         | R      | 同一ユーザー 5 回通過/6 回目 429 で usecase 未実行を確認。                                   |

### 並行処理

| ID  | 判定         | テスト | 結果・残る範囲                                                                                                     |
| --- | ------------ | ------ | ------------------------------------------------------------------------------------------------------------------ |
| P01 | 対象外（DB） | —      | 同じ商品を A/B が取得 → A が全更新を commit → B が全更新を commit。専用 DB がないため作成・実行とも対象外。        |
| P02 | 対象外（DB） | —      | 取得時は同じ旧データ → A だけが変える項目と B だけが変える項目を含め更新。専用 DB がないため作成・実行とも対象外。 |
| P03 | 対象外（DB） | —      | A の商品と B の商品を別接続で同時更新。専用 DB がないため作成・実行とも対象外。                                    |
| P04 | 対象外（DB） | —      | 同じ商品へ 2 件、片方だけ画像保存で失敗。専用 DB がないため作成・実行とも対象外。                                  |
| P05 | 一部実施     | M      | 両名前検索を待ち合わせて null を返し、双方が別名作成・商品 transaction へ進む。DB 一意性は未検証。                 |
| P06 | 成功         | S      | 正順・逆順・混在・疎 index を deferred で制御。署名欠落は O03 に記載。                                             |
| P07 | 成功         | S      | 重複 uiId で同一キーとなり、後で完了した署名が辞書を上書きする現状を確認。                                         |
| P08 | 対象外（DB） | —      | 所有権確認後、別接続で対象削除／所有者変更してから更新。専用 DB がないため作成・実行とも対象外。                   |

### controller・Router

| ID  | 判定 | テスト | 結果・残る範囲                                                    |
| --- | ---- | ------ | ----------------------------------------------------------------- |
| R01 | 成功 | C・R   | 数値 ID・認証 ID・validatedBody の参照を確認。                    |
| R02 | 成功 | C・R   | 200 の署名 4 項目のみ返却。null/空配列/空辞書と非空の両方を確認。 |
| R03 | 成功 | C      | AppError/通常 Error を同一参照で next へ渡し成功応答を送らない。  |
| R04 | 成功 | R      | 実 JWT 検証でトークンなし/不正/期限切れの 401 を確認。            |
| R05 | 成功 | R      | ID 不正/body 不正/両方不正で params 優先、usecase 未実行を確認。  |
| R06 | 成功 | R      | ユーザー別枠と 10 分窓経過後の再開を実レート制限で確認。          |
| R07 | 成功 | R      | 不正 body でも回数に含まれ、6 回目は 429 が先に返る。             |
| R08 | 成功 | C・R   | body へ別 ID を混入しても認証ユーザー ID を使う。                 |

### 観測事項

| ID  | 判定         | テスト | 結果・残る範囲                                                                                                                                                          |
| --- | ------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O01 | 一部実施     | S・U   | 空配列でも拒否せず first_image_url=undefined を渡す。既存先頭画像あり/なしの DB 保存結果は未検証。                                                                      |
| O02 | 一部実施     | M      | ブランド未採用・別名作成の呼出回数を観測。永続化・実 DB 行数は未検証。                                                                                                  |
| O03 | 成功         | S      | 完了順による返却署名の欠落を再現。現状確認テストの成功であり、不具合解消を意味しない。                                                                                  |
| O04 | 成功         | S      | 同一ミリ秒・重複 uiId によるキー共有と辞書上書きを観測。                                                                                                                |
| O05 | 対象外（DB） | —      | stale なモデルインスタンスからの更新、所有権の変更・削除競合について実 SQL と最終行を観測。排他制御や再認可がある前提にしない。専用 DB がないため作成・実行とも対象外。 |

## 観測結果の詳細

### 商品画像署名の欠落（S13 / P06 / O03）

S3 署名を個別の deferred Promise に置換し、同じ入力で完了順だけを変更した。返却配列の元 index と URL、件数を assert している。

| 新規画像の index | 署名の完了順 | 返却された署名の index | 観測                             |
| ---------------- | ------------ | ---------------------- | -------------------------------- |
| 0, 1, 2          | 0 → 1 → 2    | 0, 1, 2                | 欠落なし                         |
| 0, 1, 2          | 2 → 1 → 0    | 0, 1                   | index 2 が欠落                   |
| 0, 1, 2          | 1 → 0 → 2    | 0, 2                   | index 1 が欠落                   |
| 1                | 1            | 1                      | 元 index を保持                  |
| 0, 2             | 2 → 0        | 0                      | index 2 が欠落                   |
| 1, 3             | 3 → 1        | 3, 1                   | 欠落なし、返却順は入力順と異なる |

いずれも保存用の `finalImageUrls` は入力順で生成された。署名配列は元 index への代入と filter による詰め直しを繰り返すため、後の代入で先に完了した署名を上書きする現行動作を再現できた。今回のテストはこの観測結果を明示的に記録するもので、既存コードの修正は行っていない。

### ブランド解決・別名作成（O02 / T05 / Q03 / P05）

- ID 指定で存在するブランド、または brand 付き alias は採用される。
- 名前検索で見つかったブランド、新しく作成した alias は戻り値へ採用されない経路があることを確認した。
- 未紐付け alias があっても別名作成へ進む。逐次 2 回実行でも、両方の名前検索を未登録で揃えた並行実行でも、作成 service が 2 回呼ばれた。
- 別名作成は商品 transaction 開始前に呼ばれ、transaction 引数も受け取らない。商品更新の失敗後に別名が実 DB に残るか、unique 制約があるかは未検証。

### 空画像・キー共有（O01 / O04）

- `finalImageUrls=[]` では ITEM_IMAGE_NULL にならず、先頭画像に undefined、画像保存に空配列を渡した。旧先頭画像が残るかどうかは DB 待ち。
- 同じ商品を同一ミリ秒に再実行すると、各メディアのキーが一致した。
- 属性の uiId が重複すると同じキーを使い、後で完了した署名が辞書を上書きした。uiId 一意性やアップロード結果は保証していない。

## 今回の対象外

DB が必要なケースは、失敗したテストでも skip したテストでもない。依頼に基づく未実装・未実行として上表に記載した。次回は専用 PostgreSQL と反映済みスキーマを用意し、一部実施項目の残りと対象外 22 項目を設計書の順序で検証する必要がある。

既存エラーの修正、テスト DB の準備、マイグレーション実行、今回と無関係なテストの修正は行っていない。

---

<a id="follow-up"></a>

# 商品編集中データの確定更新：修正案と修正後のテスト設計

> 最新の DB 結果は末尾の「2026-10-10 DB 追加検証レポート」と testReport.md 冒頭を参照。以下の旧報告にある「transaction 引数なし」「DB 未検証」は当時の記録。

## 1. 本書の対象

[testReport.md](#initial-report) の観測結果を根拠として、`server/src` 内の修正案と、修正後に必要なテストの方針をまとめる。テストの責務分離・モック方法・実装順序・完了判定は [testArchitecture.md](../../architecture/itemEditing/updateConfirm.md) に従う。

**今回は設計のみとし、編集対象は本書だけとする。** 既存コード、既存テスト、設計書、報告書は変更しない。本書に記載する修正後の結果は提案する仕様であり、実装済み・検証済みの結果ではない。

ユーザーの追加指定により、**DB 未検証の事項は修正方針に含めない。** 対象は、実行済みの DB 非接続テストで確認できた配列操作、戻り値、service の呼出し、入力検証、キー生成に限定する。

### 対象と根拠

| 修正 ID | 修正対象                         | 確認できた事実                                                                                                        | 元のケース                |
| ------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| F1      | 商品画像の署名配列               | 署名の完了順によって返却配列から署名が欠落する。保存用 URL 配列の入力順は保持される                                   | S13 / P06 / O03           |
| F2      | ブランド解決結果・別名作成の分岐 | 名前で見つかったブランドや新規 alias が返却結果へ採用されない。既存 alias があっても作成 service が呼ばれる経路がある | B03、B05〜B08 / Q03 / O02 |
| F3      | 商品画像 0 件の判定              | 空配列でも通過し、更新 service へ first_image_url=undefined と空の画像配列が渡る                                      | E04 / V10 / S08 / O01     |
| F4      | アップロードキーと uiId の重複   | 同一ミリ秒の再実行でキーが一致する。同じリクエスト内の重複 uiId では署名辞書が上書きされる                            | Q04 / P07 / V12 / O04     |

以下は今回の修正案・追加テスト設計の対象外とする。未確認の DB 挙動から修正の必要性を断定しない。

- 別名が実 DB で重複するか、商品更新の失敗後に残存するか。
- DB 一意制約、マイグレーション、並行作成の排他制御。ブランド解決を商品 transaction の callback 内で実行する順序は、追加指示に基づきテスト契約へ反映する。
- 実 DB の rollback・commit 後の可視性・外部キーや JSONB の保存結果。
- stale なモデル、所有者変更、削除、同時更新による競合（O05 等）。
- 既知の型エラー、Router 登録、共通エラー処理、今回の観測と無関係な改善。

## 2. 変更対象と責務

パスは `server/src/` からの相対パス。

| ファイル                                         | 修正案                                                                                           | 責務                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------ |
| `usecases/itemEditing/shared/buildSignedUrls.ts` | F1：署名配列の圧縮を並行処理の完了後へ移す。F4：リクエストごとに生成する識別子を新規キーへ加える | URL と署名情報の組立て   |
| `usecases/itemEditing/shared/resolveBrand.ts`    | F2：検索結果を明示的に返し、解決済みの場合の追加作成を止める                                     | ブランド解決の業務分岐   |
| `usecases/itemEditing/updateConfirm.ts`          | F3：確定した商品画像が 0 件なら既存 AppError で停止する                                          | 更新前の業務上の前提確認 |
| `validators/body/itemEditing.ts`                 | F4：colorVariants 内で uiId が重複していたら拒否する                                             | リクエストの入力検証     |

service の DB アクセス実装、モデル制約は変更案に含めない。ブランド解決は、追加指示で確認した現行実装どおり商品 transaction の callback 内で行う。F2 では既存の `getBrand`、`getAliasOne`、`getBrandOne`、`createAliases` と `BrandResult` を利用できる。

Controller と Route に業務ロジックを追加しない。成功レスポンスは既存の署名 4 項目を維持する。新しい依存ライブラリは追加しない。

## 3. F1：商品画像の署名欠落を防ぐ

### 原因

現行 helper は、並行処理中に `itemImageSignedUrls[index]` へ代入した直後、同じ配列を filter して詰め直している。そのため、配列内の位置と元の入力 index の対応が変化し、後から完了した処理が別の署名を上書きする。

例えば index 2 の署名が先に完了すると、その要素が filter によって配列の位置 0 へ移る。後から index 0 が完了すると、位置 0 の署名が置き換わる。

### 修正案

変更をこの原因に限定し、次の順序にする。

1. 各署名処理は元の入力 index へ結果を格納する。
2. 並行処理中は配列を圧縮・並べ替えしない。
3. `Promise.all` の完了後に、欠けている要素を一度だけ filter する。
4. 返却要素の `index` には、圧縮後の配列位置ではなく元の入力 index を残す。
5. `newUploadedUrls` と `finalImageUrls` の組立ては現在の入力 index 対応を維持する。

処理構造の例（実装コードではなく、変更位置を示す擬似コード）：

```text
await Promise.all(入力画像ごとの処理)
    新規アップロード対象の場合:
        署名をawaitする
        署名配列[元index] = { index: 元index, url: 署名 }
        新規公開URL配列[元index] = 公開URL

署名配列 = 署名配列から未設定要素を除去
入力順に既存URL／新規公開URLを選び、確定URL配列を作る
```

### 修正後の契約

- 新規署名対象 1 件につき、返却署名が必ず 1 件対応する。
- 返却配列は元 index の昇順とし、元 index と URL の対応を保持する。
- index が飛び飛びでも、0 始まりに付け直さない。
- 既存画像は署名配列へ追加せず、確定 URL 配列には従来どおり含める。
- 署名処理が reject した場合は helper も reject する。既に開始した別の Promise の取消しは保証しない。

## 4. F2：ブランド解決結果を返し、不要な別名作成を抑止する

### 原因と提案の範囲

現行処理には、`getBrandOne` で見つかったブランドや `createAliases` の結果を `brandResult` へ反映しない経路がある。また、brand 付き alias を採用した後も処理が続き、未紐付け alias がある場合も作成へ進む。

本案では「検索で解決できた結果を商品更新の引数へ反映する」「既に利用できる alias が返っているなら作り直さない」を提案する。これは helper の分岐・戻り値・service 呼出しで検証する。実 DB における重複行の防止や既存データの整理は含めない。

### 修正後の分岐案

上から順に評価し、結果が決まったら return する。

| 順序 | 条件                                                 | 戻り値 `{ brand, alias }`          | 後続の検索・作成             |
| ---- | ---------------------------------------------------- | ---------------------------------- | ---------------------------- |
| 1    | 指定 brandId に対応するブランドが存在                | `{ 指定ブランド, null }`           | 名前検索・作成なし           |
| 2    | 指定 ID で解決せず、brand.name が null または空文字  | `{ null, null }`                   | 名前検索・作成なし           |
| 3    | 正規化名で取得した alias に brand がある             | `{ alias.brand, alias }`           | ブランド名検索・追加作成なし |
| 4    | 上記で解決せず、正規化名に対応するブランドが存在     | `{ 名前で取得したブランド, null }` | 作成なし                     |
| 5    | ブランドが見つからず、未紐付け alias が存在          | `{ null, 既存alias }`              | 作成なし                     |
| 6    | ブランド・alias とも存在せず、現行の作成条件を満たす | `{ null, 新規作成alias }`          | createAliases を 1 回        |
| 7    | いずれにも該当しない                                 | `{ null, null }`                   | 作成なし                     |

分岐上の注意点：

- 有効な ID 指定を最優先にする。存在しない ID を 404 にする変更は含めず、現在と同様に名前への fallback を許す。
- brand 付き alias を、名前検索結果より優先する現行の方針を維持する。
- 未紐付け alias と名前検索のブランドが両方ある場合は、ブランドのみ採用する。無関係な alias をそのブランドへ自動的に紐付けない。
- 新規 alias の返却は既存の `BrandResult` で表せる。usecase の既存処理により、更新引数の brand_id は null、brand_aliases_id はその alias.id になる。実 DB 保存の成否は本書の確認範囲外。
- 正規化方法、正規化前の `inputName.length >= 2` という作成条件は変更しない。空白だけの名前や絵文字の扱い（B09）は、名称入力の別仕様として今回広げない。
- brand.name が未指定の場合は、解決結果を null にする現在の挙動を維持する。

### 重複実行で確認する範囲

初回に作成した未紐付け alias を、2 回目の検索 service が返した場合、2 回目はその alias を再利用して作成 service を呼ばない。

この確認は、検索結果を指定したモックテストで行う。並行する 2 件の検索が両方とも未登録を返す場合まで重複作成を防ぐ保証は追加しない。Q03 の service 呼出し分岐だけを更新し、P05 の DB 側対策は今回の修正案に含めない。

### transaction への影響

ブランド解決と createAliases は、追加指示の意図に合わせ、商品更新 transaction の callback 内で行う。期待する順序は「数値・マスター検証 →transaction 開始 → ブランド解決・必要な別名作成 → 本体更新 → 画像更新」とする。

- ブランド解決が完了するまで本体・画像更新と callback 完了へ進まない。
- ブランド service が失敗した場合、transaction は開始済みであり、同一エラーが callback から usecase へ伝播する。後続のブランド service と商品更新は実行しない。
- transaction 開始に失敗して callback が呼ばれなければ、ブランド解決も実行しない。
- 本体更新失敗時は callback が同一エラーで reject し、画像更新へ進まない。T05 はこの順序と伝播を検証する。

今回のテスト修正は callback 内の実行順序を対象とする。現行の resolveBrand/createAliases には transaction 引数がなく、createAliases の Model.create にも明示的な transaction 指定はないため、callback 内での呼出しだけを根拠に DB 操作が同一 transaction へ参加しているとは判定しない。引数追加や DB の rollback 検証は今回行わない。

## 5. F3：確定した商品画像が 0 件なら更新を止める

### 原因

配列の存在のみを確認する `if (!finalImageUrls)` では、空配列が通過する。DB で何が保存されるかは未検証だが、更新引数の first_image_url が undefined になることは確認済み。

### 修正案

商品情報の確定更新では「利用できる商品画像が 1 件以上あること」を前提とする案を採る。usecase の現在の画像チェック位置で、空配列も拒否する。

```ts
if (!finalImageUrls || finalImageUrls.length === 0) {
    throw new AppError("ITEM_IMAGE_NULL", 400);
}
```

- エラーコードと HTTP ステータスは既存のものを使用する。
- 動画 URL → サムネイル URL → 商品画像の検証順は維持する。
- 数値検証、マスター検証、ブランド解決、transaction、両更新 service へ進めない。
- 判定対象は入力の itemImages 件数ではなく、helper が組み立てた確定 URL 件数とする。入力があっても、既存 index 不在や type 不足で全件除外される場合を含む。
- schema に商品画像件数の下限は追加しない。空の入力配列を schema が受理する V10 と、確定画像 0 件を usecase が拒否するケースを分ける。
- 商品画像 1 件以上のときの引継ぎ、順序、先頭画像の選択は維持する。一部だけ画像が確定しない場合の扱いや画像上限変更は追加しない。

これは更新 service に不完全な引数を渡さないための修正であり、DB 上の旧先頭画像残存を確認したうえでの修正ではない。

## 6. F4：別リクエストのキー共有と同一リクエストの uiId 重複を分けて防ぐ

### F4-a：同一ミリ秒の別リクエスト

`Date.now()` だけに依存せず、`buildSignedUrls` の 1 回の呼出しごとに Node.js 標準の `node:crypto` の `randomUUID()` で識別子を生成する案とする。新しいライブラリは不要。

時刻と既存プレフィックスを残し、新規アップロードキーに識別子を追加する。

| メディア   | キーの提案                                                      |
| ---------- | --------------------------------------------------------------- |
| 動画       | `video/original/{userId}/{itemEditingId}_{now}_{requestId}`     |
| サムネイル | `thumbnail/{userId}/{itemEditingId}_{now}_{requestId}`          |
| 商品画像   | `item-image/{userId}/{itemEditingId}_{index}_{now}_{requestId}` |
| 属性画像   | `attributes/{userId}/{itemEditingId}_{uiId}_{now}_{requestId}`  |

- 1 回の helper 呼出しでは同じ requestId を使用する。ファイル間の識別には従来のプレフィックス・index・uiId を使う。
- 署名関数へ渡す key と、保存用の公開 URL へ組み込む key は必ず同一にする。
- 既存 URL を再利用する場合、その URL は書き換えない。
- レスポンスの項目・型は変更せず、requestId を新しいレスポンス項目として追加しない。
- これは時刻だけによる衝突を避ける方策であり、全リクエストでの数学的な一意性や、リクエスト再送の冪等性を保証するものではない。
- 実装前にはキーを受け取る動画処理等に末尾形式への依存がないか確認する。既存キーを読み替える移行は行わない。

### F4-b：同じリクエストの重複 uiId

requestId を追加しても、同じリクエスト内で uiId が重複していれば属性のキーと返却辞書を共有する。この問題は入力検証で扱う。

`updateItemEditingConfirmBodySchema` の colorVariants 配列に、uiId の一意性を検証する refinement を追加する案とする。`Set<string>` で出現済み uiId を確認し、2 件目以降の該当 uiId に検証エラーを付ける。

- 比較は現在の文字列の完全一致とする。trim、小文字化、ID の自動再採番は行わない。
- 重複があれば既存の validateBody を通じて `INVALID_BODY / 400` にする。
- 画像あり／なし、uploaded の値にかかわらず同じ colorVariants 配列内の重複を拒否する。
- 色配列 0 件・1 件・一意な複数件は受理する。uiId の文字種や長さ、空文字そのものの禁止は今回追加しない。ただし空文字が複数件あれば重複として拒否する。
- 正常 HTTP 経路では controller・usecase・署名処理へ到達しない。
- helper 内に同じ schema 検証を追加しない。直接 helper へ不正な重複 uiId を渡した場合まで保護したと主張しない。

## 7. 修正後のテスト方針

### 元の設計方針の引継ぎ

| レベル       | 方針                                                                                                                | 既存の主なファイル                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| U            | usecase を実行し、依存 helper/service と transaction は Vitest でモック。更新引数・処理順序・例外・後続未実行を検証 | `usecase.test.ts`                           |
| H            | helper 実装を使用。DB service、S3 署名、時刻、requestId 生成をモック                                                | `signedUrls.test.ts`、`masterBrand.test.ts` |
| V            | 実 schema と validateBody を使用し、入力の受理・拒否を検証                                                          | `validation.test.ts`                        |
| C/R          | 実 controller またはテスト用 Express に接続した Router を使用。usecase をモック                                     | `controller.test.ts`、`route.test.ts`       |
| service 単体 | 今回 service 実装の変更は提案しない。既存の呼出契約の回帰確認を維持                                                 | `services.test.ts`                          |
| DB 結合      | 今回の修正方針・追加ケース設計の対象外                                                                              | 作成・実行しない                            |

- Vitest を使用し、Router 結合には既存の Supertest を用いる。
- テスト名には本書の AF ケース ID、元のケース ID、条件と期待結果を含める。
- 同じ ID 内の複数条件は `it.each` 等で独立ケースへ展開する。
- AppError は型・code・statusCode を、予期しない例外は同一オブジェクトの伝播を検証する。
- 並行署名は deferred Promise で完了順を制御する。sleep やランダムな実行順には依存しない。
- requestId は既知の異なる値を順に返すモックにする。実 UUID の統計的な衝突試験や固定文字列へのスナップショット比較を目的にしない。
- helper を全モックした U だけで F1・F2・F4 の解決を確認したことにはしない。実 helper との組合せも検証する。

### 9 つの観点への対応

| 観点             | 今回確認する範囲                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 正常系           | 署名の全件返却、ブランド採用、商品画像 1 件以上、一意 uiId                                                                                         |
| 異常系           | 確定画像 0 件、重複 uiId、署名・ブランド service の例外と後続停止                                                                                  |
| 境界値           | 画像 0/1/10 件、uiId の 0/1/2 件、同一時刻、飛び飛びの index                                                                                       |
| 条件分岐         | ブランドの優先順位、既存/新規画像、情報不足、採用済み結果からの早期 return                                                                         |
| 状態遷移         | 2 回目の検索で alias が返ったときの再利用、画像再利用から新規署名への切替。永続状態は扱わない                                                      |
| DB 整合性        | 対象外。更新引数の整合性だけは U/H で確認し、DB 保証と区別                                                                                         |
| トランザクション | 画像 0 件で未開始、transaction 内のブランド解決と例外伝播、更新 service への同一 transaction 引渡しと完了待ちを確認。DB の rollback 検証は含めない |
| 重複実行         | 同じ時刻でも別 requestId でキーが分かれること、既存 alias 返却時の作成呼出し抑止                                                                   |
| 並行処理         | 署名完了順を変えても欠落・対応ずれがないこと。DB 並行更新・別名の同時作成制御は対象外                                                              |

## 8. 追加・変更するテストケース

以下は修正後の期待結果。現時点で実装・実行はしていない。

### F1：署名配列

| 新 ID  | 元のケース      | レベル | 入力・手順                                               | 修正後の期待結果                                                                                               |
| ------ | --------------- | ------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| AF-S01 | S13 / P06 / O03 | H      | 新規 index=[0,1,2]、完了順を正順・逆順・混在にする       | すべて返却 index=[0,1,2]、件数 3、URL 対応一致、重複なし                                                       |
| AF-S02 | S13 / O03       | H      | 新規 index=[1]、[0,2]、[1,3]。複数件は逆順でも完了させる | 返却 index はそれぞれ[1]、[0,2]、[1,3]。元 index を付け替えない                                                |
| AF-S03 | S05 / S06       | H      | 既存・新規を交互に指定                                   | 新規の署名だけを全件返し、確定 URL は既存分を含め入力順                                                        |
| AF-S04 | S08 / V10       | H      | 署名対象 0 件・1 件・10 件                               | 件数が対象数と一致。0 件でも既存画像があれば確定 URL は維持                                                    |
| AF-S05 | E11             | H/U    | 複数署名のうち 1 件を reject                             | 同一エラーを伝播し、実 helper 経由の usecase では商品更新へ進まない。開始済み Promise の取消しは assert しない |
| AF-S06 | N01 / N02 / R02 | H/U/C  | 元 index が飛び飛びの結果を usecase と controller へ渡す | 署名 4 項目の型と index を維持。first_image_url は確定 URL の先頭、画像更新には全確定 URL を渡す               |

### F2：ブランド解決

| 新 ID  | 元のケース            | レベル | 入力・手順                                                          | 修正後の期待結果                                                                                                                                                                                                      |
| ------ | --------------------- | ------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AF-B01 | B01 / B02             | H      | 有効 ID、存在しない ID ＋名前、ID なし＋名前なし                    | 有効 ID 優先。存在しない ID は名前へ fallback。名前なしは両方 null                                                                                                                                                    |
| AF-B02 | B03 / B08             | H      | brand 付き alias が返る                                             | その brand・alias を返す。getBrandOne と createAliases は未実行                                                                                                                                                       |
| AF-B03 | B05 / O02             | H/U    | alias なし、名前検索でブランドが返る                                | ブランドを採用。更新引数 brand_id にその ID、brand_aliases_id に null。作成なし                                                                                                                                       |
| AF-B04 | B07 / O02             | H/U    | 未紐付け alias あり、ブランド名検索の結果が null                    | 既存 alias を返し、更新引数 brand_id=null・brand_aliases_id=既存 ID。作成なし                                                                                                                                         |
| AF-B05 | B05 / B07             | H/U    | 未紐付け alias と名前検索ブランドが両方ある                         | ブランドのみ採用。既存 alias の紐付け更新や作成を呼ばない                                                                                                                                                             |
| AF-B06 | B06 / O02             | H/U    | 検索結果なし、2 文字以上で新規 alias を作成                         | 作成 1 回、その alias を返す。更新引数 brand_aliases_id へ新規 ID を渡す                                                                                                                                              |
| AF-B07 | B04 / B06 / B09       | H      | 元名 0/1/2 文字、全半角・カナ・空白・絵文字                         | 現行の正規化と作成条件を維持。作成した場合の alias 返却だけを変更                                                                                                                                                     |
| AF-B08 | Q03 / O02             | H/U    | 初回は未登録 → 作成、2 回目の検索はその未紐付け alias を返す        | 2 回とも同じ alias.id を採用し、createAliases の合計呼出しは 1 回。DB 件数は assert しない                                                                                                                            |
| AF-B09 | B10 / E11             | H/U    | getBrand、getAliasOne、getBrandOne、createAliases をそれぞれ reject | 呼び出される分岐を用意し、transaction 開始後の同一エラーの callback/usecase への伝播、後続ブランド service・商品更新の未実行を確認                                                                                    |
| AF-B10 | N01 / T01 / T02 / T05 | U/H    | ブランド解決成功後に商品更新を実行                                  | 商品 transaction→ ブランド解決 → 本体 → 画像の順序を確認。ブランド解決中の更新・callback 完了待ち、更新 service への同一 t 引渡し、開始失敗時のブランド解決未実行、本体更新失敗の伝播を確認。別名の DB 残存は扱わない |

### F3：商品画像 0 件

| 新 ID  | 元のケース | レベル | 入力・手順                                                                 | 修正後の期待結果                                                                                                |
| ------ | ---------- | ------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| AF-I01 | E04 / O01  | U      | helper 結果を[]、null、undefined とし、既存先頭画像あり/なしを組み合わせる | ITEM_IMAGE_NULL/400。数値・マスター・ブランド・transaction・更新 service は未実行                               |
| AF-I02 | V10 / O01  | V/H/U  | itemImages=[]を実 schema と実 helper へ渡す                                | schema は受理、確定配列は[]、usecase が ITEM_IMAGE_NULL/400 を返す                                              |
| AF-I03 | S06 / S08  | H/U    | 入力画像はあるが、既存 URL 不在・新規 type 不足で全件除外される            | 入力件数にかかわらず ITEM_IMAGE_NULL/400。商品更新なし                                                          |
| AF-I04 | N02 / D04  | U/H    | 確定画像 1 件・10 件                                                       | 更新を実行。first_image_url と画像配列の先頭が一致し、全件を更新 service へ渡す。永続化は扱わない               |
| AF-I05 | E15        | U/H    | 動画・サムネイル・画像配列の不備を重ねる                                   | 動画 → サムネイル → 商品画像のエラー優先順位を維持                                                              |
| AF-I06 | R03        | C/R    | usecase が ITEM_IMAGE_NULL を reject                                       | controller は next へ同一 AppError を渡し、200 を返さない。Router はテスト用エラー観測 middleware で 400 を確認 |

### F4：キー生成・uiId の一意性

| 新 ID  | 元のケース            | レベル | 入力・手順                                                            | 修正後の期待結果                                                                          |
| ------ | --------------------- | ------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| AF-K01 | Q04 / O04             | H      | 同一時刻・同一商品・同一入力で 2 回実行し、requestId モックだけ変える | 動画・サムネイル・商品画像・属性画像の各新規キーが呼出し間で異なる                        |
| AF-K02 | S01 / S04 / S05 / S09 | H      | 1 回で全メディアを新規指定                                            | 1 回生成した requestId を使用し、署名 key と公開 URL の key が一致。元 index・uiId は保持 |
| AF-K03 | S02 / S10 / Q01       | H      | 動画・商品画像・属性画像等を既存利用                                  | 既存 URL を書き換えず、不要な S3 署名を呼ばない                                           |
| AF-K04 | Q02 / P06             | H      | 時刻を変えた再実行、同時開始して別 requestId を割当て、署名を逆順完了 | 各呼出し内の URL 対応を保持し、別呼出しの署名結果を混ぜない。再送への同一結果は保証しない |
| AF-K05 | E11                   | H/U    | requestId 生成が throw、またはキー生成後の署名が reject               | エラーを伝播して商品更新へ進めない                                                        |
| AF-V01 | V12 / P07 / O04       | V/R    | uiId が同じ 2 件。画像あり/なし、uploaded=true/false を組み合わせる   | schema 拒否、INVALID_BODY/400。controller/usecase 未実行                                  |
| AF-V02 | V12 / N05             | V/H    | 色 0 件・1 件・一意な複数件、色の並べ替え                             | schema 受理。各 uiId と署名・既存画像の対応を維持                                         |
| AF-V03 | V12                   | V      | 1 件だけ空 uiId、空 uiId が 2 件、同一 uiId が離れた位置にある        | 1 件の空文字は受理、重複は位置によらず拒否。勝手に trim・再採番しない                     |
| AF-V04 | V16 / R05 / R07       | V/R    | 重複 uiId の body、params も不正なリクエスト、重複 body の繰返し      | 既存の params 優先・認証・レート制限順序を維持。body 不正も制限回数に加算                 |

## 9. 既存テストの移行方針

既存の観測テストをそのまま残すと、不具合の現行結果を期待する assert が修正後に失敗する。修正時は次の対応を行う。本書作成時点では変更しない。

| 既存テスト                                                  | 修正時の扱い                                                                                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S13 / P06 / O03：署名欠落を期待するケース                   | AF-S01/S02 へ変更し、欠落なし・全 index 対応を期待する。旧結果は testReport.md の履歴に残す                                                                       |
| B03 / B05〜B08 / O02：未採用や不要な作成を期待するケース    | AF-B02〜B06 の分岐表へ置換。brand=null・alias ありの更新引数も追加検証                                                                                            |
| Q03：同じ未紐付け alias が返っても作成 2 回を期待するケース | AF-B08 へ変更。検索結果を指定した逐次再実行の確認に限定                                                                                                           |
| E04 / O01：空配列が更新へ進むケース                         | AF-I01 へ変更し、空配列も 400・後続未実行を期待                                                                                                                   |
| V10：schema が画像 0 件を受理するケース                     | 維持。usecase の 0 件拒否とは責務を分ける                                                                                                                         |
| Q04：同一時刻のキー一致を期待するケース                     | AF-K01 へ変更。時刻と requestId を別々にモック                                                                                                                    |
| S01 / S04 / S05 / S09 等のキー文字列比較                    | requestId 込みの期待値へ変更。署名と公開 URL の対応 assert は維持                                                                                                 |
| V12：重複 uiId を受理するケース                             | 重複部分を AF-V01/V03 へ置換。空配列・素材比率合計など無関係な受理条件は維持                                                                                      |
| P07：helper 直接呼出しで辞書上書きを期待するケース          | HTTP の入力契約を確認する AF-V01 へ移す。helper 直接呼出しまで拒否されるとは期待しない                                                                            |
| N01、ブランド関連の service 呼出順・回数                    | 解決後の早期 return を反映。追加指示に合わせ、商品 transaction 開始後にブランド解決を実行する期待値へ変更。T05 も callback 内の別名作成・本体更新失敗の伝播へ移行 |
| その他の正常系・認証・認可・価格/在庫境界・エラー伝播       | 原則として既存期待値を維持し回帰確認                                                                                                                              |

既存 436 件という件数の維持やカバレッジ 100%を完了条件にしない。仕様が変わるケースだけ期待結果を更新し、無関係な assert を弱めない。失敗したテストを skip や todo にして成功扱いにしない。

## 10. 実装順序と完了判定

### 実装順序

元の testArchitecture.md の P0 → P1 → P2 に合わせる。

1. **P0：基本動作・異常時停止** — F1 の署名件数と index 対応、F3 の空画像拒否、F2 の返却結果と更新引数、F4-b の重複 uiId 拒否をケースごとに実装する。修正前の再現条件と修正後の期待結果を対にする。
2. **P1：helper・入力境界・接続** — ブランドの全分岐と例外、キーの全メディアへの適用、既存 URL 引継ぎ、validator から controller/Router までの接続を確認する。
3. **P2：重複実行・並行処理** — 正順・逆順・混在・疎 index、同一時刻の別 requestId、検索済み alias の再利用を確認する。DB 未検証事項への対策は追加しない。

### 完了条件

- F1〜F4 の対象ファイルだけに必要な変更を行い、上記の修正後の契約を満たす。
- AF ケースの実処理・モック範囲が明確で、観測テストを新しい期待結果へ移行できている。
- 異常系はエラーだけでなく、後続検証・署名・更新の未実行を適切な境界で確認できている。
- 署名の各完了順で、件数・元 index の一意性・URL 対応・確定 URL 順序が一致する。
- ブランドの戻り値、必要な service だけを呼ぶこと、商品更新へ渡す ID を確認できている。
- transaction 開始後にブランド解決を行い、その完了前には更新へ進まない。ブランド解決失敗時は callback/usecase へ同一エラーを伝播し、商品更新へ進まない。
- 既存の所有権取得、成功レスポンス、transaction 引渡し・完了待ち、認証・レート制限の回帰テストが通る。
- DB 未検証の事項について成功・修正完了と記載しない。今回の完了は DB 非接続で検証できる修正範囲に限定する。

実装時の確認コマンド（`server/` で実行）：

```bash
npm run test:run -- test/usecases/itemEditing/updateConfirm/
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

既存 ESLint 設定がテスト TS を検査しない場合は、前回同様に対象テストへ typescript-eslint の検査を別途適用する。既知のエラーは修正せず、新しい変更に起因するエラーと区別する。

本書作成時点ではコード・テストを変更していないため、これらのコマンドの再実行や、修正後の成功判定は行っていない。

---

## 修正レポート

> 以下は順序の意図が確認される前の実行履歴。現在の設計は上記各節へ反映済みであり、最新の判定は末尾の「再修正レポート」を参照する。

### 実施結果

第 8〜10 節に基づき、F1〜F4 の追加・移行テストを実装した。対象ディレクトリの 7 テストファイルを実行した結果は、**502 件中 494 件成功、8 件失敗、skip/todo なし**だった。追加テストの実装は完了したが、ブランド解決と transaction 開始の順序が本書の契約と一致しないため、全件成功の完了条件は未達である。

今回変更したのは、このディレクトリのテスト 6 ファイル、共通 fixture、本レポートだけである。`services.test.ts`は変更せず回帰確認した。実装コード、`testArchitecture.md`、過去の観測結果を記録した`testReport.md`は変更していない。

### 追加・移行内容と AF ケースの結果

モックは Vitest を使用した。service・S3 署名・transaction をモックし、helper、schema、validateBody、controller、Router は各テストの責務に応じて実処理を呼び出している。署名の完了順は deferred Promise、requestId は`randomUUID`の固定応答で制御した。DB への接続は行っていない。

以下は 31 個の AF ケース ID の対応表である。同じ ID を複数条件やレイヤーで検証しているため、ID 数と実行テスト件数は一致しない。

| 対象 ID     | 主なファイル                                | 結果・確認内容                                                                                                                                             |
| ----------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AF-S01〜S04 | `signedUrls.test.ts`                        | 成功。正順・逆順・混在、疎 index、既存と新規の混在、署名対象 0/1/10 件で、件数・index・URL 対応と確定 URL 順を確認                                         |
| AF-S05      | `masterBrand.test.ts`                       | 成功。実 helper 内の署名失敗を同一エラーとして伝播し、マスター検索・商品更新へ進まない                                                                     |
| AF-S06      | `masterBrand.test.ts`、`controller.test.ts` | 成功。疎 index を含む署名 4 項目の返却、先頭画像と全画像の更新引数を確認                                                                                   |
| AF-B01〜B07 | `masterBrand.test.ts`                       | 成功。ID 指定、紐付け済み alias、正式ブランド、未紐付け alias、新規作成の優先順位、名前の境界・正規化、更新へ渡す ID を確認                                |
| AF-B08      | `masterBrand.test.ts`                       | 成功。2 回目の検索で既存 alias を返すモックにより再利用を確認。作成 service の合計呼出しは 1 回                                                            |
| AF-B09      | `masterBrand.test.ts`                       | **失敗（4 件）**。各ブランド service の例外は伝播するが、例外発生前に transaction が開始されている                                                         |
| AF-B10      | `masterBrand.test.ts`、`usecase.test.ts`    | **一部失敗**。ブランド解決完了前の transaction 開始を検出。同一 transaction の更新 service への引渡し、本体・画像更新と transaction 完了の待機は確認できた |
| AF-I01      | `usecase.test.ts`                           | 成功。確定画像が空配列/null/undefined の場合、既存先頭画像の有無によらず 400 で後続未実行                                                                  |
| AF-I02〜I04 | `masterBrand.test.ts`                       | 成功。schema が受理する画像 0 件、実 helper が全件除外する入力、確定画像 1/10 件を実 usecase へ接続して確認                                                |
| AF-I05      | `usecase.test.ts`                           | 成功。動画 → サムネイル → 商品画像のエラー優先順位を維持                                                                                                   |
| AF-I06      | `controller.test.ts`、`route.test.ts`       | 成功。ITEM_IMAGE_NULL の同一 AppError を next へ渡し、テスト用エラー middleware を通じて HTTP 400 を確認                                                   |
| AF-K01〜K04 | `signedUrls.test.ts`                        | 成功。同一時刻の別 requestId、1 呼出し内のキー対応、既存 URL 保持、異なる時刻や並行実行での結果の分離を確認                                                |
| AF-K05      | `masterBrand.test.ts`                       | 成功。UUID 生成失敗、および動画・サムネイル・商品画像・属性画像の署名失敗で商品更新へ進まない                                                              |
| AF-V01      | `validation.test.ts`、`route.test.ts`       | 成功。画像なし・新規・既存の組合せ 9 通りで重複 uiId を拒否し、INVALID_BODY/400、usecase 未実行を確認                                                      |
| AF-V02      | `validation.test.ts`、`signedUrls.test.ts`  | 成功。色 0/1/複数件と並べ替えを受理し、uiId と画像 URL の対応を維持                                                                                        |
| AF-V03      | `validation.test.ts`                        | 成功。単独の空文字は受理し、空文字や離れた位置の重複は拒否。trim・大小文字変換を行わない                                                                   |
| AF-V04      | `route.test.ts`                             | 成功。認証・params 検証の優先順位を維持し、重複 body による 400 もレート制限回数に加算                                                                     |

署名欠落、不要な alias 作成、空画像での更新継続、同一時刻のキー一致、重複 uiId 受理を期待していた観測テストは、修正後の契約へ移行した。画像 0 件の schema 受理、素材比率合計など無関係な入力条件の期待値は維持している。失敗するケースを skip/todo にしたり、現行実装に合わせて順序の assert を弱めたりしていない。

### 失敗 8 件の原因と完了判定

本書では「ブランド解決 → 商品 transaction 開始 → 本体更新 → 画像更新」の順序を要求している。一方、現行の`server/src/usecases/itemEditing/updateConfirm.ts`は、`sequelize.transaction`の callback 内で`resolveBrand`を呼び出している。これにより、次の 8 件が失敗した。

| ファイル・ケース                                             | 件数 | 設計書と異なる観測結果                                                                                            |
| ------------------------------------------------------------ | ---- | ----------------------------------------------------------------------------------------------------------------- |
| `masterBrand.test.ts`：AF-B09                                | 4    | getBrand/getAliasOne/getBrandOne/createAliases の各例外発生時、transaction の呼出し回数が期待値 0 回に対して 1 回 |
| `masterBrand.test.ts`：AF-B10                                | 1    | alias 作成が未完了の時点で transaction が開始済み。呼出し順も設計と逆                                             |
| `masterBrand.test.ts`：既存 T05                              | 1    | alias 作成の呼出しが商品 transaction 開始より後                                                                   |
| `usecase.test.ts`：既存 N01/N02/N05/T01                      | 1    | 正常時のブランド解決と transaction 開始の順序が逆                                                                 |
| `usecase.test.ts`：既存 E11/E12/E13/T06 の resolveBrand 例外 | 1    | resolveBrand が失敗しても transaction は呼出し済み                                                                |

F1・F3・F4 の追加テスト、および F2 のブランド採用・再利用は成功した。既存の認証・認可、入力境界、レスポンス、更新引数、transaction 引渡しと完了待ちも対象テストで確認した。ただし、F2 の処理順序と異常時の transaction 未開始については契約未達であり、修正全体の完了とは判定しない。

今回許可された範囲はテストディレクトリ内に限られるため、実装コードは修正していない。DB の永続化、rollback、alias の残存や並行更新の整合性については検証も成功判定も行っていない。transaction callback 内で呼んでいることだけから、ブランド service に同じ transaction が適用されるとは判断しない。

### 実行コマンドと詳細結果

`server/`で次を実行した。テスト結果の集計には Vitest の JSON レポートを使用した。

```bash
npm run test:run -- test/usecases/itemEditing/updateConfirm/ --reporter=json --outputFile=/tmp/afterfix-tests.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

| テストファイル        |    成功 |  失敗 |    合計 |
| --------------------- | ------: | ----: | ------: |
| `controller.test.ts`  |       5 |     0 |       5 |
| `masterBrand.test.ts` |     144 |     6 |     150 |
| `route.test.ts`       |      22 |     0 |      22 |
| `services.test.ts`    |       4 |     0 |       4 |
| `signedUrls.test.ts`  |      60 |     0 |      60 |
| `usecase.test.ts`     |      48 |     2 |      50 |
| `validation.test.ts`  |     211 |     0 |     211 |
| **合計**              | **494** | **8** | **502** |

`npm run lint`は成功した。既存設定ではテスト TS が検査対象外のため、対象ディレクトリの 8 個の TS ファイルへ、ESLint API で typescript-eslint の recommended 設定を別途適用し、エラー・警告ともに 0 件だった。

型検査は既知の対象外エラーにより失敗した。`npm run typecheck`では`src/controllers/items.ts`の export 不一致 1 件と`src/usecases/items/upload/uploadDraft.ts`の import 先不在 4 件、テスト用 tsconfig では`shopSignup/signup1.test.ts`と`signup5.test.ts`の import 先不在 2 件が報告された。今回変更したテストファイルに型エラーは報告されていない。これらの既知エラーは変更していない。

## 再修正レポート

### 再修正の理由と対象

ブランド解決と createAliases を商品 transaction の callback 内で実行する順序は、意図した変更であることが確認された。この指示を設計の前提として、第 3・5・7〜10 節の関連記述と、`usecase.test.ts`・`masterBrand.test.ts`の期待値を修正した。前回の修正レポートは実行履歴として残しているが、そこでの「順序の不一致による未達」という判定は本レポートで更新する。

今回変更したファイルは、このディレクトリ内の上記テスト 2 ファイルと`afterFix.md`のみ。実装コード、DB、その他のテストファイルは変更していない。

### 更新したテスト契約

期待する順序を「事前検証 →transaction 開始 → ブランド解決・必要な別名作成 → 本体更新 → 画像更新」とした。

| 対象                       | 更新・確認内容                                                                                                                                                         | 結果 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| AF-B09（4 件）             | 各ブランド service の例外発生時は transaction 開始済みとし、transaction の返却 Promise と usecase が同じエラーで reject すること、後続 service・商品更新の未実行を確認 | 成功 |
| AF-B10：ブランド解決待機   | 別名作成を保留している間は transaction 開始済みで、本体・画像更新と callback 完了には進まない。解決後は順序どおり更新し、両更新 service に同じ t を渡す                | 成功 |
| AF-B10 / T05：本体更新失敗 | transaction 開始後に別名を作成し、本体更新で失敗した場合は同じエラーを伝播して画像更新へ進まない                                                                       | 成功 |
| N01 / N02 / N05 / T01      | 正常時の呼出し順を transaction 開始 → ブランド解決へ変更。保存引数・返却項目の検証は維持                                                                               | 成功 |
| E11 / E12 / E13 / T06      | ブランド解決より前の事前処理失敗では transaction 未開始。ブランド解決以降の失敗では開始済みで、transaction の返却 Promise にも同一エラーが伝播                         | 成功 |
| E14                        | transaction 開始失敗で callback が呼ばれない場合はブランド解決未実行。完了時の失敗ではブランド解決実行済みであることを追加確認                                         | 成功 |

失敗テストを削除・skip 化せず、変更された契約に対応する assert へ移行した。ブランド解決、本体更新、画像更新、transaction 完了の待機、および異常時の後続未実行は引き続き検証している。

### 再実行結果

`server/`で実行：

```bash
npm run test:run -- test/usecases/itemEditing/updateConfirm/ --reporter=json --outputFile=/tmp/afterfix-revised-tests.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

| テストファイル        |    成功 |  失敗 |    合計 |
| --------------------- | ------: | ----: | ------: |
| `controller.test.ts`  |       5 |     0 |       5 |
| `masterBrand.test.ts` |     150 |     0 |     150 |
| `route.test.ts`       |      22 |     0 |      22 |
| `services.test.ts`    |       4 |     0 |       4 |
| `signedUrls.test.ts`  |      60 |     0 |      60 |
| `usecase.test.ts`     |      50 |     0 |      50 |
| `validation.test.ts`  |     211 |     0 |     211 |
| **合計**              | **502** | **0** | **502** |

**7 ファイル・502 件がすべて成功し、skip/todo は 0 件。** 前回失敗した 8 件はすべて成功した。F1〜F4 の AF ケースと既存の回帰テストは、更新した呼出し順の契約を満たしている。

`npm run lint`は成功。変更したテスト TS の 2 ファイルへ、ESLint API で typescript-eslint の recommended 設定も別途適用し、エラー・警告ともに 0 件だった。

型検査は前回と同じ既知の対象外エラーのみで失敗した。アプリ側は`src/controllers/items.ts`の export 不一致 1 件と`uploadDraft.ts`の import 先不在 4 件、テスト側は`shopSignup/signup1.test.ts`・`signup5.test.ts`の import 先不在 2 件である。今回変更したファイルの型エラーは報告されておらず、既知エラーは修正していない。

### 完了判定と検証範囲

今回依頼された、意図した実行順序への設計・テストの再修正と、対象テストの全件成功を確認した。DB 非接続で検証する呼出し順・待機・例外伝播の範囲では完了とする。

これは createAliases の DB 操作が商品更新と同じ transaction へ参加し、更新失敗時に rollback されることの確認ではない。現行コードは resolveBrand/createAliases へ t を明示的に渡しておらず、Model.create にも transaction 指定がない。DB への参加・rollback・永続化の整合性は今回の検証対象外であり、成功とは判定していない。

## 2026-10-10 DB 追加検証レポート

ユーザーからテスト DB 追加に伴う未実施項目の実装・実行依頼を受け、本ディレクトリだけを変更した。設計は testArchitecture.md 冒頭、詳細の 49 項目対応と実行結果は[testReport.md](#initial-report)冒頭が最新である。

現行コードの調査により、helper が`src/usecases/shared/`へ移動し、resolveBrand/createAliases へ transaction が渡ることを確認した。旧回帰テスト 3 ファイルの参照先と引数の完全一致 assert をこの実装へ合わせた。アプリ側は編集していない。

| 追加検証                   | 元ケース                                                 | 期待・確認した結果                                                            | ファイル                     |
| -------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------- |
| AF-DB01：保存・状態・JSONB | N02〜N08、ST01〜ST06・ST08、D01・D03〜D06・D08・D10、E01 | 全保存項目、外部キー、非対象行不変、JSONB、画像順序、所有権除外               | database.test.ts             |
| AF-DB02：制約              | V09〜V11、I03〜I04、D09、O01                             | NOT NULL/ENUM/VARCHAR/FK/モデル画像上限と rollback、空画像拒否                | database.test.ts             |
| AF-DB03：別名と再実行      | N08、O02、Q01〜Q03                                       | 現行の名前解決結果を関連付け、逐次 alias 再利用、メディア URL 上書き          | database.test.ts             |
| AF-DB04：transaction       | E12〜E13、ST07、D07、T03〜T05・T07、Q05                  | 商品と新規 alias の rollback、別接続可視性、再試行成功                        | databaseTransactions.test.ts |
| AF-DB05：並行・観測        | P01〜P05・P08、O05                                       | 順序制御した commit/rollback、変更列混在、並行別名 2 行、所有者変更・削除競合 | databaseConcurrency.test.ts  |

T05/Q05 について、以前の報告では callback 内での呼出しのみを検証したが、今回は Model.create まで同じ transaction を渡す現行コードと DB rollback を確認した。別名は残存しなかった。Q03 は DB1 行の再利用、P05 は同時検索後に 2 行生成された。これらは異なる順序での結果として区別する。

P02 では A 名称/B 価格の混在、P08 では削除後の成功応答と所有者変更後の書込みを観測した。テスト成功はこれらの不具合解消を意味しない。フォルダ外編集禁止に従い、修正や docs/todo への追加を行わず本報告へ残した。

最終実行は**DB104 件＋回帰 502 件＝ 606 件、10 ファイルすべて成功、失敗/skip/todo は 0 件**。全接続で`.env.test`由来の`test_db`を確認。作成した ID だけを削除し、残存 0 件を検証した。全体 lint/型検査は対象外の既存エラーで失敗したが、変更 TS8 ファイルの追加 lint は成功し、対象内の型エラーはない。コマンド・エラー箇所・途中経過は testReport.md に記録した。

## 2026-10-12 P02・P05・P08 修正後のテスト結果（最新）

先行するアプリ修正を根拠に、旧不具合の観測テストを修正後の契約へ移行した。今回の編集は本ディレクトリのテスト 4 ファイル（`usecase.test.ts`、`services.test.ts`、`masterBrand.test.ts`、`databaseConcurrency.test.ts`）、`testArchitecture.md`、本書のみ。

- **P02**：初回取得の待合せと transaction 内の再取得を区別。後の入力の名称・価格が保存され、SQL に名称の更新と所有者条件付き FOR UPDATE が含まれることを確認。単体では再取得の完了待ちと最新インスタンスの両更新への引渡しを確認した。
- **P05**：別商品の両検索が未登録の状態から並行作成し、別名 1 行を両商品が共有することを確認。同一商品の同時更新、service のロック待機・再検索・例外伝播、再利用した別名の brand 反映も確認した。
- **P08**：初回取得後の削除・所有者変更を ITEM_EDITING_NOT_FOUND/404 で拒否し、本体・画像・別名を更新しないことを確認。別接続の FOR UPDATE NOWAIT によるロック取得は処理中に拒否され、commit 後は成功した。

最終結果は **10 ファイル・619 件すべて成功（失敗・skip・todo は 0 件）**。内訳は controller 5、masterBrand 152、route 22、services 10、signedUrls 60、usecase 53、validation 211、database 91、databaseTransactions 6、databaseConcurrency 9 件。既存の rollback・再試行・逐次別名再利用も成功した。

実行コマンド（`server/`）：

```bash
npm run test:run -- test/usecases/itemEditing/updateConfirm/ --maxWorkers=1
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

DB 接続は既存ガードで`.env.test`由来の`test_db`を確認し、作成 ID だけを削除して残存 0 件を確認した。ファイル間の DB 負荷を抑えるため worker を 1 にし、ケース内の並行 transaction は維持した。

lint・アプリ型検査は成功。変更テスト 4 ファイルへ ESLint API と typescript-eslint recommended を追加適用し、エラー・警告 0 件。テスト型検査は対象外の既知エラー（`shopSignup/signup1.test.ts:33`、`signup5.test.ts:27`の import 先不在 2 件）のみで失敗し、今回の変更ファイルに型エラーは報告されなかった。対象外ファイルは編集していない。確認範囲は上記の制御した競合順序であり、既存の重複別名の整理や DB 一意制約の保証は含まない。
