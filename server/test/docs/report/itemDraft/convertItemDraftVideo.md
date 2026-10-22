# convertItemDraftVideo テストレポート

実行日: 2026-10-22。最新結果: 対象API・ID返却・フロント接続の実装と必要検証を完了。
パスとコマンドは特記以外server/基準。

- DB非接続: 19ファイル676件成功（単体・HTTP・既存回帰）。
- 新API実DB: 2ファイル36件成功（service13、usecase23）。
- 下書き作成API実DB回帰: 1ファイル148件成功。返却IDと実保存行の一致を含む。
- 合計22ファイル860件成功。最終実行の失敗・skip/pending・todo・未処理例外0。重複実行は加算していない。
- lint、本番typecheck、テストtypecheck、通常lint対象外の変更TS12ファイル追加lint、git diff --checkが成功。
- clientのAPI・hook実処理を依存モック付きで検証。全体lint/型検査はユーザー指示により完了判定から除外。
- 実AWS通信・配信、実ffmpeg/ffprobe、ブラウザの全画面操作、複数プロセス運用、カバレッジ計測は未実施。

[詳細設計](../../../../../docs/design/backend/detail/itemDraft/convertItemDraftVideo.md) /
[テスト設計](../../architecture/itemDraft/convertItemDraftVideo.md)

## 監査と実装範囲

item_editing版の契約をItemDraft Model、既存の所有者限定query、transaction、Router登録、共通S3/非同期境界と照合した。
仕様判断を要する相違はなく、コピー時に残っていた「実DBテスト実行済み」の記述を今回の検査予定・結果への参照に変更し、編集ID等の表現、共通S3の実装済み区分を訂正した。
基本設計の認可カラム表記item_draft_.seller_idをitem_draft.seller_idへ訂正した。

PATCH /api/item-draft/:id/convertを追加。所有者付きロック検索、processing→converted、失敗時failed/URL null/duration保持、同一所有者・下書きIDの新要求で旧要求を中断する。
公開HTTPは認証・入力・制限の拒否も202とする元設計を維持し、拒否本文・内部status・必要ヘッダーを保持。拒否後の変換は実行しない。
新規utility・ジョブMap・S3キー・一時パスをDraft用に分離し、既存Editing版の同数値ID・同UUIDとの干渉を防ぐ。
Model・associate・DBスキーマの変更はなく、migration/syncは実行していない。

ユーザーの追加回答により、POST /item-draftの既存200・署名URL群へcommit済みitemDraftIdを追加した。
フロントはそのIDでDraft用APIを呼び、通常保存はEditing用APIを維持する。
動画署名がPresignedPostなのにurlのみのPUTで送っていたため、呼出しに必要なfields/File付きFormData POSTへ修正した。
下書き保存後は既存の下書き一覧へ遷移する。

## ケース対応・結果

| ケース | 実行対象・確認範囲 | 結果 |
| --- | --- | --- |
| U01〜U18 | 実usecase。transaction/service/変換をモック。全状態、認可拒否、元URL変更、失敗記録、中断・3要求・待機・再送 | 26件成功 |
| U19 | isolatedJobs.test.ts。Editing/Draft両実usecase、同一所有者/ID、逆順完了、signal・保存先独立 | 1件成功 |
| V01〜V14 | Draft実utility。spawn/fs/S3境界モック。秒数・HLS引数・送信順・各障害・timeout/abort・close/cleanup・同UUIDのパス分離 | 39件成功 |
| A01〜A06 | 共通S3 utilityの既存テスト。signal/SDK/pipeline・stream解放・原因保持 | 16件成功 |
| S01〜S04 | 所有者条件・取得列・必須transaction/ロック、3列DTO、待機・元例外 | 6件成功 |
| C01〜C04 | 実controller/共通非同期境界。認証/検証済みID採用、応答非待機、例外捕捉、再応答なし | 6件成功 |
| M01/M02 | 対象method/pathだけ公開202、内部status/header保持 | 5件成功 |
| H01〜H13 | 実JWT/Router/limiter/parser/errorHandler。入力境界、窓/計上順、拒否後停止、対象パス、実app接続、Editingと制限枠独立 | 42件成功 |
| D01〜D07 | 実所有者限定query/更新service/PostgreSQL。保存3列・保持列・他行不変、rollback、実ロック待機、SQLSTATE22003 | 13件成功 |
| I01〜I12 | 実usecase/service/Model/transaction、変換utilityのみモック。元URL/所有者変更・削除、競合、中断後更新抑止、実UPDATE後の障害と再試行 | 23件成功 |
| F01 | 下書き作成usecase/controller/HTTP/実DB。作成ID返却と実保存ID一致、transaction外側完了前は返却しない | 既存回帰内で成功 |
| F02/F03 | client API・hookの実処理とformの受渡し照合。Draft/EditingのURL/ID分離、fields/file、upload失敗/通信失敗時の変換禁止、変換拒否伝播、動画未変更skip。保存失敗はformのtry/catchと呼出し順のコード確認 | 簡易検証成功。ブラウザ未実行 |

新規Draftケースは125件。残るDB非接続551件は共通S3・作成/削除・Editing版の回帰であり、新規APIのテスト件数へ重複加算しない。
JSONにはファイルごとの件数があり、ケースIDの範囲数と展開後件数は異なる。

## 実行コマンドと根拠

