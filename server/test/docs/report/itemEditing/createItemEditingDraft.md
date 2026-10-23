# createItemEditingDraft テスト報告・修正記録

## 2026-10-23 旧deleted_atケース削除後の一括検証（最新）

ユーザー指示により、旧item.deleted_atに依存するDB/HTTPのO05 AF-DEL01各1件と、競合AF-DEL02の論理削除commit/rollback計2件を削除した。P03〜P07/AF-DB01の残る10件（更新・soldout・所有者変更・物理削除・複合変更×commit/rollback）は維持。旧ケースの期待値緩和やskip化は行わず、本番コード・DBスキーマは変更していない。前節までの失敗・除外は過去の実行履歴であり、この結果で残件を解消した。

`server/`で以下を除外条件なしに一括実行し、**9ファイル268件すべて成功、失敗・skip・todo・未処理例外0件、終了コード0（27.85秒）**。

```bash
npm run test:run -- test/integration/database/itemEditing/createItemEditingCopy test/integration/usecases/itemEditing/createItemEditingCopy test/integration/database/itemEditing/createItemEditingDraft test/integration/usecases/itemEditing/createItemEditingDraft --maxWorkers=1
```

- 実DBのコピー・新規/下書き作成・null保存・所有権・非対象行保持・DB制約・commit/rollback・競合・HTTP接続、およびDB非接続Routerを対象とした。コピーDBは93件、新規/下書きDBは54件、usecase結合2ディレクトリは121件。過去の実行との重複加算なし。
- `.env.test`由来のNODE_ENV=test・設定DB名と、アプリ/Model/observer/下書きcompetitorの実DB名test_dbを既存ガードで確認し、必要なスキーマ検査後にfixtureを書き込んだ。今回の自作ID限定cleanup・残存0検査・全接続closeがhookを含め成功。並行ケースはbackend PIDとpg_blocking_pidsによる実待機確認を維持した。過去の中断実行で作成した行の一括削除は実施していない。
- `npm run lint`・`npm run typecheck`・`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json`成功。通常lint対象外の変更した結合テスト3ファイルは、既存ESLint/@eslint/js/typescript-eslint recommendedをNode APIのoverrideConfigで適用して追加検査し、警告・エラー0件。共有設定は変更なし。
- Node v20.20.2でAWS SDKのNodeバージョン警告あり。カバレッジ・実AWS通信は未検証。将来のitem_trash削除/復元仕様は今回の対象外。



## 2026-10-23 item_id追加・DB反映結果

- `20261023100000-add-item-editing-item-id.js`を追加し、development（neondb）・test（test_db）へこの1件だけUmzugのSequelize履歴管理で適用した。テストDBの過去の未記録migrationは適用していない。両DBでINTEGER・nullable・item(id)へのFK・ON UPDATE NO ACTION（既定）/ON DELETE CASCADEを確認。適用直前/直後の既存編集行は各0件。downは実装済み・DB上では未実行。
- 3作成usecaseのdataに`item_id: null`を追加し、3serviceの引数型（コピーは下書き型を継承）でもnullを必須にした。serviceは受け取ったdataをそのままModelへ渡す。単体fixtureの完全一致と旧「item_idなし」期待値を更新した。DB fixtureのitem_id存在・nullableガード、所有権・コピー・非対象行検査は維持。
- 単体：`npm run test:run -- src/services/itemEditing/test/createItemEditing src/usecases/itemEditing/test/createItemEditing src/usecases/itemEditing/createItemEditingCopy/test --maxWorkers=1`は6ファイル199件成功。
- DB：`npm run test:run -- test/integration/database/itemEditing/createItemEditingDraft --maxWorkers=1`は54件成功。ITEM-ID01はsetupのusecaseモックを`vi.importActual`で回避した実新規作成→別接続SELECTのnull確認。下書きの共通保存検査にもnull確認を追加した。全接続の設定/実DB名test_dbガード・自作ID限定cleanupと残存0検査・closeを通過。
- コピーDB：`npm run test:run -- test/integration/database/itemEditing/createItemEditingCopy --maxWorkers=1`は93成功・1失敗。O05 AF-DEL01は削除済みitem.deleted_atをupdateして404を期待する旧ケースで、実際は作成成功。item_id検査・全コピー項目の再SELECT・元商品削除後のコピー保持などは成功。
- usecase結合：コピー・下書きの2ディレクトリを`--maxWorkers=1 -t '^(?!.*P03 P04 P05 P06 P07 AF-DEL02 AF-DB01)'`で実行し、7ファイル111成功・1失敗・12除外。失敗はコピーdatabaseHttpの同じ旧論理削除ケース（期待404/実際201）。除外12件は既存の先行変更競合ケース。最初の一括実行ではそのケースが約55秒待機して失敗し進行が止まったため中断した。一括実行のcleanup/close完遂は未確認であり、最終集計へ合算しない。
- `npm run lint`・`npm run typecheck`・`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json`は成功。カバレッジ未取得。実行環境Node 20（package要求は26）のためAWS SDK警告あり。通常lint対象外のテストTSへ追加ESLint検査は未実施。
- item_idの追加・保存契約は反映済み。旧deleted_atテストの見直しと結合テスト全件成功は残件として指定Todoへ記録し、Todoは未完了一覧に残す。削除・復元の本番仕様は今回変更していない。



