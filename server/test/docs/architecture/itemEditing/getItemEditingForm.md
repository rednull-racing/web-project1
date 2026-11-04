# getItemEditingForm テスト設計

設計日: 2026-11-04。パスはserver/基準。
仕様: [詳細設計](../../../../../docs/design/backend/detail/itemEditing/getItemEditingForm.md)。ユーザー確定事項は毎分80回、updatedAt/item_id非公開。

## 対象と境界

GET /api/item-editing/:id/form の接続と所有者限定参照を検証する。更新、S3操作、migration、フロント型変更は対象外。
service単体はModel.findOne、usecase単体はservice、controller単体はusecaseをモックする。HTTPは実Router/parser/JWT/schema/limiter/errorHandlerを最小Expressに接続しusecaseのみモックする。対象外usecaseは初期化前に遮断する。
実DBは実usecase/service/Modelを使用し、.env.test設定・全接続のtest_db・スキーマ確認後に自作行を作成、ID限定cleanup・残存確認・closeを行う。実アプリの全Router登録は静的照合とし、cron全体を起動しない。

## ケースと配置

IDのS/U/Cは各層単体、HはHTTP、DBは実DBを示す。P0は公開契約・認可、P1は待機・制限、P2は並行参照。

| ID | 優先度 | 前提・入力・手順 | 期待結果 | 配置 |
| --- | --- | --- | --- | --- |
| S01 | P0 | 所有者7、対象123、Modelが行を返す | where両ID、全取得列・任意include完全一致、lock/transactionなし、同じ行返却 | src/services/itemEditing/test/getItemEditingForm.test.ts |
| S02/S03/S04 | P1 | Modelがnull/例外/保留 | null返却、元例外伝播し再試行なし、保留中未完了解放後返却 | 同上 |
| U01/U02/U03 | P0 | 行/null/DB例外をserviceから返す | 両IDだけ渡す、同一行、404 AppError、元例外・再検索なし | src/usecases/itemEditing/test/getItemEditingForm.test.ts |
| U04/U05 | P1/P2 | service保留の成功/失敗、2要求を逆順完了 | 完了を待ち、要求間で結果が混ざらない | 同上 |
| C01/C02 | P0 | raw値へ偽装ID、検証済みID123・認証ID7、成功/例外 | 検証済み値のみ採用、200とitemEditingの1キー、例外はnextへ同一参照・成功応答なし | src/controllers/itemEditing/test/getItemEditingForm.test.ts |
| C03/C04 | P1 | usecase保留成功/失敗、json送信失敗 | 保留中応答なし、解放後応答/伝播、送信失敗時再取得なし | 同上 |
| H01/H02 | P0 | 正常、無認証/空/署名不正/期限切れ＋不正ID | 200と引数一致、401優先・usecase未実行 | test/integration/usecases/itemEditing/getItemEditingForm/route.test.ts |
| H03 | P0 | 1/2147483647/指数/16進/先頭0/空白付き、0/-1/小数/非数値/上限超過/Infinity/NaN/空白 | coerce後数値採用、不正は400と後続未実行 | 同上 |
| H04 | P0 | usecaseの404/内部例外 | 共通404/500完全一致、内部SQL非公開 | 同上 |
| H05 | P1 | 同一ユーザー80回→81回、対象変更、別ユーザー | 80回成功・81回429、既定本文/RateLimit/Retry-After、別枠 | 同上 |
| H06 | P1 | 80回後59999/60000/60001ms進行 | 窓直前429、一致/直後200 | 同上 |
| H07 | P1 | 400/404/500を80回→不正ID要求 | 失敗も計上、81回目429がparamsより優先 | 同上 |
| H08 | P1 | 未認証/不正JSONを81回→認証済み80回 | parser優先、401/400は枠未消費、後続未実行 | 同上 |

単体fixtureはsrc/usecases/itemEditing/test/getItemEditingForm.fixtures.ts、HTTP fixtureは既存getItemConfirmPage/httpFixtures.tsの副作用のない最小Express/JWT helperを再利用する。
実DB配置はtest/integration/database/itemEditing/getItemEditingForm/database.test.ts、専用fixtureはtest/fixtures/itemEditing/getItemEditingForm/databaseFixtures.ts。既存getItemConfirmPage/databaseSetup・databaseFixturesのhook/ガード/ID追跡を明示再利用する。

| ID | 優先度 | 前提・手順 | 期待結果 |
| --- | --- | --- | --- |
| DB01 | P0 | 全関連あり・normalをseed、実usecase取得 | 全公開列・保存JSONB/画像順/数値・親子/Brand/Optionのid/nameを完全一致、非公開列なし、observerの全追跡行snapshot不変 |
| DB02 | P0 | edit・任意関連/値nullを取得 | null/空JSON保持、item_id/updatedAt/管理列なし |
| DB03 | P0 | 他人/所有者null/削除済IDを所有者で取得（3条件） | AppError404同一code、全行不変 |
| DB04 | P1/P2 | 逐次再送と3対象並行取得 | 再送同一値、結果ID混同なし、全処理回収・全行不変 |
| DB05 | P0 | Category親なし子なし、画像[]、duration0 | parent:null/children:[]と空/0保持、全行不変 |
| DB06 | P1 | 読取後fixture側で更新→再取得→削除→再取得 | 最新保存値、削除後404、各参照はsnapshot不変 |

全3接続（app/models/observer）で設定DB名・実DB名、必要Model列/NULL、INTEGER/JSONB/ARRAY、所有者・関連FKを検査してからseedする。hookで追加行も追跡する。
参照専用のため書込み状態遷移・rollback・補償・通知・実更新ロックの検証は該当しない。JSONBは保存値の保持を確認し、新しい保存値検証を発明しない。並行更新との厳密な直列化を保証しない。

## 実行・完了条件

server/で対象5系統のgetItemEditingFormテストを指定して npm run test:run -- <各対象ファイル> を実行する。共有controllerとquery利用側のDBなし回帰も対象を明示して実行する。
npm run lint、npm run typecheck、./node_modules/.bin/tsc --noEmit -p test/tsconfig.json、通常対象外test/配下は既存typescript-eslintで追加検査する。
全必要ケース成功、skip・未処理例外・未解決事項なし、cleanup/close成功、設計・実装・[レポート](../../report/itemEditing/getItemEditingForm.md)の整合を完了条件とする。
