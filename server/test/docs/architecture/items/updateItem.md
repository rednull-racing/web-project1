# updateItem テスト設計

設計日: 2026-10-23。パスはserver/基準。根拠は[詳細設計](../../../../../docs/design/backend/detail/items/updateItem.md)と同日のユーザー回答。対象はPUT /api/itemsの実装全体と、createItemのname/title空文字拒否の回帰。URL実体・AWS・動画変換・実COMMIT応答喪失・負荷試験は対象外。

## 対象と境界

- U: `src/usecases/items/update/test/updateItem.test.ts`。実usecaseとnormalizeJapanese、DB service・transaction・validateMasterをモック。変換・分岐・引数・待機・停止を保証し、実DBを保証しない。
- S: `src/services/items/{query,command}/test/updateItem.test.ts`とvideo/sale/shipping近接test。実service、Model境界をモック。所有者where・lock・同一transaction・既存instance更新を確認。
- M: `test/integration/usecases/items/updateItem/master.test.ts`。実usecaseとvalidateMasterを接続、DB service境界をモック。
- V/C: validator/controller近接`test/updateItem.test.ts`。実schema、実controller（usecaseモック）。型変換なし・validated値採用・応答/例外を確認。
- H: `test/integration/usecases/items/updateItem/{route,registration}.test.ts`。実Express/parser/JWT/rate limiter/Router/controller/errorHandlerと実registerRoutesの接続を区別。usecase・対象外依存はモック、DB非接続。
- D: `test/integration/database/items/updateItem/`。実usecase/service/Model/PostgreSQL。通知だけモック。保存・所有者条件・rollback後新規SELECTを確認。
- P/実DB HTTP: `test/integration/usecases/items/updateItem/{concurrency,databaseHttp}.test.ts`。独立transaction・observerで実待機/commit可視性とHTTP応答を確認。

## fixtureと処理

`test/fixtures/items/updateItem/`に純粋データ・usecaseモック・HTTP・DB・競合準備を分離。既存createItemの純粋データfactoryを再利用する場合も、DB setupやhookの評価を伴わないことを確認する。正常セッションはid=11/userId=7/status=edit/item_id=456、price=12340、全必須URL/IDと商品・色・サイズ在庫を持つ。更新先item/関連IDを区別する。日時はUのみ固定する。

公開保存値は詳細設計5章と完全対応。current以外のJSON、関連ID、seller_id/createdAt/管理列/video.play_countの保持を確認する。期待値は既知値を列挙し、実装の変換をhelperで再実装しない。

## ケース

P0は認可・入力・原子性、P1は接続・境界・副作用。表のIDとit.each展開件数は別集計。

