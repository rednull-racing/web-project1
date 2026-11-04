# getItemEditingForm テスト設計

設計日・追加取得の更新日: 2026-11-04。パスはserver/基準。
仕様: [詳細設計](../../../../../docs/design/backend/detail/itemEditing/getItemEditingForm.md)。ユーザー確定事項は毎分80回、updatedAt/item_id非公開、トップレベル7キー、hasShopはboolean、カテゴリー一覧は既存getAllLevel1()の全カラム取得維持。既存S01/DB01/DB05はCategory関連の5列契約へ、U01/C01/H01等は7キー契約へ更新し、既存の認可・制限・エラー観点は維持する。実行結果はレポートへ記録する。

## 対象と境界

GET /api/item-editing/:id/form の接続、所有者限定参照、フォーム用一覧と認証ユーザーの承認済みショップ有無を検証する。更新、S3操作、migration、フロント型変更は対象外。
service単体はModel.findOne、usecase単体はservice、controller単体はusecaseをモックする。HTTPは実Router/parser/JWT/schema/limiter/errorHandlerを最小Expressに接続しusecaseのみモックする。対象外usecaseは初期化前に遮断する。
実DBは編集データと追加6取得の実usecase/service/Modelを使用し、.env.test設定・全接続のtest_db・スキーマ確認後に自作行を作成、ID限定cleanup・残存確認・closeを行う。実アプリの全Router登録は静的照合とし、cron全体を起動しない。

## ケースと配置

IDのS/U/Cは各層単体、HはHTTP、DBは実DBを示す。P0は公開契約・認可、P1は待機・制限、P2は並行参照。

| ID          | 優先度 | 前提・入力・手順                                                                   | 期待結果                                                                        | 配置                                                                   |
| ----------- | ------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| S01         | P0     | 所有者7、対象123、Modelが行を返す                                                  | where両ID、Category/parent/childrenの5列を含む全取得列・任意include完全一致、lock/transactionなし、同じ行返却      | src/services/itemEditing/test/getItemEditingForm.test.ts               |
| S02/S03/S04 | P1     | Modelがnull/例外/保留                                                              | null返却、元例外伝播し再試行なし、保留中未完了解放後返却                        | 同上                                                                   |
| U01/U02/U03 | P0     | 行/null/DB例外をserviceから返す                                                    | 両IDだけ渡す、itemEditingへ同一行と追加一覧の同一参照を格納した7キー、404 AppError、元例外・再検索なし、取得失敗時は追加6取得未実行                          | src/usecases/itemEditing/test/getItemEditingForm.test.ts               |
| U04/U05     | P1/P2  | service保留の成功/失敗、2要求を逆順完了                                            | 編集取得完了を待って追加取得、要求間でitemEditing・一覧・hasShopが混ざらない                                            | 同上                                                                   |
| C01/C02     | P0     | raw値へ偽装ID、検証済みID123・認証ID7、成功/例外                                   | 検証済み値のみ採用、200と7キーのusecase結果をそのままjsonへ渡す、例外はnextへ同一参照・成功応答なし | src/controllers/itemEditing/test/getItemEditingForm.test.ts            |
| C03/C04     | P1     | usecase保留成功/失敗、json送信失敗                                                 | 保留中応答なし、解放後応答/伝播、送信失敗時再取得なし                           | 同上                                                                   |
| H01/H02     | P0     | 正常、無認証/空/署名不正/期限切れ＋不正ID                                          | 7キーの200 JSON完全一致と引数一致、401優先・usecase未実行                                           | test/integration/usecases/itemEditing/getItemEditingForm/route.test.ts |
| H03         | P0     | 1/2147483647/指数/16進/先頭0/空白付き、0/-1/小数/非数値/上限超過/Infinity/NaN/空白 | coerce後数値採用、不正は400と後続未実行                                         | 同上                                                                   |
| H04         | P0     | usecaseの404/内部例外                                                              | 共通404/500完全一致、内部SQL非公開                                              | 同上                                                                   |
| H05         | P1     | 同一ユーザー80回→81回、対象変更、別ユーザー                                        | 80回成功・81回429、既定本文/RateLimit/Retry-After、別枠                         | 同上                                                                   |
| H06         | P1     | 80回後59999/60000/60001ms進行                                                      | 窓直前429、一致/直後200                                                         | 同上                                                                   |
| H07         | P1     | 400/404/500を80回→不正ID要求                                                       | 失敗も計上、81回目429がparamsより優先                                           | 同上                                                                   |
| H08         | P1     | 未認証/不正JSONを81回→認証済み80回                                                 | parser優先、401/400は枠未消費、後続未実行                                       | 同上                                                                   |

