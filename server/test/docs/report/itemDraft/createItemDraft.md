# createItemDraft テスト報告・修正記録

## 2026-10-22 元編集セッションの消費（今回の最新結果）

対象: `docs/todo/done/create-item-draft-retains-editing-session.md` に基づく既存バグ修正。
基本設計の元行消費を適用し、下書き本体・画像の保存後に、再認可・UPDATEロック済みの元item_editingを同一transactionで削除する。
削除完了と外側transactionのcommitが終わってから、既存の200・itemDraftId・署名URL群を返す。
失敗時は新規下書き・新規ブランド別名の作成と元編集行の削除を一緒にrollbackする。

- DB非接続: usecase80件・controller5件・helper接続253件・HTTP19件、4ファイル357件成功。
- 実DB: 保存148件・transaction20件・競合12件、3ファイル180件成功。合計7ファイル537件成功。失敗・skip/pending・todo・未処理例外0。
- lint・本番typecheck・テストtypecheck・通常lint対象外の変更TS5ファイル追加lintが成功。過去や途中の重複実行は合算していない。
- 同じ編集IDの成功後再送は404。別編集IDからの下書き作成・ブランド別名再利用は維持する。
- 以前の元行保持・同じ編集IDで複数行を作るQ01/Q05/P01等は旧契約。今回の期待値は[更新済みテスト設計](../../architecture/itemDraft/createItemDraft.md)を優先する。

### 変更と検証境界

本番変更は `src/usecases/itemDraft/createItemDraft.ts` の既存deleteItemEditing利用だけ。
service/Model/Routerの仕様やDBスキーマ、フロント、S3オブジェクトは変更しない。migration/syncの実行なし。

| ケース                | 確認内容                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------- |
| N01/T01・AF-CONSUME01 | 保存・画像更新後に再認可済み元行を同一transactionで削除し、成功後は元行不存在。非対象行は保持 |
| AF-CONSUME02          | 削除失敗の元例外がtransaction外へ伝播し成功応答を返さない。実DBでは先行の下書き保存をrollback |
| AF-CONSUME03/T02      | 本体・画像・削除・外側commitを個別gateで保留し、後続・返却が先行しない                        |
| Q01/Q05               | 成功後の同ID再送404・下書き追加なし。新規別編集IDの要求は独立して成功                         |
| AF-CONSUME04/Q01/Q05  | 初回成功後の再送404、追加書込みなし・先行下書き全列保持を実DBで確認                           |
| AF-CONSUME05          | 実DELETE後の例外で元行全列を復元、下書き/新規別名rollbackと再試行成功                         |
| AF-CONSUME06/P01      | 両先行順で独立PID間の実ロック待機→先行commit・後続404、保存1行                                |
| AF-CONSUME07/P03      | 先行DELETE後の実ロック待機→先行rollback・後続だけ成功/元行消費                                |

usecase単体はtransaction/service/helper境界のモック、HTTPはusecase境界をモックする。DBの保存・削除・rollback・ロックは実DB側で分けて保証する。
実AWSアップロード・S3配信、ブラウザ全画面の通し操作、実COMMIT応答喪失、カバレッジ計測は今回の検証外。

### 実行コマンド・結果・保証範囲

実行ディレクトリはserver/。Node.js 26.12.1を使用するため、次のPATH/共有ライブラリを設定した。

```bash
export PATH=/tmp/node-v26.12.1-linux-x64/bin:$PATH
export LD_LIBRARY_PATH=/tmp/node26-libs/usr/lib/x86_64-linux-gnu
npm run test:run -- src/usecases/itemDraft/test/createItemDraft.test.ts src/controllers/itemDraft/test/createItemDraft.test.ts test/integration/usecases/itemDraft/createItemDraft/masterBrand.test.ts test/integration/usecases/itemDraft/createItemDraft/route.test.ts --maxWorkers=1 --reporter=json --outputFile=/tmp/item-draft-consume-nondb-results.json
```

最終の上記実行は357件すべて成功、失敗・skip/pending・todo・未処理例外0。先行の333件実行は重複加算しない。

