# convertItemDraftVideo テスト設計

設計日: 2026-10-22。[詳細設計](../../../../../docs/design/backend/detail/itemDraft/convertItemDraftVideo.md)とユーザー回答を根拠とする。
対象はPATCH /api/item-draft/:id/convert。以下のパスはserver/基準。実行結果は[レポート](../../../docs/report/itemDraft/convertItemDraftVideo.md)へ記載する。
既存旧Video APIは契約を維持する。成功converted、失敗failed/URL null/duration保持、新要求で旧処理を中断し、公開HTTPすべて202。

## 配置・境界

| レベル           | 配置                                                                           | 実処理とモック境界                                               |
| ---------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| usecase単体      | src/usecases/itemDraft/test/convertItemDraftVideo.test.ts                      | 実usecase・要求管理、DB transaction/serviceと変換utilityをモック |
| 要求管理の独立性 | test/integration/usecases/itemDraft/convertItemDraftVideo/isolatedJobs.test.ts | 実Editing/Draft両usecase、DB/変換境界をモック                    |
| utility単体      | src/utils/test/itemDraftVideoConversion.test.ts                                | 実utility、spawn/fs/S3/cleanupを境界モック                       |
| S3単体           | src/utils/s3/test/itemEditingVideoConversion.test.ts                           | 共通S3 utilityの既存回帰、SDK・streamを境界制御                  |
| service単体      | src/services/itemDraft/test/convertItemDraftVideo.test.ts                      | 実service、Modelインスタンス境界                                 |
| controller単体   | src/controllers/itemDraft/test/convertItemDraftVideo.test.ts                   | 実controller・runDetachedTask、usecase境界                       |
| middleware単体   | src/middleware/test/itemDraftVideoResponse.test.ts                             | 実202境界、部分req/res                                           |
| HTTP接続         | test/integration/usecases/itemDraft/convertItemDraftVideo/http.test.ts         | 実Router・JWT・limiter・parser・errorHandler、usecase境界        |
| 実DB             | test/integration/database/itemDraft/convertItemDraftVideo/database.test.ts     | 実Model/query/command/PostgreSQL、外部通信なし                   |
| usecaseと実DB    | test/integration/usecases/itemDraft/convertItemDraftVideo/database.test.ts     | 実usecase・service・transaction、変換utility境界のみモック       |

実DBでは専用fixture/setupを使用する。DB/Model import前にserver/.env.test由来・NODE_ENV=test・URLのDB名を検査し、
アプリ用sequelize・models初期化用db.sequelize・observerの全3接続の設定DB名とcurrent_database()=test_dbを確認する。
各接続でItemDraft/ItemEditing/User全Model列の存在とnullable、ItemDraft全列の型・所有者FK・必要default、READ COMMITTEDを検査し、完了後にだけseedする。
全Promise/transaction回収後、自作IDのみをItemDraft→ItemEditing→User順でcleanupし残存0件を確認する。hook・spyを解除し、全接続close後にenvを復元する。
ガード/スキーマ不足時にmigration/sync/別DBへの差替えは行わない。
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
| U19 | 同一所有者・同一IDのEditing/Draft両要求を同時に保留し逆順完了   | ジョブ登録・signalが独立し、中断も結果混入もない                     |

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
| H13     | 同一所有者のEditing/Draft要求                  | それぞれ10分5回の枠が独立                   |

## utility・service・実DB

utilityのV01〜V13/A01〜A06の個別条件と、以下を対応させる。
正常HLS・URL・整数秒数、0/小数/非数/範囲外、playlist/segment不足、音声optional指定、
download/probe/spawn/error/非0/timeout/upload/cleanup障害、abort後close前のcleanup抑止、
全listener/timer解除、対象外ファイル保持、主原因とcleanup原因保持を検証する。
S3はsignalあり/なしのSDK optionsとpipeline、stream終了、元例外伝播を確認する。

| ID       | 条件と期待結果                                                                       |
| -------- | ------------------------------------------------------------------------------------ |
| V01      | 正常URL・秒数切捨・MIME・segment→playlist順、要求UUIDの一時パスだけcleanup           |
| V02/V03  | 秒数0/上限/空/負/非数/無限/超過、元URL不備。許容値だけ成功し他は後続停止             |
| V04/V05  | playlist/segment欠落、download失敗。uploadなし、cleanupと原因伝播                    |
| V06/V07  | spawn error→close、各process非0終了。close前cleanupなし、終了後失敗                  |
| V08/V09  | 両process timeout/abort。kill→closeを回収してからcleanup                             |
| V10      | download/probe/upload境界のabortとupload障害。後続ファイルを送信しない               |
| V11/V12  | cleanup単独/主原因重複、timer/listener解除。元原因保持と解放                         |
| V13      | mkdir/readdir等I/O障害。自作パスcleanupを試行し原因を保持                            |
| V14      | 同一所有者・ID・要求UUIDのEditing/Draft変換。S3キーと一時パスを分離し相互cleanupなし |
| A01〜A03 | download signal有無のSDK/pipeline options、Body型不正、SDK/pipeline元例外伝播        |
| A04/A05  | upload signal有無・MIME・Body、SDK失敗時もstream destroy→closeを待機                 |
| A06      | abortとstream障害の競合2順序。SDKからの主原因を置換せずstreamを回収                  |