初回報告と修正記録を統合した。以下が今回のRouter検証結果であり、後半の各節は当時の実行履歴として残す。

<a id="route-db-isolation-20261016"></a>

## RouterのDB設定依存解消（2026-10-16）

- 対象：`test/integration/usecases/itemEditing/createItemEditingDraft/route.test.ts`。DB非接続1ファイル40件が成功、失敗・skip・todo・未処理例外0件。実DBテストは今回未実行。
- 修正前：下記コマンドでbeforeEachのRouter読込み時に40件すべてが`DATABASE_URL is not set!`で停止。対象外の`createItemEditingCopy`がモックされず、controller経由で`src/db.ts`が読み込まれていた。
- 環境調査：npm scriptで`NODE_ENV=test`は設定され、server/.env.testの`DATABASE_URL`も存在する（`DETABASE_URL`の誤記なし）。起動元processにはDATABASE_URLがない。db.tsは.env.testを読む前にprocess.envを検査するため、そこで停止する。さらに当テストは認証情報の読込みを防ぐためdotenv.configを無効化しており、DB用setupも使用しない。
- 修正：`createItemEditingCopy/createItemEditingCopy.js`を実import先でモック。既存40件・期待値・本番コード・環境設定は変更なし。R01〜R08・AF-R01〜05と併記のC02/V01〜05は成功。実Router・認証・validator・レート制限・controller・共通errorHandlerとエラー観測middlewareを維持し、全usecaseとdotenvをモックする。
- 修正後のサンドボックス内実行はHTTP待受けの`listen EPERM`で40件失敗・未処理例外40件。通信許可後に同じコマンドで全件成功した。DB接続エラーとは区別する。

server/で実行：

