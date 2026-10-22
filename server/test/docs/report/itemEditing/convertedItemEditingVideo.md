# convertedItemEditingVideo テストレポート

実施日: 2026-10-22。対象: PATCH /api/item-editing/:id/convert。
**最新状態は中断・未完了**。詳細設計、初期本番実装、テスト設計、DB非接続テスト、実DB13ケースを作成したが、
必須親User.createdAtのNULL制約がModelとtest_dbで一致せず、実DBの準備段階で停止した。
developへ統合しない。仕様の確認待ちは解消済みであり、現在の阻害要因は既存スキーマ差異。

- 統合後のDB非接続検証: 19ファイル263件成功（新規139、既存回帰124）。失敗0、skip/todo0、未処理例外0。
- lint・本番typecheck・テストtypecheck・通常lint対象外6ファイルの追加ESLintは成功。
- 実DB: 1ファイル13件は本体未実行。ガード失敗をskipで成功扱いにしていない。
- 実usecaseとDBの接続・競合ケースI系は未実装/未実行。機能全体の検証完了とは報告しない。
- 実AWS・実ffmpeg/ffprobe・実stream pipelineの検証なし。バイナリはこの環境のPATH上に見つからなかった。カバレッジ未取得。

[詳細設計](../../../../../docs/design/backend/detail/itemEditing/convertItemEditingVideo.md) /
[テスト設計](../../architecture/itemEditing/convertedItemEditingVideo.md) /
[阻害要因Todo](../../../../../docs/todo/P3-techdebt/user-video-timestamps-db-nullability.md)

## 実装した範囲

server/src基準でroutes/itemEditing.ts、controllers/itemEditing/itemEditing.ts、middleware/itemEditingVideoResponse.ts、
middleware/rateLimit/itemEditingRateLimit.ts、usecases/itemEditing/convertedItemEditingVideo.ts、
services/itemEditing/command.ts、types/serviceType/itemEditing.ts、utils/itemEditingVideoConversion.tsとutils/s3/videoConvert.tsを実装・更新。
app.tsはparser前に対象PATCHだけ202へ揃える境界を接続した。
新たなcontroller importにより既存テストがDB初期化へ進まないよう、既存7テストに対象外usecaseモックのみ追加した。

成功converted、失敗failed/URL null/duration保持、既存nullからの受付とnull書込み禁止、
所有者/編集ID別の新要求による旧要求中断、旧結果保存抑止を実装した。
現在の単一Node.jsプロセス内で中断を管理し、永続キューや複数プロセス間の中断は導入していない。
Model・migration・DBスキーマの変更はない。

## 統合後の最終DB非接続結果

以下のパス・コマンドの基準はserver/。JSON集計元は一時ファイル
/tmp/converted-item-editing-video-results.json（重要な件数と結果は本書にも保持）。

| テスト | ケース | 成功件数 |
| --- | --- | ---: |
| src/usecases/itemEditing/test/convertedItemEditingVideo.test.ts | U01〜U18。状態、停止、transaction待機、差替え、別キー独立、原因保持 | 26 |
| src/utils/test/itemEditingVideoConversion.test.ts | V01〜V13。変換、duration境界、子プロセスclose/中断/timeout、I/O、cleanup | 38 |
| src/utils/s3/test/itemEditingVideoConversion.test.ts | A01〜A06。signal有無、SDK/pipeline引渡し、stream終了と原因保持 | 16 |
| src/services/itemEditing/test/convertedItemEditingVideo.test.ts | S01〜S04。DTO3状態、同一instance/transaction、await、所有者where/lock | 7 |
| src/controllers/itemEditing/test/convertedItemEditingVideo.test.ts | C01〜C04。検証値採用、非待機、共通境界、送信失敗 | 6 |
| src/middleware/test/itemEditingVideoResponse.test.ts | M01/M02。内部statusとheaders、対象外 | 5 |
| test/integration/usecases/itemEditing/convertedItemEditingVideo/http.test.ts | H01〜H12。JWT、params、parser、limiter窓/独立、全202、実app順序 | 41 |
| src/services/itemEditing/test/の上記以外6ファイル | 既存service回帰 | 22 |
| src/controllers/itemEditing/test/の上記以外3ファイル | 既存controller回帰 | 14 |
| test/integration/usecases/itemEditing/createItemEditingCopy/route.test.ts | 既存HTTP回帰 | 26 |
| test/integration/usecases/itemEditing/createItemEditingDraft/route.test.ts | 既存HTTP回帰 | 40 |
| test/integration/usecases/itemEditing/updateConfirm/route.test.ts | 既存HTTP回帰 | 22 |
| 合計（重複加算なし） | 19ファイル、new139/regression124 | 263 |

