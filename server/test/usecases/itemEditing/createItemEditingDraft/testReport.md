# 下書きから商品編集セッション作成：レビュー・テスト結果

## 1. 結果

2026-10-13に設計書と実装をレビューし、対象8テストファイルの**206件すべてが成功**した。失敗・skip・todo・未処理例外は最終実行で0件。DB非接続129件、実DB77件である。

主要なコピー・認可・削除・rollback・再試行・行ロックの契約を確認できた。ただし、設計に対する検証不足と追加lintエラーがあるため、設計全体の完了とはしない。本番の共通エラー処理にも問題を確認した。修正案は [afterFix.md](./afterFix.md) に記載し、今回は本番コード・テストコードを修正していない。追加したファイルは本報告書とafterFix.mdのみ。

| テストファイル               |    成功 | 失敗／skip／todo | 実処理と確認内容                                                                    |
| ---------------------------- | ------: | ---------------- | ----------------------------------------------------------------------------------- |
| usecase.test.ts              |      55 | 0／0／0          | 実usecase＋service/transactionモック。全コピー値、呼出順、await、例外伝播           |
| services.test.ts             |      10 | 0／0／0          | 実service＋モデル操作モック。所有者where、取得列、UPDATEロック指定、同じtransaction |
| validation.test.ts           |      33 | 0／0／0          | 実schema/validateBody。正整数、型不正、未知キー除去、上限未確定の観測               |
| controller.test.ts           |       4 | 0／0／0          | 実controller＋usecaseモック。検証済みID、201、next、完了待ち                        |
| route.test.ts                |      27 | 0／0／0          | 実Router/認証/制限/validator＋usecaseモック。401/400/201/429、5/6回、時間窓         |
| database.test.ts             |      54 | 0／0／0          | 実usecase/service/モデル/DB。コピー、所有権、再送、HTTP拒否時の不変                 |
| databaseTransactions.test.ts |      11 | 0／0／0          | 実DB＋障害注入。INSERT/DELETE後rollback、commit可視性、再試行、保存制約             |
| databaseConcurrency.test.ts  |      12 | 0／0／0          | 実DBの独立transaction。ロック待機、commit/rollback後の再評価、更新/削除競合         |
| **合計**                     | **206** | **0／0／0**      | 設計の67ケースIDとは別の、it.each展開後の件数                                       |

件数はVitestのJSON結果 `/tmp/createItemEditingDraft-test-results-escalated.json` から集計した。設計ケースは67個で、優先度のP0/P1/P2はケースIDに数えない（前回の70個という集計を訂正）。カバレッジは取得していない。

## 2. 設計とのレビュー

ファイル分割、fixture、29コピー列と認証seller_id、依存モック、実DBと単体の分離は設計に沿っている。異常系の後続未実行、deferredによる待機、別接続からの再取得も実装されている。

残る点は次のとおり。

- **RV01：並行処理後の非対象行確認が不足。** 設計11節は並行後も非対象行の再取得を求めるが、P01〜P09は主に競合対象だけをassertしている。ST06の通常成功・失敗では確認済みだが、並行中の非対象行まで保証できない。
- **RV02：P01の逆順は実質同じ手順。** A/Bは同じ `run(f)` で、観測結果にも要求名が残らない。先行/後続の直列化は検証できるが、「A→B/B→A」のラベルだけでは、異なる要求の識別と逆順を検証したことにならない。
- **RV03：E08のSレベルが未実装。** 画像11件の実モデル拒否・rollbackはDで確認できた。設計表のS/Dのうち、11件を渡したservice呼出し契約のSケースはない。
- **RV04：追加lintが2件失敗。** route.test.ts:31、database.test.ts:90のエラー観測middlewareで `_next` が未使用。Expressには4引数が必要なので、引数を削除する修正は不適切。

設計のID上限は未確定のまま。勝手にDBのINTEGER上限を入力仕様へ採用していない。R08は設計どおりテスト専用handlerによる観測であり、本番共通handlerの動作保証ではない。

## 3. 設計ケースごとの結果

略号：U=usecase、S=services、V=validation、C=controller、R=route、D=database、DT=databaseTransactions、DC=databaseConcurrency（いずれも `.test.ts`）。同じ結果・ファイルのIDはまとめた。以下は最終実行の判定であり、初回の環境エラーを含めない。

