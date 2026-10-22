# deleteItemDraft テスト実装・実行レポート

## 2026-10-22 item_draft.item_id削除後の回帰

削除migrationと現行Modelに従い、DB保存結果のitem_id:null期待値、既存下書きfixture入力、取得カラム一覧、nullable参照ケース、共有fixtureの旧FK検査を削除。本番コードには該当依存がなく変更なし。AF-OWN02の未知キー入力・所有者保存検証は維持し、item_id非存在を確認する。

server/で以下を実行（--maxWorkers=1は共有fixture・hookのファイル間干渉を避けるため）。

- `npm run test:run -- test/integration/database/itemDraft/createItemDraft/database.test.ts test/integration/database/itemDraft/deleteItemDraft/database.test.ts src/services/itemDraft/test/ src/usecases/itemDraft/test/createItemDraft.test.ts --maxWorkers=1`: 6ファイル264件成功（DB148+15、非DB101）。
- `npm run test:run -- test/integration/database/itemEditing/createItemEditingDraft/ test/integration/usecases/itemEditing/createItemEditingDraft/ test/integration/usecases/itemDraft/deleteItemDraft/ --maxWorkers=1`: 8ファイル207件成功、sharedIdRoutesの6件失敗。旧nullableケース除去前の結果。controllerモックのconvertItemEditingVideoController不足は別Todo `docs/todo/P3-techdebt/shared-id-routes-controller-mock-export.md` に記録し未修正。
- `npm run test:run -- test/integration/usecases/itemDraft/createItemDraft/databaseConcurrency.test.ts test/integration/database/itemEditing/createItemEditingDraft/database.test.ts --maxWorkers=1`: 最終変更後2ファイル65件成功。上記実行との重複を合算しない。
- `npm run lint`、`npm run typecheck`、`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` 成功。変更したtest配下TS6ファイルはESLint APIと既存typescript-eslint recommendedで追加検査し成功。

初回DB実行はsandboxのEPERMで163件本体未実行。通信許可後に同じガードで成功。.env.test由来test_dbを初期化前に検査し、アプリ・models・observer、共有基盤のcompetitorの全接続で実DB名を確認。現行Model列、共有基盤の型・NULL・ENUM・FKを検査後にseedし、自作IDだけのcleanup・残存0確認、hook解除・全接続closeを完了。migration/syncは実行していない。S3はモックで実通信未検証、カバレッジ未取得。今回実行していない機能全体の再検証完了を意味しない。

以下は過去の実行履歴。

## 最新結果：共有ErrorHandlerのF2対応完了（2026-10-19）

F2は共通機能 `ErrorHandler` / `ErrorHandler` として独立実装・テストを完了した。**レポート本体は [ErrorHandlerの独立レポート](../ErrorHandler/errorHandler.md) に記載している。**

deleteItemDraftのO03は新契約AF-JSON01へ更新し、正常/なし/不正JWT＋不正JSONがすべて400/INVALID_JSONとなり、作成・削除usecaseが呼ばれないことを確認した。通常ErrorのR06とDB失敗のH04は安全な500を維持している。

削除APIはJWT不正ケース1件追加により旧208件から209件となり、全件成功。独立ErrorHandler55件・既存作成API24件を含め計288件が成功し、lint・本番/テスト型検査・追加lintも成功した。旧O03の500観測は以下の初回履歴として保持する。その他の未確認範囲は解消扱いにしない。

## F1修正・再検証（2026-10-19、履歴）

**F1は修正済み。既存作成HTTP19件・controller単体5件が成功し、削除APIの208件もすべて成功した。** 合計13ファイル232件、失敗・skip・todo・未処理例外0件。以下の初回レポートにある19件失敗は修正前の履歴である。

変更したテストは `src/controllers/itemDraft/test/createItemDraft.test.ts` と `test/integration/usecases/itemDraft/createItemDraft/route.test.ts` の2ファイル。

- 対象外のdeleteItemDraftUseCaseを現在の相対import先で独立してモックし、作成usecaseモックと分離した。
- 全24ケースのafterEachで削除usecaseの呼出し0回を確認する。DBモジュールのmock factoryはimportされたら失敗する形にして、DB初期化へ進まないことも確認した。
- 追加lintで検出した既存の未使用 `_next` は `void _next` で明示した。Expressがエラーハンドラーとして認識する4引数を維持した。
- 本番コード、db.tsの接続ガード、dotenvモック、既存のレスポンス・認証・入力・レート制限の期待値は変更していない。

| 検証                       |         成功 | 失敗/skip/todo | 結果                                                    |
| -------------------------- | -----------: | -------------- | ------------------------------------------------------- |
| AF-MOCK01：既存controller  |            5 | 0/0/0          | DB初期化なしでケース本体まで実行                        |
| AF-MOCK01：既存作成HTTP    |           19 | 0/0/0          | beforeEachのimport失敗を解消、従来assertを維持          |
| AF-MOCK01：削除API回帰     |          208 | 0/0/0          | 単体97、DBなし結合62、実DB49を維持                      |
| AF-MOCK02：作成/削除の分離 | 上記ケース内 | 0/0/0          | 作成24ケースの削除呼出し0回、削除C01/R01の作成呼出し0回 |