```bash
npm run test:run -- test/integration/database/itemDraft/createItemDraft/database.test.ts test/integration/usecases/itemDraft/createItemDraft/databaseTransactions.test.ts test/integration/usecases/itemDraft/createItemDraft/databaseConcurrency.test.ts --maxWorkers=1 --reporter=json --outputFile=/tmp/item-draft-consume-db-results.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

実DB180件と静的検査はすべてexit 0。--maxWorkers=1は共有fixture/hook/envのファイル間干渉防止で、ケース内の並行transactionは維持。
追加lintは既存ESLint APIとtypescript-eslint推奨規則を用い、変更したtest配下のDB fixture・DB3ファイル・masterBrandの計5TSを検査した。0 errors/0 warnings、共有設定変更なし。

DB import前にserver/.env.test由来・NODE_ENV=test・設定DB名test_dbを検査し、src/db・models用sequelize・observerの全3接続で設定DB名とcurrent_database()=test_dbを確認してから書込みを許可した。
今回のseed前スキーマ検査は使用Model全列の存在まで。型/NULL/ENUM/FK等の実DB制約は既存の直接SQL/Modelケースで確認する範囲と区別し、全接続全制約の事前照合済みとは扱わない。
競合はREAD COMMITTEDと独立transactionのPIDを確認し、pg_stat_activityのLock/対象SQLとpg_blocking_pidsの相手PIDで実待機を観測した。時間経過だけで成立としない。
全Promise/transaction回収後、自作ID限定cleanup・残存0件・hook/spy解除・3接続close・env復元まで成功。

Q02/Q03/P04〜06は独立した別編集行を使い、従来のメディア/別名再利用・別名ロックの検証を維持した。
旧P01の2行保存や、旧Q01/Q05の同ID再送成功を通すための期待値緩和はしていない。元行消費の明示契約へ期待値を移行した。

初回HTTPはsandbox待受拒否のため停止。同じ対象を権限付き再実行して成功した。
/tmpのJSONは一時成果物でGit管理外。必要な集計・手順・結果は本文へ残す。

---

以下は今回の修正前に行った過去の実行記録。各節の「現行」「最新」等はその実行時点を指す。

## 2026-10-22 item_draft.item_id削除後の回帰

削除migrationと現行Modelに従い、DB保存結果のitem_id:null期待値、既存下書きfixture入力、取得カラム一覧、nullable参照ケース、共有fixtureの旧FK検査を削除。本番コードには該当依存がなく変更なし。AF-OWN02の未知キー入力・所有者保存検証は維持し、item_id非存在を確認する。

server/で以下を実行（--maxWorkers=1は共有fixture・hookのファイル間干渉を避けるため）。

- `npm run test:run -- test/integration/database/itemDraft/createItemDraft/database.test.ts test/integration/database/itemDraft/deleteItemDraft/database.test.ts src/services/itemDraft/test/ src/usecases/itemDraft/test/createItemDraft.test.ts --maxWorkers=1`: 6ファイル264件成功（DB148+15、非DB101）。
- `npm run test:run -- test/integration/database/itemEditing/createItemEditingDraft/ test/integration/usecases/itemEditing/createItemEditingDraft/ test/integration/usecases/itemDraft/deleteItemDraft/ --maxWorkers=1`: 8ファイル207件成功、sharedIdRoutesの6件失敗。旧nullableケース除去前の結果。controllerモックのconvertItemEditingVideoController不足は別Todo `docs/todo/done/shared-id-routes-controller-mock-export.md` に記録（当時未修正。2026-10-22にモック補完・対象6件成功、deleteItemDraftレポートの最新結果参照）。
- `npm run test:run -- test/integration/usecases/itemDraft/createItemDraft/databaseConcurrency.test.ts test/integration/database/itemEditing/createItemEditingDraft/database.test.ts --maxWorkers=1`: 最終変更後2ファイル65件成功。上記実行との重複を合算しない。
- `npm run lint`、`npm run typecheck`、`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` 成功。変更したtest配下TS6ファイルはESLint APIと既存typescript-eslint recommendedで追加検査し成功。

初回DB実行はsandboxのEPERMで163件本体未実行。通信許可後に同じガードで成功。.env.test由来test_dbを初期化前に検査し、アプリ・models・observer、共有基盤のcompetitorの全接続で実DB名を確認。現行Model列、共有基盤の型・NULL・ENUM・FKを検査後にseedし、自作IDだけのcleanup・残存0確認、hook解除・全接続closeを完了。migration/syncは実行していない。S3はモックで実通信未検証、カバレッジ未取得。今回実行していない機能全体の再検証完了を意味しない。

以下は過去の実行履歴。

## 2026-10-16 service配置変更の補足

service直下の単一TSを同名フォルダへ移動し、呼出し元・モックの参照を更新した。services共通testを対象コードのtestへ移動・分割した。以下の過去の実行表・コマンドは当時の配置と件数を示す。現配置は [設計書](../../architecture/itemDraft/createItemDraft.md) を参照する。

旧services/testの30件はcategories・itemConditionOption・shippingDayOption・shippingServiceOption・todouhuken各3件、brands6件、brandAliases9件に分割し、ケースID・期待値を維持した。

service単体テスト全体は移動前9ファイル・移動後15ファイルで、ともに72件すべて成功。Vitest JSONの全テスト名と成否が一致した。DB接続・実DBテスト・migrationは未実施。

初回報告と改善案・再実行記録を統合した。以下は各実行時点の履歴であり、移動前の最新結果は後半の「9. F1〜F6 対応後の再実行結果（2026-10-12）」を参照する。

## 2026-10-16 配置変更後の確認

5分類への移動、serviceテストの3分割、報告書と改善案・再実行記録の統合を実施した。テストのケース・期待値と本番コードは変更していない。現在の配置と実行コマンドは [設計書の配置表](../../architecture/itemDraft/createItemDraft.md) を参照する。

DB非接続の単体・結合テストは10ファイル・823件すべて成功。失敗・skip・todoは0件。初回は804件成功し、Router19件はサンドボックスのHTTP待受け制限で停止した。同じテストを通信許可後に再実行し19件成功を確認した。JSON結果は `/tmp/create-item-draft-layout-results.json` と `/tmp/create-item-draft-route-authorized.json` に出力した。

| ファイル（server/基準）                                                   | 成功件数 |
| ------------------------------------------------------------------------- | -------: |
| `src/usecases/itemDraft/test/createItemDraft.test.ts`                     |       79 |
| `src/controllers/itemDraft/test/createItemDraft.test.ts`                  |        5 |
| `src/validators/body/test/createItemDraft.test.ts`                        |      350 |
| `src/usecases/shared/test/createItemDraft.signedUrls.test.ts`             |       72 |
| `src/utils/s3/test/createItemDraft.videoPresignedPost.test.ts`            |        4 |
| `src/services/itemDraft/test/createItemDraft.test.ts`                     |        6 |
| `src/services/itemEditing/test/createItemDraft.test.ts`                   |        5 |
| `src/services/test/createItemDraft.test.ts`                               |       30 |
| `test/integration/usecases/itemDraft/createItemDraft/masterBrand.test.ts` |      253 |
| `test/integration/usecases/itemDraft/createItemDraft/route.test.ts`       |       19 |
| 合計                                                                      |      823 |

lint・本番コードのtypecheck・単体/結合テスト全体の型検査、参照パス以外の内容保持、相対import・mock参照先、文書リンクとgit diff --checkを確認した。実DBテスト177件・DB接続・migrationは今回は未実施。後述の1,000件成功は2026-10-12の履歴であり、今回の実行件数には含めない。

---

<a id="initial-report"></a>

# 商品下書き作成：テスト結果報告

## 1. 結果

**2026-10-12、10 ファイル・861 件を実行し、861 件すべて成功しました。失敗・skip・todo は 0 件です。** DB テストは 156 件、DB 非接続テストは 705 件です。Vitest の JSON レポートから集計しました。実行時間帯は 17:49:53〜17:50:11（日本時間）です。

[testArchitecture.md](../../architecture/itemDraft/createItemDraft.md) の 148 ケース ID すべてに、今回実行したテストが対応しています。ただし、ケース ID がテスト名にあるだけで完了扱いにせず、コードのアサーションも照合しました。Q02 は、helper のキー生成と DB の動画・サムネイル・商品画像の保存まで成功していますが、再実行した 2 行の**色画像 URL を DB から直接比較するアサーションが不足**しています。この部分は一部実施として残します。

**全件成功は、下書き作成 API を問題なく利用できるという意味ではありません。** 現行 Router では正しい認証・body でも `INVALID_PARAMS / 400` で止まります。また、usecase を直接呼ぶと所有者未設定の下書きが保存され、参照元の所有者変更・削除後も作成が継続します。これらを期待する観測テストも成功件数に含まれています。

今回の編集対象は本書と [afterFix.md](#follow-up) だけです。本番コード、テストコード、設定、設計書は変更していません。テスト失敗箇所の修正も行っていません。以前の実行結果を今回の件数へ加算していません。

## 2. ファイル別の結果と検証範囲

全ファイルで失敗・skip・todo は 0 件です。

| 記号     | テストファイル                                                                                                       | 成功件数 | 実処理とモックの境界                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------- | -------: | ------------------------------------------------------------------------------------------------------------ |
| U        | [usecase.test.ts](../../../../src/usecases/itemDraft/test/createItemDraft.test.ts)                                   |       68 | 実 usecase。helper・service・transaction はモック。保存引数・待機・後続未実行を確認                          |
| HM       | [masterBrand.test.ts](../../../integration/usecases/itemDraft/createItemDraft/masterBrand.test.ts)                   |      184 | 実 helper と実 usecase。DB service・S3・transaction をモック。数値・マスター・ブランド・メディアの接続を確認 |
| HS       | [signedUrls.test.ts](../../../../src/usecases/shared/test/createItemDraft.signedUrls.test.ts)                        |       71 | 実 URL helper。S3 署名・公開ドメイン・時刻・UUID を制御。署名内部の AWS 処理は未検証                         |
| V        | [validation.test.ts](../../../../src/validators/body/test/createItemDraft.test.ts)                                   |      325 | 実 schema・validateBody・validateParams。受理・拒否・parse 後の値を確認                                      |
| S        | [services.test.ts](../../architecture/itemDraft/createItemDraft.md)                                                  |       41 | 実 service。Model メソッド・SQL 呼出しをモック。DB の効果はこのファイルでは保証しない                        |
| C        | [controller.test.ts](../../../../src/controllers/itemDraft/test/createItemDraft.test.ts)                             |        5 | 実 controller、usecase モック。認証 ID・検証済み body・200 応答・next への伝播を確認                         |
| R        | [route.test.ts](../../../integration/usecases/itemDraft/createItemDraft/route.test.ts)                               |       11 | 実 Router・JWT 認証・レート制限・validator。usecase モック。最小 Express と Supertest で HTTP を検証         |
| D        | [database.test.ts](../../../integration/database/itemDraft/createItemDraft/database.test.ts)                         |      127 | 実 usecase・helper・service・モデル・PostgreSQL。S3 のみモック。永続化・制約・状態・逐次再実行を確認         |
| T        | [databaseTransactions.test.ts](../../../integration/usecases/itemDraft/createItemDraft/databaseTransactions.test.ts) |       17 | 同上。明示した service の障害注入・保留を追加。commit 可視性・rollback・再試行を確認                         |
| P        | [databaseConcurrency.test.ts](../../../integration/usecases/itemDraft/createItemDraft/databaseConcurrency.test.ts)   |       12 | 同上。実 SELECT・保存・別名作成をラップして順序を制御。別 transaction の競合を確認                           |
| **合計** | **10 ファイル**                                                                                                      |  **861** | **DB156 件＋ DB 非接続 705 件**                                                                              |

JSON の `numTotalTestSuites=144` は describe 等を含む集計値です。テストファイル数には `testResults` の 10 ファイルを使いました。ケース ID と `it.each` 展開後の件数も別の数字です。一つのテストが複数 ID に対応するため、ID 別に件数を足して 861 件を算出してはいません。

## 3. DB 接続・後片付け

- 読込元は **`server/.env.test`**。事前検査で NODE_ENV=test と接続 URL の DB 名=test_db を確認しました。接続 URL 全体や認証情報は本書へ記載しません。
- [databaseSetup.ts](../../../fixtures/itemDraft/createItemDraft/databaseSetup.ts) は DB モジュール初期化前に同じ設定を検査し、dotenv の既定呼出しも検証済み値へ限定します。別 env の明示指定・接続 URL 変更は停止条件です。
- [databaseFixtures.ts](../../../fixtures/itemDraft/createItemDraft/databaseFixtures.ts) でアプリ用・models/index 用・observer 用の 3 接続について設定 DB 名を検査し、接続後の `SELECT current_database()` が test_db であることを確認してから fixture を作成しました。全 DB ファイルの setup が通過し、安全条件による中断はありませんでした。
- `describeTable` により必要なテーブルとモデル上の列の存在を確認しました。すべての索引・制約の DDL 一致までを網羅した検査ではありません。実制約のうち確認したものは D04〜D09 に記載しています。
- 新規下書き ID は afterCreate hook で追跡しています。seller_id が null でも対象を見失わず、rollback した採番 ID も含めて、作成した ID だけを外部キー順に削除しました。各ケースの残存 0 件アサーションと接続終了が通過しました。シーケンスは戻していません。
- DB 作成、migration、sync、truncate、テーブル全件削除は行っていません。S3 への実アップロードも行っていません。
- 結果は observer の新規 SELECT または新しく取得したモデルで判定しました。rollback 前のモデルインスタンスを保存結果の証拠にしていません。

## 4. 設計書との対応

以下の記号は第 2 節のファイルに対応します。判定は「成功＝記載した検証が成功」「観測＝現行挙動を再現」「一部実施＝実行済み部分は成功したが設計の確認が残る」です。観測の成功は修正済みや望ましい仕様という意味ではありません。

### 正常系

| ID  | 判定 | 対応     | 確認した内容・限界                                                                                       |
| --- | ---- | -------- | -------------------------------------------------------------------------------------------------------- |
| N01 | 成功 | HM・U    | 処理順・各呼出し回数・body/モデル/URL 配列の参照・署名 4 項目の返却。                                    |
| N02 | 成功 | D・U     | 全作成項目と DB 全列を照合。seller_id/item_id 未設定は O02 として区別。                                  |
| N03 | 成功 | D・U     | detail/summary の null だけ空文字へ補完し、空文字・日本語を保存。                                        |
| N04 | 成功 | D・U     | 全体・色・サイズ在庫 0/1/8 を同時および独立に変更。initial/current と比率 0.2 を確認。                   |
| N05 | 成功 | D・U     | 複数色・サイズ・素材の順序、日本語・小数、uiId による色画像対応。                                        |
| N06 | 成功 | D・U     | 色・素材の空配列は保存引数で undefined、JSONB ではキー省略。sizes=[]は保持。                             |
| N07 | 成功 | D・HM・U | 取得カテゴリの分類を採用。nullable 分類 null・カテゴリ未選択はキー省略。layer=null は U の防御確認のみ。 |
| N08 | 成功 | D・U     | ID・名前・紐付 alias・未紐付 alias・新規 alias・未選択の関連 ID。                                        |
| N09 | 成功 | D・U     | 省略 color/画像のキー省略と、空 color/空サイズ名の保持。                                                 |
| N10 | 成功 | U        | HTTP 外の在庫 null/undefined は 1、size=null/undefined は undefined。schema 受理とは区別。               |
| N11 | 成功 | D・U     | 配送自由文の null・空文字・値ありを保持。                                                                |

### 異常系・後続未実行

| ID  | 判定 | 対応         | 確認した内容・限界                                                                              |
| --- | ---- | ------------ | ----------------------------------------------------------------------------------------------- |
| E01 | 成功 | D・U         | 不存在・他人所有・所有者 null で 404。署名/transaction 前に停止し下書きなし。                   |
| E02 | 成功 | HM・U        | 実 helper の動画 URL null/空文字で VIDEO_URL_NULL。マスター・保存へ進まない。                   |
| E03 | 成功 | HM・HS・U    | サムネイル URL null/空文字で THUMBNAIL_URL_NULL。保存なし。                                     |
| E04 | 成功 | D・HM・HS・U | 入力空、既存 URL 欠落、新規 type 不足で確定画像 0 件。ITEM_IMAGE_NULL、transaction 未開始。     |
| E05 | 成功 | U            | helper モックの null/undefined 配列を防御分岐として拒否。通常 helper の出力ではない。           |
| E06 | 成功 | HM           | 6 種 ID の abc/NaN で INVALID_NUMBER。署名済みでも照合・保存を開始しない。                      |
| E07 | 成功 | D・HM        | 5 種マスターの個別・複数不存在で対応 404。後続検索・保存を打切り。                              |
| E08 | 成功 | HM・U        | 取得・署名・数値・マスターの元例外と後続未実行。開始済み署名の取消しは保証しない。              |
| E09 | 成功 | T・HM・U     | ブランド 4 依存の個別障害。transaction 内で停止し本体/画像なし。実別名作成後の障害も rollback。 |
| E10 | 成功 | T・HM・U     | 本体作成失敗で画像保存なし。先に作成した別名も rollback。                                       |
| E11 | 成功 | D・T・U      | 本体 INSERT 後の画像失敗で本体・新規別名が残らない。                                            |
| E12 | 成功 | U            | transaction 開始/完了のモック例外を伝播。実 commit 通信障害は未再現。                           |
| E13 | 成功 | HM・U        | 取得・動画・サムネイル・画像・数値・マスターのエラー優先順位。                                  |
| E14 | 成功 | HM           | 動画 URL なしでも helper 内の商品画像署名の例外が先に伝播。数値/保存なし。                      |

### 入力検証・境界値

| ID  | 判定 | 対応      | 確認した内容・限界                                                                                |
| --- | ---- | --------- | ------------------------------------------------------------------------------------------------- |
| V01 | 成功 | V         | itemEditingId の負数/0/1/2/小数/文字列/null/欠落。正の整数 number だけ受理。                      |
| V02 | 成功 | V         | 価格 299/300/301/999999/1000000/1000001 の境界。                                                  |
| V03 | 成功 | V         | 価格 0・負数・小数・文字列・null・欠落・非 JSON の NaN/Infinity を拒否。                          |
| V04 | 成功 | V         | 全体・色・サイズ在庫の型・整数・0 下限。                                                          |
| V05 | 成功 | V         | 比率 0〜100 は小数も受理。範囲外/型不正を拒否、合計 100 は要求しない。                            |
| V06 | 成功 | V         | カテゴリ level は 1 以上の整数のみ受理。                                                          |
| V07 | 成功 | V         | 各必須項目の欠落・型違い・null を検証。nullable キーも欠落は拒否。                                |
| V08 | 成功 | V         | nullable 文字列の null を受理、通常の必須文字列 null を拒否。                                     |
| V09 | 成功 | V         | 動画/サムネイルと name/type 省略は受理。file=null、uploaded 欠落/型違いは拒否。                   |
| V10 | 成功 | V         | 商品画像 type=null/空は受理、type/name 欠落は拒否。空 name・任意 MIME を受理。                    |
| V11 | 成功 | V         | optional 色/画像/type の省略と null 拒否、sizes 必須・空サイズ名の保持。                          |
| V12 | 成功 | HM・HS・V | 画像 0/1/10/11 枚・空の色/サイズ/素材を受理。保存可否は E04/D05 で別判定。                        |
| V13 | 成功 | V         | 一意・2 件/3 件/非隣接重複。重複位置の uiId に custom issue。                                     |
| V14 | 成功 | V         | 空 uiId1 件は受理、2 件は拒否。大小文字/空白の違いを正規化しない。                                |
| V15 | 成功 | D・V      | schema は全定義値・null・空・不正文字列を受理。DB 保存の拒否を D04 で確認。                       |
| V16 | 成功 | D・V      | 0/1/2/254/255/256 文字を schema で受理。DB の 255 境界と別名閾値は別検証。                        |
| V17 | 成功 | V         | 任意 MIME・長文・大きな安全整数・多数の色サイズを受理。在庫合計一致の制約なし。負荷試験ではない。 |
| V18 | 成功 | C・V      | トップ/入れ子の未知キーを除去。controller は認証 ID と validatedBody を採用。                     |
| V19 | 成功 | V         | parse 済み body の格納と next1 回。失敗は INVALID_BODY、値設定/正常 next なし。                   |
| V20 | 成功 | V         | params 1/01 を数値 1 へ変換。0/負数/小数/abc/欠落は INVALID_PARAMS、next なし。                   |

### 数値変換

| ID  | 判定 | 対応  | 確認した内容・限界                                                                                    |
| --- | ---- | ----- | ----------------------------------------------------------------------------------------------------- |
| I01 | 成功 | D・HM | 6 種 ID の null/空文字を null へ変換。空文字は実 usecase 保存まで接続。condition.id=null は HTTP 外。 |
| I02 | 成功 | HM    | 1/01/空白付き 1/1e2 を 1/1/1/100 へ変換。                                                             |
| I03 | 成功 | D・HM | 0/空白は 0。マスター 5 種の検索を省略するが保存時 FK 違反。brand は検索後 fallback。                  |
| I04 | 成功 | D・HM | 負数・小数・Infinity・INTEGER 上限超過文字列が数値変換を通る。DB 結果は第 5 節。                      |
| I05 | 成功 | HM    | 6 種の非数値と複数不正。先行の数値変換で停止する順序を確認。                                          |

### マスター照合

| ID  | 判定 | 対応 | 確認した内容・限界                                                  |
| --- | ---- | ---- | ------------------------------------------------------------------- |
| M01 | 成功 | HM   | 有効 ID の引数名、null/0 の検索抑止、カテゴリ結果の参照。           |
| M02 | 成功 | HM   | 各位置以降が複数不存在でも最初の対応 404 で停止。                   |
| M03 | 成功 | HM   | 各検索を保留/失敗させ、後続検索・transaction が進まないことを確認。 |

### 署名 URL

| ID  | 判定 | 対応   | 確認した内容・限界                                                                      |
| --- | ---- | ------ | --------------------------------------------------------------------------------------- |
| S01 | 成功 | HM・HS | 新規動画の key/MIME/500MiB 上限と公開 URL、usecase 保存への接続。実容量検査ではない。   |
| S02 | 成功 | HS     | 動画新規条件不成立の再利用、converted→original→null。空文字は nullish fallback しない。 |
| S03 | 成功 | HM・HS | 変換済み動画があっても新規動画 URL を採用。converted_url を作成先へコピーしない。       |
| S04 | 成功 | HM・HS | 新規/既存/不完全なサムネイル指定、公開 URL・保存値・署名の対応。                        |
| S05 | 成功 | HM・HS | 新規/既存混在の元 index 対応、確定順序、先頭と全画像の保存引渡し。                      |
| S06 | 成功 | HS     | 既存 index 欠落・空 URL・null/非配列を採用しない。name を既存 URL とみなさない。        |
| S07 | 成功 | HS     | 新規商品画像の空 name でも type ありなら署名する。                                      |
| S08 | 成功 | HM・HS | type null/空は署名なし。部分欠落は圧縮、全欠落は 400、署名 index は元位置。             |
| S09 | 成功 | HM・HS | 新規色画像の uiId キー、返却辞書と保存 URL の対応。                                     |
| S10 | 成功 | HM・HS | 省略/既存色画像を uiId で再利用。色の並替えでも対応を保持。                             |
| S11 | 成功 | HM・HS | 不完全な新規色画像は署名せず、既存画像にも fallback しない。                            |
| S12 | 成功 | HS     | 削除/変更した uiId と非配列の既存色から旧画像を持ち込まない。S3 実削除は対象外。        |
| S13 | 成功 | HM・HS | 正順/逆順/混在、index1 のみ・1/3 等でも署名の元 index・件数・順序を保持。               |
| S14 | 成功 | HS     | 色署名の逆順完了でも対応を維持。最後の 1 件が保留中は未完了。                           |
| S15 | 成功 | HM・HS | 新規動画 POST 署名 undefined でも公開 URL 生成・作成へ進む。O05 参照。                  |
| S16 | 成功 | HM・HS | 各署名段階の例外を伝播し、次の署名群を開始しない。開始済み兄弟 Promise も回収。         |
| S17 | 成功 | HS     | 同一時刻でも別 UUID で全メディア key を分離。1 呼出し内の共有と並行結果の非混在。       |
| S18 | 成功 | HS     | 動画署名/最後の商品画像署名の保留中は次段階の署名へ進まない。                           |

### ブランド解決

| ID  | 判定 | 対応 | 確認した内容・限界                                                      |
| --- | ---- | ---- | ----------------------------------------------------------------------- |
| B01 | 成功 | HM   | 指定 ID 優先、存在しなければ名前 fallback。不要な検索/別名作成を抑止。  |
| B02 | 成功 | HM   | ID 未指定/不在＋名前 null/空で両関連なし。404 へ変換しない。            |
| B03 | 成功 | HM   | brand 付き alias を優先し、直接ブランド検索/作成を停止。                |
| B04 | 成功 | HM   | alias なし/未紐付 alias ありでも、直接ブランドがあれば brand のみ採用。 |
| B05 | 成功 | HM   | 直接ブランドなしの未紐付 alias を再利用、追加作成なし。                 |
| B06 | 成功 | HM   | 新規 alias 結果と brand 有無を保存引数へ採用。同じ t を作成へ渡す。     |
| B07 | 成功 | HM   | 元名長 0/1/2、空白 2 つ・絵文字の JS length による検索/作成分岐。       |
| B08 | 成功 | HM   | 全角・大小文字・カタカナ・空白の正規化。検索名と保存する元名を区別。    |
| B09 | 成功 | HM   | ブランドの各依存の待機/例外・後続未実行。                               |

### service の契約

| ID   | 判定 | 対応 | 確認した内容・限界                                                                           |
| ---- | ---- | ---- | -------------------------------------------------------------------------------------------- |
| SV01 | 成功 | S    | id と seller_id を同じ where で取得、transaction なし時の lock 未指定、null/例外。           |
| SV02 | 成功 | S    | 共通 service へ t を指定すると同じ t と FOR UPDATE 指定。この usecase 自身の再取得ではない。 |
| SV03 | 成功 | S    | data と t を Model.create へそのまま渡し、モデル参照を返す。                                 |
| SV04 | 成功 | S    | 画像 setDataValue→changed→save、同じ配列/t、空配列の引渡し。                                 |
| SV05 | 成功 | S    | create/save の元例外、save 完了前の service 未完了。                                         |
| SV06 | 成功 | S    | マスター/ブランド/別名の検索引数・include・返却参照/null/例外。                              |
| SV07 | 成功 | S    | bind 付き advisory lock→ 同じ t の再検索 → 未登録なら作成。                                  |
| SV08 | 成功 | S    | ロック完了を待ち、再検索で見つかった alias を返して create しない。                          |
| SV09 | 成功 | S    | ロック/再検索/作成の各失敗で後続を止める。                                                   |
| SV10 | 成功 | S    | t なしはロック/再検索せず create。任意の呼出しの重複防止は保証しない。                       |

### DB 整合性・制約

| ID  | 判定 | 対応 | 確認した内容・限界                                                                                      |
| --- | ---- | ---- | ------------------------------------------------------------------------------------------------------- |
| D01 | 成功 | D    | 全保存列・画像順と先頭一致、非対象行と公開 Item 不変。                                                  |
| D02 | 成功 | D    | sale/recommend=false、割引/動画変換情報は null。元値をコピーしない。所有者も null。                     |
| D03 | 成功 | D    | JSONB のキー省略・空配列・各在庫 0・素材小数・日本語・nullable FK を再取得。                            |
| D04 | 成功 | D    | 両 ENUM の全定義値を保存。null はモデル validation、不正/空は DB 22P02 で拒否。                         |
| D05 | 成功 | D    | 確定画像 1/9/10 を保存。11 はモデル validator で拒否し本体 rollback。入力 11/確定 10 は保存。           |
| D06 | 成功 | D    | name/title/freeText・新規別名の 255/256 境界。256 で 22001、新規別名も rollback。                       |
| D07 | 成功 | D    | nullable ID 保存、0/空白の FK 違反、実マスター削除後の事前 404。                                        |
| D08 | 成功 | D    | brand/未紐付 alias 削除時に該当 FK だけ SET NULL。他列維持。                                            |
| D09 | 成功 | D    | 直接 SQL で gender の NOT NULL/ENUM、category の FK を確認（23502/22P02/23503）。単文失敗後は元行不変。 |
| D10 | 成功 | D    | 参照元 item_id あり/null の作成、他ユーザー・既存下書き・公開商品全列の不変。                           |

### 状態遷移

| ID   | 判定 | 対応 | 確認した内容・限界                                                      |
| ---- | ---- | ---- | ----------------------------------------------------------------------- |
| ST01 | 成功 | D    | 下書き 1 行新規作成、元編集行を維持、公開 Item の増加なし。             |
| ST02 | 成功 | D    | 同一参照元の再作成でも既存下書きを変更せず別行追加。                    |
| ST03 | 成功 | D・U | 元 initial=10/current=4 でも新下書き在庫は body 由来。元行不変。        |
| ST04 | 成功 | D    | 既存利用は converted を original へ、新規動画は新 URL。元行不変。       |
| ST05 | 成功 | D    | body の色/素材が空なら新下書きに旧属性なし。元属性は残る。              |
| ST06 | 成功 | D・U | 元 video_status null/pending/completed で作成可能。元状態を変更しない。 |
| ST07 | 成功 | T    | 画像保存失敗で新下書きと新規別名は残らず、元行不変。                    |

### トランザクション

| ID  | 判定 | 対応  | 確認した内容・限界                                                                 |
| --- | ---- | ----- | ---------------------------------------------------------------------------------- |
| T01 | 成功 | S・U  | 同じ t がブランド作成・本体・画像の各境界へ伝わる。DB の原子性は T04 以降で確認。  |
| T02 | 成功 | HM・U | 取得・署名・数値・マスター・ブランド・本体・画像・transaction 完了をそれぞれ待つ。 |
| T03 | 成功 | T     | 本体 INSERT 後は同じ t で見え、observer では見えない。commit 後は全画像が見える。  |
| T04 | 成功 | T     | 実別名 INSERT 後/実本体 INSERT 後の障害で両行 rollback。既存別名は残す。           |
| T05 | 成功 | T     | 実画像 save 完了後の意図的 throw でも本体・新規別名を rollback。                   |
| T06 | 成功 | T     | 画像保存前/後で保留。commit 前は新規 2 行とも見えず、後は関連付きで見える。        |
| T07 | 成功 | T     | 失敗後の同一入力再試行で成功回の下書き/別名各 1 行。                               |
| T08 | 成功 | HM・U | URL/数値/マスター不正なら transaction 未開始。署名発行は保存成功とは別。           |
| T09 | 成功 | T     | 5 種マスターを検証後に別接続で削除。FK 違反で下書き・新規別名 rollback。           |

### 重複実行

| ID  | 判定     | 対応  | 確認した内容・限界                                                                                                  |
| --- | -------- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| Q01 | 成功     | D・HM | 既存メディアの同一入力 2 回で別 ID の下書き 2 行、先行行不変。                                                      |
| Q02 | 一部実施 | D・HS | helper では全メディア key 分離を確認。DB では動画/サムネイル/商品画像の 2 行を確認。色画像 URL の DB 比較は未確認。 |
| Q03 | 成功     | D・HM | 逐次 2 回で下書き 2 行が alias1 行を共有。                                                                          |
| Q04 | 成功     | T     | 初回画像失敗後の再試行で成功回のみ保存。自動再試行はしない。                                                        |
| Q05 | 成功     | D     | 応答喪失後の再送を想定した usecase 直接 2 回実行で別行追加。HTTP 通信断自体は再現していない。                       |

### 並行処理

| ID  | 判定 | 対応 | 確認した内容・限界                                                                                               |
| --- | ---- | ---- | ---------------------------------------------------------------------------------------------------------------- |
| P01 | 成功 | P    | 両取得後 A→B/B→A の commit 順を固定。名称/価格/在庫/画像が対応する別行 2 件、元行不変。                          |
| P02 | 成功 | P    | 別ユーザー・別商品を 2 つの t で交差。名称/価格/全体在庫/新規メディアが非混在。色/サイズ/素材は同じ fixture 値。 |
| P03 | 成功 | P    | A 本体 INSERT 保留中に B commit→A 画像失敗。B の保存行を維持。                                                   |
| P04 | 成功 | P    | 両初期 alias 検索なし →A が作成保留 →B の実ロック待ち →A commit→B 再検索。alias1 行を共有。                      |
| P05 | 成功 | P    | 同じ順序で A rollback→B 作成。最終下書き/alias 各 1 行。                                                         |
| P06 | 成功 | P    | hashtext が異なる 2 名を使用。A ロック保持中に B commit。alias 別行。B だけ lock_timeout を設定。                |
| P07 | 成功 | P    | 取得後に別接続でメディア/属性変更。下書きは旧取得値を再利用し、変更後の元行は維持。                              |
| P08 | 成功 | P    | 取得後の所有者変更/削除を再確認せず作成成功。元行の変更/削除を維持。                                             |
| P09 | 成功 | P    | 解決後に brand/alias 削除。書込み FK 違反、画像保存なし・下書きなし。                                            |
| P10 | 成功 | HS   | 同時署名を B→A で解放、画像/色は逆順。index/uiId/request と各返却値が非混在。                                    |

### controller

| ID  | 判定 | 対応 | 確認した内容・限界                                                                       |
| --- | ---- | ---- | ---------------------------------------------------------------------------------------- |
| C01 | 成功 | C    | 認証ユーザー ID と同じ validatedBody を渡す。未検証 body/params から入力を作り直さない。 |
| C02 | 成功 | C    | 200 と署名 4 項目だけ。値あり・null・空配列・空辞書を保持。                              |
| C03 | 成功 | C    | AppError/通常 Error を同一参照で next へ、成功応答なし。                                 |
| C04 | 成功 | C    | usecase 保留中は応答しない。解放後に 200。                                               |

### Router

| ID  | 判定 | 対応 | 確認した内容・限界                                                                            |
| --- | ---- | ---- | --------------------------------------------------------------------------------------------- |
| R01 | 成功 | R    | なし/Bearer 不正/署名不正/期限切れは 401。認証失敗はレート枠を消費しない。                    |
| R02 | 成功 | R    | 認証/body 正常でも params 空により INVALID_PARAMS・400、usecase 未実行。O01 の観測を含む。    |
| R03 | 成功 | R    | 不正 body や body/query の id でも params 不足が優先。                                        |
| R04 | 成功 | R    | 5 回 params400→6 回目 429、別ユーザー/10 分経過後は再び params400。作成成功は確認していない。 |
| R05 | 成功 | R    | 不正入力も枠を消費し、6 回目は validator 前の 429。                                           |
| R06 | 成功 | R    | 無認証/制限超過は不正入力より 401/429 を優先。                                                |
| R07 | 成功 | R    | id を付けた未定義パスは 404。                                                                 |

### 観測

| ID  | 判定 | 対応    | 確認した内容・限界                                                                              |
| --- | ---- | ------- | ----------------------------------------------------------------------------------------------- |
| O01 | 観測 | R       | 正しい HTTP 要求でも params400 で作成へ進めない現行挙動。                                       |
| O02 | 観測 | D・P・U | create data に seller_id/item_id なし、DB でも両列 null。                                       |
| O03 | 観測 | P       | 所有者変更・参照元削除後も再取得せず下書き作成が成立。                                          |
| O04 | 観測 | P       | 参照元を並行更新しても旧メディア snapshot を使う。                                              |
| O05 | 観測 | HM      | 新規動画の署名 null でも公開 URL を保存処理へ渡す。実アップロード可能性は未確認。               |
| O06 | 観測 | D       | ID の 0/空白/負数/小数/Infinity/INTEGER 上限超過で、FK・404・DB エラー・brand fallback を観測。 |

## 5. 確認した挙動とロジック上の注意点

### HTTP の入口と保存結果

1. **O01：正常な HTTP 要求でも作成できません。** `POST /api/item-draft` は `/:id` を定義していませんが、id 必須の params 検証を行います。正しい JWT・body の要求でも 400 になり、body 検証・usecase へ進みません。body/query に id を足しても変わりません。5 回分の要求はレート制限へ加算され、6 回目は 429 になります。C での 200 は controller 単体の成功であり、この HTTP 経路の成功を意味しません。
2. **O02：作成先の seller_id・item_id は null です。** 参照元の所有権は検査しますが、作成データへ両 ID を渡しません。実 DB の再取得でも null でした。認証ユーザーに紐付く下書きとして扱うには保存契約の見直しが必要です。item_id を継承すべきかは、新規商品と既存公開商品の編集を区別して決める事項です。
3. **O03：取得後の所有者変更・参照元削除を再確認しません。** 初回取得を保留し、別接続で変更/削除を commit してから解放すると、下書き作成は成功しました。編集行を再取得せず、作成先にも参照元の FK がないため、元行の削除だけでは作成を止めません。
4. **O04：並行更新後も取得済みメディアを使います。** 別接続が original/thumbnail/商品画像/色画像を変更した後でも、下書きには旧 URL が入りました。元行の新しい値は維持されます。これは snapshot 利用の観測であり、最新値を使うべきかは別途契約を決めます。
5. **O05：新規動画の署名が null でも保存処理へ進みます。** POST 署名境界を undefined にすると、helper は署名 null と生成した公開 URL を返し、usecase がその URL で作成へ進みました。AWS 署名処理そのものを実行した結果ではありません。実署名関数には公開 bucket 未設定時に undefined を返す分岐があり、設定不備時の打切り方が未定義です。

### 入力検証と保存制約の差

| 入力                                           | schema/変換                | 実保存・検索で確認した結果                                                                       |
| ---------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| gender/age=null                                | schema 受理                | モデルの ValidationError。本体/画像・新規別名は残らない                                          |
| gender/age の空・不正文字列                    | schema 受理                | DB ENUM エラー 22P02。画像保存なし                                                               |
| name/title/freeText/未登録ブランド名 256 文字  | schema 受理                | DB 文字数エラー 22001。新規別名も rollback                                                       |
| マスター 5 種の ID=0/空白                      | 0 へ変換、事前照合を省略   | 参照先 0 なしを確認した環境で FK エラー。null の代わりに 0 を保存しようとする                    |
| マスター 5 種の負数/小数/2147483648            | 数値変換を通過             | 取得で見つからず、対応する 404。型不正として INVALID_NUMBER にはならない                         |
| brand ID=0/空白/負数/小数/2147483648、名前なし | 数値変換を通過             | ID で見つからず、brand/alias とも null で保存へ進む                                              |
| 6 種 ID の Infinity                            | NaN ではないため変換を通過 | DatabaseError。具体的な HTTP 応答までは確認していない                                            |
| 商品画像 11 枚                                 | schema に枚数上限なし      | **確定 URL**が 11 件ならモデル validator で拒否。本体 INSERT も rollback。入力 11/確定 10 は成功 |

DB が不正な保存を拒否し原子性を維持したことは確認できています。一方、schema で受理した入力が通常の DB 例外として上位へ出るため、入力エラーの扱いがレイヤー間で揃っていません。明示的な AppError による 400 になる契約は、これらのケースにはありません。本番の共通エラーハンドラーを含む HTTP 応答は未検証です。

### transaction・重複実行・並行処理

- 本体 INSERT 後の画像失敗、画像 save 後の意図的例外、本体の実文字数違反のいずれでも、新規下書き・transaction 内の新規別名は残りませんでした。前から存在する別名は維持されました。
- commit 前は observer から新規行が見えず、commit 後に本体・画像・別名の関連が見えました。元モデルの変更済み値を rollback 判定へ使っていません。
- 同じ body を再実行すると下書きは 2 行になります。作成 API に冪等性はありません。未登録ブランド名の逐次再実行では別名 1 行を共有します。
- 同じ参照元の両取得を待ち合わせ、A→B と B→A の commit 順を固定しても、名称・価格・全体在庫・画像が対応する別行 2 件になりました。
- 別ユーザーの 2transaction を画像保存前で交差させても、確認した入力と URL は混ざりませんでした。色・サイズ・素材まで異なる値での比較は未追加です。
- ブランド別名は、両初期検索が未登録 →A が alias 作成を保留 →B の advisory lock 待ちを pg_stat_activity で確認 →A commit→B 再検索の順序で 1 行を共有しました。A rollback の場合は B が作成し、最終的に別名・下書き各 1 行になりました。両 transaction の分離レベルは read committed でした。
- 異なる正規化名では hashtext 値が異なることを確認し、A のロック保持中に B が commit しました。ハッシュ衝突を含むすべての名称の並行性を保証する試験ではありません。
- 共通 service を通さない任意の SQL INSERT の重複防止、DB 全体の一意制約、全スケジュールでの競合安全性を保証したものではありません。

## 6. 再現コマンドと静的確認

実行ディレクトリは `/home/conta/project/server`。以前確認されたサンドボックスの HTTP 待受・DB 接続制限を避け、今回の Vitest は承認された実行環境で実行しました。今回、通信拒否による失敗や設定差替えはありません。

```bash
npm run test:run -- test/usecases/itemDraft/createItemDraft/ --maxWorkers=1 --reporter=json --outputFile=/tmp/createItemDraft-report-run.json > /tmp/createItemDraft-report-run.log 2>&1
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