```bash
npm run test:run -- test/integration/usecases/itemEditing/createItemEditingDraft/route.test.ts --maxWorkers=1
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

すべて成功。`--maxWorkers=1`は修正前Todoの再現条件を揃えるために維持した。通常lintの対象外である変更TSは、ESLint APIで`overrideConfigFile: true`とし、当該ファイルをfilesに指定して`@eslint/js`・`typescript-eslint`のrecommended設定で追加検査した（エラー0・警告0、共有設定変更なし）。

本件の完了範囲はRouterのDB設定依存解消。DB保存・transaction・実アプリ登録・カバレッジは今回検証していない。DB初期化順序と上書き後の接続先検証は [別Todo](../../../../../docs/todo/done/validate-test-db-url-after-loading-env.md) に記録し、本番コードの修正やDB接続・migrationは行っていない。

<a id="initial-report"></a>

# 下書きから商品編集セッション作成：レビュー・テスト結果

## 1. 結果

2026-10-13 に設計書と実装をレビューし、対象 8 テストファイルの**206 件すべてが成功**した。失敗・skip・todo・未処理例外は最終実行で 0 件。DB 非接続 129 件、実 DB77 件である。

主要なコピー・認可・削除・rollback・再試行・行ロックの契約を確認できた。ただし、設計に対する検証不足と追加 lint エラーがあるため、設計全体の完了とはしない。本番の共通エラー処理にも問題を確認した。修正案は [修正案・修正後の検証記録](#follow-up) に記載し、今回は本番コード・テストコードを修正していない。追加したファイルは本報告書と afterFix.md のみ。

| テストファイル               |    成功 | 失敗／skip／todo | 実処理と確認内容                                                                         |
| ---------------------------- | ------: | ---------------- | ---------------------------------------------------------------------------------------- |
| usecase.test.ts              |      55 | 0／0／0          | 実 usecase ＋ service/transaction モック。全コピー値、呼出順、await、例外伝播            |
| services.test.ts             |      10 | 0／0／0          | 実 service ＋モデル操作モック。所有者 where、取得列、UPDATE ロック指定、同じ transaction |
| validation.test.ts           |      33 | 0／0／0          | 実 schema/validateBody。正整数、型不正、未知キー除去、上限未確定の観測                   |
| controller.test.ts           |       4 | 0／0／0          | 実 controller ＋ usecase モック。検証済み ID、201、next、完了待ち                        |
| route.test.ts                |      27 | 0／0／0          | 実 Router/認証/制限/validator ＋ usecase モック。401/400/201/429、5/6 回、時間窓         |
| database.test.ts             |      54 | 0／0／0          | 実 usecase/service/モデル/DB。コピー、所有権、再送、HTTP 拒否時の不変                    |
| databaseTransactions.test.ts |      11 | 0／0／0          | 実 DB ＋障害注入。INSERT/DELETE 後 rollback、commit 可視性、再試行、保存制約             |
| databaseConcurrency.test.ts  |      12 | 0／0／0          | 実 DB の独立 transaction。ロック待機、commit/rollback 後の再評価、更新/削除競合          |
| **合計**                     | **206** | **0／0／0**      | 設計の 67 ケース ID とは別の、it.each 展開後の件数                                       |

件数は Vitest の JSON 結果 `/tmp/createItemEditingDraft-test-results-escalated.json` から集計した。設計ケースは 67 個で、優先度の P0/P1/P2 はケース ID に数えない（前回の 70 個という集計を訂正）。カバレッジは取得していない。

## 2. 設計とのレビュー

ファイル分割、fixture、29 コピー列と認証 seller_id、依存モック、実 DB と単体の分離は設計に沿っている。異常系の後続未実行、deferred による待機、別接続からの再取得も実装されている。

残る点は次のとおり。

- **RV01：並行処理後の非対象行確認が不足。** 設計 11 節は並行後も非対象行の再取得を求めるが、P01〜P09 は主に競合対象だけを assert している。ST06 の通常成功・失敗では確認済みだが、並行中の非対象行まで保証できない。
- **RV02：P01 の逆順は実質同じ手順。** A/B は同じ `run(f)` で、観測結果にも要求名が残らない。先行/後続の直列化は検証できるが、「A→B/B→A」のラベルだけでは、異なる要求の識別と逆順を検証したことにならない。
- **RV03：E08 の S レベルが未実装。** 画像 11 件の実モデル拒否・rollback は D で確認できた。設計表の S/D のうち、11 件を渡した service 呼出し契約の S ケースはない。
- **RV04：追加 lint が 2 件失敗。** route.test.ts:31、database.test.ts:90 のエラー観測 middleware で `_next` が未使用。Express には 4 引数が必要なので、引数を削除する修正は不適切。

設計の ID 上限は未確定のまま。勝手に DB の INTEGER 上限を入力仕様へ採用していない。R08 は設計どおりテスト専用 handler による観測であり、本番共通 handler の動作保証ではない。

## 3. 設計ケースごとの結果

略号：U=usecase、S=services、V=validation、C=controller、R=route、D=database、DT=databaseTransactions、DC=databaseConcurrency（いずれも `.test.ts`）。同じ結果・ファイルの ID はまとめた。以下は最終実行の判定であり、初回の環境エラーを含めない。

| 設計 ID            | 判定                 | ファイル | 確認内容／残る範囲                                                                         |
| ------------------ | -------------------- | -------- | ------------------------------------------------------------------------------------------ |
| N01、N02           | 成功                 | U、D     | 所有者、全 29 列、seller_id、同一 t、作成・削除・返却 ID                                   |
| N03                | 成功                 | U、D     | nullable 列と空 JSON を保持                                                                |
| N04                | 成功                 | U、D     | 空文字・空配列を保持                                                                       |
| N05                | 成功                 | U、D     | 0/false/recommend=null を保持                                                              |
| N06                | 成功                 | U、D     | 全項目・キーなし・配列内 optional なし、JSON と配列順を保持                                |
| N07                | 成功                 | U、D     | gender/age 全定義値、video_status=null/文字列を保持                                        |
| N08                | 成功                 | D        | 商品・ブランド参照あり/片方/両方 null、参照先不変                                          |
| N09                | 成功                 | D        | 新規日時・新規行、元日時をコピーしない                                                     |
| B01                | 成功                 | U、D     | 各 STRING 列 0/254/255 文字                                                                |
| B02                | 成功                 | U、D     | 画像 null/0/1/10 件と元 first_image_url                                                    |
| B03                | 成功                 | U、D     | 各 TEXT 列の空文字・日本語長文                                                             |
| E01                | 成功                 | U、D     | 不存在 404、作成/削除なし、DB 不変                                                         |
| E02                | 成功                 | S、D     | 他人所有 404、所有者 where、DB 不変                                                        |
| E03                | 成功                 | U        | transaction 開始失敗で 3service 未実行                                                     |
| E04、E05、E06      | 成功                 | U、S、DT | 取得/作成/削除失敗の伝播と停止、DB rollback                                                |
| E07                | 成功                 | DT       | 各 STRING 列 256 文字で DatabaseError・PostgreSQL 22001、削除なし                          |
| E08                | 一部実施             | DT       | 画像 11 件の ValidationError・image_url のエラー・rollback 成功。S は RV03                 |
| E09                | 成功（模擬）         | U        | callback 後の例外伝播のみ。実 commit 障害は対象外                                          |
| V01                | 成功                 | V、R     | ID=1/2/11 を変換せず渡す                                                                   |
| V02、V03           | 成功                 | V、R     | 0/負数/小数/文字列/空/null/boolean/配列/object/欠落を拒否                                  |
| V04                | 成功                 | V        | body 不正、JSON 外の NaN/±Infinity を拒否                                                  |
| V05、V06           | 成功                 | V、C/R   | 未知キー除去、validatedBody 設定、失敗時 throw と next 未実行                              |
| O01                | 成功（観測）         | V        | 2147483646/2147483647/2147483648 を schema が受理。業務上限は保留                          |
| S01、S02           | 成功                 | S        | id ＋ seller_id、30 取得列、同じ t・UPDATE ロック、結果参照                                |
| S03、S04           | 成功                 | S        | data/t/削除インスタンスを保持し、create/destroy 完了を待つ                                 |
| S05                | 成功                 | S        | findOne/create/destroy それぞれの元例外と保留                                              |
| ST01、ST02         | 成功                 | D、DT    | 成功時移行、失敗時全列保持・途中編集なし                                                   |
| ST03               | 成功                 | D        | HTTP の認証/入力/制限拒否は transaction0 回。認可 404 も DB 不変                           |
| ST04               | 成功                 | D        | 成功後再送 404、追加生成・成功行変更なし                                                   |
| ST05               | 成功                 | DT       | 失敗後の同入力再試行成功、失敗回の残存なし                                                 |
| ST06               | 成功（通常経路）     | D、DT    | 別下書き・既存編集・Item・マスター等の全列不変。並行時は RV01                              |
| T01、T02           | 成功                 | U、S     | 同一 t をモデル操作まで渡し、各段階と transaction 完了を await                             |
| T03、T04           | 成功                 | DT       | 実 INSERT 後/実 DELETE 後の throw を含め、別接続で rollback 確認                           |
| T05                | 成功                 | DT       | commit 前：編集なし/下書きあり、commit 後：編集あり/下書きなし                             |
| T06、T07           | 成功                 | DT       | rollback 後 NOWAIT 取得可能、障害解除後再試行成功                                          |
| P01                | 一部実施             | DC       | 実ロック待機 → 先行 commit→ 後続 404、編集 1 件は成功。RV01/RV02 が残る                    |
| P02                | 一部実施             | DC       | 実 INSERT→ 先行 rollback→ 後続成功、先行編集なし。RV01 が残る                              |
| P03、P04           | 一部実施             | DC       | 更新 commit 後の最新コピー/削除 commit 後 404 は成功。RV01 が残る                          |
| P05、P06           | 一部実施             | DC       | usecase 先行後、後続 UPDATE/DELETE の影響行数 0、rollback 時 DELETE1 行は成功。RV01 が残る |
| P07、P08           | 一部実施             | DC       | 変更 rollback 後の元値コピー/所有者変更 commit 後 404 は成功。RV01 が残る                  |
| P09                | 一部実施             | DC       | 別接続・別所有者で片方保留中に他方 commit、混在なしは成功。非対象行は RV01                 |
| C01、C02、C03、C04 | 成功                 | C、R     | 認証 ID・validatedBody 採用、201 と ID、同じ例外 next、完了待ち                            |
| R01、R02、R03      | 成功                 | R        | 未認証等 401、正常 201、不正 ID400、未認証は枠消費なし                                     |
| R04、R05、R06、R07 | 成功                 | R        | ユーザー別 5/6 回、不正入力加算、599999/600000/600001ms、401/429 優先                      |
| R08                | 成功（観測 handler） | R        | 同じ AppError/通常 Error が観測 handler へ到達。本番 handler は下記 PR01                   |

## 4. DB 環境・実行履歴

読込元は `server/.env.test`、DB 名は設定・実接続ともに `test_db`。アプリ、モデル index、observer、competitor の全 4 接続を検査した。別 env 読込み・接続設定差替え・DB 名不一致は発生していない。スキーマの列・nullable・文字数・ENUM・FK がガードを通過し、並行テストの分離レベルは READ COMMITTED だった。

実 DB では対象 usecase/service/モデルを使用した。対象に S3 通信はなく、HTTP 結合時だけ同 controller が import する対象外 usecase をモックした。DB 障害は service 境界の throw、文字数超過は実 SQL、画像超過は実モデル validation である。実 commit 障害や全更新・削除 API の結合は検証していない。

並行処理は `pg_backend_pid()`・`pg_blocking_pids()` で独立接続と実待機を確認してから gate を解放した。上表の順序で commit/rollback・再取得が成立した。全ケースで作成 ID に限定した後片付けと残存 0 件の assert が通り、接続終了も失敗なし。migration・sync・truncate は実行せず、シーケンス値は戻していない。

初回はサンドボックスが DB 接続と HTTP 待受けを EPERM で拒否した。102 成功・27 失敗・77skip・未処理例外 27 件（DB3suite の setup 失敗）。DB の 77 件は本体未実行で、DB 書込み前に停止した。通信を許可した再実行が上記 206 成功であり、初回を製品ロジックの失敗と扱わない。

実行ディレクトリは `server/`。

```bash
npm run test:run -- test/usecases/itemEditing/createItemEditingDraft/ --maxWorkers=1 --reporter=default --reporter=json --outputFile.json=/tmp/createItemEditingDraft-test-results-escalated.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

