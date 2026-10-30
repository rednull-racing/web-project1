# getItemDraftPageMetadata テスト設計

2026-10-30。[詳細設計](../../../../../docs/design/backend/detail/itemDraft/getItemDraftPageMetadata.md)とユーザー回答（120回/分、id/nameのみ）を根拠とする。パスはserver/基準。結果は[レポート](../../report/itemDraft/getItemDraftPageMetadata.md)へ記録する。

## 対象・境界・配置

- service `services/itemDraft/query.ts#getMyItemDraftPageMetadata`：Model.findOneをモックしSQL optionsを保証。`src/services/itemDraft/test/getItemDraftPageMetadata.test.ts`。
- usecase `usecases/itemDraft/getItemDraftPageMetadata.ts`：serviceをモックし不存在・返却列・待機を保証。`src/usecases/itemDraft/test/getItemDraftPageMetadata.test.ts`。
- controller `controllers/itemDraft/itemDraft.ts`：各usecaseをモックし検証済み入力・応答を保証。`src/controllers/itemDraft/test/getItemDraftPageMetadata.test.ts`。
- HTTP：`test/integration/usecases/itemDraft/getItemDraftPageMetadata/route.test.ts`。最小Expressに実parser/Router/認証/制限/schema/controller/errorHandlerを接続、usecaseと対象外依存をモック。実アプリ全体は起動せず、共通prefixはroutes/index.tsと照合する。
- DB：`test/integration/database/itemDraft/getItemDraftPageMetadata/database.test.ts`。実usecase/service/Modelを使い所有者WHEREと公開列、不変条件を保証する。専用 `test/fixtures/itemDraft/getItemDraftPageMetadata/databaseFixtures.ts` は既存getItemDraftPage基盤を再利用する。
- 単体/HTTPのデータfixtureにはDB import・hookを持ち込まない。標準ID101/認証7、名称・null・空文字・空白をケースごとに生成する。取得Modelを代用する型アサーションはモック境界に限定。

## ケース（P0を優先、待機・接続はP1、反復・並行はP2）

| ID | レベル・前提／手順 | 期待結果・停止位置 |
| --- | --- | --- |
| S01 | service：所有者IDと対象IDを渡す | findOne完全一致：attributes id/name、where id/seller_id、include/lock/transactionなし。同じ参照を返す |
| S02 | service：null／DB例外 | null保持／元例外の同一参照伝播、再試行なし |
| U01 | usecase：name値/null/空/空白・余剰列付きModel | id/nameだけを完全一致で返し元データ不変 |
| U02 | usecase：検索null | AppError型/code ITEM_DRAFT_NOT_FOUND/statusCode404、後続なし |
| U03 | usecase：service reject | 元例外を伝播 |
| U04 | usecase：取得を保留／並行要求を交差 | 保留中未完了、解放後結果。別要求のID/name混入なし |
| C01 | controller：raw params/body/queryと検証済みIDを異なる値にする | validatedParams.idとreq.user.idのみを渡し200 {itemDraft}、nextなし |
| C02 | controller：404/通常例外 | 同じ参照をnextへ、成功status/jsonなし |
| C03 | controller：成功/失敗のPromiseを保留 | 保留中status/json/nextなし、解放後に契約どおり応答/伝播 |
| C04 | controller：JSON送信throw | nextへ伝播、usecase再実行なし |
| R01 | HTTP正常・ID1/2147483647・body/query所有者偽装 | 200 JSON完全一致、数値paramsと認証本人のID採用 |
| R02 | tokenなし/Basic/空/不正JWT/別鍵/期限切れ＋不正id | 401、usecaseなし |
| R03 | 0/負数/小数/非数値/上限超過等 | 400 INVALID_PARAMS、usecaseなし |
| R04 | coerce可能な16進/指数/先頭0等の表記 | schema契約どおり数値化 |
| R05 | 業務404/DB例外 | 404公開JSON／500固定応答、SQL・秘密マーカー非公開 |
| R06 | 不正JSON＋正常/無効/なしJWT | parserの400 INVALID_JSONが認証より先、usecaseなし |
| R07 | id欠落/余分なpath/定義外method | 404、取得なし |
| R08 | usecase保留 | HTTP JSONは完了まで未送信 |
| L01 | 同一ユーザー120回と121/122回 | 120回許可、以降429、standard/Retry-Afterヘッダー、legacyなし |
| L02 | 400/404/500を各120回 | 失敗要求も消費、次429 |
| L03 | 別ユーザー／JWT・IP・対象ID変更／未認証反復 | ユーザー別枠、同一ユーザーは回避不可、未認証は非消費 |
| L04 | 制限超過＋不正ID、59999/60000/60001ms | 429優先、窓終了で再開 |
| L05 | 別APIと独立、121並行要求 | 別APIのstore非共有、120許可/1拒否 |
| D01 | DB：関連・内部列付き所有行を取得 | id/nameだけ、対象・他人・別下書き・編集・商品・マスター不変 |
| D02 | DB：name null/空/空白/255文字 | 値を補完・trimせず返す |
| D03 | DB：他人/不存在/所有者null | 同じ404、保護対象不変 |
| D04 | DB：逐次/並行再読取 | 同じ結果、別要求混入なし、不変 |
| D05 | DB：fixture自身の対象を明示削除して再取得 | 404、他の行不変 |

JSONB・画像・関連の変換、書込み・transaction・rollback・外部通信は本APIに存在せず対象外。取得後の更新/削除との直列化は保証しない。

## DB前提と実行・完了条件

.env.test由来のNODE_ENV=test/PostgreSQL/test_dbを初期化前に検査。既存基盤のapp/models/observer/competitor全4接続で設定DB名とcurrent_databaseを確認し、必要なitem_draftの列・NULL・型・FKとfixture関連スキーマを検査後にseedする。schema不一致は自動補正しない。名前付きhookで全自作IDを追跡、全処理回収後FK順のID限定cleanup・残存0・hook解除・全接続close・env復元を行う。

server/で対象単体3ファイルとHTTPディレクトリを明示し `npm run test:run -- <対象>`、DBは `npm run test:run -- test/integration/database/itemDraft/getItemDraftPageMetadata/ --maxWorkers=1`（共有基盤hook干渉防止）。影響する既存itemDraft単体/HTTP回帰も明示実行。`npm run lint`、`npm run typecheck`、`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` と通常対象外TSのESLint追加検査を行う。全必須ケース成功、skip/未処理例外/未実装なし、成果物整合を完了条件とする。
