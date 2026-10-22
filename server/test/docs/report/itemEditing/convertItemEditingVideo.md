# convertItemEditingVideo テストレポート

更新日: 2026-10-22。最新結果: **完了**。
ユーザーが指定したUser日時2列のNOT NULL化を実DB・テストDBへ適用し、中断していた検証を再開した。
名称をconvertItemEditingVideoへ統一し、名称変更後に必要ケースと回帰を再実行した。

- DB非接続: 19ファイル263件成功（新規139/既存回帰124）。
- 実DB: service/query 13件、実UseCase接続23件、計2ファイル36件成功。
- 合計: 21ファイル299件成功、失敗・skip/todo・未処理例外0。
- lint、本番typecheck、テストtypecheck、追加TS lint 11ファイル、migration構文、差分検査成功。
- 実DBの全3接続ガード・必要スキーマ・READ COMMITTED・自作ID限定cleanup残存0・全接続close/env復元を確認。
- 実AWS・実ffmpeg/ffprobe・実stream pipelineは対象境界でモックし、実通信/配信・実変換の成功まで保証しない。カバレッジ未取得。

[詳細設計](../../../../../docs/design/backend/detail/itemEditing/convertItemEditingVideo.md) /
[テスト設計](../../architecture/itemEditing/convertItemEditingVideo.md) /
[再発防止Todo](../../../../../docs/todo/done/user-video-timestamps-db-nullability.md)

## 最新の変更とmigration（F7）

新規ESM migration:
[20261022080000-enforce-user-timestamps-not-null.js](../../../../migrations/20261022080000-enforce-user-timestamps-not-null.js)。

User ModelのcreatedAt/updatedAtはallowNull:false。両DBの対象列は適用前NULL許容だった。
接続設定はserver/.envのneondb、server/.env.testのtest_dbから個別に読み込み、
設定DB名と接続後のcurrent_database()を検査してからメタデータ・NULL件数を読み取った。
両DBともcreatedAt/updatedAtの既存NULLは0件。データ補完や既存行削除は行っていない。

| DB | 適用後createdAt/updatedAt | 型/default | 今回の履歴 |
| --- | --- | --- | --- |
| neondb | 両列NOT NULL | timestamp with time zone / now()を保持 | SequelizeMetaに今回名1件 |
| test_db | 両列NOT NULL | 同上 | 同上 |

upは2列のSET NOT NULLを同一transactionで実行する。downは逆順のDROP NOT NULLで、データ・型/defaultを変更しない。
既存NULLがあればDB制約検査で停止し、補完値を推測しない。downは構文・内容を確認したが実DBへの実行はしていない。

実行ディレクトリserver/、Node.js 26.12.1（既存の/tmp配置とlibatomic）を使用した。
通常CLIは.sequelizercのCJS requireがESMとして評価されDB操作前に停止したため、
一時専用ESM実行スクリプトで今回のupだけを直接呼び、SequelizeMetaへ今回名のみを登録して適用後の定義/履歴を検査した。
未適用migrationを一括実行していない。通常CLI復旧は別Todoで扱い、本APIの実装範囲へ広げていない。

```bash
LD_LIBRARY_PATH=/tmp/node26-libs/usr/lib/x86_64-linux-gnu /tmp/node-v26.12.1-linux-x64/bin/node tmp/user-timestamps-preflight.mjs
LD_LIBRARY_PATH=/tmp/node26-libs/usr/lib/x86_64-linux-gnu /tmp/node-v26.12.1-linux-x64/bin/node tmp/apply-user-timestamps.mjs
```

上記tmpスクリプトは今回の作業用でGit管理外。
接続前に.env/.env.testの出所・PostgreSQL・想定DB名、接続後に実DB名・対象列型・NULL0件・履歴を検査し、他のmigrationは呼ばない。
初回sandbox接続EPERMは承認手順で再実行した。初回のSSL強制指定は環境のDB_SSLに一致しなかったため、
アプリと同じDB_SSLによる設定へ修正し、読取り・適用とも成功した。
DDLと履歴登録は別transactionであり、適用後に両方の成立を確認した。実COMMIT応答喪失を模擬検証したとは扱わない。

## 実DBの再開と名称統一（F8）

改名対象はusecase/controller/limiterの識別子、対応ファイル、fixture/integrationの機能ディレクトリ、
テスト設計/レポートのファイル名、import・モック・ドキュメント記載。
処理結果のvideo_statusは仕様どおりconvertedのまま。
最終検査で旧API処理名の参照はdocs/server配下に残っていない。