Node.js 26.12.1を既存/tmp配置から使用した。各serverコマンドに次を設定。

```bash
export PATH=/tmp/node-v26.12.1-linux-x64/bin:$PATH
export LD_LIBRARY_PATH=/tmp/node26-libs/usr/lib/x86_64-linux-gnu
```

最終DB非接続実行:

```bash
npm run test:run -- src/usecases/itemDraft/test/convertItemDraftVideo.test.ts src/services/itemDraft/test/convertItemDraftVideo.test.ts src/controllers/itemDraft/test/convertItemDraftVideo.test.ts src/utils/test/itemDraftVideoConversion.test.ts src/middleware/test/itemDraftVideoResponse.test.ts test/integration/usecases/itemDraft/convertItemDraftVideo/http.test.ts test/integration/usecases/itemDraft/convertItemDraftVideo/isolatedJobs.test.ts src/utils/s3/test/itemEditingVideoConversion.test.ts src/usecases/itemDraft/test/createItemDraft.test.ts src/controllers/itemDraft/test/ test/integration/usecases/itemDraft/createItemDraft/route.test.ts test/integration/usecases/itemDraft/createItemDraft/masterBrand.test.ts src/usecases/itemEditing/test/convertItemEditingVideo.test.ts src/utils/test/itemEditingVideoConversion.test.ts src/middleware/test/itemEditingVideoResponse.test.ts test/integration/usecases/itemEditing/convertItemEditingVideo/http.test.ts test/integration/usecases/itemDraft/deleteItemDraft/route.test.ts test/integration/usecases/itemDraft/deleteItemDraft/sharedIdRoutes.test.ts --maxWorkers=1 --reporter=json --outputFile=/tmp/item-draft-video-final-results.json
```

実DB:

```bash
npm run test:run -- test/integration/database/itemDraft/convertItemDraftVideo/database.test.ts test/integration/usecases/itemDraft/convertItemDraftVideo/database.test.ts --maxWorkers=1 --reporter=json --outputFile=/tmp/item-draft-video-db-results.json
npm run test:run -- test/integration/database/itemDraft/createItemDraft/database.test.ts --maxWorkers=1 --reporter=json --outputFile=/tmp/item-draft-create-db-regression.json
```

maxWorkers=1はfixtureのhook/env/cleanupのファイル間干渉防止。ケース内の独立transaction・並行要求は維持している。
/tmpのJSONとclient簡易検証スクリプトは一時成果物でGit管理外。主要結果と保証範囲は本文へ記録した。

```bash
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

通常lint対象外の変更test/**/*.ts 12ファイルを、既存ESLint APIとtypescript-eslint推奨規則で追加検査。0 errors/0 warnings。共有設定の変更なし。
clientはリポジトリルートから `node /tmp/item-draft-client-check.cjs` を実行。
TypeScriptで変更4ファイルを構文確認し、実API/hookをVMへロード、React useCallback・apiFetch・fetchのみ依存境界を置換した。S3実通信の成功は保証しない。

## DBの安全条件と結果

新APIの専用databaseSetupはDB import前にserver/.env.testの出所、NODE_ENV=test、PostgreSQL・設定DB名test_dbを検査する。
全3接続（src/db、Model registry、observer）で設定名とcurrent_database()=test_dbを確認し、ItemDraft/ItemEditing/Userの全Model列存在/NULL制約、Draft全列型・所有者FK・必要default、READ COMMITTEDを確認してからfixtureを書き込んだ。
D06は独立transactionごとのPIDを取得し、observerのpg_blocking_pidsとLock待機で先行・後続の実待機を確認。時間経過だけで排他としない。
作成IDを追跡し、全処理回収後にDraft→Editing→User順で対象ID限定cleanup、残存0件、hook/spy解除、全接続close・env復元が成功。
作成API回帰も既存の.env.test/全接続ガードと自作ID限定cleanupを通過。返却IDと新規SELECTの行IDを照合した。
外側commit Promiseのモック保留と実DB rollbackを区別し、実COMMIT応答喪失の再現はしていない。

## 修正・再検証の履歴

| ID | 初回結果・原因 | 修正/再実行と最終結果 |
| --- | --- | --- |
| 環境DB | sandboxの接続EPERM。36件はsetupでpending、本体未実行 | 同じガードと対象を権限付き再実行、36件成功 |
| 環境HTTP | sandboxのlisten拒否で503件中61件失敗、442件成功 | 権限付きで再実行し、待受問題を解消 |
| F1/H10 | 上記再実行は502成功/1失敗。Draft HTTPテストの大文字URLだけITEM-EDITINGが残存 | ITEM-DRAFTへ訂正。関連回帰を含む最終676件成功 |
| 環境lint | 追加lintの対象取得用子プロセスがEPERM | 同じ検査を権限付き再実行、12ファイル0診断 |

## 対象外の残件

動画変換API追加時点では、基本設計のcreateItemDraftが元item_editingを削除する一方、実装は元行を保持していた。
動画変換は返却されたitemDraftIdを使うため元行保持に依存しない。動画変換API追加時には削除動作を変えず、[別Todo](../../../../../docs/todo/done/create-item-draft-retains-editing-session.md)へ記録した。その後の元編集セッション消費の修正で解消済み（当該Todoの完了記録参照）。
画面GET API全体の新テーブルへの移行とブラウザでの保存→編集再開→公開の通し確認は今回の検証外。
