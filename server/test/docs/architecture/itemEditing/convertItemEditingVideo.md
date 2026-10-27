# convertItemEditingVideo テスト設計

設計日: 2026-10-22。[詳細設計](../../../../../docs/design/backend/detail/itemEditing/convertItemEditingVideo.md)とユーザー回答を根拠とする。
対象はPATCH /api/item-editing/:id/convert。以下のパスはserver/基準。実行結果は[レポート](../../../docs/report/itemEditing/convertItemEditingVideo.md)へ記載する。
既存旧Video APIは契約を維持する。成功converted、失敗failed/URL null/duration保持、新要求で旧処理を中断し、公開HTTPすべて202。

## 配置・境界

| レベル         | 配置                                                                           | 実処理とモック境界                                               |
| -------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| usecase単体    | src/usecases/itemEditing/test/convertItemEditingVideo.test.ts                  | 実usecase・要求管理、DB transaction/serviceと変換utilityをモック |
| utility単体    | src/utils/test/itemEditingVideoConversion.test.ts                              | 実utility、spawn/fs/S3/cleanupを境界モック                       |
| S3単体         | src/utils/s3/test/itemEditingVideoConversion.test.ts                           | 実S3 utility、SDK・streamを境界制御                              |
| service単体    | src/services/itemEditing/test/convertItemEditingVideo.test.ts                  | 実service、Modelインスタンス境界                                 |
| controller単体 | src/controllers/itemEditing/test/convertItemEditingVideo.test.ts               | 実controller・runDetachedTask、usecase境界                       |
| middleware単体 | src/middleware/test/itemEditingVideoResponse.test.ts                           | 実202境界、部分req/res                                           |
| HTTP接続       | test/integration/usecases/itemEditing/convertItemEditingVideo/http.test.ts     | 実Router・JWT・limiter・parser・errorHandler、usecase境界        |
| 実DB           | test/integration/database/itemEditing/convertItemEditingVideo/database.test.ts | 実Model/query/command/PostgreSQL、外部通信なし                   |
| usecaseと実DB  | test/integration/usecases/itemEditing/convertItemEditingVideo/database.test.ts | 実usecase・service・transaction、変換utility境界のみモック       |

実DBでは専用fixture/setupを使用し、.env.test由来・全接続test_db・必要スキーマ確認後に自作IDだけseed/cleanupする。
単体のModel代用やtransaction callback成功を実SQL・commit・rollback・ロック保証と扱わない。
deferredの開始通知と解放gateを分離し、全処理をfinallyで回収する。固定sleepで待機を判定しない。
ケースIDは下表の観点単位で、it.each展開後の件数とは異なる。基本契約・認可・中断はP0、他はP1。

## usecaseケース

| ID  | 前提・手順                                                      | 期待結果                                                             |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| U01 | original/processing/converted/failed/null、正常元動画・変換結果 | processing→converted、同一transaction引渡し、元URL維持、null保存なし |
| U02 | 所有者限定検索null（他人・不存在相当）                          | 404と後続未実行                                                      |
| U03 | 元動画null/空文字                                               | 400、更新・変換なし                                                  |
| U04 | 変換utility失敗                                                 | 同じ元動画を再取得してfailed/URL null、duration更新なし、元例外伝播  |
| U05 | 最終取得でoriginal_url変更                                      | 内部中断409、成功/failed更新なし                                     |
| U06 | 最終取得で行削除・所有者変更相当null                            | 保存なし、内部エラー、他人・削除行復元なし                           |
| U07 | 変換失敗と失敗記録失敗                                          | AggregateErrorに両方の原因保持                                       |
| U08 | 開始時update/transaction失敗                                    | 変換・追加更新なし、元例外                                           |
| U09 | 成功保存の障害                                                  | 失敗状態の記録と元例外伝播                                           |
| U10 | 開始transaction外側を保留                                       | commit完了まで変換なし                                               |
| U11 | 完了transaction外側を保留                                       | commit完了までusecase未完了                                          |
| U12 | 旧変換を保留して新要求、旧終了もgateで保留                      | 旧signal中断、旧回収前に新変換なし、旧からfailed保存なし             |
| U13 | 旧終了待ちの間に3要求到達                                       | 中間要求は変換せず最後だけ開始                                       |
| U14 | 別ID・別所有者で並行要求                                        | signal・結果独立、他人のIDで所有者ジョブを中断不可                   |
| U15 | 同じIDで逐次2回・失敗後再送                                     | 各回再変換、登録リークなし                                           |
| U16 | UPDATE待機中に新要求                                            | 更新後abortを検出し旧callback失敗、旧完了後新要求開始                |
| U17 | 元URL変更後に通常失敗                                           | 古い処理からfailed保存なし                                           |
| U18 | 中断とutility cleanup障害の重複                                 | 両原因保持、旧failed書込みなし                                       |