| ケース | 実行ファイル（server/基準） | 件数・結果 |
| --- | --- | --- |
| U01〜U18、V01〜V13、A01〜A06、S01〜S04、C01〜C04、M01/M02、H01〜H12と既存回帰 | 下記DB非接続コマンド | 263成功 |
| D01〜D07 | test/integration/database/itemEditing/convertItemEditingVideo/database.test.ts | 13成功 |
| I01〜I12 | test/integration/usecases/itemEditing/convertItemEditingVideo/database.test.ts | 23成功 |

I系は変換utilityだけをモックし、実UseCase・service・Model・transaction・PostgreSQLを接続した。
正常/全状態と再送、失敗duration保持、他人/不存在/元URLなし、元URL差替え後の旧成功/失敗保存抑止、
重複/3要求/別IDと所有者分離、最終所有者変更/削除、実UPDATE後の障害とrollback/再試行、
旧完了UPDATE後のabortによるrollbackを確認した。
Model hookの障害注入は実UPDATE後に置き、transaction内の値とobserver側の可視性を区別した。
ロック待機はD06で独立transactionのPIDとpg_blocking_pids/Lockを観測し、時間経過だけで成立扱いにしていない。

3接続（src/db・Model registry・observer）すべてで.env.test由来のtest_dbと必要スキーマを検査してからseedを許可した。
各ケース後に自作IDだけをFK順に削除し、残存0件をassert、hook/spy/envの復元と全接続closeまで成功。
実DBのNOT NULLやrollbackの結果を、transactionモックの成功で代用していない。

## 最終実行コマンド・静的検査

以下はserver/で実行。runtimeを統一するため各コマンドへ
PATH=/tmp/node-v26.12.1-linux-x64/bin:$PATH と LD_LIBRARY_PATH=/tmp/node26-libs/usr/lib/x86_64-linux-gnu を設定した。
HTTP待受・DB接続は承認手順で制限外実行。--maxWorkers=1はfixture hook/env/cleanupのファイル間干渉防止で、
D/I内の独立transactionや並行要求を無効にする指定ではない。

```bash
npm run test:run -- src/usecases/itemEditing/test/convertItemEditingVideo.test.ts src/utils/test/itemEditingVideoConversion.test.ts src/utils/s3/test/itemEditingVideoConversion.test.ts src/services/itemEditing/test/ src/controllers/itemEditing/test/ src/middleware/test/itemEditingVideoResponse.test.ts test/integration/usecases/itemEditing/convertItemEditingVideo/http.test.ts test/integration/usecases/itemEditing/createItemEditingCopy/route.test.ts test/integration/usecases/itemEditing/createItemEditingDraft/route.test.ts test/integration/usecases/itemEditing/updateConfirm/route.test.ts --reporter=json --outputFile=/tmp/convert-item-editing-video-results.json
npm run test:run -- test/integration/database/itemEditing/convertItemEditingVideo/database.test.ts test/integration/usecases/itemEditing/convertItemEditingVideo/database.test.ts --maxWorkers=1 --reporter=json --outputFile=/tmp/convert-item-editing-video-db-results.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
node --check migrations/20261022080000-enforce-user-timestamps-not-null.js
git diff --check
```

JSON一時集計はDB非接続263/263・実DB36/36、各success=true。異なる対象なので合計299件、再実行や担当の個別結果は重複加算していない。
通常lint対象外のtest TSは既存ESLint/typescript-eslint APIで11ファイル追加検査、0 errors/0 warnings。
対象は専用fixture4、専用integration3、既存createCopyのroute/databaseHttpとcreateDraft/updateConfirmのroute計4。
新規ライブラリ・共有lint設定の変更はない。

## 完了範囲と残る対象外事項

APIの詳細設計、本番コード、テスト設計、テスト/fixture、今回の実行結果の対応を照合し、必須の未実装/未実行/skip・未解決失敗はない。
User日時列の前提差異は今回の明示migrationで解消した。
他ModelのNULL制約棚卸し・Modelに合わせる是正方針は依頼どおりTodoへ記録した。Video日時列等は未変更で、全Model整合作業の完了とはしていない。
複数Node.jsプロセス間の中断、永続ジョブ復旧、実AWS/ffmpeg配信は対象外。既存CLIのNode26互換問題も別Todoであり、今回の適用/検証を妨げない実行方法で完了した。

## 初回中断時の履歴（以下はF7/F8による再開前）

以下に残る「中断」「未実装」「未実行」「最新」は初回記録時点の状態を示す。
現在の判定・実行件数・名称は本書冒頭からの最新節を優先する。F5のUser制約差異とI系未実装はF7/F8で解消済み。

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
[テスト設計](../../architecture/itemEditing/convertItemEditingVideo.md) /
[阻害要因Todo](../../../../../docs/todo/done/user-video-timestamps-db-nullability.md)

## 実装した範囲