追加取得のケースも`src/usecases/itemEditing/test/getItemEditingForm.test.ts`へ配置する。依存6取得は`getAllLevel1`・`getAllCondition`・`getAllShippingDay`・`getAllShippingService`・`getAllTodouhuken`・`getUserHasShop`をそれぞれモックし、全呼出しの回数・引数を検査する。一覧は取り違えを検出できる異なる値を用い、空配列も保持する。

| ID | 優先度 | 前提・入力・手順 | 期待結果 |
| --- | --- | --- | --- |
| U06 | P0 | ユーザー取得null、ShopInfo:null、ShopInfoありを個別に返す | hasShopはfalse/false/trueのboolean、ショップ検索に認証済みuserIdのみを渡し、User/ShopInfo本体は結果へ含めない |
| U07 | P0 | 編集取得成功後、追加6依存を一つずつreject | 同じ例外を伝播、成功結果なし、再取得なし。開始済み並列処理の取消しは期待しない |
| U08 | P1 | 追加6依存を一つずつdeferredで保留し、他は完了 | 6取得が並列開始し保留中はusecase未完了、解放後に全7キーを返す。開始した処理はfinallyで解放・回収 |

単体fixtureはsrc/usecases/itemEditing/test/getItemEditingForm.fixtures.ts、HTTP fixtureは既存getItemConfirmPage/httpFixtures.tsの副作用のない最小Express/JWT helperを再利用する。
実DB配置はtest/integration/database/itemEditing/getItemEditingForm/database.test.ts、専用fixtureはtest/fixtures/itemEditing/getItemEditingForm/databaseFixtures.ts。既存getItemConfirmPage/databaseSetup・databaseFixturesのhook/ガード/ID追跡を明示再利用する。

| ID   | 優先度 | 前提・手順                                      | 期待結果                                                                                                            |
| ---- | ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| DB01 | P0     | 全関連あり・normalをseed、実usecase取得         | 全公開列・保存JSONB/画像順/数値・Category親子のid/name/allowed_gender/allowed_age/parent_id、Brand/Optionのid/nameを完全一致、非公開列なし、observerの全追跡行snapshot不変 |
| DB02 | P0     | edit・任意関連/値nullを取得                     | null/空JSON保持、item_id/updatedAt/管理列なし                                                                       |
| DB03 | P0     | 他人/所有者null/削除済IDを所有者で取得（3条件） | AppError404同一code、全行不変                                                                                       |
| DB04 | P1/P2  | 逐次再送と3対象並行取得                         | 再送同一値、結果ID混同なし、全処理回収・全行不変                                                                    |
| DB05 | P0     | Category親なし子なし、画像[]、duration0         | Categoryの5列とparent:null/children:[]、空/0保持、全行不変                                                                         |
| DB06 | P1     | 読取後fixture側で更新→再取得→削除→再取得        | 最新保存値、削除後404、各参照はsnapshot不変                                                                         |
| DB07 | P0 | 編集データの選択カテゴリーとは別に、異なるsort_orderのlevel1とlevel2を用意し実usecase取得 | categoryは全level1のみをsort_order ASCで全カラム返し、各Option一覧も全カラム取得。自作マスターが含まれ、対象・他人の行とマスターが不変 |
| DB08 | P0 | ショップ未登録、未承認、承認済みを認証ユーザーで取得。他ユーザーの承認済みショップも用意 | hasShopはfalse/false/true、他ユーザーのショップでtrueにならず、7キー以外にUser/ShopInfoを公開しない。追跡したショップも不変・ID限定cleanup |

全3接続（app/models/observer）で設定DB名・実DB名、必要Model列/NULL、INTEGER/JSONB/ARRAY、所有者・関連FKを検査してからseedする。ショップ検証で使うShopInfoも全接続で必要列・NULL・user_id関連を確認し、自作ショップをID追跡・snapshot・FK順cleanupの対象とする。hookで追加行も追跡する。
参照専用のため書込み状態遷移・rollback・補償・通知・実更新ロックの検証は該当しない。JSONBは保存値の保持を確認し、新しい保存値検証を発明しない。並行更新との厳密な直列化や、複数参照の同時点snapshotは保証しない。

## 実行・完了条件

server/で対象5系統のgetItemEditingFormテストを指定して npm run test:run -- <各対象ファイル> を実行する。共有controllerとquery利用側のDBなし回帰も対象を明示して実行する。
npm run lint、npm run typecheck、./node_modules/.bin/tsc --noEmit -p test/tsconfig.json、通常対象外test/配下は既存typescript-eslintで追加検査する。
全必要ケース成功、skip・未処理例外・未解決事項なし、cleanup/close成功、設計・実装・[レポート](../../report/itemEditing/getItemEditingForm.md)の整合を完了条件とする。