service S01〜S04: processing/converted/failedのDTO完全一致、同一インスタンスとtransaction、完了待機、例外伝播。
標準DB fixtureは所有者/他人のUser、対象下書き、同一所有者の別下書き・他人下書き・所有者null下書き、同じ元URLを持つ保護対象のItemEditing。
対象下書きはURL/秒数、全商品情報、JSONB、画像配列、価格割引、配送備考、固定作成日時を持つ。更新前後の新規SELECTでupdatedAt以外の全列を比較し、
保護下書き3行と編集行を完全一致で確認する。updatedAtは通常更新としてDate型を検証し、作成日時・所有者・元URLを保持する。

| ID  | 実DBの前提・手順                                                            | 期待結果・展開件数                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| D01 | original/processing/converted/failed/nullから所有者限定query→processing更新 | URL/秒数・他全列・保護行を保持、5件                           |
| D02 | processing保存後、converted・今回URL・秒数0/42を保存                        | 更新3列とupdatedAt以外保持、2件                               |
| D03 | duration17/nullからfailed・URL nullを保存                                   | durationと他全列・保護行保持、2件                             |
| D04 | 同transaction内で3列実UPDATE後にcallback例外                                | transaction内新値・observer旧値、rollback後全列旧値、1件      |
| D05 | 他人ユーザー/他人下書き/所有者null/自作削除IDを検索                         | 全てnullで行不変、1件（4条件）                                |
| D06 | 独立transactionの先行UPDATEロック取得、後続実待機、先行URL変更をcommit      | pg_blocking_pidsでPID間Lock確認、後続は変更後元URLを取得、1件 |
| D07 | processing実UPDATE後にduration=2147483648を保存                             | SQLSTATE22003、先行更新含むrollback、1件                      |

D06はtransactionごとのpg_backend_pidとREAD COMMITTEDを確認する。observerと独立transaction2本を確保し、lock_timeout8秒・待機観測5秒・ケース20秒の上限を設ける。
固定sleepで判定せず、finallyで先行解放→後続結果回収→残transaction終了を行ってからcleanupする。
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

## 下書き保存から変換の接続

ユーザー承認によりcreateItemDraftのID返却とフロント呼出し変更まで対象とする。新APIのDB/HTTP検証と分けて以下を確認する。

| ID  | 境界・条件                                            | 期待結果                                                                           |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| F01 | createItemDraft成功時のusecase/controller             | 保存した下書きのitemDraftIdが応答へ返る。削除済みitemEditingIdや別行IDを返さない   |
| F02 | 新規アップロード/販売中商品の編集の共有下書き保存関数 | 保存応答のitemDraftIdでPATCH /item-draft/:id/convertを呼び、元の編集IDで変換しない |
| F03 | 下書き保存失敗                                        | 変換APIを呼ばない                                                                  |

F01は対応するcreateItemDraftの既存テストを更新して回帰する。F02/F03はclientの対象関数と分岐・レスポンス型を確認し、
実ブラウザ・AWSとの実通信を実行していない場合はレポートへ明記する。client側の既知lint/型エラーは今回の完了判定から除外する。

## 実行・完了条件

server/で以下の対象パスを明示して実行する。DB suiteはfixture/hook干渉を抑えるためmaxWorkers=1で順に実行し、ケース内の独立transactionは維持する。

```bash
npm run test:run -- test/integration/database/itemDraft/convertItemDraftVideo/database.test.ts test/integration/usecases/itemDraft/convertItemDraftVideo/database.test.ts --maxWorkers=1
npm run test:run -- src/usecases/itemDraft/test/convertItemDraftVideo.test.ts src/services/itemDraft/test/convertItemDraftVideo.test.ts src/controllers/itemDraft/test/convertItemDraftVideo.test.ts src/utils/test/itemDraftVideoConversion.test.ts src/middleware/test/itemDraftVideoResponse.test.ts test/integration/usecases/itemDraft/convertItemDraftVideo/http.test.ts test/integration/usecases/itemDraft/convertItemDraftVideo/isolatedJobs.test.ts src/utils/s3/test/itemEditingVideoConversion.test.ts
```

HTTPと実DBの実行権限不足は承認手順で対応する。
npm run lint、npm run typecheck、./node*modules/.bin/tsc --noEmit -p test/tsconfig.jsonも実行する。
通常lint対象外のtest/\**/\_.tsは既存ESLint/typescript-eslintで追加検査し共有設定を変更しない。
必要ケース成功、未回収Promise/skip/未実行/失敗なし、DB cleanupとclose成功、文書整合を完了条件とする。

新規Draft版の実行結果は統合後に対応レポートへ記録する。既存Editing版の成功結果を本APIの検証済み根拠にはしない。
