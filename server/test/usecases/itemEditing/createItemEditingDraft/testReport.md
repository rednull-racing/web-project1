# 下書きから商品編集セッション作成：レビュー・テスト結果

## 1. 結果

2026-10-13 に設計書と実装をレビューし、対象 8 テストファイルの**206 件すべてが成功**した。失敗・skip・todo・未処理例外は最終実行で 0 件。DB 非接続 129 件、実 DB77 件である。

主要なコピー・認可・削除・rollback・再試行・行ロックの契約を確認できた。ただし、設計に対する検証不足と追加 lint エラーがあるため、設計全体の完了とはしない。本番の共通エラー処理にも問題を確認した。修正案は [afterFix.md](./afterFix.md) に記載し、今回は本番コード・テストコードを修正していない。追加したファイルは本報告書と afterFix.md のみ。

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