```bash
npm run test:run -- src/usecases/itemEditing/test/convertedItemEditingVideo.test.ts src/utils/test/itemEditingVideoConversion.test.ts src/utils/s3/test/itemEditingVideoConversion.test.ts src/services/itemEditing/test/ src/controllers/itemEditing/test/ src/middleware/test/itemEditingVideoResponse.test.ts test/integration/usecases/itemEditing/convertedItemEditingVideo/http.test.ts test/integration/usecases/itemEditing/createItemEditingCopy/route.test.ts test/integration/usecases/itemEditing/createItemEditingDraft/route.test.ts test/integration/usecases/itemEditing/updateConfirm/route.test.ts --reporter=json --outputFile=/tmp/converted-item-editing-video-results.json
```

最初の統合実行はサンドボックスのlisten EPERMによりHTTP129件失敗・134件成功となった。
同じ対象を承認手順に従い制限外で再実行し、263/263成功、exit 0。制限外でもDBを接続する対象は含めていない。
各担当の個別成功をこの最終結果へ重複加算していない。

## 実DBガード停止と未実行範囲

専用fixtureはtest/fixtures/itemEditing/convertedItemEditingVideo/databaseSetup.tsとdatabaseFixtures.ts。
実DBケースはtest/integration/database/itemEditing/convertedItemEditingVideo/database.test.ts。

DB担当worktreeのserver/で3回とも次を実行した。--maxWorkers=1はfixtureのhook/env/cleanupのファイル間干渉を抑える指定で、D06内の独立transaction並列検証を置き換えない。

```bash
npm run test:run -- test/integration/database/itemEditing/convertedItemEditingVideo/database.test.ts --maxWorkers=1
```

接続前にserver/.env.test由来・NODE_ENV=test・PostgreSQL URLのtest_dbを検査する。
src/db.ts、models/indexのSequelize、observerの3接続を列挙し、全接続の設定名・実DB名・必要スキーマの検査完了後だけsafeを立てる設計。
最終停止時は最初のsrc/db.ts接続の設定名/SELECT current_database()がtest_dbと確認でき、
ItemEditing全列の存在/NULL検査を通過したが、User.createdAtで停止した。
残り2接続の後続ガードと動画列の型/FK/default/分離レベル検査は未到達であり、全ガード成功とは扱わない。

実エラー:

```text
DB_TEST_STOP: user.createdAt exists=true nullable=true expected=false
```

| ID | 実装した観点 | 展開件数・状態 |
| --- | --- | --- |
| D01 | original/processing/converted/failed/null→processing、非対象列/他行保持 | 5件・未実行 |
| D02 | converted/URL、duration 0/42 | 2件・未実行 |
| D03 | failed/URL null、duration 17/null保持 | 2件・未実行 |
| D04 | 実UPDATE後のcallback失敗とrollback | 1件・未実行 |
| D05 | 他人/所有者null/不存在の実除外 | 1件・未実行 |
| D06 | 独立transaction/PID/observerのpg_blocking_pids実待機後に元URL再取得 | 1件・未実行 |
| D07 | INTEGER超過SQLSTATE 22003と先行processingのrollback | 1件・未実行 |