server/src基準でroutes/itemEditing.ts、controllers/itemEditing/itemEditing.ts、middleware/itemEditingVideoResponse.ts、
middleware/rateLimit/itemEditingRateLimit.ts、usecases/itemEditing/convertItemEditingVideo.ts、
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
| src/usecases/itemEditing/test/convertItemEditingVideo.test.ts | U01〜U18。状態、停止、transaction待機、差替え、別キー独立、原因保持 | 26 |
| src/utils/test/itemEditingVideoConversion.test.ts | V01〜V13。変換、duration境界、子プロセスclose/中断/timeout、I/O、cleanup | 38 |
| src/utils/s3/test/itemEditingVideoConversion.test.ts | A01〜A06。signal有無、SDK/pipeline引渡し、stream終了と原因保持 | 16 |
| src/services/itemEditing/test/convertItemEditingVideo.test.ts | S01〜S04。DTO3状態、同一instance/transaction、await、所有者where/lock | 7 |
| src/controllers/itemEditing/test/convertItemEditingVideo.test.ts | C01〜C04。検証値採用、非待機、共通境界、送信失敗 | 6 |
| src/middleware/test/itemEditingVideoResponse.test.ts | M01/M02。内部statusとheaders、対象外 | 5 |
| test/integration/usecases/itemEditing/convertItemEditingVideo/http.test.ts | H01〜H12。JWT、params、parser、limiter窓/独立、全202、実app順序 | 41 |
| src/services/itemEditing/test/の上記以外6ファイル | 既存service回帰 | 22 |
| src/controllers/itemEditing/test/の上記以外3ファイル | 既存controller回帰 | 14 |
| test/integration/usecases/itemEditing/createItemEditingCopy/route.test.ts | 既存HTTP回帰 | 26 |
| test/integration/usecases/itemEditing/createItemEditingDraft/route.test.ts | 既存HTTP回帰 | 40 |
| test/integration/usecases/itemEditing/updateConfirm/route.test.ts | 既存HTTP回帰 | 22 |
| 合計（重複加算なし） | 19ファイル、new139/regression124 | 263 |

```bash
npm run test:run -- src/usecases/itemEditing/test/convertItemEditingVideo.test.ts src/utils/test/itemEditingVideoConversion.test.ts src/utils/s3/test/itemEditingVideoConversion.test.ts src/services/itemEditing/test/ src/controllers/itemEditing/test/ src/middleware/test/itemEditingVideoResponse.test.ts test/integration/usecases/itemEditing/convertItemEditingVideo/http.test.ts test/integration/usecases/itemEditing/createItemEditingCopy/route.test.ts test/integration/usecases/itemEditing/createItemEditingDraft/route.test.ts test/integration/usecases/itemEditing/updateConfirm/route.test.ts --reporter=json --outputFile=/tmp/converted-item-editing-video-results.json
```

最初の統合実行はサンドボックスのlisten EPERMによりHTTP129件失敗・134件成功となった。
同じ対象を承認手順に従い制限外で再実行し、263/263成功、exit 0。制限外でもDBを接続する対象は含めていない。
各担当の個別成功をこの最終結果へ重複加算していない。

## 実DBガード停止と未実行範囲

専用fixtureはtest/fixtures/itemEditing/convertItemEditingVideo/databaseSetup.tsとdatabaseFixtures.ts。
実DBケースはtest/integration/database/itemEditing/convertItemEditingVideo/database.test.ts。

DB担当worktreeのserver/で3回とも次を実行した。--maxWorkers=1はfixtureのhook/env/cleanupのファイル間干渉を抑える指定で、D06内の独立transaction並列検証を置き換えない。

```bash
npm run test:run -- test/integration/database/itemEditing/convertItemEditingVideo/database.test.ts --maxWorkers=1
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
test/fixtures/itemEditing/convertItemEditingVideo/の4ファイル、
test/integration/database/itemEditing/convertItemEditingVideo/database.test.ts、
test/integration/usecases/itemEditing/convertItemEditingVideo/http.test.ts。
結果6 files/0 errors/0 warnings。共有ESLint設定は変更していない。

## 再開条件と残件

1. Todoの既存User日時列のModel/反映済みDB差異について調査・整合方針を確定する。DB反映後のDB優先規約に従い、NOT NULL化やModel変更を推測で行わない。
2. 方針に沿って必要な対応が完了した後、同じ全接続/必要スキーマガードでD01〜D07を実行する。
3. 未実装の実usecase DB接続I系を実装・実行し、所有者・元URL差替え・中断と実transactionの結果を照合する。
4. 必要な修正・再検証と文書の最終照合を完了してから、完了報告・develop統合を行う。

単体のtransactionモック成功を実DBの永続化/rollback/ロック成功と扱わず、
S3モック成功を実送信/配信成功と扱わない。現在の中断状態でAPI開発完了とはしない。