実行ディレクトリは `server/`。

```bash
npm run test:run -- src/controllers/itemDraft/test/createItemDraft.test.ts test/integration/usecases/itemDraft/createItemDraft/route.test.ts src/validators/params/test/id.test.ts src/middleware/validate/test/deleteItemDraft.test.ts src/controllers/itemDraft/test/deleteItemDraft.test.ts src/usecases/itemDraft/test/deleteItemDraft.test.ts src/services/itemDraft/test/deleteItemDraft.test.ts test/integration/usecases/itemDraft/deleteItemDraft/ test/integration/database/itemDraft/deleteItemDraft/ --maxWorkers=1 --reporter=json --outputFile=/tmp/delete-draft-f1.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

全コマンド終了コード0。232件のうちDB非接続は183件、実DBは49件。実DBの.env.test/test_db限定ガード、全接続のDB名検査、作成ID限定cleanup・残存0件・closeも通過した。外部通信は前回と同じ境界モックで、実COMMIT通信障害O04等の未確認範囲を新たに保証するものではない。

`void _next` 追加後は修正対象24件だけを `/tmp/delete-draft-f1-target.json` へ再実行し、24成功・失敗/skip/todo0を確認した。これは232件に重複加算しない。

通常lint対象外のHTTPテストを含む修正2ファイルは、既存ESLint APIに `test/**/*.ts` のrecommended設定を追加指定して検査した。設定ファイルは変更していない。初回追加lintで既存 `_next` の未使用1件を検出し、修正後はerror/warning0。

```bash
node --input-type=module <<'JS'
import { ESLint } from 'eslint';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
const runner = new ESLint({ overrideConfig: tseslint.config({ files: ['test/**/*.ts'], extends: [eslint.configs.recommended, ...tseslint.configs.recommended] }) });
const results = await runner.lintFiles(['src/controllers/itemDraft/test/createItemDraft.test.ts','test/integration/usecases/itemDraft/createItemDraft/route.test.ts']);
process.stdout.write((await runner.loadFormatter('stylish')).format(results));
const errors = results.reduce((sum, result) => sum + result.errorCount, 0);
const warnings = results.reduce((sum, result) => sum + result.warningCount, 0);
console.info(`Target lint: ${results.length} files, ${errors} errors, ${warnings} warnings`);
process.exitCode = errors ? 1 : 0;
JS
```

F1のTodoは完了を記録した。F2は依頼範囲外のため変更していない。初回の既存回帰759件全体は再実行せず、今回の変更に直接関係する24件と、指定の削除208件を再検証した。初回の740成功と今回の成功を足して「今回の全回帰結果」とはしない。

## 1. 初回結果（2026-10-19、F1修正前の履歴）

[テスト設計書](../../architecture/itemDraft/deleteItemDraft.md) に基づき、単体・HTTP・実DB・transaction・並行処理のテストを実装した。**追加した11テストファイル208件はすべて成功、失敗・skip・todo・未処理例外は0件**。本番コード・既存テスト・共有設定・モデル・migrationは変更していない。

設計91IDのうち90IDに実行ケースが対応する。O04（実COMMIT通信障害）は設計どおり未実施であり、成功数に含めない。O01/O02/O03は現行挙動の観測、O05は代表2APIの回帰であり、仕様変更や全既存APIの網羅を意味しない。

関連する既存回帰は別集計で **740件成功・19件失敗・skip/todo 0件**。失敗19件は既存createItemDraftのHTTPテストのbeforeEachで発生し、リクエスト検証本体に到達していない。削除usecaseの追加に既存モックが追随していないことが原因。F1に修正案を記載し、既存テストは変更していない。

lint、本番typecheck、テスト用typecheck、通常lint対象外の追加10ファイルへの追加lintはすべて成功。実DBは `.env.test` 由来のPostgreSQL `test_db` に限定し、全接続の検査・fixture限定cleanup・接続closeを実施した。

## 2. 変更範囲・実処理とモック

パスは以下、特記がなければ `server/` 基準。

| 記号 | 新規ファイル                                                                       | 実処理 / モック                                                                            |
| ---- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| V    | `src/validators/params/test/id.test.ts`                                            | 実idParamSchema。外部依存なし                                                              |
| M    | `src/middleware/validate/test/deleteItemDraft.test.ts`                             | 実validateParamsとschema。部分Request/Response/nextのみテスト用                            |
| C    | `src/controllers/itemDraft/test/deleteItemDraft.test.ts`                           | 実controller。削除usecaseと対象外の作成usecaseをモック                                     |
| U    | `src/usecases/itemDraft/test/deleteItemDraft.test.ts`                              | 実usecase。transaction・取得/削除serviceを境界でモック                                     |
| S    | `src/services/itemDraft/test/deleteItemDraft.test.ts`                              | 実service。findOne・モデルインスタンスdestroyをモック                                      |
| R    | `test/integration/usecases/itemDraft/deleteItemDraft/route.test.ts`                | 実Router・JWT認証・MemoryStore・validator・controller・共通errorHandler。両usecaseをモック |
| I    | `test/integration/usecases/itemDraft/deleteItemDraft/sharedIdRoutes.test.ts`       | categories読取/itemEditing更新の実Router・共通ID検証。controller以下をモック               |
| D    | `test/integration/database/itemDraft/deleteItemDraft/database.test.ts`             | 実usecase/service/model/PostgreSQL。S3境界をモック                                         |
| H    | `test/integration/usecases/itemDraft/deleteItemDraft/routeDatabase.test.ts`        | 最小Expressから実DBまで。対象外の作成usecase・外部通信をモック                             |
| T    | `test/integration/usecases/itemDraft/deleteItemDraft/databaseTransactions.test.ts` | 実transaction。指定箇所のcall-through待合せ/障害注入のみspy                                |
| P    | `test/integration/usecases/itemDraft/deleteItemDraft/databaseConcurrency.test.ts`  | 実削除usecase・実編集開始usecase・独立transaction。実ロック待機を監視                      |

fixtureは `test/fixtures/itemDraft/deleteItemDraft/` に `fixtures.ts`、`databaseSetup.ts`、`databaseFixtures.ts`、`concurrencyFixtures.ts` を追加した。

- factory、明示的な取得列、境界値、deferred、期限付きgateを配置した。
- 既存 `test/fixtures/itemEditing/createItemEditingDraft/` の接続ガード・スキーマ検査・作成ID追跡・cleanupを再利用した。同じDB/FK構成を再実装せず、削除用に管理者相当ユーザー、所有者null行、同じitem/メディアURLを持つ別下書き、保護対象比較を追加した。既存fixtureは編集していない。
- 外部通信のsend・delete・upload境界をモックし、削除正常時に呼出し0回を確認した。実S3への残存確認は行っていない。
- 実アプリのimportはcronを起動するため、対象Routerと実errorHandlerを最小Expressへ登録した。`registerRoutes` の登録パスはソース照合であり、実アプリ全体・NGINX・CORSの起動試験ではない。

設計からの配置上の補足は、並行制御helperを `concurrencyFixtures.ts` として分離したこと。期待値・本番契約の変更はない。T06の局所lock_timeoutは監視時間を確保するため1500msとした。

## 3. ファイル別の最終件数

件数は最終Vitest JSON出力の `assertionResults` から集計。設計ID数と `it.each` 展開後のテスト件数は異なる。複数IDを1ケースで確認するもの、1IDを複数入力へ展開するものがある。

| 分類                 | ファイル記号   |    成功 |  失敗 | skip/todo |
| -------------------- | -------------- | ------: | ----: | --------: |
| 単体                 | V              |      46 |     0 |       0/0 |
| 単体                 | M              |      23 |     0 |       0/0 |
| 単体                 | C              |       6 |     0 |       0/0 |
| 単体                 | U              |      13 |     0 |       0/0 |
| 単体                 | S              |       9 |     0 |       0/0 |
| DBなしHTTP           | R              |      56 |     0 |       0/0 |
| DBなし共有Router回帰 | I              |       6 |     0 |       0/0 |
| 実DB                 | D              |      16 |     0 |       0/0 |
| HTTP＋実DB           | H              |       9 |     0 |       0/0 |
| 実transaction        | T              |      10 |     0 |       0/0 |
| 実並行処理           | P              |      14 |     0 |       0/0 |
| **追加テスト合計**   | **11ファイル** | **208** | **0** |   **0/0** |

内訳は単体97件、DBなし結合62件、実DB結合49件。カバレッジ率は取得しておらず、208件の成功から行/分岐100%を主張しない。

### 既存回帰（追加208件との重複加算なし）

| 既存ファイル                                                                                |    成功 |   失敗 | 範囲・備考                                                |
| ------------------------------------------------------------------------------------------- | ------: | -----: | --------------------------------------------------------- |
| `src/usecases/itemDraft/test/createItemDraft.test.ts`                                       |      79 |      0 | 作成usecase                                               |
| `src/controllers/itemDraft/test/createItemDraft.test.ts`                                    |       5 |      0 | 作成controller。対象外削除の依存遮断不足はF1で補足        |
| `src/services/itemDraft/test/createItemDraft.test.ts`                                       |       6 |      0 | 作成service                                               |
| `src/services/itemDraft/test/createItemEditingDraft.test.ts`                                |       7 |      0 | 共有取得・削除service                                     |
| `src/usecases/itemEditing/test/createItemEditingDraft.test.ts`                              |      55 |      0 | 編集開始usecase                                           |
| `src/controllers/itemEditing/test/createItemEditingDraft.test.ts`                           |       4 |      0 | 編集開始controller                                        |
| `src/services/itemEditing/test/createItemEditingDraft.test.ts`                              |       4 |      0 | 編集作成service                                           |
| `src/validators/body/test/createItemEditingDraft.test.ts`                                   |      33 |      0 | 編集開始入力                                              |
| `test/integration/usecases/itemDraft/createItemDraft/masterBrand.test.ts`                   |     253 |      0 | 実helper接続、DBなし                                      |
| `test/integration/usecases/itemDraft/createItemDraft/route.test.ts`                         |       0 |     19 | F1。beforeEachのimport失敗、HTTPケース本体未実行          |
| `test/integration/usecases/itemEditing/createItemEditingDraft/route.test.ts`                |      40 |      0 | 編集開始HTTP、DBなし                                      |
| `test/integration/database/itemDraft/createItemDraft/database.test.ts`                      |     148 |      0 | 実DBの作成保存                                            |
| `test/integration/usecases/itemDraft/createItemDraft/databaseTransactions.test.ts`          |      17 |      0 | 実DBの作成transaction                                     |
| `test/integration/usecases/itemDraft/createItemDraft/databaseConcurrency.test.ts`           |      12 |      0 | 実DBの作成競合                                            |
| `test/integration/database/itemEditing/createItemEditingDraft/database.test.ts`             |      54 |      0 | 実DBの編集開始保存                                        |
| `test/integration/usecases/itemEditing/createItemEditingDraft/databaseTransactions.test.ts` |      11 |      0 | 実DBの編集開始transaction                                 |
| `test/integration/usecases/itemEditing/createItemEditingDraft/databaseConcurrency.test.ts`  |      12 |      0 | 実DBの編集開始競合                                        |
| **既存回帰合計**                                                                            | **740** | **19** | **DBなし486成功/19失敗、実DB254成功/0失敗。skip/todoは0** |

## 4. 設計IDとの対応・確認内容

「成功」は当該レベルのassertが通った意味。V/C/U/Sの成功を実DBや認証の保証へ広げない。ファイル記号は2節の新規ファイルを指す。

| ID  | ファイル | 判定・確認した条件                                                                                                             |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| V01 | V        | 成功：1/2/2147483646/2147483647の数値化                                                                                        |
| V02 | V        | 成功：0/負数/上限超過/巨大値の拒否とissue.path                                                                                 |
| V03 | V        | 成功：小数/NaN/±Infinity/非数値を拒否                                                                                          |
| V04 | V        | 成功：欠落/undefined/null/空文字/空白を拒否                                                                                    |
| V05 | V        | 成功：SQL/HTML風文字列、slash、commaを拒否                                                                                     |
| V06 | V        | 成功：未知キー除去、元オブジェクト不変                                                                                         |
| V07 | V        | 成功：HTTP外の数値型境界                                                                                                       |
| M01 | M        | 成功：validatedParams格納、raw params不変、next1回                                                                             |
| M02 | M        | 成功：不正値・欠落でAppError400、next/response/検証値設定なし                                                                  |
| M03 | M        | 成功：部分Request再利用時の不正入力は古い検証値を上書きせずnextなし                                                            |
| C01 | C        | 成功：raw/body/queryの他人IDを無視し認証ユーザーと検証済みidだけを渡す                                                         |
| C02 | C        | 成功：200とmessageのみのJSON、nextなし                                                                                         |
| C03 | C        | 成功：AppError/通常Errorの同一参照をnextへ、成功応答なし                                                                       |
| C04 | C        | 成功：usecase保留中の応答/nextなし、成功/失敗で解放                                                                            |
| C05 | C        | 成功：jsonの模擬送信失敗後に削除再実行・作成なし                                                                               |
| U01 | U        | 成功：同じtransaction・取得インスタンス、引数完全一致、取得→削除                                                               |
| U02 | U        | 成功：nullならITEM_DRAFT_NOT_FOUND/404、削除なし                                                                               |
| U03 | U        | 成功：transaction開始相当失敗、取得/削除なし                                                                                   |
| U04 | U        | 成功：取得失敗をそのまま伝播、削除なし                                                                                         |
| U05 | U        | 成功：削除失敗をそのまま伝播、再試行なし                                                                                       |
| U06 | U        | 成功：callback後のtransaction rejectを伝播。実COMMIT障害の検証ではない                                                         |
| U07 | U        | 成功：取得の成功/不存在/例外まで削除を開始しない                                                                               |
| U08 | U        | 成功：削除の成功/例外までusecaseを完了しない                                                                                   |
| U09 | U        | 成功：callback完了後もtransaction Promiseを待つ                                                                                |
| U10 | U        | 成功：交差した2要求のモデルとtransactionが混ざらない                                                                           |
| S01 | S        | 成功：id＋seller_idのwhere、UPDATE lock、同じt                                                                                 |
| S02 | S        | 成功：モデル/nullをそのまま返す                                                                                                |
| S03 | S        | 成功：findOneの元例外を伝播                                                                                                    |
| S04 | S        | 成功：全取得列・順序とoptionsの完全一致、余分な条件なし                                                                        |
| S05 | S        | 成功：インスタンスdestroyのみ、static destroy/createなし                                                                       |
| S06 | S        | 成功：destroyの元例外を伝播、再試行/復元なし                                                                                   |
| S07 | S        | 成功：取得/削除それぞれの保留後成功/例外を待機                                                                                 |
| R01 | R        | 成功：bodyなしの正常要求、200/JSON、作成usecaseなし                                                                            |
| R02 | R        | 成功：なし/Basic/空Bearer/壊れたJWT/別鍵/期限切れは401                                                                         |
| R03 | R        | 成功：HTTP表現可能な不正値は400、usecaseなし。エンコードしたslash/空白も確認                                                   |
| R04 | R        | 成功：上下限を数値でusecaseへ渡す。実DB固定境界行は作成していない                                                              |
| R05 | R        | 成功：他人/不存在相当の404 JSONが同じ形                                                                                        |
| R06 | R        | 成功：500整形、内部message/SQL/stackのレスポンス露出なし                                                                       |
| R07 | R        | 成功：id欠落/余分なpath/未定義PUT・PATCHは削除なし                                                                             |
| R08 | R        | 成功：body/queryで所有者・対象を上書きできない                                                                                 |
| R09 | R        | 成功：無認証＋不正入力・制限超過時も401、正常ユーザー枠消費なし                                                                |
| R10 | R        | 成功：制限超過＋不正入力は429優先                                                                                              |
| R11 | R        | 成功：usecase保留中にJSONを送らない                                                                                            |
| R12 | R/H      | 成功：管理者JWTも本人IDで実認可し、他人の下書きは404                                                                           |
| L01 | R        | 成功：20回通過、21/22回目429、残量境界                                                                                         |
| L02 | R        | 成功：不正入力20回も計上し21回目429                                                                                            |
| L03 | R        | 成功：404要求も計上                                                                                                            |
| L04 | R        | 成功：500要求も計上                                                                                                            |
| L05 | R        | 成功：同じIPでも別ユーザー枠は独立                                                                                             |
| L06 | R        | 成功：JWT再発行・対象id/query/IP系ヘッダー変更で回避不能                                                                       |
| L07 | R        | 成功：401要求21回は認証済みユーザー枠に加算しない                                                                              |
| L08 | R        | 成功：299999ms時は429、300000msで再開、直後も残量更新                                                                          |
| L09 | R        | 成功：standardヘッダー・Retry-After、legacyヘッダーなし、既定429本文                                                           |
| L10 | R        | 成功：作成先行/削除先行とも独立store                                                                                           |
| L11 | R        | 成功：同一ユーザー21並行要求は20通過/1拒否。拒否対象の順序は固定しない                                                         |
| D01 | D        | 成功：D1のみ物理削除、親・他下書き・editing・ユーザー全列不変                                                                  |
| D02 | D        | 成功：事前確認した不存在idは404・削除なし                                                                                      |
| D03 | D        | 成功：他人/管理者本人IDでは他人行を削除しない                                                                                  |
| D04 | D        | 成功：seller_id=nullはA/Bとも404                                                                                               |
| D05 | D        | 成功：共有item/URLの別下書きを保持、S3境界0回                                                                                  |
| D06 | D        | 成功：item_id=null/nullable列null/attributes空/画像空でも削除可能                                                              |
| D07 | D        | 成功：video_status3値×sale_flag2値に削除制約なし                                                                               |
| D08 | D        | 成功：削除成功後の再要求は404                                                                                                  |
| H01 | H        | 成功：HTTPから実削除、commit前の応答なし、commit後200と別接続で不存在                                                          |
| H02 | H        | 成功：実DBの他人/不存在/null所有者/管理者で404、非対象不変                                                                     |
| H03 | H        | 成功：401/400/429はusecase・transaction・取得・削除0回                                                                         |
| H04 | H        | 成功：実destroy後の模擬障害は500・実rollback                                                                                   |
| T01 | T        | 成功：findOne/destroyまで同じt、commit後に不存在                                                                               |
| T02 | T        | 成功：実取得後のgateで同じt/別接続とも旧行、未完了                                                                             |
| T03 | T        | 成功：実destroy後は同じtで不存在、別接続で旧行、commit後に不存在                                                               |
| T04 | T        | 成功：実destroy後throwで全列rollback、復元INSERTなし                                                                           |
| T05 | T        | 成功：取得前/取得後/削除前の個別失敗で後続停止・旧行保持                                                                       |
| T06 | T        | 成功：実DELETEがSHARE table lockで待機、SQLSTATE55P03、実rollback                                                              |
| T07 | T        | 成功：失敗後同じidで再試行成功、その後404。ロック解放確認                                                                      |
| T08 | T        | 成功：404後に別transactionのFOR UPDATE NOWAITが完了                                                                            |
| T09 | T        | 成功：commit済み後の模擬送信失敗では復元なし、再要求404                                                                        |
| P01 | P        | 成功：先行ロック→後続待機→先行commit、後続404。逆ラベル順も実施                                                                |
| P02 | P        | 成功：先行実destroy後rollback、後続取得gate時に元行を観測、後続削除成功                                                        |
| P03 | P        | 成功：編集開始先行commit→削除404、正しくコピーされたediting1件                                                                 |
| P04 | P        | 成功：編集開始が実editing作成・削除後rollback→削除成功、editing0件                                                             |
| P05 | P        | 成功：削除先行commit→編集開始404、editing0件                                                                                   |
| P06 | P        | 成功：削除先行rollback→編集開始成功、editing1件                                                                                |
| P07 | P        | 成功：別ユーザー・別行は先行成功/rollbackの両方で待たず完了                                                                    |
| P08 | P        | 成功：削除先行時の所有者UPDATE待機、commitなら影響0行、rollbackなら所有者変更後に旧所有者404/新所有者削除可                    |
| P09 | P        | 成功：所有者UPDATE先行commitなら旧所有者404、rollbackなら削除成功。WHERE再評価                                                 |
| P10 | P        | 成功：所有権不一致は先行行ロック中も404で終了                                                                                  |
| O01 | V/R      | 観測成功：先頭ゼロ/符号/小数表記/指数/16進/空白/丸められる小数を数値化して受理                                                 |
| O02 | V        | 観測成功：HTTP外のtrue/[1]は1として受理、false/空配列/複数要素/objectは拒否                                                    |
| O03 | R        | 観測成功：不正JSONはJWTの有無によらず認証前に失敗し現errorHandlerで500。F2参照                                                 |
| O04 | —        | 未実施：実COMMIT通信障害は設計で未計画。U06/T04/T09では代替できない                                                            |
| O05 | I        | 代表範囲成功：categories読取/itemEditing更新の上下限でcontroller到達、上限超過で400・controller未実行。全利用APIの回帰ではない |

## 5. 実DBの接続・状態・並行順序の証拠

- 読込元は `server/.env.test`。NODE_ENV=test、採用設定の由来とDB名test_dbをDB/model import前に検査した。既存setupのdotenvモックで `.env` へのフォールバック・別ファイル指定・設定上書きを拒否した。
- アプリsequelize、models/index側sequelize、observer、competitorの全4接続で接続前DB名と接続後 `SELECT current_database()` を検査し、すべてtest_dbだった。接続URL・認証情報・env値は本レポートに記録しない。
- 反映済みitem_draft/item_editingの列型、nullable、INTEGER、JSONB、配列、ENUM、FK参照先と削除方向を既存fixtureのcheckSchemaで検査した。必要な親・マスターは専用の作成行を参照した。スキーマ自動補正、migration、sync、DB作成、TRUNCATE、シーケンス巻戻しは行っていない。
- 結果判定はobserverの新規SELECT。commit前に元行、commit後に不存在、rollback後に同じid/createdAt/全列の元行を確認した。更新済みモデルの見た目だけでrollbackを判断していない。
- PではtransactionごとのPIDとREAD COMMITTEDを実取得した。Aが実FOR UPDATE取得後にBを開始し、`pg_blocking_pids` と `pg_stat_activity.wait_event_type='Lock'` で指定PID間の実待機を確認してからAを解放した。両方のロック取得完了を先に待つgateは設けていない。
- 編集開始側は実 `createItemEditingDraftUseCase` を実行。作成・削除成功後に意図的throwするP04でも、新規editingは残存0件、後続削除は成功した。P03/P06の成功editingは全コピー列と所有者を明示比較した。
- T06はcompetitorのSHAREテーブルロックと対象transactionだけの1500ms lock_timeoutを使用し、実DELETEの55P03を確認した。ラッパーのthrowだけでDB例外を再現したとはしていない。
- finallyでgate・保留Promise・transactionを回収後、作成IDだけをFK依存順にcleanupし、残存0件をassertした。既存のafterAllで全接続をcloseしenvを復元した。未知の接続先への書込み・cleanupはない。

## 6. 実行コマンド・検査

実行ディレクトリはすべて `server/`。JSONファイルは件数の集計用の一時出力であり、リポジトリには追加していない。

### 新規208件の最終実行

```bash
npm run test:run -- src/validators/params/test/id.test.ts src/middleware/validate/test/deleteItemDraft.test.ts src/controllers/itemDraft/test/deleteItemDraft.test.ts src/usecases/itemDraft/test/deleteItemDraft.test.ts src/services/itemDraft/test/deleteItemDraft.test.ts test/integration/usecases/itemDraft/deleteItemDraft/ test/integration/database/itemDraft/deleteItemDraft/ --maxWorkers=1 --reporter=json --outputFile=/tmp/delete-draft-final.json
```

終了コード0。11ファイル208成功、失敗/skip/todo/未処理例外0。単体97件、DBなし結合62件、実DB49件に分けて集計した。

### 既存回帰

```bash
npm run test:run -- src/usecases/itemDraft/test/createItemDraft.test.ts src/controllers/itemDraft/test/createItemDraft.test.ts src/services/itemDraft/test/createItemDraft.test.ts src/services/itemDraft/test/createItemEditingDraft.test.ts src/usecases/itemEditing/test/createItemEditingDraft.test.ts src/controllers/itemEditing/test/createItemEditingDraft.test.ts src/services/itemEditing/test/createItemEditingDraft.test.ts src/validators/body/test/createItemEditingDraft.test.ts test/integration/usecases/itemDraft/createItemDraft/route.test.ts test/integration/usecases/itemDraft/createItemDraft/masterBrand.test.ts test/integration/usecases/itemEditing/createItemEditingDraft/route.test.ts --maxWorkers=1 --reporter=json --outputFile=/tmp/delete-draft-regression.json
npm run test:run -- test/integration/database/itemDraft/createItemDraft/database.test.ts test/integration/usecases/itemDraft/createItemDraft/databaseTransactions.test.ts test/integration/usecases/itemDraft/createItemDraft/databaseConcurrency.test.ts test/integration/database/itemEditing/createItemEditingDraft/database.test.ts test/integration/usecases/itemEditing/createItemEditingDraft/databaseTransactions.test.ts test/integration/usecases/itemEditing/createItemEditingDraft/databaseConcurrency.test.ts --maxWorkers=1 --reporter=json --outputFile=/tmp/delete-draft-db-regression.json
```

前者は終了コード1（486成功・19失敗）、後者は終了コード0（254成功）。既存createItemDraftのHTTP回帰はF1のため未確認であり、「全回帰成功」とは報告しない。`--maxWorkers=1` はfixture・mock・storeのファイル間干渉を避ける指定で、Pケース内部の競合は独立接続で実行した。

### lint・型検査

```bash
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