| 設計ID             | 判定                | ファイル | 確認内容／残る範囲                                                                 |
| ------------------ | ------------------- | -------- | ---------------------------------------------------------------------------------- |
| N01、N02           | 成功                | U、D     | 所有者、全29列、seller_id、同一t、作成・削除・返却ID                               |
| N03                | 成功                | U、D     | nullable列と空JSONを保持                                                           |
| N04                | 成功                | U、D     | 空文字・空配列を保持                                                               |
| N05                | 成功                | U、D     | 0/false/recommend=nullを保持                                                       |
| N06                | 成功                | U、D     | 全項目・キーなし・配列内optionalなし、JSONと配列順を保持                           |
| N07                | 成功                | U、D     | gender/age全定義値、video_status=null/文字列を保持                                 |
| N08                | 成功                | D        | 商品・ブランド参照あり/片方/両方null、参照先不変                                   |
| N09                | 成功                | D        | 新規日時・新規行、元日時をコピーしない                                             |
| B01                | 成功                | U、D     | 各STRING列0/254/255文字                                                            |
| B02                | 成功                | U、D     | 画像null/0/1/10件と元first_image_url                                               |
| B03                | 成功                | U、D     | 各TEXT列の空文字・日本語長文                                                       |
| E01                | 成功                | U、D     | 不存在404、作成/削除なし、DB不変                                                   |
| E02                | 成功                | S、D     | 他人所有404、所有者where、DB不変                                                   |
| E03                | 成功                | U        | transaction開始失敗で3service未実行                                                |
| E04、E05、E06      | 成功                | U、S、DT | 取得/作成/削除失敗の伝播と停止、DB rollback                                        |
| E07                | 成功                | DT       | 各STRING列256文字でDatabaseError・PostgreSQL 22001、削除なし                       |
| E08                | 一部実施            | DT       | 画像11件のValidationError・image_urlのエラー・rollback成功。SはRV03                |
| E09                | 成功（模擬）        | U        | callback後の例外伝播のみ。実commit障害は対象外                                     |
| V01                | 成功                | V、R     | ID=1/2/11を変換せず渡す                                                            |
| V02、V03           | 成功                | V、R     | 0/負数/小数/文字列/空/null/boolean/配列/object/欠落を拒否                          |
| V04                | 成功                | V        | body不正、JSON外のNaN/±Infinityを拒否                                              |
| V05、V06           | 成功                | V、C/R   | 未知キー除去、validatedBody設定、失敗時throwとnext未実行                           |
| O01                | 成功（観測）        | V        | 2147483646/2147483647/2147483648をschemaが受理。業務上限は保留                     |
| S01、S02           | 成功                | S        | id＋seller_id、30取得列、同じt・UPDATEロック、結果参照                             |
| S03、S04           | 成功                | S        | data/t/削除インスタンスを保持し、create/destroy完了を待つ                          |
| S05                | 成功                | S        | findOne/create/destroyそれぞれの元例外と保留                                       |
| ST01、ST02         | 成功                | D、DT    | 成功時移行、失敗時全列保持・途中編集なし                                           |
| ST03               | 成功                | D        | HTTPの認証/入力/制限拒否はtransaction0回。認可404もDB不変                          |
| ST04               | 成功                | D        | 成功後再送404、追加生成・成功行変更なし                                            |
| ST05               | 成功                | DT       | 失敗後の同入力再試行成功、失敗回の残存なし                                         |
| ST06               | 成功（通常経路）    | D、DT    | 別下書き・既存編集・Item・マスター等の全列不変。並行時はRV01                       |
| T01、T02           | 成功                | U、S     | 同一tをモデル操作まで渡し、各段階とtransaction完了をawait                          |
| T03、T04           | 成功                | DT       | 実INSERT後/実DELETE後のthrowを含め、別接続でrollback確認                           |
| T05                | 成功                | DT       | commit前：編集なし/下書きあり、commit後：編集あり/下書きなし                       |
| T06、T07           | 成功                | DT       | rollback後NOWAIT取得可能、障害解除後再試行成功                                     |
| P01                | 一部実施            | DC       | 実ロック待機→先行commit→後続404、編集1件は成功。RV01/RV02が残る                    |
| P02                | 一部実施            | DC       | 実INSERT→先行rollback→後続成功、先行編集なし。RV01が残る                           |
| P03、P04           | 一部実施            | DC       | 更新commit後の最新コピー/削除commit後404は成功。RV01が残る                         |
| P05、P06           | 一部実施            | DC       | usecase先行後、後続UPDATE/DELETEの影響行数0、rollback時DELETE1行は成功。RV01が残る |
| P07、P08           | 一部実施            | DC       | 変更rollback後の元値コピー/所有者変更commit後404は成功。RV01が残る                 |
| P09                | 一部実施            | DC       | 別接続・別所有者で片方保留中に他方commit、混在なしは成功。非対象行はRV01           |
| C01、C02、C03、C04 | 成功                | C、R     | 認証ID・validatedBody採用、201とID、同じ例外next、完了待ち                         |
| R01、R02、R03      | 成功                | R        | 未認証等401、正常201、不正ID400、未認証は枠消費なし                                |
| R04、R05、R06、R07 | 成功                | R        | ユーザー別5/6回、不正入力加算、599999/600000/600001ms、401/429優先                 |
| R08                | 成功（観測handler） | R        | 同じAppError/通常Errorが観測handlerへ到達。本番handlerは下記PR01                   |