## HTTP・controllerケース

| ID      | 前提・入力・手順                               | 期待結果                                    |
| ------- | ---------------------------------------------- | ------------------------------------------- |
| C01     | raw params/body/query偽装と正常validatedParams | 認証ID・検証済みidのみ採用、202本文完全一致 |
| C02     | usecase保留                                    | HTTP応答は待たず202、テスト終了前に回収     |
| C03     | usecase AppError/一般例外/同期throw            | 共通境界で捕捉しHTTP再応答なし              |
| C04     | 応答送信失敗                                   | nextへ元例外、usecase二重実行なし           |
| M01/M02 | 対象/対象外method/path、内部status・headers    | 対象のみ公開202、内部status保持             |
| H01     | 正常と所有者偽装                               | 正常202、認証ID利用                         |
| H02     | JWTなし/空/不正/期限切れ                       | 202拒否、usecaseなし                        |
| H03     | ID上下限付近・範囲外・小数・文字               | schema契約、拒否は202・usecaseなし          |
| H04     | 不正JSON/primitiveとJWT不備                    | parser優先、202・認証/変換なし              |
| H05     | 5回・6回                                       | 5回受付、6回202拒否とRetry-After            |
| H06     | ユーザー/対象ID/IP/token変更                   | ユーザー枠、専用枠の独立                    |
| H07     | 10分窓直前/一致/直後                           | 期限まで拒否、窓終了後再開                  |
| H08     | params拒否・業務失敗                           | 到達分を消費                                |
| H09     | 未認証・parser拒否                             | limiter非消費                               |
| H10     | 他API・末尾slash・大小文字                     | 対象だけ202、他APIは従来status              |
| H11     | 実appのparser前接続（cron等モック）            | 本番接続順との一致                          |
| H12     | 未知例外                                       | HTTP202、内部詳細非公開                     |

## utility・service・実DB

utility担当が実装前に通知したV01〜V13/A01〜A06の個別条件と、以下を対応させる。
正常HLS・URL・整数秒数、0/小数/非数/範囲外、playlist/segment不足、音声optional指定、
download/probe/spawn/error/非0/timeout/upload/cleanup障害、abort後close前のcleanup抑止、
全listener/timer解除、対象外ファイル保持、主原因とcleanup原因保持を検証する。
S3はsignalあり/なしのSDK optionsとpipeline、stream終了、元例外伝播を確認する。

| ID       | 条件と期待結果                                                                |
| -------- | ----------------------------------------------------------------------------- |
| V01      | 正常URL・秒数切捨・MIME・segment→playlist順、要求UUIDの一時パスだけcleanup    |
| V02/V03  | 秒数0/上限/空/負/非数/無限/超過、元URL不備。許容値だけ成功し他は後続停止      |
| V04/V05  | playlist/segment欠落、download失敗。uploadなし、cleanupと原因伝播             |
| V06/V07  | spawn error→close、各process非0終了。close前cleanupなし、終了後失敗           |
| V08/V09  | 両process timeout/abort。kill→closeを回収してからcleanup                      |
| V10      | download/probe/upload境界のabortとupload障害。後続ファイルを送信しない        |
| V11/V12  | cleanup単独/主原因重複、timer/listener解除。元原因保持と解放                  |
| V13      | mkdir/readdir等I/O障害。自作パスcleanupを試行し原因を保持                     |
| A01〜A03 | download signal有無のSDK/pipeline options、Body型不正、SDK/pipeline元例外伝播 |
| A04/A05  | upload signal有無・MIME・Body、SDK失敗時もstream destroy→closeを待機          |
| A06      | abortとstream障害の競合2順序。SDKからの主原因を置換せずstreamを回収           |