すべて終了コード0。本番typecheckが除外する単体テストと、結合・fixtureの型もテスト用tsconfigで確認した。

通常lint対象外の `test/` には設定を変更せず、以下を追加実行した。追加10ファイル、error/warningとも0。

```bash
node --input-type=module <<'JS'
import { ESLint } from 'eslint';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
const runner = new ESLint({overrideConfig: tseslint.config({files:['test/**/*.ts'],extends:[eslint.configs.recommended,...tseslint.configs.recommended]})});
const results = await runner.lintFiles(['test/fixtures/itemDraft/deleteItemDraft/**/*.ts','test/integration/database/itemDraft/deleteItemDraft/**/*.ts','test/integration/usecases/itemDraft/deleteItemDraft/**/*.ts']);
const formatter = await runner.loadFormatter('stylish');
process.stdout.write(formatter.format(results));
const errors = results.reduce((n,r)=>n+r.errorCount,0);
console.info(`Additional lint: ${results.length} files, ${errors} errors`);
process.exitCode = errors ? 1 : 0;
JS
```

## 7. 実装中の失敗と修正の履歴

| 段階       | 結果・原因                                                  | 対応・最終状態                                                                                                     |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 初回単体   | 95件成功                                                    | 後にS07の保留後例外2ケースを追加し、最終単体97件成功                                                               |
| 初回HTTP   | 60件失敗、Supertestの一時HTTP待受がサンドボックスで拒否     | 権限付きで同じテストを再実行し60成功。その後slash/空白2ケースを追加し最終DBなし結合62成功。APIロジック不良ではない |
| 初回DB収集 | hoisted変数を直接exportしたfixtureで収集失敗、ケース本体0件 | hoistedな内部変数とexportを分離。テストfixtureだけ修正                                                             |
| DB再実行   | PostgreSQL接続EPERMでsetup失敗                              | 同じ.env.test/test_dbガードを維持して権限付き再実行。接続先の変更・ガード緩和なし                                  |
| 初回実DB   | 25成功・T06の1件失敗                                        | テスト用待機監視SQLの `:blocker=ANY` を `:blocker = ANY` に修正。最終実DB49件はすべて成功。本番コード変更なし      |
| 既存回帰   | createItemDraft HTTPの19件がbeforeEachで失敗                | F1に修正案。既存テストの失敗をskip化・期待値緩和で隠していない                                                     |