## 4. DB環境・実行履歴

読込元は `server/.env.test`、DB名は設定・実接続ともに `test_db`。アプリ、モデルindex、observer、competitorの全4接続を検査した。別env読込み・接続設定差替え・DB名不一致は発生していない。スキーマの列・nullable・文字数・ENUM・FKがガードを通過し、並行テストの分離レベルはREAD COMMITTEDだった。

実DBでは対象usecase/service/モデルを使用した。対象にS3通信はなく、HTTP結合時だけ同controllerがimportする対象外usecaseをモックした。DB障害はservice境界のthrow、文字数超過は実SQL、画像超過は実モデルvalidationである。実commit障害や全更新・削除APIの結合は検証していない。

並行処理は `pg_backend_pid()`・`pg_blocking_pids()` で独立接続と実待機を確認してからgateを解放した。上表の順序でcommit/rollback・再取得が成立した。全ケースで作成IDに限定した後片付けと残存0件のassertが通り、接続終了も失敗なし。migration・sync・truncateは実行せず、シーケンス値は戻していない。

初回はサンドボックスがDB接続とHTTP待受けをEPERMで拒否した。102成功・27失敗・77skip・未処理例外27件（DB3suiteのsetup失敗）。DBの77件は本体未実行で、DB書込み前に停止した。通信を許可した再実行が上記206成功であり、初回を製品ロジックの失敗と扱わない。

実行ディレクトリは `server/`。

```bash
npm run test:run -- test/usecases/itemEditing/createItemEditingDraft/ --maxWorkers=1 --reporter=default --reporter=json --outputFile.json=/tmp/createItemEditingDraft-test-results-escalated.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

`--maxWorkers=1` はファイル間のfixture・hook・ストア干渉を抑えるため。ケース内の競合は独立transactionで別に再現している。

| 検査                           | 結果                                                                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 対象Vitest                     | 8ファイル・206件成功                                                                                                                                                         |
| npm run lint                   | 成功。ただし現行設定はsrcのTSのみを対象とする                                                                                                                                |
| npm run typecheck              | 成功（本番コード）                                                                                                                                                           |
| test/tsconfig.jsonの全体型検査 | 失敗。対象外shopSignup/signup1.test.ts:33・signup5.test.ts:27の参照先なし（既知の2件）                                                                                       |
| 対象11ファイルの型検査         | TypeScript APIで同tsconfigのオプションを適用し、対象TSをrootNamesに指定。診断0件                                                                                             |
| 対象11ファイルの追加lint       | ESLint Node APIでoverrideConfigFile=true、当ディレクトリのTSへ@eslint/js・typescript-eslintのrecommendedを適用（no-explicit-anyは既存設定と同じoff）。エラー2・警告0（RV04） |

## 5. 本番コードの確認事項

**PR01：共通errorHandlerがExpressのエラーmiddlewareとして呼ばれない。** `src/middleware/errorHandler.ts` は3引数で、app.tsがそのままapp.useへ登録している。Express 4の実LayerにAppErrorを渡す補助確認で、`handlerArguments=3`、`forwardedWithoutHandling=true`、`responseSent=false` となった。HTTPを起動せず、実登録Layerのhandle_errorを直接呼んだ結果である。

したがってR08成功から本番の404/500のJSON形式まで保証できない。本usecaseのコピー・削除ロジックには今回のテストで矛盾を検出していない。PR01・RV01〜RV04と既知の型検査エラーは未修正で、範囲外のコードやTodoも変更していない。