ファイル間の DB fixture/hook・レート制限状態の干渉を抑えるため `--maxWorkers=1` を指定しました。ケース内部の並行処理は P 系で別に制御しています。

| 確認                          | 結果                                                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest                        | 861/861 成功、10 ファイル、skip/todo なし、終了コード 0                                                                                       |
| npm run lint                  | 成功、終了コード 0。ただし既存設定の TypeScript 対象は src 配下                                                                               |
| npm run typecheck             | 成功、終了コード 0                                                                                                                            |
| テスト tsconfig の型検査      | 終了コード 2。対象外の shopSignup/signup1.test.ts と signup5.test.ts の参照先不在（TS2307）2 件。createItemDraft 内のエラーは報告されていない |
| 対象テスト TS への追加 ESLint | 13 ファイル、エラー 0・警告 0。ESLint API で typescript-eslint recommended を指定して検査。既存設定は未変更                                   |
| 変更範囲                      | 実行前後のコードハッシュを照合。既存コード・テスト・設計書の編集なし。報告用 Markdown2 ファイルのみ                                           |

対象テストへの追加 ESLint は、既存 ESLint と typescript-eslint を使って次の方法で実行しました。

```bash
node --input-type=module - <<'JS'
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: tseslint.config({
    files: ['test/usecases/itemDraft/createItemDraft/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  }),
});
const results = await eslint.lintFiles(['test/usecases/itemDraft/createItemDraft/**/*.ts']);
console.log((await eslint.loadFormatter('stylish')).format(results));
console.log(JSON.stringify({
  files: results.length,
  errors: results.reduce((n, r) => n + r.errorCount, 0),
  warnings: results.reduce((n, r) => n + r.warningCount, 0),
}));
process.exitCode = results.some(r => r.errorCount) ? 1 : 0;
JS
```