途中の実行を最終件数へ重複加算していない。setup失敗で実行されなかったケースを成功・skip件数へ混ぜていない。

## 8. 修正案・観測事項

### F1：既存createItemDraftのHTTPテストが対象外削除usecaseを実importする

**初回に確認したテスト分離不備。現在は修正・再検証済み（冒頭の最新結果参照）。** 以下は初回調査時の原因・修正案。元ケースは既存createItemDraftレポートのR系、新設側ではR01〜R12の依存遮断に関連する。

- 再現：6節の既存DBなし回帰を実行。`createItemDraft/route.test.ts` の全19件でbeforeEach中のRouter importが失敗する。
- 実際のエラー：`TypeError: Cannot read properties of undefined (reading 'error')`、`src/db.ts:10`。既存のdotenvモックがconfig()の結果を返さない状態で、追加されたdeleteItemDraftUseCase→db.tsへ進むため発生する。HTTP要求・削除SQLには到達していない。
- 原因：既存テストは同じcontrollerモジュールがimportするcreateItemDraftUseCaseだけをモックしており、新設のdeleteItemDraftUseCaseを遮断していない。削除追加に伴う既存テスト互換性の不足で、今回の新規テストによる本番変更ではない。
- 対象：`test/integration/usecases/itemDraft/createItemDraft/route.test.ts`。同じimportを持つ `src/controllers/itemDraft/test/createItemDraft.test.ts` も対象外依存の遮断を追加する。後者5件は通るが、実DB/model設定への依存を持たせる根拠にはしない。
- 修正案：各ファイルで現在の相対パスの `deleteItemDraftUseCase` を `vi.mock` し、元の作成usecaseモックと独立させる。dotenvモックにダミーDB設定を返す方法やdb.tsのガード緩和は使わない。
- 修正後契約：作成APIの既存19HTTPケースがDB初期化なしで本体まで実行され、従来の応答・入力・制限assertを維持する。本番Router/controller/usecaseの変更は対象外。