seed前停止でテスト作成行0、cleanup DELETE0。safe不成立時にcleanup削除をしない。
列挙した3接続はすべてclose成功。migration、sync、DB作成、既存行の補正は行っていない。
読み取り専用の後続調査でUser/VideoのcreatedAt/updatedAtがすべてtimestamp with time zone・NULL許容と確認された。
両Modelは4列ともallowNull:false。既存NULL件数・本番DBの定義・差異の経緯は未調査で、Todoへ記録した。

## 初回・修正・再検証履歴

| 修正ID | 原因・対象 | 修正と結果 |
| --- | --- | --- |
| F1 | utilityのfinally内throwがno-unsafe-finally、unitの未使用import | cleanup原因を変数に保持してfinally外でthrow、未使用import削除。主原因保持を維持しutility54件/usecase26件とlint再成功 |
| F2 | HTTP fixtureのhoisted export収集不備、writeHead overload型診断 | fixture初期化順・具体的overload型を修正。HTTP/controller/middleware52件と統合後の両型検査成功 |
| F3 | DB fixtureのFK情報型がobjectでテストtsc失敗 | 型付き情報スキーマSELECTへ変更。テスト型検査成功。DBガード失敗とは別のテストコード問題 |
| F4 | 初回DB fixtureが無関係なVideo/Itemまでseed・全列照合しVideo.createdAtで停止 | 非対象依存を除き本APIのItemEditing/必要親Userへ限定。APIの必要ガードは維持。次に必要親User.createdAtで停止、ここからDB再実行停止 |
| F5 | 既存User日時NULL定義不一致 | 未修正。対象外のschema変更やガード緩和をせず中断、Todo作成 |
| F6 | 新規3ファイルの末尾空行をstaged差分検査で検出 | 末尾空行だけ削除。挙動変更なし、差分検査再成功 |
| 環境 | HTTP listen EPERM、DB socket EPERM | 承認手順で同じガード/対象を制限外実行。HTTP成功、DBはschemaガード停止 |
| 検査コマンド | 初回追加ESLintのflat configにextendsを直接渡して起動失敗 | tseslint.configによる展開へ修正。リポジトリ共有設定変更なし、追加6ファイル0 errors/0 warnings |

DB担当の3回の履歴は、sandbox EPERM、過剰Videoガード、必要親Userガードの順。
いずれもセットアップ失敗で13件はランナー上skipped、本体の成功/失敗判定ではない。
同じ原因の繰返し実行は行わない。

## 静的検査

作業ブランチへ3担当を統合した状態で以下はすべてexit 0。

```bash
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
git diff --check
```

通常lint対象外TSは既存ESLint APIを使用し、次の6ファイルをtypescript-eslint推奨規則で追加検査した。
test/fixtures/itemEditing/convertedItemEditingVideo/の4ファイル、
test/integration/database/itemEditing/convertedItemEditingVideo/database.test.ts、
test/integration/usecases/itemEditing/convertedItemEditingVideo/http.test.ts。
結果6 files/0 errors/0 warnings。共有ESLint設定は変更していない。

## 再開条件と残件

1. Todoの既存User日時列のModel/反映済みDB差異について調査・整合方針を確定する。DB反映後のDB優先規約に従い、NOT NULL化やModel変更を推測で行わない。
2. 方針に沿って必要な対応が完了した後、同じ全接続/必要スキーマガードでD01〜D07を実行する。
3. 未実装の実usecase DB接続I系を実装・実行し、所有者・元URL差替え・中断と実transactionの結果を照合する。
4. 必要な修正・再検証と文書の最終照合を完了してから、完了報告・develop統合を行う。

単体のtransactionモック成功を実DBの永続化/rollback/ロック成功と扱わず、
S3モック成功を実送信/配信成功と扱わない。現在の中断状態でAPI開発完了とはしない。