JSON とログは `/tmp` の一時成果物です。上記コマンドで再生成でき、今回の成功/失敗/skip/todo 件数はそのランナー出力に基づきます。

## 7. 完了範囲と残る確認

今回の完了範囲は、既存 10 テストファイルの実行、148 設計 ID との照合、結果報告と改善案の記載です。設計 ID の判定は成功 141 項目・観測 6 項目・一部実施 1 項目です。これは 861 件という実行件数とは別の集計です。

残る確認は Q02 の色画像 URL の DB 比較、並行時の色/サイズ/素材の値の区別、実アプリ登録・共通エラー処理を含む HTTP ＋ DB の結合、実 S3 署名・アップロード、実 commit 通信障害です。前 2 つは [afterFix.md](#follow-up) にテスト改善案を記載しました。後者の外部通信・障害再現は今回の設計範囲に含めていません。カバレッジは取得していません。

観測されたルート不整合、所有者未設定、取得後の競合、入力制約の差は修正していません。具体的な修正案と仕様確認が必要な点は afterFix.md を参照してください。

---

<a id="follow-up"></a>

# 商品下書き作成：改善案と追加テストの方針

## 1. この文書の扱い

[testReport.md](#initial-report) の今回の実行結果を根拠に、本番コードとテストコードの改善案をまとめます。**Vitest の失敗は 0 件です。以下は観測した問題・制約の不一致・検証の不足に対する提案であり、修正済みの報告ではありません。** 本番コード、テストコード、設定、DB スキーマは編集していません。

パスは `server/` 基準です。変更する場合は業務契約を決めてから、設計書と既存の観測テストを更新します。現在のテストが通っていることを、現行挙動を永久に維持する理由にはしません。一方、未確定の仕様を推測して新しい制約・冪等性・状態遷移を追加することもしません。

| ID  | 優先度       | 根拠                                                         | 対応案                                                                   |
| --- | ------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| F1  | P0           | O01・R02/R03：正しい HTTP 要求が params400 で止まる          | パスと params 検証を合わせ、body の itemEditingId を入口にする           |
| F2  | P1           | O02：DB でも seller_id/item_id=null                          | 認証ユーザーを作成先へ保存。item_id 継承は仕様確認後に決定               |
| F3  | P1・契約確認 | O03・P08：取得後の所有者変更/削除後も作成成功                | 作成直前の存在・所有権を条件にするなら、transaction 内で所有者付き再取得 |
| F4  | P1           | V15/V16・I03/I04・D04/D06/D07：schema 受理後のモデル/DB 拒否 | ENUM・文字数・ID の入力契約を保存制約と揃える                            |
| F5  | P1           | O05・S15：新規動画署名なしでも公開 URL で作成へ進む          | 新規署名が取得できないときは保存前に停止                                 |
| F6  | P2           | Q02 の DB 確認不足、P02 の値区別、ケース名と待機処理         | テストのアサーションと診断・後片付けを補強                               |

F1/F2 はコードと実行結果の両方で確認できた不整合です。F3 の再認可の時点、F4 の下書き未選択値、O04 の snapshot 利用は業務契約の選択を伴います。F5 は helper 境界の挙動を確認したもので、実 S3 の設定不備を今回発生させたわけではありません。

## 2. F1：下書き作成 API の入口を修正する

### 確認した問題

`src/routes/itemDraft.ts` は `POST /` に id 必須の `validateParams(idParamSchema)` を接続しています。パスに `:id` がないので req.params は空です。実 Router テストでは、正常 JWT・正常 body でも `INVALID_PARAMS / 400` になり、usecase を呼びませんでした。

### 本番コードの案

- 現在の API パス `POST /api/item-draft` を維持する場合、不要な params 検証を外します。
- `itemEditingId` は既存 body schema が正の整数として検証するため、body の値を controller/usecase へ渡します。
- 接続順は認証 → レート制限 →body 検証 →controller にします。認証・制限・所有権照合は維持します。
- params 用 import は不要になった分だけ整理します。controller や route へ業務ロジック・DB 操作を追加しません。

対象は `src/routes/itemDraft.ts`。別 URL へ変更する案は、フロントエンドと API 契約の変更を伴うため、今回の提案には含めません。

### 修正後に確認するテスト

| 追加 ID | 元 ID        | レベル | 条件                                                      | 提案する期待結果                                              |
| ------- | ------------ | ------ | --------------------------------------------------------- | ------------------------------------------------------------- |
| AF-R01  | R02・O01     | R      | 正常 JWT と正常 body                                      | usecase を 1 回呼び、署名 4 項目を 200 で返す                 |
| AF-R02  | R03・V01/V19 | R      | itemEditingId 欠落/0/文字列、価格不正、重複 uiId          | INVALID_BODY・400、controller/usecase 未実行                  |
| AF-R03  | R01/R06      | R      | 未認証または期限切れ＋不正 body                           | 401 を優先。レート枠を消費しない                              |
| AF-R04  | R04/R05      | R      | 同一ユーザー 5 回 →6 回、別ユーザー、時間窓更新、不正入力 | 正常 5 回は 200、6 回目 429。別枠・再開・不正入力の加算を確認 |
| AF-R05  | C01・V18     | C/R    | 別 userId/seller_id を body へ混入                        | 認証 ID と parse 済み body だけを渡す                         |

R02/R03/O01 の旧 400 期待は、新しい契約へ移行します。旧結果は testReport の履歴として残します。単体 C で 200 になるだけで入口の修正完了とはせず、実 Router で確認します。

## 3. F2：作成した下書きを所有者へ紐付ける

### 確認した問題

`createItemDraftUseCase` は参照元を userId で検索しますが、`CreateItemDraft` へ渡す data に seller_id がありません。モデル・DB が nullable なので、実保存でも seller_id=null になります。認証したユーザーの下書きとして、後から所有者条件で取得できる保存結果にはなっていません。

item_id も null ですが、こちらは「元の公開商品を編集する下書き」か「新規商品のための下書き」かで必要な関連が変わります。seller_id と同じ理由で機械的にコピーしません。

### 本番コードの案

- `src/usecases/itemDraft/createItemDraft.ts` の作成 data へ `seller_id: userId` を渡します。body の所有者 ID を採用しません。
- `src/types/serviceType/itemDraft.ts` の作成 DTO に seller_id を追加し、型からも引渡し漏れを検出します。
- service の Model.create への引渡しと、同一 transaction での本体・画像保存を維持します。
- item_id は仕様確認後に、参照元の値を継承するか、常に null とするかを明文化します。body に任意 item_id を追加して信用する案にはしません。
- 今回の事実だけを根拠にモデルの nullable 変更・migration・既存行の一括補正はしません。過去の所有者未設定行は、作成時の所有者を安全に特定できる証跡があるかを別途確認します。

### 修正後に確認するテスト

| 追加 ID  | 元 ID            | レベル | 条件                                 | 提案する期待結果                                          |
| -------- | ---------------- | ------ | ------------------------------------ | --------------------------------------------------------- |
| AF-OWN01 | N02・O02         | U/S/D  | 所有者 A から作成                    | DTO・Model.create に seller_id=A。別接続 SELECT でも A    |
| AF-OWN02 | V18・C01・P02    | C/R/D  | body に所有者 B を混入、A/B 並行作成 | 各下書きは認証された自分の seller_id。body による変更なし |
| AF-OWN03 | E10/E11・T04/T05 | D      | 本体/画像保存の障害                  | 所有者設定済み本体も新規別名と一緒に rollback             |
| AF-OWN04 | D10・O02         | D      | 参照元 item_id あり/null             | 仕様確定した継承方針どおり保存し、元商品と他行は不変      |

N02/D01/D02、P01/P02 の seller_id=null 期待、O02 は修正後の所有者契約へ移行します。item_id については、仕様を決めていない段階で期待値を変更しません。

## 4. F3：作成直前の存在・所有権を確認する

### 観測と判断が必要な点

P08/O03 では、A が編集中商品を取得した後に、別接続が所有者を B へ変更または元行を削除し、その後 A を解放しても作成が成功しました。元行を更新した不具合ではありませんが、作成直前には対象が存在するか・A が所有するかを確認していません。

「作成時点でも編集中商品が存在し、操作ユーザーが所有していること」を成立条件にするなら、次の案で再確認します。初回に認可された snapshot の複製を許す仕様なら、この挙動を仕様として明記し、再取得を追加する理由を分けます。

### 本番コードの案

- 初回の取得・URL/数値/マスター確認は、現在のエラー優先順位を踏まえて維持します。
- managed transaction 内で、ブランド解決・別名作成・下書き INSERT より前に `getMyItemEditing({ itemEditingId, userId, transaction: t })` を呼びます。
- 共通 service は t がある場合に所有者条件付き `FOR UPDATE` を指定するため、この既存機能を使います。null なら既存の `ITEM_EDITING_NOT_FOUND / 404` で停止します。
- ロックは本体・画像保存と commit/rollback まで保持します。再取得のために別 transaction を開きません。
- 初回取得後に発行した署名の取消しまで新しく保証しません。DB 失敗時には、下書きと transaction 内の新規別名が残らないことを引き続き確認します。

対象は `src/usecases/itemDraft/createItemDraft.ts`。service のロック機能自体は実装済みです。

**O04 のメディア鮮度は別の判断です。** 再認可だけを追加しても、先に buildSignedUrls が選んだ既存 URL は旧 snapshot のままです。最新 URL を採用するなら、参照元の画像 index/uiId と body の対応をどう扱うか、署名生成の時点をどこに置くかも決めます。再取得を追加しただけで最新メディア保証を得たと報告しません。

### 修正後に確認するテスト

| 追加 ID   | 元 ID          | レベル | 再現する順序                              | 提案する期待結果                                                     |
| --------- | -------------- | ------ | ----------------------------------------- | -------------------------------------------------------------------- |
| AF-AUTH01 | N01・T02・SV02 | U/S    | 初回取得 →transaction 再取得を保留 → 解放 | 再取得が完了するまでブランド/本体/画像なし。同じ t と所有者条件/lock |
| AF-AUTH02 | P08・O03       | D      | 初回取得 → 所有者 B へ変更 commit→A 解放  | 再取得は null、404。下書き/新規別名なし。B 所有の元行全列を維持      |
| AF-AUTH03 | P08・O03       | D      | 初回取得 → 元行削除 commit→A 解放         | 404。下書き/新規別名なし                                             |
| AF-AUTH04 | P01/P02・T04   | D      | 正常な並行作成と片方の障害                | 成立した作成だけを保存し、ロック解放・rollback・関連行を確認         |
| AF-AUTH05 | P07・O04       | H/D    | 所有者は同じ、メディアだけ並行変更        | snapshot 利用/最新利用のうち、確定した契約を検証                     |

再認可を成立条件にする修正を実装した時点で、P08/O03 の「作成成功」を新しい 404 契約へ移行します。N01 の取得回数・順序も更新します。P07/O04 は、メディア鮮度の契約を変えない限り維持します。

## 5. F4：入力契約を保存制約と揃える

### 確認した差

- gender/age は任意文字列・null を schema が受理しますが、保存先は NOT NULL の ENUM です。
- name/title/freeText と新規別名は 256 文字を schema が受理し、DB で拒否されます。
- ID 変換は NaN だけを拒否します。0/空白は照合省略後に FK 違反となり、Infinity は DB 検索のエラーになります。
- 画像 11 件は schema で受理されますが、確定 URL が 11 件なら画像 save のモデル validator が拒否します。

rollback は成功しましたが、利用者の入力を明示的な 400 へ揃える契約ではありません。入力制約を変える場合は、本番コードと観測テストの両方を同じ契約へ更新します。

### 本番コードの案

| 対象                | 提案                                                                          | 決める事項・注意                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| gender/age          | schema を定義済み ENUM へ限定                                                 | 下書きで未選択を許すなら nullable を維持し、usecase で null を unisex/both へ明示補完する案。未選択不可なら schema で null を拒否する案。どちらを採るか先に決める |
| name/title/freeText | 保存する文字列を 255 文字以内に検証                                           | 空文字の禁止は今回の根拠から追加しない。detail/summary は TEXT なので同じ上限を転用しない                                                                         |
| brand.name          | 新規別名として保存する自由入力名の長さを検証                                  | 有効 ID の表示名や既存の解決結果など、保存に使わない値まで一律に拒否しない。新規作成経路の resolveBrand で確認する案                                              |
| 6 種 ID             | nullable 値を除き、有限の正整数かつ PostgreSQL INTEGER 範囲内であることを確認 | 空文字は既存どおり null。空白のみを null 扱い/拒否のどちらにするか決める。01 や 1e2 を受理する現行互換性も明記する                                                |
| 商品画像枚数        | 確定 URL が 10 枚を超えたら、本体作成前に明示的な AppError で拒否する案       | 入力 11 枚・確定 10 枚の現行成功を維持するなら、body 配列の上限 10 だけで代替しない。既存のモデル validator も残す                                                |

主な対象は `src/validators/body/itemDraft.ts`、`src/usecases/itemDraft/createItemDraft.ts`、`src/usecases/shared/{validateNumber,resolveBrand}.ts` です。共通 helper を変える場合は itemEditing などの利用元も確認し、createItemDraft だけの修正だと扱わないようにします。モデルを緩めて DB 拒否をなくす案は含めません。

新しい AppError のコード・400 の契約は、実装前に既存エラー規約へ合わせて決めます。元の DB エラーを何でも 400 に変換するのではなく、確認できる入力条件を保存前に検証します。

### 追加・移行するテスト

| 追加 ID  | 元 ID         | レベル  | 条件                                       | 提案する期待結果                                                               |
| -------- | ------------- | ------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| AF-V01   | V15・D04      | V/U/D   | 全 ENUM 値、null、空、不正文字列           | 全定義値を保存。null は選んだ契約へ補完/拒否。不正値は schema で 400、保存なし |
| AF-V02   | V16・D06      | V/H/U/D | 保存文字列 254/255/256 文字、日本語        | 255 まで受理。256 は保存前に明示的な入力エラー、関連行なし                     |
| AF-I01   | I03/I04・O06  | H/U     | 0/空白/負数/小数/Infinity/INTEGER 上限超過 | 決定した ID 契約で拒否/未選択へ変換。拒否時はマスター/ブランド/保存へ進まない  |
| AF-I02   | I01/I02       | H/U/D   | null/空、1/01/空白付き 1/1e2、有効 ID      | 決定した互換性を維持し、引渡し・保存値を確認                                   |
| AF-IMG01 | V12・D05・E11 | H/U/D   | 入力 0/1/10/11、確定 0/10/11               | 確定 0/11 は本体 INSERT 前に拒否、入力 11/確定 10 は契約どおり受理             |

V15/V16/I03/I04/O06 の旧挙動を期待する部分は移行対象です。D04/D06/D09 の**モデル・DB 制約そのものの検証**は維持し、入力 schema が厳しくなったという理由で削除しません。画像 11 件のモデル検証は service/モデル側のテストへ残し、usecase 経由の拒否位置だけを変更します。

## 6. F5：新規動画署名がない場合に保存を止める

### 確認した挙動

S15/O05 は、動画 POST 署名関数が undefined を返しても、helper が公開 URL を組み立て、usecase がその URL で作成へ進むことを確認しています。実署名関数には公開 bucket 未設定時の undefined return があります。今回は S3 通信をモックしているため、実設定不備やアップロード失敗を発生させた結果ではありません。

### 本番コードの案

- 新規動画の署名を要求した分岐で、POST 署名が取得できなければ、公開 URL の確定・DB 保存へ進ませないようにします。
- `src/usecases/shared/buildSignedUrls.ts` または署名 utility の境界で、既存 AppError を用いて明確に停止する案とします。内部設定/署名処理の問題なので、利用者の未入力と同じ VIDEO_URL_NULL へ一律に置換しません。
- 既存動画を再利用する場合の videoSignedUrl=null は正常です。署名 null を無条件に拒否しません。
- 共通 helper/utility の変更時は、他のアップロード usecase も確認します。今回確認した事実だけから、S3 全体の設定や IAM を変更する案にはしません。

| 追加 ID   | 元 ID    | レベル       | 条件                             | 提案する期待結果                                             |
| --------- | -------- | ------------ | -------------------------------- | ------------------------------------------------------------ |
| AF-SIGN01 | S15・O05 | H/U          | 新規動画＋ POST 署名 undefined   | 明示した署名エラーで停止。後続署名/数値/transaction/保存なし |
| AF-SIGN02 | S02      | H/U/D        | 既存動画再利用＋署名 null        | 従来どおり保存可                                             |
| AF-SIGN03 | S01・S16 | H/U          | 正常 POST 署名/元関数 reject     | 正常時の引数と返却を維持、reject は契約どおり伝播            |
| AF-SIGN04 | O05      | utility 単体 | 公開 bucket 未設定、AWS はモック | 新しく定めたエラーを返す。実通信は不要                       |

S15/O05 の「作成へ進む」を、修正実装時に打切り契約へ移行します。旧観測は履歴として残します。

## 7. F6：成功したテストの検証範囲と診断を補強する

本節は本番の不具合を確定したものではありません。今回すべて成功したテストを設計書と照合したうえで、確認が残る部分や、失敗時の読み取りやすさを改善する案です。

| 追加 ID    | 元 ID                    | 対象ファイル                            | 改善案                                                                                                                                                                                   |
| ---------- | ------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AF-DB01    | Q02                      | database.test.ts                        | 同一時刻・異なる UUID で作った両行の attributes.colorVariants を再取得。uiId で色画像 URL を特定し、それぞれの返却署名から対応する公開 URL と一致すること、両行の URL が異なることを確認 |
| AF-P01     | P02                      | databaseConcurrency.test.ts             | A/B の色・サイズ在庫・素材・色画像まで異なる fixture を使い、各行の JSONB 全体と返却値の対応を確認。名称/価格/全体在庫だけの非混在から検証範囲を広げる                                   |
| AF-SAFE01  | S13/S14/S17・B06         | signedUrls.test.ts、masterBrand.test.ts | 一部の既存 deferred ケースにも try/finally を付け、途中 assert 失敗時に全 gate を解放・Promise を回収。今回の実行で未回収が発生したとは扱わない                                          |
| AF-NAME01  | E08/E09/E10/E11/T08・S17 | usecase.test.ts、signedUrls.test.ts 等  | 条件ごとの ID を表データに持たせ、関係しない ID を全展開行へ付けない。S17 の重複記載などを整理し、テスト名だけでも失敗した責務を特定できるようにする                                     |
| AF-GUARD01 | P04/P05                  | databaseConcurrency.test.ts             | ロック待ちの 100 回照会は負荷によって確認時間が変わるため、実待機状態を確認する条件は維持しつつ、再試行上限と診断を明確にする。固定 sleep で成功を推測しない                             |

Q02 の未確認部分は AF-DB01 で補完します。元ケース ID を残し、追加テストを実行した後で testReport の「一部実施」を更新します。今回の報告だけで「修正後成功」に変更しません。

ケース ID 数と実行件数は別に集計し、複数 ID を一つのテストが確認する場合は、確認した具体的な条件を報告書へ残します。ケース名に ID があるだけで、すべての入力と DB 結果を検証済みとしません。

## 8. 今回の修正対象にしない事項と実装順序

- 商品下書きの重複作成は Q01/Q05/P01 で確認していますが、作成 API に冪等性キーを求める仕様はまだありません。自動的に 1 行へまとめる修正案は含めません。
- O04 の snapshot 利用、元 item_id の継承、未選択 gender/age は、先に業務契約を決める事項です。
- brandAliases の advisory lock ＋再検索・逐次再利用・rollback は今回成功しました。これを修正する必要性は確認していません。共通 service を通さない INSERT まで防ぐ DB unique 追加は、別の設計変更になります。
- 本番の共通 errorHandler を含む HTTP ＋ DB の結合、実 S3 アップロード、実 commit 通信障害は未検証です。未確認の結果から不具合や修正済みを断定しません。
- テスト tsconfig の失敗は、対象外の `test/usecases/shopSignup/signup1.test.ts` と `signup5.test.ts` の参照先不在 2 件です。今回の createItemDraft コードに起因する型エラーではなく、ここでは修正しません。

実装する場合は、まず F1 で入口を成立させ、F2 の所有者保存、F3/F4 の業務契約を確認した修正、F5 の署名欠落時の停止へ進みます。F6 は本番仕様の変更と独立して補強できます。各段階で該当する観測テストを新しい契約へ移行し、同じディレクトリの回帰テストと DB 安全確認を実行します。新しいモデル制約・migration が必要になる変更は、別途範囲を明示します。

**本書に記載した改善案・追加テストは未実装・未実行です。今回の成果は結果報告と提案の記録に限ります。**

---

## 9. F1〜F6 対応後の再実行結果（2026-10-12）

**11 ファイル・1,000 件すべて成功。失敗・skip・todo・未処理エラーは 0 件です。** 本節が最新の検証結果です。上記の「未実装・未実行」は改善案作成時の記録として残します。

`server/` で次のコマンドを実行しました。ファイル間の DB fixture・hook の干渉を避けるため 1 worker とし、各テスト内の並行処理は維持しています。

```bash
npm run test:run -- test/usecases/itemDraft/createItemDraft/ --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/createItemDraft-rerun-results-authorized.json --no-cache
```

| ファイル                     |  成功件数 |
| ---------------------------- | --------: |
| usecase.test.ts              |        79 |
| masterBrand.test.ts          |       253 |
| signedUrls.test.ts           |        72 |
| validation.test.ts           |       350 |
| services.test.ts             |        41 |
| controller.test.ts           |         5 |
| route.test.ts                |        19 |
| videoPresignedPost.test.ts   |         4 |
| database.test.ts             |       148 |
| databaseTransactions.test.ts |        17 |
| databaseConcurrency.test.ts  |        12 |
| **合計**                     | **1,000** |

DB 非接続は 823 件、実 DB は 177 件です。実 DB は `server/.env.test` 由来の設定を使用し、全接続の設定 DB 名と `SELECT current_database()` が `test_db` であることをガードで確認しました。commit・rollback 後の再取得、関連行の整合性、fixture ID を限定した後片付けも成功しています。S3/AWS 通信はモックです。

F1〜F6 の主な確認結果は次のとおりです。

- **F1**：正常 POST は 200。不正 body、認証優先順位、5 回／6 回目のレート制限、未知の所有者情報の除去を確認。
- **F2**：認証ユーザーの `seller_id` 保存、別ユーザー並行作成での所有者の非混在、保存障害時の rollback を確認。
- **F3**：transaction 内の再取得・行ロック、所有者変更／削除後の 404、同じ参照元でのロック待ちと rollback 後の B の commit を確認。メディアは初回 snapshot を使う契約を維持。
- **F4**：ENUM と null の `unisex/both` 補完、255 文字境界（補助平面文字・ブランド正規化後も含む）、正整数 ID の範囲と空白の null 化、確定画像 10 枚上限を確認。モデル・DB 制約の直接検証も成功。
- **F5**：新規動画署名欠落／bucket 未設定時の 500 と後続停止、既存動画の署名 null 許容、正常署名・元例外の伝播を確認。
- **F6**：Q02 の色画像 URL と返却署名、P02 の JSONB 全体とユーザー別の対応、deferred の解放・回収、ケース名の整理、実ロック待ちの診断を含む回帰が成功。

### 新たな修正点・今回の変更範囲

今回の再実行から、追加修正を要する失敗は確認されませんでした。初回はサンドボックスの通信制限（`EPERM`）で Router19 件が失敗し、DB177 件は setup で未実行でしたが、制限外で同じ安全ガード付きテストを再実行すると全件成功しました。これはコードの修正点ではありません。

今回編集したのは本書への追記のみです。本番コード・テストコードの追加修正は行っていません。`item_id` 継承の仕様決定、最新メディア保証、共通 helper を利用する別 usecase、実 S3 アップロードは今回の検証対象外です。