| 追加検証案 | 元ケース                | 手順・修正後期待値                                                                            |
| ---------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| AF-MOCK01  | 既存作成R系 / 本設計R01 | 削除usecaseモック追加後、既存19ケースとcontroller5ケースを再実行して成功。新規削除208件も維持 |
| AF-MOCK02  | C01/R01                 | 作成要求で削除usecase呼出し0回、削除要求で作成usecase呼出し0回。dotenv/DBへ到達しない         |

修正提案は [Todo](../../../../../docs/todo/P1-bug/createItemDraft-deleteItemDraft-test-mock.md) にも記録した。

### F2：不正JSONが共通errorHandlerで500になる（初回観測・提案の履歴）

**現在は共有ErrorHandlerとして修正・検証済み。[独立レポート](../ErrorHandler/errorHandler.md) を参照。以下は変更前の観測と提案。** 削除APIはbody不要だが、壊れたJSONを送るとexpress.json()が認証より先にSyntaxErrorを発生させ、AppError以外を一律500にする変更前のerrorHandlerで500となっていた。JWTあり/なしとも同じ結果。削除usecase/DBには到達しない。

- 対象候補：`src/middleware/errorHandler.ts`、必要に応じその専用テスト。削除usecaseの修正ではない。
- 修正案：共有APIの入力エラー方針を確定後、body-parserのJSON構文エラーを識別し、安全な400 JSONへ変換する。任意Errorのstatus値を無条件に信用する処理は追加しない。通常DB例外の500・内部情報非公開は維持する。
- 修正後の期待候補：`AF-JSON01`（O03対応）で正常/欠落/不正JWT＋不正JSONを400として確認し、認証前parserという順序を明示。`AF-JSON02`（R06対応）で通常Errorは500、message/stack/SQL非公開を維持する。方針確定・実装修正後にだけO03の期待値を更新する。
- 現時点では設計の観測契約に一致しており、削除APIの仕様違反とは断定しない。[判断用Todo](../../../../../docs/todo/P3-techdebt/json-parser-error-response-policy.md) を残した。

### 修正不要・未確定として分けるもの

- O01/O02のcoerce受理は現schemaと設計に一致する。数字列限定の入力へ勝手に変更しない。
- O04ではCOMMIT通信断時の成否不明が残る。U06のreject・T04のrollback・T09の送信境界失敗から、すべてのCOMMIT障害で行が保持されるとは結論しない。運用上の契約を広げる場合は別途設計する。
- 実測した範囲では、所有権・削除範囲・transaction引渡し・await・ロールバック・並行排他について本番ロジックの誤りは検出していない。

## 9. 初回実装時の残る範囲・完了判定（履歴）

単体・HTTP・実DBのテスト実装と実行、90設計IDの対応確認、結果・失敗原因・修正案の記録まで完了。追加テスト208件とlint/型検査は成功している。

既存作成HTTP19件はF1未修正のため回帰未確認。O04の実COMMIT通信障害、実回線切断、実S3残存、実アプリ全体の起動、全共有schema利用API、分散MemoryStoreは未検証/対象外である。F1/F2の本番・既存テスト修正は実施していない。