`--maxWorkers=1` はファイル間の fixture・hook・ストア干渉を抑えるため。ケース内の競合は独立 transaction で別に再現している。

| 検査                            | 結果                                                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 対象 Vitest                     | 8 ファイル・206 件成功                                                                                                                                                                  |
| npm run lint                    | 成功。ただし現行設定は src の TS のみを対象とする                                                                                                                                       |
| npm run typecheck               | 成功（本番コード）                                                                                                                                                                      |
| test/tsconfig.json の全体型検査 | 失敗。対象外 shopSignup/signup1.test.ts:33・signup5.test.ts:27 の参照先なし（既知の 2 件）                                                                                              |
| 対象 11 ファイルの型検査        | TypeScript API で同 tsconfig のオプションを適用し、対象 TS を rootNames に指定。診断 0 件                                                                                               |
| 対象 11 ファイルの追加 lint     | ESLint Node API で overrideConfigFile=true、当ディレクトリの TS へ@eslint/js・typescript-eslint の recommended を適用（no-explicit-any は既存設定と同じ off）。エラー 2・警告 0（RV04） |

## 5. 本番コードの確認事項

**PR01：共通 errorHandler が Express のエラー middleware として呼ばれない。** `src/middleware/errorHandler.ts` は 3 引数で、app.ts がそのまま app.use へ登録している。Express 4 の実 Layer に AppError を渡す補助確認で、`handlerArguments=3`、`forwardedWithoutHandling=true`、`responseSent=false` となった。HTTP を起動せず、実登録 Layer の handle_error を直接呼んだ結果である。