| ID / 優先度 | レベル | 条件・手順 | 期待結果・停止位置 |
| --- | --- | --- | --- |
| N01 / P0 | U/D/H | 所有editセッションを更新 | 201/既存itemId、4行同ID更新、全コピー列・保持列・元セッション消費・非対象不変 |
| N02 / P0 | U/D | 商品/色/サイズinitialとcurrentが異なる、商品initial=0/1、更新前active/soldout | currentのみ復元し0=soldout、1以上=active。編集セッションstatusとの混同なし。元JSON不変・別参照 |
| N03 / P1 | U/D | 全半角/カタカナ/空白、親なし/不在、user_name=null、通知保留/失敗 | search_text正規化、fallback、commit後のみ通知・非待機・失敗捕捉、更新結果維持 |
| V01 / P0 | V/H | itemEditingId=1/2147483647、0/負数/小数/型/欠落、body外IDと偽装所有者 | 厳密数値・不正400、未知キー除去、body以外で補完なし、拒否後usecase未実行 |
| H01 / P0 | C/H | 実JWT/Controller引渡し/公開応答・例外/保留 | 認証済みuserIdとvalidatedBodyのみ採用、201、next同一例外、完了まで応答なし |
| H02 / P0 | H | 不正JSON/未認証/schema拒否/業務失敗、5/6回、窓境界、ユーザー・IP/token/ID/POST変更 | parser→認証→制限→schema、拒否順・消費・独立性・標準header・共通errorHandler |
| E01 / P0 | U/D | sessionなし/他人/normal/item_id不正、商品なし/他人、各関連なし | 404/400/500の所定code、更新/元行消費/通知なし |
| E02 / P0 | U/D/M | 空name/title、URL欠落、画像0/1/10/11、価格299/300/1000000/1000001、必須/任意IDとマスター | 所定400/404、公開検証順、更新なし。name/title空白のみはtrimを追加しない |
| E03 / P0 | U/D | attributes全体/各階層/後方要素不正、商品inventory欠落、各inventoryキー欠落/null/不正/非有限、initial負数/小数 | 構造500/業務400、後続と元データ変更なし。NaN/undefined等はU直接注入と明示 |
| T01 / P0 | U | 各取得/更新/削除reject、依存保留、開始/外側transaction rejectと保留、通知reject | 同一t、後続停止、外側完了まで通知/成功なし。モックのrollback保証なし |
| S01 / P1 | S | 所有者検索・FKごとの取得、null FK/取得欠落、各検索reject/保留、各instance更新 | 正しいwhere/列/ロック順/同一t、元例外、更新完了待ち。実ロックはP |
| M01 / P1 | M | 実validateMasterの各マスター不在/存在/取得失敗 | 個別404、順序・同一t、後続更新なし。親欠落は許容 |
| D01 / P0 | D | 実DBで正常更新・保存境界・所有権と状態拒否・再送 | 新規SELECTの全4行とFK・保持列・元行消費・非対象不変 |
| D02 / P0 | D | 各更新後/削除後の注入失敗、修復再試行 | 先行書込みの実実行後にrollback、全行復元・再試行成功 |
| P01 / P0 | P | 同一セッションcommit/rollback・別セッション同商品・別商品 | pg_blocking_pidsで実待機、先行commit後404/rollback後成功、別セッションは順に成功 |
| P02 / P0 | P | セッション保存/所有者変更/削除・商品所有者変更/削除を先行 | 待機後の最新値で更新または404、古いsnapshotで更新なし |

## 実DBの前提と後片付け

`.env.test`由来NODE_ENV=test/DATABASE_URLのDB名test_dbをModel import前に検査。引数なしdotenvも検証済みparsedだけを返し、別envや差替えを拒否する。アプリ・Model・observer・competitorの全接続について接続前設定DB名、接続後current_database=test_db、必要スキーマを確認後にseedする。ガード不成立・スキーマ不足は中断しmigration/syncで補正しない。

実待機はREAD COMMITTEDとプール余裕を確認し、transaction PID間のpg_blocking_pidsを期限付き観測する。固定sleepやPromise.allだけで排他を保証しない。finallyで全gate解放・Promise/transaction回収後、自作IDだけをFK順cleanupし残存0、hook/spy解除、全接続closeとenv復元を確認する。

## 実行と完了条件

対象コマンド（server/。実行結果はレポートを参照）:

```bash
npm run test:run -- src/usecases/items/update/test src/services/items/query/test/updateItem.test.ts src/services/items/command/test/updateItem.test.ts src/services/video/test/updateItem.test.ts src/services/sale/test/updateItem.test.ts src/services/itemShippingProfile/test/updateItem.test.ts src/controllers/items/test/updateItem.test.ts src/validators/body/test/updateItem.test.ts test/integration/usecases/items/updateItem/route.test.ts test/integration/usecases/items/updateItem/registration.test.ts test/integration/usecases/items/updateItem/master.test.ts --maxWorkers=1
npm run test:run -- test/integration/database/items/updateItem test/integration/usecases/items/updateItem/databaseHttp.test.ts test/integration/usecases/items/updateItem/concurrency.test.ts --maxWorkers=1
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

maxWorkers=1はfixture hookやモック・接続準備のファイル間干渉を抑えるため。ケース内競合の代用ではない。通常lint外の変更test/**/*.tsはtypescript-eslint推奨ルールで別途検査。createItemの空文字拒否関連回帰も別途実行する。

全必要ケース・静的検査成功、schema/cleanup/close成功、未処理例外・必須skip/未実行なしで完了。[レポート](../../report/items/updateItem.md)に実行範囲と限界・修正を記録し、未実装/未実行は完了としない。