service S01〜S04: processing/converted/failedのDTO完全一致、同一インスタンスとtransaction、完了待機、例外伝播。
実DB D01〜: 全接続ガード・スキーマ、3状態の保存・保持列、所有者条件、不存在、rollback、元URL差替えと実ロック待機。
実usecase DB I01〜: 正常・失敗値・他人・元動画なし、最終元URL差替え、重複要求の旧結果抑止、実transaction失敗時rollbackと再試行。

### 実UseCaseとDBの接続ケース（P0）

変換utilityのみをモックし、UseCase・service・Model・transactionは実処理を通す。
既存の3接続ガード・自作ID追跡・cleanup/close fixtureを再利用する。実UPDATE後の障害はModel hookで注入し、SQLとobserver可視性を検証する。

| ID  | 前提・手順                                                  | 期待結果・展開件数                                                           |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| I01 | original/processing/converted/failed/nullから実行・逐次再送 | processingのcommit後に変換、convertedだけ保存・保持列不変・signal別参照、5件 |
| I02 | 変換失敗、既存duration17/null、再試行                       | failed/URL null・duration保持、元例外、再試行成功、2件                       |
| I03 | 他人ユーザー/他人ID/所有者null/自作削除ID                   | 404、変換/更新なし、全行保持、4件                                            |
| I04 | 元URL null/空文字                                           | 400、processingも保存しない、2件                                             |
| I05 | 変換中に元URL差替え、旧変換成功/失敗                        | 旧converted/failedを保存しない、変更後行保持、2件                            |
| I06 | 旧変換終了gate中の新要求                                    | 旧signal中断・終了回収後だけ新要求、旧結果なし、1件                          |
| I07 | 旧終了待ちで3要求                                           | 中間の変換なし、最後だけ保存、1件                                            |
| I08 | 別IDと他人による同一ID要求                                  | 別ID独立、所有者のsignalは中断されない、1件                                  |
| I09 | processingの実UPDATE後にhook例外                            | transaction rollback・変換なし、再試行成功、1件                              |
| I10 | convertedの実UPDATE後にhook例外                             | 成功保存rollback→failed補償、元duration維持、再試行成功、1件                 |
| I11 | 変換中の所有者変更/削除                                     | 最終保存禁止、他人/削除行の更新・復元なし、2件                               |
| I12 | 完了UPDATE後に新要求でabort                                 | 旧callback rollback、新要求が結果保存、1件                                   |

JSONB変換・商品コピー・通知は対象処理がないため対象外。
実AWSのアップロード・配信、複数Node.jsプロセス間中断、永続ジョブ復旧は保証範囲外。
実COMMIT応答喪失は模擬rejectと区別し、必ずrollbackしたとの保証は行わない。

## 実行・完了条件

server/で対象パスを明示してnpm run test:run --を実行する。HTTPと実DBの実行権限不足は承認手順で対応する。
npm run lint、npm run typecheck、./node\*modules/.bin/tsc --noEmit -p test/tsconfig.jsonも実行する。
通常lint対象外のtest/\*\*/\_.tsは既存ESLint/typescript-eslintで追加検査し共有設定を変更しない。
必要ケース成功、未回収Promise/skip/未実行/失敗なし、DB cleanupとclose成功、文書整合を完了条件とする。

2026-10-22のユーザー指示に基づきUser日時2列のNOT NULL migrationを両DBへ適用後に再開済み。
D01〜D07の13件とI01〜I12の23件を実行し、全接続/必要スキーマガード・cleanup・closeを含め成功した。
名称統一後のDB非接続263件と静的検査も成功。履歴と最新結果は対応レポートを参照。