したがって R08 成功から本番の 404/500 の JSON 形式まで保証できない。本 usecase のコピー・削除ロジックには今回のテストで矛盾を検出していない。PR01・RV01〜RV04 と既知の型検査エラーは未修正で、範囲外のコードや Todo も変更していない。

---

<a id="follow-up"></a>

# 下書きから商品編集セッション作成：修正案

## 1. 対象と判断

[初回テスト報告](#initial-report) のレビュー・実行結果に基づく提案。対象 206 件は成功したが、本番共通エラー処理、設計に対する検証不足、追加 lint に修正が必要である。**本書は修正案のみで、本番コード・テストの修正や修正後の再実行は行っていない。**

パスは `server/` 基準。下書きコピー・取得 where・行ロック・同一 transaction・削除の業務処理は維持する。入力 ID 上限の決定、他機能の import エラー、スキーマ変更は対象外。

## 2. 本番コードの修正案

### F1（P0）：共通 errorHandler を 4 引数で登録する

根拠は PR01・R08。現行 handler が 3 引数なので、Express 4 はエラー処理時にスキップする。Router テストは別の 4 引数 handler を使うため、この問題を検出できなかった。

対象は `src/middleware/errorHandler.ts`。`ErrorRequestHandler` 型で `(err, req, res, next)` の 4 引数を明示し、既存の AppError と通常 Error の JSON 形式・status を保持する。利用しない引数も lint に適合する形で明示的に扱い、引数の削除・デフォルト引数化・rest 引数化で関数 length を減らさない。

修正後は、本 Router が渡す INVALID_BODY/400・ITEM_DRAFT_NOT_FOUND/404 と、通常 Error/500 が共通 handler から返る。201 応答、認証 middleware 自身の 401、レート middleware 自身の 429、DB の原子性は変更しない。

対象 usecase/service/model に、本テスト結果を理由とした追加修正は提案しない。

## 3. テストコードの修正案

### F2（P1）：実共通 handler の接続テストを追加する

対象は `test/usecases/itemEditing/createItemEditingDraft/route.test.ts`。既存 R08 の観測 handler テストは維持し、実 Router ＋実共通 errorHandler の最小アプリを別に組む。usecase だけをモックして AppError/通常 Error を返し、status に加えて既存 JSON 形式を完全一致で確認する。DB や app 全体の起動は不要。

修正前は共通 handler の登録 Layer がエラーを処理せず次へ渡る。修正後はエラー JSON を返し、正常 201 には影響しないことを確認する。

### F3（P1）：非対象行・要求識別・service 境界を補う

根拠は RV01〜RV03。対象は同ディレクトリの `databaseConcurrency.test.ts`、`databaseFixtures.ts`、`services.test.ts`。

- P01〜P08 で別下書き・既存編集・Item・参照先の事前 snapshot を取り、並行処理後に全列一致を確認する。P09 では B の下書きが操作対象になるため、それを保護対象から除き、残る非対象行を比較する。
- P01 は A/B ごとの開始・取得・transaction・完了結果を記録する。A 先行/B 先行それぞれで、指定した要求が成功し他方が 404 になることを assert する。入力は同一のまま、ラベルの入替えだけで逆順確認済みとしない。
- E08 の S ケースでは画像 11 件の配列を service へ渡し、モデル create への同じ data/t の引渡しと、モデル側の ValidationError の同一参照での伝播を確認する。拒否そのものの保証は既存 D テストに置く。

### F4（P1）：4 引数を維持して追加 lint を通す

根拠は RV04。対象は `route.test.ts:31` と `database.test.ts:90` の観測用 handler。`_next` を削除せず、例えば `void _next;` で未使用が意図的であることを示す。テストに必要な 4 引数の関数 length と既存観測結果を維持し、共有 ESLint 設定は変更しない。

## 4. 追加・移行するケース

| 追加 ID | 元 ID・根拠         | レベル | 入力・手順                                                | 修正後の期待結果                                                         |
| ------- | ------------------- | ------ | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| AF-R01  | V02/V03・PR01       | R      | 正常認証＋不正 ID、実共通 handler を接続                  | 400、`{ code: "INVALID_BODY", message: "INVALID_BODY" }`、usecase 未実行 |
| AF-R02  | E01/E02/R08・PR01   | R      | usecase が ITEM_DRAFT_NOT_FOUND/404 を返す                | 共通 handler から 404 と code/message の JSON、201 なし                  |
| AF-R03  | E04〜E06/R08・PR01  | R      | usecase が通常 Error を返す                               | 500、既存の error/message の JSON。内部 Error の詳細なし                 |
| AF-R04  | C02/R02             | R      | F1 後に正常要求                                           | 201・`{ itemEditingId }` を維持                                          |
| AF-DB01 | P01〜P08/ST06・RV01 | D      | 既存の各競合を実行し非対象 snapshot も比較                | commit/rollback 後も非対象行全列不変                                     |
| AF-DB02 | P09/ST06・RV01      | D      | 別所有者・別下書きの成功を交差                            | 対象 2 行は移行、対象外下書き・既存編集・参照先は不変                    |
| AF-DB03 | P01・RV02           | D      | A 先行/B 先行を要求別 trace で独立展開                    | 指定した先行要求だけ成功、後続 404、編集 1 行、実ロック待機あり          |
| AF-S01  | E08・RV03           | S      | モデル create に ValidationError を設定し画像 11 件を渡す | 同じ配列/data/t を引き渡し、同じ例外を伝播。DB 拒否は既存 E08 で別確認   |
| AF-R05  | R08/ST03・RV04      | R/D    | 未使用引数を明示した 4 引数 handler で既存要求を再実行    | 既存結果と関数 length=4 を維持し、追加 lint エラー 0                     |

既存 206 件は原則維持する。P01 は手順と assert を補強し、P01〜P09 は非対象行 assert を追加する。E08 の D 検証・R08 の観測用 handler の期待値は変更しない。初回の通信制限を理由に skip 化や期待値変更を行わない。

## 5. 修正後の確認と完了条件

F1/F2 → F3/F4 の順に実施する。対象 Vitest、npm run lint、npm run typecheck、テスト TS の型検査と追加 lint を再実行する。DB 検査は引き続き `.env.test`・test_db の全接続ガードを通し、別接続の結果と後片付けを確認する。

完了条件は、共通 handler の 400/404/500 と正常 201、要求別の競合結果、並行後の非対象行不変、E08 の S/D 責務、追加 lint 成功が確認できること。ケース ID・追加テスト・実行件数の対応を報告し、対象外の既知 import エラーを全体成功へ混ぜない。未確定の ID 上限と実 commit 障害の検証は引き続き保留／対象外とする。

## 6. 追加修正レポート（2026-10-13）

### 6.1 結果と今回の範囲

修正済みの対象 8 テストファイルを実行し、通信を許可した最終実行で**220 件すべて成功**した。失敗・skip・todo・未処理例外は 0 件。DB 非接続 143 件、実 DB77 件である。対象 11 個の TypeScript ファイルの型検査と追加 lint も成功した。テスト全体の型検査は、対象外の既知 import エラー 2 件により失敗しており、全体成功とは扱わない。

1〜5 節は修正前の提案として保存する。本節が F1〜F4 の修正後の検証結果であり、[初回テスト報告](#initial-report) の初回判定を更新する。今回の編集は本ファイルへの追記のみ。本番コード・テストコード・共有設定の追加修正は行っていない。

検証した修正済みコードは以下のとおり。

- F1：`src/middleware/errorHandler.ts` に実装済みの `ErrorRequestHandler` 型と 4 引数を、実 Router の HTTP 経路で検証した。
- F2：`route.test.ts` の別 Express アプリに実共通 handler を接続し、400・404・500 の JSON 完全一致と正常 201 を確認した。既存 R08 の観測 handler テストも維持した。
- F3：`databaseConcurrency.test.ts` と `databaseFixtures.ts` で P01〜P09 の非対象行比較を追加した。P01 は AsyncLocalStorage で要求名を保持し、開始・取得・transaction・完了結果を要求別に確認した。`services.test.ts` には画像 11 件の同一参照での引渡しと ValidationError 伝播を追加した。
- F4：`route.test.ts` と `database.test.ts` の観測 handler で未使用引数を `void` で扱い、`length === 4` を確認した。共有 ESLint 設定は変更していない。

### 6.2 ファイル別件数と追加・移行ケース

件数は `/tmp/createItemEditingDraft-afterFix-results-escalated.json` の Vitest JSON 結果から集計した。各ファイルの失敗・skip・todo はすべて 0 件。

| ファイル                     | 初回件数 | 今回成功 | 変更内容                                                              |
| ---------------------------- | -------: | -------: | --------------------------------------------------------------------- |
| usecase.test.ts              |       55 |       55 | 既存回帰を維持                                                        |
| services.test.ts             |       10 |       11 | AF-S01 を 1 件追加                                                    |
| validation.test.ts           |       33 |       33 | 既存回帰を維持                                                        |
| controller.test.ts           |        4 |        4 | 既存回帰を維持                                                        |
| route.test.ts                |       27 |       40 | AF-R01 を 10 条件、AF-R02〜04 を各 1 件追加。R08 に AF-R05 を対応付け |
| database.test.ts             |       54 |       54 | ST03 の 3 条件に AF-R05 を対応付け                                    |
| databaseTransactions.test.ts |       11 |       11 | E08 の実モデル拒否・rollback を含む既存回帰を維持                     |
| databaseConcurrency.test.ts  |       12 |       12 | P01〜P09 の既存 12 件を補強                                           |
| **合計**                     |  **206** |  **220** | **既存 206 件を維持し、14 件追加**                                    |

追加 ID はテストの観点を表す。既存ケースに複数 ID を付けた箇所は件数を重複計上しない。

| 追加 ID／元 ID          | 対応ファイル・展開件数                                | 判定と確認内容                                                                                                  |
| ----------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| AF-R01／V02・V03        | route.test.ts・10 件追加                              | 成功。不正 ID は 400、code/message 完全一致、usecase 未実行                                                     |
| AF-R02／E01・E02・R08   | route.test.ts・1 件追加                               | 成功。ITEM_DRAFT_NOT_FOUND は共通 handler から 404 と code/message を返す                                       |
| AF-R03／E04〜E06・R08   | route.test.ts・1 件追加                               | 成功。通常 Error は 500 と既存 error/message のみを返し、内部詳細を含まない                                     |
| AF-R04／C02・R02        | route.test.ts・1 件追加                               | 成功。正常 201 と `{ itemEditingId: 456 }`、認証所有者・検証済み ID の引渡しを維持                              |
| AF-DB01／P01〜P08・ST06 | databaseConcurrency.test.ts・既存 11 件               | 成功。commit/rollback 後も別下書き・既存編集・Item・参照先・所有者の全列が事前 snapshot と一致                  |
| AF-DB02／P09・ST06      | databaseConcurrency.test.ts・既存 1 件                | 成功。操作対象の B 下書きだけを保護対象から除き、残る非対象行の全列一致を確認                                   |
| AF-DB03／P01            | databaseConcurrency.test.ts・既存 2 件                | 成功。A 先行は A 成功/B404、B 先行は B 成功/A404。要求別 trace、独立 transaction、実ロック待機、編集 1 行を確認 |
| AF-S01／E08             | services.test.ts・1 件追加                            | 成功。11 件の同じ配列・data・transaction をモデル create へ渡し、設定した ValidationError を同じ参照で伝播      |
| AF-R05／R08・ST03       | route.test.ts・既存 2 件、database.test.ts・既存 3 件 | 成功。観測 handler の 4 引数、例外参照、HTTP 拒否時の DB 不変を維持。追加 lint もエラー 0                       |

初回の RV01〜RV04 は上表で補完できた。E08 は S/D の双方を確認済み、P01〜P09 は競合と非対象行不変を確認済みとなる。PR01 は実共通 handler 経由の 400・404・500 と正常 201 を確認済みとなる。

### 6.3 実処理・モック・並行処理・DB 後片付け

Router 検証は実 Router・controller・認証・validator・レート制限・共通 handler を使用し、usecase をモックした最小アプリで行った。アプリ全体は起動していない。AF-S01 は実 service とモデル create のモックによる境界検証であり、件数拒否そのものは既存 E08 の実モデル validation で確認した。これを DB 制約による拒否とは扱わない。

DB 読込元は `server/.env.test`。アプリ・モデル初期化・observer・competitor の全 4 接続について、接続前の設定 DB 名と接続後の `SELECT current_database()` が `test_db` であることを既存ガードで確認した。別 env 読込み、接続設定差替え、DB 名不一致は発生していない。既存の列・nullable・型・ENUM・FK 検査、および並行処理の READ COMMITTED 検査も通過した。

実 DB では対象 usecase・service・モデルを使用した。HTTP 結合で読み込まれる対象外 usecase は引き続きモックし、外部通信を実行していない。rollback 検証の障害注入、gate による取得待機制御、文字数超過の実 SQL 拒否、画像超過の実モデル拒否の責務は従来どおり維持した。

P01 は同一入力の A/B を非同期コンテキストで識別し、先行取得・後続ロック待機を確認後に先行を解放した。先行 commit 後に後続の取得結果が null となり、後続解放後に 404 で完了すること、作成・削除が先行 transaction だけで行われることを確認した。A→B/B→A の両展開で、指定した要求名と開始・取得・完了結果が一致した。

P02〜P08 は INSERT 後 rollback、更新・削除・所有者変更の commit/rollback、usecase 先行時の後続再評価を検証した。P09 は A がロックを保持したまま B を commit し、その後 A を commit して、対象 2 行の移行と値の混在がないことを確認した。ロック待機は `pg_blocking_pids()` で確認し、保存結果と非対象行は observer の新規 SELECT で比較した。

全 DB ケースで、保留 Promise・transaction の回収、作成 ID だけを対象にした後片付け、残存 0 件の assert が成功した。接続終了・hook 解除もエラーなし。migration・sync・truncate は実行せず、シーケンスを戻していない。

### 6.4 実行履歴と静的検査

実行ディレクトリは `server/`。`--maxWorkers=1` はファイル間の fixture・hook・ストアの干渉を抑えるためであり、ケース内の並行処理は独立 transaction で別途実行している。

```bash
npm run test:run -- test/usecases/itemEditing/createItemEditingDraft/ --maxWorkers=1 --reporter=default --reporter=json --outputFile.json=/tmp/createItemEditingDraft-afterFix-results.json
# 通信を許可して同じ接続ガードで再実行
npm run test:run -- test/usecases/itemEditing/createItemEditingDraft/ --maxWorkers=1 --reporter=default --reporter=json --outputFile.json=/tmp/createItemEditingDraft-afterFix-results-escalated.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

初回はサンドボックスが DB 接続と Supertest の HTTP 待受けを EPERM で拒否した。103 件成功・40 件失敗・77 件 skip・未処理例外 40 件。DB3suite の 77 件は接続時の setup 失敗による本体未実行で、fixture 書込み前に停止した。これは対象ロジックの失敗と区別する。通信を許可して設定・ガード・期待値を変更せず再実行した結果が、上記 220 件成功である。

| 検査                            | 結果と対象                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| 対象 Vitest                     | 成功。8 ファイル・220 件、失敗/skip/todo/未処理例外 0                                        |
| npm run lint                    | 成功。現行設定の recommended ルールは src の TS を対象とし、テスト TS の検証は下記で別に実施 |
| npm run typecheck               | 成功。本番コードの型検査                                                                     |
| test/tsconfig.json の全体型検査 | 失敗。shopSignup/signup1.test.ts:33、signup5.test.ts:27 の既知 TS2307 のみ                   |
| 対象 11 ファイルの型検査        | 成功。同 test/tsconfig のオプションと対象 TS の rootNames で診断 0 件                        |
| 対象 11 ファイルの追加 lint     | 成功。recommended ルールを明示的に適用し、エラー 0・警告 0                                   |

対象 TS への追加検査は、次の Node API による方法で実施した。共有設定を編集せず、DB やテスト本体も起動しない。

```bash
node --input-type=module <<'JS'
import { ESLint } from 'eslint';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import ts from 'typescript';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const target = 'test/usecases/itemEditing/createItemEditingDraft';
const files = readdirSync(target).filter(name => name.endsWith('.ts')).map(name => `${target}/${name}`);
const runner = new ESLint({ overrideConfigFile: true, overrideConfig: tseslint.config({ files: [`${target}/**/*.ts`], extends: [eslint.configs.recommended, ...tseslint.configs.recommended], rules: { '@typescript-eslint/no-explicit-any': 'off' } }) });
const results = await runner.lintFiles(files);
console.log('Additional lint:', files.length, 'files');
console.log(await (await runner.loadFormatter('stylish')).format(results));
console.log(JSON.stringify({errors: results.reduce((n,r) => n+r.errorCount,0), warnings: results.reduce((n,r)=>n+r.warningCount,0)}));
const config = ts.readConfigFile('test/tsconfig.json', ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve('test'));
const program = ts.createProgram(files.map(file => resolve(file)), parsed.options);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
console.log('Target typecheck:', files.length, 'root files,', diagnostics.length, 'diagnostics');
if (diagnostics.length) console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, {getCanonicalFileName: f=>f, getCurrentDirectory:()=>process.cwd(), getNewLine:()=> '\n'}));
process.exitCode = diagnostics.length || results.some(r=>r.errorCount) ? 1 : 0;
JS
```

### 6.5 完了範囲と未確認事項

F1〜F4 および AF-R01〜05・AF-DB01〜03・AF-S01 の必須確認は完了した。今回の検証範囲で本番ロジックと期待契約の不一致、修正したテストのロジック誤りは検出していない。

入力 ID 上限の決定、実 commit 障害、対象外機能の import 修復は引き続き対象外。カバレッジは取得していない。対象外の既知型エラーが残るため、リポジトリ全体の検査完了を意味しない。

## 7. 追加修正レポート後の再修正案の判断

対象テストは通信許可後に全件成功し、対象の追加 lint・型検査も成功したため、今回の対象コードへの再修正案は追加しない。初回 EPERM は実行環境の制限であり、skip 化・期待値変更・接続ガード緩和の根拠にはしない。

全体型検査に残る 2 件は初回レポートで記録済みの対象外 import エラーである。今回の変更によるエラーとして扱わず、対象外コードや Todo の編集、修正範囲の拡大は行っていない。
