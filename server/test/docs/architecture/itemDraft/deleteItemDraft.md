# 下書き商品削除：テスト設計書

## 2026-10-22 削除済みカラムへの対応

`item_draft.item_id` は削除済み。作成時の初期値・nullable参照・取得カラム・FKとして要求しない。未知入力の除去と保存データへの非混入は維持する。以下の初回設計中の旧カラムに関する記述より、この契約を優先する。

2026-10-19追記：共有ErrorHandlerのJSON入力仕様を独立して変更した。[独立設計書](../ErrorHandler/errorHandler.md) に基づき、O03は正常/なし/不正JWTすべてで400/INVALID_JSONを期待するAF-JSON01へ更新した。旧500観測はレポート履歴に残す。通常ErrorのR06は500を維持する。

## 1. 目的・根拠・今回の範囲

認証済みユーザー自身の下書きだけを物理削除し、削除確定後に成功を応答する契約を検証する。正常応答だけでなく、所有権の取り違え、入力による認可回避、途中失敗による消失、競合による二重成功を検出する。

- 仕様の根拠：[deleteItemDraft 詳細設計](../../../../../docs/design/backend/detail/itemDraft/deleteItemDraft.md) の2〜8節。
- 実装の基準：コミット `f7bea400`、2026-10-19時点。将来のテスト実装前に差分を再確認する。
- 配置・設計規則：[test/AGENTS.md](../../../AGENTS.md)、[architecture/AGENTS.md](../AGENTS.md)。以下のコードパスは、特記がない限り `server/` 基準。
- 今回は本設計書だけを作成する。本番コード、既存テスト、fixture、設定、DBは変更しない。ケース表は実施予定であり、実装済み・検証済みの結果ではない。
- 対象外：S3への実通信、他APIの全機能、認証基盤の全面監査、分散レート制限の新設、DBスキーマ変更。対象外の保証をケース数やカバレッジで補ったことにしない。

## 2. 調査対象と現在の配置

| パス・関数                                                                     | 責務・確認事項                                                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `src/routes/itemDraft.ts`                                                      | `DELETE /:id`。認証→削除用レート制限→params検証→controller                                  |
| `src/routes/index.ts` の `registerRoutes`                                      | `/api/item-draft` に登録。HTTPテストは `/api/item-draft/:id` を使う                         |
| `src/middleware/authMiddleware.ts` の `authenticateToken`                      | Bearer JWTを検証し `req.user` を設定。欠落・不正は直接401応答                               |
| `src/middleware/rateLimit/itemDraftRateLimit.ts` の `deleteItemDraftRateLimit` | 5分20回、キーは `admin:${user.id}`。削除用に独立したストア。失敗要求も数える                |
| `src/validators/params/id.ts` の `idParamSchema`                               | `z.coerce.number().int().positive().max(2147483647)`                                        |
| `src/middleware/validate/validateParams.ts` の `validateParams`                | 成功値を `req.validatedParams` に格納。不正時は `AppError("INVALID_PARAMS",400)` をthrow    |
| `src/controllers/itemDraft/itemDraft.ts` の `deleteItemDraftController`        | 検証済みidと認証ユーザーをusecaseへ渡す。完了後200、例外はnext                              |
| `src/usecases/itemDraft/deleteItemDraft.ts` の `deleteItemDraftUseCase`        | managed transaction開始、所有者条件付き取得、不存在404、取得した1件を削除                   |
| `src/services/itemDraft/query.ts` の `getMyItemDraft`                          | `where: {id:itemDraftId,seller_id:userId}`、`lock:transaction.LOCK.UPDATE`、同一transaction |
| `src/services/itemDraft/command.ts` の `deleteItemDraft`                       | `itemDraft.destroy({transaction})` をawait。戻り値void                                      |
| `src/types/serviceType/itemDraft.ts`                                           | 取得のtransactionは必須、削除は任意型。本APIは両方へ必ず同じtransactionを渡す               |
| `src/models/item_draft.ts`、`src/models/index.ts`                              | INTEGER主キー、seller_id nullable、status列・paranoid設定なし、参照関係                     |
| `src/usecases/itemEditing/createItemEditingDraft.ts`                           | 同じ下書きをロックし、item_editing作成後に下書き削除。競合相手として実行する                |
| `src/services/itemEditing/command.ts`、`src/models/item_editing.ts`            | 編集開始競合に必要な作成処理とモデル                                                        |
| `src/errors.ts`、`src/middleware/errorHandler.ts`                              | AppErrorのcode/statusCode、500の公開JSON形                                                  |
| `src/db.ts`                                                                    | `.env.test` 読込みと `test_db` ガード。managed transactionの実接続                          |
| `src/app.ts`                                                                   | JSON parserは認証より前。直接importするとcronが起動するため、最小Express構成で検証する      |

既存の `src/services/itemDraft/test/createItemEditingDraft.test.ts` は共有取得・削除サービスの呼出し契約を一部確認している。`createItemDraft` のcontroller/usecase/service単体、`test/integration/usecases/itemDraft/createItemDraft/`、`test/integration/database/itemDraft/createItemDraft/`、`test/fixtures/itemDraft/createItemDraft/`、[既存レポート](../../report/itemDraft/createItemDraft.md) も参考にする。ただし、別機能の成功件数を削除APIの検証結果に流用しない。

調査時点で、削除API専用のテスト・fixture・レポートは未作成。共通IDスキーマに専用のparams単体テストはない。共有サービスの既存テストを壊したり、作成APIの古い観測事項を本APIの仕様へ転記したりしない。

## 3. 契約と停止位置

```text
認証 → レート制限 → params検証 → controller
  → transaction開始 → 所有者条件＋FOR UPDATE取得
  → 不存在なら404 / 存在すればdestroy → commit → 200
```

| 条件                   | 公開応答                                                                      | 後続停止・DB結果                                                      |
| ---------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| トークンなし           | 401、`{message:"トークンがありません。"}`                                     | レート枠を消費せず、validator/controller/usecase未実行                |
| トークン不正・期限切れ | 401、`{message:"トークンが無効です。"}`                                       | 同上                                                                  |
| 21回目以降             | 429、express-rate-limitの現行既定応答                                         | validator/controller/usecase未実行。アプリ独自のJSON codeを仮定しない |
| id不正                 | 400、`{code:"INVALID_PARAMS",message:"INVALID_PARAMS"}`                       | transaction未開始。要求はレート枠へ計上                               |
| 対象なし・他人の対象   | 404、`{code:"ITEM_DRAFT_NOT_FOUND",message:"ITEM_DRAFT_NOT_FOUND"}`           | 取得後の削除なし。transaction終了、対象外行不変                       |
| 通常のDB例外           | 500、`{error:"INTERNAL_SERVER_ERROR",message:"サーバーエラーが発生しました"}` | 業務層で別Errorに置換しない。開始済みtransactionは失敗終了            |
| 正常                   | 200、`{message:"下書き商品を削除しました"}`                                   | commit後、対象の1行のみ不存在。JSON Content-Type                      |

取得・削除・transactionの例外は、単体では元Errorの同一参照、HTTPでは公開JSONを検証する。既知のAppErrorには型・code・statusCodeをassertする。401/429に `INVALID_PARAMS` や500用JSONを強制しない。

### 引渡し対応

| 取得元                           | 引渡し先                            | 検証する値・禁止する混入                             |
| -------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| `req.validatedParams.id`         | usecaseの `itemDraftId`             | number。raw params、body、queryのidを使わない        |
| `req.user.id`                    | usecase・取得serviceの `userId`     | 認証ユーザー。body/queryのseller_id/userIdを使わない |
| transaction callbackのt          | 取得・削除service、findOne・destroy | 全段で同じ参照。別transactionやundefinedを渡さない   |
| 所有者条件で取得したインスタンス | 削除serviceの `itemDraft`           | 同じ参照。再構築・別行の利用なし                     |

## 4. レベル、配置、実処理とモック

次のファイル名は追加予定。ディレクトリ規則は [単体](../../../../src/AGENTS.md)、[結合DB](../../../integration/database/AGENTS.md)、[結合usecase/HTTP](../../../integration/usecases/AGENTS.md)、[fixture](../../../fixtures/AGENTS.md) に従う。

| 記号・レベル                    | 予定配置                                                                               | 実処理 / モック境界・保証の限界                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| V：単体                         | `src/validators/params/test/id.test.ts`                                                | 実schema。数値化と拒否条件。HTTP到達性は保証しない                                                                  |
| M：単体                         | `src/middleware/validate/test/deleteItemDraft.test.ts`                                 | 実validateParams＋実schema、部分Request/Response/next。失敗はthrowとして捕捉                                        |
| C：単体                         | `src/controllers/itemDraft/test/deleteItemDraft.test.ts`                               | 実controller、usecaseをモック。同じモジュールがimportするcreateItemDraftUseCaseも実パスでモックしDB/AWS初期化を防ぐ |
| U：単体                         | `src/usecases/itemDraft/test/deleteItemDraft.test.ts`                                  | 実usecase、DBインスタンスのtransactionと2つのserviceをモック。callback/引数/待機/例外のみ                           |
| S：単体                         | `src/services/itemDraft/test/deleteItemDraft.test.ts`                                  | 実取得・削除service、モデルfindOne・対象インスタンスdestroyをモック。SQL契約のみ                                    |
| R：HTTP結合、DBなし             | `test/integration/usecases/itemDraft/deleteItemDraft/route.test.ts`                    | 実Router・JWT認証・レート制限・params・controller・共通errorHandler、usecaseのみモック。作成usecaseも遮断           |
| O05：共有schema接続回帰、DBなし | `test/integration/usecases/itemDraft/deleteItemDraft/sharedIdRoutes.test.ts`           | 既存のcategories読取・itemEditing更新Routerを実行し、controller以下の依存を遮断。共通schemaの境界までの接続のみ     |
| H：HTTP＋実DB結合               | `test/integration/usecases/itemDraft/deleteItemDraft/routeDatabase.test.ts`            | 最小Expressから実usecase/service/model/DBまで。外部通信は遮断し、作成usecaseだけを必要に応じてモック                |
| D：DB結合                       | `test/integration/database/itemDraft/deleteItemDraft/database.test.ts`                 | 実usecase/service/model/PostgreSQL。所有権・削除範囲・状態変化                                                      |
| T：transaction結合              | `test/integration/usecases/itemDraft/deleteItemDraft/databaseTransactions.test.ts`     | 実DB。待機・障害注入箇所だけラッパーspy。commit/rollback後の再SELECT                                                |
| P：並行結合                     | `test/integration/usecases/itemDraft/deleteItemDraft/databaseConcurrency.test.ts`      | 独立transactionで削除/編集開始を実行。実ロック待ちと解除後の結果                                                    |
| fixture/setup                   | `test/fixtures/itemDraft/deleteItemDraft/{fixtures,databaseSetup,databaseFixtures}.ts` | factory・deferred / 接続前ガード / seed・observer・作成ID追跡・cleanupを分離                                        |
| 将来の実行結果                  | `test/docs/report/itemDraft/deleteItemDraft.md`                                        | ケースID・ファイル・実施範囲・件数・未確認を対応。本タスクでは作成しない                                            |

R/Hで最小アプリへ実 `errorHandler` を接続し、専用の観測middlewareだけで500整形まで検証済みにしない。アプリ全体のcron、CORS、NGINX、実 `registerRoutes` 起動の網羅は対象外。登録パスはソース確認と区別して報告する。

## 5. fixture・共通アサーション

### 5.1 単体・HTTP

- 正常値は認証ユーザーA=7、他ユーザーB=8、下書きD1=101。U/Sのtransactionは型付きモックでUPDATEロック識別値を持たせる。インスタンスはテストごとにfactoryで作る。
- Cではraw paramsのidを999、validatedParams.idを101にして取り違えを検出する。body/queryに別ユーザー・別idを混入しても `{itemDraftId:101,userId:7}` の完全一致を期待する。
- deferredは「開始通知」と「解放用Promise」を別にする。取得・削除・transaction全体・usecaseを個別に保留し、前段終了前に後続や応答が出ないことを確認する。
- beforeEachで履歴・実装・標準戻り値をリセット。spy・timer・env・rate storeは各ケースで分離し、afterEachで復元する。拒否を検証するPromiseは先に捕捉し、finallyで解放・回収する。
- JWT鍵はテスト専用に生成、dotenvを遮断し `vi.stubEnv` で設定する。正常JWTのidはnumber。署名を検証せずdecoded値を直接設定するモックでは認証を検証済みにしない。
- Rの時間窓は固定時刻と実ストアのreset時点を基準にする。Date・interval等だけを制御してHTTP I/Oを止めない。store resetを伴うtimerを進め、境界の直前/到達/直後を別ケースにする。JWTの有効期間は時間操作より十分長くする。

### 5.2 実DB

| fixture                                                                 | 目的・比較内容                                                                    |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A/B、必要に応じ管理者C                                                  | 認可とユーザー別レート枠。DB採番IDを使用し、単体の7/8を実DB固定IDとして流用しない |
| AのD1、AのD2、BのD3、seller_id=nullのD4                                 | 対象・同一所有者別行・他人行・所有者未設定行を分離                                |
| D1と同じメディアURLを持つ別下書き                               | URL単位の誤った一括削除を検出                                             |
| 参照先item、user、categories、brands、brand_aliases、状態・配送マスター | FKの実在と削除方向を検証。下書きの削除で親を削除しない                            |
| 既存item_editing、別下書き由来のitem_editing                            | 既存編集データが不変。編集開始競合で生まれる新規行と区別                          |
| メディアあり/全nullable列null/attributes空/画像空配列                   | 作成時の必須入力を削除へ誤って再要求していないことを確認                          |

各ケースのseedは必要な親から作りcommitしておく。比較対象行は全列のスナップショットを取り、件数だけでなくid、seller_id、配列順序、JSONB、メディアURL、createdAt/updatedAtも比較する。削除対象は新規SELECTで不存在、非対象は全列不変を基本とする。rollback後は元インスタンスの状態を判定に使わない。

実S3オブジェクトを用意せず、呼び出し可能なS3境界をspy/モックして削除・アップロードが0回であることを確認する。実S3の残存確認を済ませたとは記載しない。共有URLでも他の下書きと編集データは維持される。

## 6. 単体：入力とvalidateParams

同一ID内の列挙値は `it.each` で独立ケースへ展開する。HTTPではparamsは文字列のため、オブジェクト値・boolean・配列の直接schema呼出しは通常HTTP経路と区別する。

| ID  | 優先度・レベル | 条件・入力                                                                      | 期待結果・後続停止                                                                                            |
| --- | -------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| V01 | P0・V          | id=`"1"`,`"2"`,`"2147483646"`,`"2147483647"`                                    | 受理、出力idは同値のnumber。下限/上限一致と内側                                                               |
| V02 | P0・V          | `"0"`,`"-1"`,`"2147483648"`,`"9007199254740992"`                                | 拒否、issueのpathはid。下限/上限外側、巨大値                                                                  |
| V03 | P0・V          | `"0.5"`,`"1.5"`,`"2147483646.5"`,`"NaN"`,`"Infinity"`,`"-Infinity"`,`"abc"`     | 整数・有限性を満たさず拒否                                                                                    |
| V04 | P0・V          | `{}`,id=undefined/null/空文字/空白のみ                                          | 拒否。欠落を0等で補って受理しない                                                                             |
| V05 | P1・V          | `"1 OR 1=1"`,`"1;DROP TABLE item_draft"`,`"<script>1</script>"`,`"1/2"`,`"1,2"` | 拒否。idの検証エラー。SQL/HTMLとして実行しない                                                                |
| V06 | P1・V          | `{id:"101",seller_id:8,extra:"x"}`                                              | `{id:101}` に完全一致、未知キー除去。入力オブジェクト自体は変更しない                                         |
| V07 | P1・V          | 数値1/2147483647、数値0/-1/1.5/NaN/Infinity                                     | 正常数値は受理しnumber維持、それ以外は拒否。HTTPから直接来る型ではない旨を記す                                |
| M01 | P0・M          | params.id=`"101"`、未知キーあり                                                 | validatedParamsは `{id:101}`、nextは引数なし1回。raw paramsは不変                                             |
| M02 | P0・M          | V02〜V05の代表値と欠落                                                          | INVALID_PARAMS/400をthrow。next未実行、validatedParams未設定、response送信なし                                |
| M03 | P1・M          | 既存validatedParams入りの部分Requestへ不正paramsを直接渡す                      | 不正でnextなし。成功値で上書きしない。通常HTTPではRequestを再利用しないため、このケースを認可保証へ拡大しない |

`z.coerce.number()` が許す表記・非HTTP型はO01/O02で別記する。十進数字だけの厳格な文字列制約を本仕様へ追加しない。

## 7. 単体：controller・usecase

| ID  | 優先度・レベル | 条件・手順                                              | 期待結果・後続停止                                                                             |
| --- | -------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| C01 | P0・C          | 認証A、validated id=101、raw/body/queryには別id・所有者 | usecaseを `{itemDraftId:101,userId:7}` で1回だけ呼ぶ。余計な属性なし                           |
| C02 | P0・C          | usecaseがresolve(undefined)                             | status(200)、設計どおりのmessageだけのJSONを各1回。nextなし                                    |
| C03 | P0・C          | usecaseがAppError404/通常Errorをreject                  | 同じErrorをnextへ1回。status/jsonなし                                                          |
| C04 | P0・C          | usecaseを保留し、解放して成功/失敗                      | 保留中status/json/nextなし。成功後C02、失敗後C03。両方独立ケース                               |
| C05 | P1・C          | usecase成功後、jsonが通信失敗相当のErrorをthrow         | nextへ同じError。usecase再実行や復元処理なし。実ネットワーク断を再現したとはしない             |
| U01 | P0・U          | 取得成功、削除成功                                      | transaction1回。取得引数完全一致、削除引数完全一致、tとインスタンスの参照同一。戻り値undefined |
| U02 | P0・U          | getMyItemDraftがnull                                    | ITEM_DRAFT_NOT_FOUND/404。削除0回。callbackと外側transactionの失敗伝播を確認                   |
| U03 | P0・U          | transaction開始相当でcallbackを呼ばずreject             | 同じErrorが外へ伝播。取得・削除0回                                                             |
| U04 | P0・U          | getMyItemDraftがreject                                  | 同じError。削除0回、自動再試行なし                                                             |
| U05 | P0・U          | deleteItemDraftがreject                                 | 同じError。取得・削除各1回、作り直し・再削除なし                                               |
| U06 | P0・U          | callback完了後のtransaction Promiseだけをreject         | 同じError、成功返却なし。commit相当エラーの伝播のみで、実DB rollbackを保証しない               |
| U07 | P0・U          | 取得を保留→成功/不存在/例外で解放                       | 保留中削除0回・usecase未完了。解放後U01/U02/U04に対応                                          |
| U08 | P0・U          | 削除を保留→成功/例外で解放                              | 保留中callbackとusecase未完了。取得は1回、解放後のみresolve/reject                             |
| U09 | P0・U          | callback完了後もtransaction全体を別gateで保留           | usecase未完了。gate解放後にだけresolve。transactionをawaitしていない変異を検出                 |
| U10 | P1・U          | 異なるid/ユーザーの2呼出しを交差させる                  | tA/tBと取得インスタンスが各削除へ対応。共有変数による取り違えなし。実ロック効果はP系で確認     |

Uのtransactionモックはasync callbackへ同じtを渡し、callbackをawaitし、その例外を伝播させる。commit/rollbackが実際に発行されたという主張には使用しない。usecaseへ不正な型/負数を直接渡して400を期待しない。入力検証の責務はV/M/Rにある。

## 8. 単体：共有service

| ID  | 優先度・レベル | 条件・手順                       | 期待結果・後続停止                                                                                                                                     |
| --- | -------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S01 | P0・S          | itemDraftId=101,userId=7,tで取得 | findOne1回、whereは `{id:101,seller_id:7}` の完全一致、lockはt.LOCK.UPDATE、transactionはtの同一参照                                                   |
| S02 | P1・S          | findOneがモデル/nullを返す       | そのまま返す。モデルは同じ参照。serviceは404へ変換しない                                                                                               |
| S03 | P0・S          | findOneが例外                    | 同じErrorを伝播、別取得・削除なし                                                                                                                      |
| S04 | P1・S          | 取得options全体を確認            | attributesはquery.tsで列挙する全列と順序を明示したfixtureに一致。余分なinclude、status、paranoid、別ユーザー検索なし。本番配列を読んで期待値を作らない |
| S05 | P0・S          | モデルとtで削除                  | 取得対象のdestroyを `{transaction:t}` で1回。戻り値undefined。static一括destroyやsave/update/createなし                                                |
| S06 | P0・S          | destroyがreject                  | 同じErrorを伝播。再試行・復元用createなし                                                                                                              |
| S07 | P1・S          | findOne/destroyを個別保留        | 解放まで対象serviceが完了しない。成功/例外を独立確認                                                                                                   |

既存共有serviceテストの同等assertは対応IDを記録して再利用できる。不足ケースだけを追加し、同じ意味のテストの重複で件数を増やさない。任意transactionなしの削除は本APIの契約外であり、本API経由でundefinedを許容する期待値にしない。

## 9. HTTP結合：認証・入力・公開応答

Rは実middlewareを置き換えず、usecaseの未実行と、必要ならcall-through spyで後続段への未到達を確認する。Rの成功は永続削除の証明ではなく接続契約の確認。

| ID  | 優先度・レベル | 条件・入力・手順                                                          | 期待結果・後続停止                                                                          |
| --- | -------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| R01 | P0・R          | 正常JWT、DELETE /api/item-draft/101、bodyなし                             | 200・message完全一致、JSON、usecase引数 `{itemDraftId:101,userId:A}`。作成usecase未実行     |
| R02 | P0・R          | 無Authorization/Basic/空Bearer/壊れたJWT/別鍵署名/期限切れ                | 401、認証規約のmessage。usecase未実行。各方式独立                                           |
| R03 | P0・R          | V02〜V05のHTTPで表現可能なidをURLエンコードして送る                       | 400/INVALID_PARAMS、usecase未実行。復号でslash等になる表現はR07と区別                       |
| R04 | P0・R          | id=1/2147483647、usecaseは正常終了                                        | 200、数値idを引き渡す。存在はモック前提で、実DB境界行の削除を検証済みにしない               |
| R05 | P0・R          | AでBのidを指定した前提のAppError404/存在しない前提のAppError404           | 両方同じ404 JSON。所有者名・存在有無・内部データを追加しない。実認可はD/Hで検証             |
| R06 | P0・R          | usecaseが通常Error、SQL/接続文字列に見えるテスト専用文言を含めてreject    | 500 JSON完全一致、Error.message/stack/SQLをレスポンスへ露出しない                           |
| R07 | P1・R          | DELETE /api/item-draft、DELETE /api/item-draft/101/extra、未定義PUT/PATCH | 対象の削除usecase未実行。最小アプリの404を確認。別途定義済みPOSTを未定義と扱わない          |
| R08 | P0・R          | Aの認証、Bのseller_id/userIdと別idをbody/queryへ混入                      | URL idと認証Aだけで呼出し。bodyなしが正常で、追加キーを拒否する新仕様は期待しない           |
| R09 | P0・R          | 無認証＋不正id、署名不正＋不正id、無認証＋既にAの制限超過                 | 401優先。validator/usecase未実行、Aの枠に加算しない                                         |
| R10 | P0・R          | 認証済み・制限超過＋不正id                                                | 429優先。INVALID_PARAMSにならずusecase未実行                                                |
| R11 | P1・R          | 正常要求のusecaseを保留し解放                                             | HTTP応答完了前に保留点へ到達。保留中200送信なし、解放後R01。requestはthen等で実際に開始する |
| R12 | P1・R          | admin=trueの正常JWTで他人idを要求する前提                                 | usecaseへ管理者本人のuserIdを渡す。管理者フラグから所有者を差し替えない。実DBの拒否はD03    |

JSON parser以前の不正HTTPやproxy/WAFの挙動まで、認証→制限→paramsの順序保証へ含めない。構文的に壊れたJSON bodyはO03に分ける。

## 10. HTTP結合：レート制限と敵対的な反復

すべてRレベル。テストごとにモジュールとストアを分離し、前ケースの残り枠を引き継がない。IDを変える試行も同一ユーザーの削除枠として数える。

| ID  | 優先度・レベル | 条件・手順                                            | 期待結果・後続停止                                                                                                                                  |
| --- | -------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| L01 | P0・R          | 同じユーザー、時刻固定、正常要求を1〜20回→21回→22回   | 最初20回200、以後429。usecase20回。1回目・19/20/21回目のヘッダー残量も確認                                                                          |
| L02 | P0・R          | 400になる不正idを20回→正常idで21回目                  | 20回は400、21回目429。usecase0回。不正値を変えても枠共通                                                                                            |
| L03 | P1・R          | AppError404が20回→21回目                              | 404も計上し21回目429。実対象を連続削除して20回すべて200になるとは仮定しない                                                                         |
| L04 | P1・R          | 通常Error500が20回→21回目                             | 失敗も計上し21回目429。20回までusecase実行                                                                                                          |
| L05 | P0・R          | Aで20回、同じIPでBの初回、Aの21回目                   | Bは200、Aは429。ユーザー間分離                                                                                                                      |
| L06 | P1・R          | AのJWTを再発行し、要求id/query/IP系ヘッダーを毎回変更 | Aの合計21回目429。JWT文字列・対象id・ヘッダーで枠を回避しない                                                                                       |
| L07 | P1・R          | 401要求を21回→正常Aで20回→21回目                      | 401で正常Aの枠は減らず、正常20回まで通過                                                                                                            |
| L08 | P0・R          | 枠消費後、store reset直前→reset到達→直後              | 直前429。reset後は再受付、残量も新しい窓。ぴったり境界のtimer処理を明示して再現                                                                     |
| L09 | P1・R          | レート応答とヘッダー                                  | standard RateLimit系ヘッダーあり、legacy X-RateLimit系なし、429にRetry-After。既定429本文は実ライブラリの値を確認し固定、独自エラーcodeを仮定しない |
| L10 | P1・R          | 正常POST作成枠とDELETE枠を同じユーザーで別々に消費    | 同じキー文字列でもstoreは別。DELETE20回後もPOST枠を消費していなければPOST可能、その逆も確認。作成usecaseはモック                                    |
| L11 | P2・R          | 同じユーザーで21要求を並行開始                        | 通過20、429が1。どのrequestが拒否されるかは固定しない。実MemoryStoreを使い、実DB同時削除とは分離                                                    |

時間窓は要求ごとのrolling windowや、複数EC2を共有する枠を意味しない。再起動・複数プロセスでの共有制限は現行インメモリ実装の保証外。

## 11. 実DB：認可・物理削除・非対象データ

| ID  | 優先度・レベル | 条件・手順                                                           | 期待結果・後続停止                                                                             |
| --- | -------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| D01 | P0・D          | AがD1を削除                                                          | 新規SELECTでD1不存在。対象ID集合は1行減、D2/D3/D4、item、master、既存editing、userは全列不変   |
| D02 | P0・D          | Aが不存在IDを削除                                                    | AppError404、destroyなし。fixture全行不変。不存在は事前SELECTで確認した正の範囲内id            |
| D03 | P0・D          | B/管理者CがAのD1を指定                                               | 404、削除なし、D1も全列不変。所有権だけで判断し管理者例外なし                                  |
| D04 | P0・D          | A/Bがseller_id=nullのD4を指定                                        | 両方404、D4不変。所有者未設定を共有下書きとして扱わない                                        |
| D05 | P0・D          | D1/D2が同じ各種メディアURL                              | D1のみ削除、D2/item/editingは不変。URL単位の削除なし、S3操作0回                       |
| D06 | P1・D          | nullable列null/attributes={}/image_url=[]をそれぞれ設定 | 所有者一致なら削除可能。作成時の動画・画像必須条件を削除へ追加しない                           |
| D07 | P1・D          | video_status=null/既存の任意文字列、sale_flag=true/false             | statusによる削除可否分岐なし。対象に存在しないstatus列をfixtureへ加えない                      |
| D08 | P0・D          | 成功後に同じidを再度削除                                             | 初回成功、2回目404。他の下書きは消えない。200を繰り返す冪等応答は期待しない                    |
| H01 | P0・H          | 実HTTPで正常JWT・D1を削除                                            | 200/JSONと別接続でD1不存在の両方を確認。レスポンスだけで削除済みとしない                       |
| H02 | P0・H          | 他人・不存在・null所有者のid                                         | 実取得条件から404 JSON。各行不変、削除service未実行                                            |
| H03 | P0・H          | 無認証・不正id・制限超過                                             | 各401/400/429、対象usecase/transaction開始/取得/削除0回。認証とrate自体はこのAPIでDBを使わない |
| H04 | P1・H          | 実削除後の障害注入をHTTPから呼ぶ                                     | 500 JSON、T04と同じrollback結果。HTTPとtransactionの接続を確認                                 |

上限IDの実DB固定行は作らない。1/2147483647の受理はV/Rで十分に確認し、共有DBの既存行やシーケンスへ干渉しない。型・上限制約は実DBメタデータで確認する。

## 12. 実DB：transaction、可視性、失敗後の再試行

| ID  | 優先度・レベル | 条件・手順                                        | 期待結果・後続停止                                                                                                                    |
| --- | -------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| T01 | P0・T          | 正常経路をcall-throughで観測                      | getMyItemDraft→findOne、deleteItemDraft→destroyまで同じt。実commit後はobserverで不存在                                                |
| T02 | P0・T          | 実取得完了後、削除開始前を保留                    | transaction内・observer双方でD1存在。ロック保持、応答未完了。解放後に削除commit                                                       |
| T03 | P0・T          | 実destroy完了後、serviceラッパーのreturn前を保留  | 同じtのSELECTは不存在、別接続の通常SELECTは削除前D1を取得。usecase/HTTP未完了。解放・commit後のみ別接続で不存在                       |
| T04 | P0・T          | 実destroyが成功した直後、ラッパーで意図的throw    | 同じ例外を伝播。rollback後にobserverで全列が元どおり。id・createdAtも維持、再作成のINSERTなし                                         |
| T05 | P0・T          | 取得service前/実取得後/削除実行前を個別にthrow    | D1不変。取得前と取得失敗では削除なし。新規SELECTで非対象行も不変                                                                      |
| T06 | P0・T          | 実DELETE SQLをロックタイムアウトで失敗させる      | 下記のSHAREテーブルロックでDELETEを待機させる。SQLSTATE 55P03のDB例外、成功応答なし。rollback後D1は全列不変。ラッパーthrowのT04と区別 |
| T07 | P0・T          | T04/T05/T06の失敗後、注入を解除して同じidで再試行 | 失敗後D1あり、再試行成功でD1なし、その次404。ロック/transaction漏れによる停止なし                                                     |
| T08 | P1・T          | 取得が404で終了後、別connectionで対象や別行を操作 | transactionと接続が解放され、不要な保留なし。接続プール全体の残存件数だけでなく操作完了を確認                                         |
| T09 | P1・T/H        | 実commit確定後に応答送信だけを失敗させる          | D1は消えたまま。復元INSERTなし、再DELETEは404。送信境界の模擬失敗であり実回線障害の再現ではない                                       |

T06ではseed完了後、独立competitor transactionが `LOCK TABLE item_draft IN SHARE MODE` を保持する。このロックは取得側のROW SHAREと両立するが、DELETEのROW EXCLUSIVEとは競合する。実取得まで完了したことを確認し、削除serviceのcall-throughラッパーで対象tにだけ `SET LOCAL lock_timeout = '1000ms'` を設定して実destroyを呼ぶ。observerで対象PIDがcompetitorを待つことと、実DELETEでタイムアウトしたことを確認する。失敗後にcompetitorを終了し、別接続でD1を再取得する。固定sleepで失敗を推測せず、期限付きの待機監視とrejectをawaitする。監視できなかった場合はその部分を未確認として報告する。

テーブルロックを使うT06は他の書込みケースと直列にし、成功・失敗にかかわらずfinallyで必ず解放する。共有スキーマへのトリガー追加、本番コードへの障害分岐、接続全体のタイムアウト変更は行わない。

**commit障害の範囲**：U06/R06はtransaction Promiseのreject・500整形を確認するだけ。T04は削除完了後〜commit前の失敗による実rollbackを確認する。実COMMIT通信を切断した場合は、DBでcommit済みか不明になり得るため「すべてのcommitエラーで必ず下書き保持」と断定しない。詳細設計のrollback方針と、通信断時の結果不明状態を分け、実COMMIT障害そのものはO04の未確認事項として扱う。

## 13. 実DB：並行削除・編集開始・所有者変更

P系はREAD COMMITTEDを前提とする。実接続で分離レベルを取得・記録し、異なる場合は設定を黙って変えず期待値への影響を報告する。勝者は開始時刻だけで決めず、Aが実FOR UPDATE取得済みであることをgateで確認してからBを始める。

| ID  | 優先度・レベル | 制御する順序・入力                                                   | 期待結果・停止位置                                                                                                      |
| --- | -------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| P01 | P2・P          | 同じD1をAがロック→Bの削除がロック待ち→A削除commit→B再開              | A成功、Bは404、D1なし。Bはdestroy未実行。A/Bを入れ替えた順序も実施                                                      |
| P02 | P2・P          | P01でAを実destroy後throw・rollback                                   | A失敗、Bは残ったD1を取得して削除成功、最終不存在。A rollback直後の行を観測するならBを取得後に保留する                   |
| P03 | P2・P          | 編集開始がD1をロック・editing作成・削除commit→待機していた削除を再開 | 編集1件だけ作成、削除404。新規editing内容はD1由来、既存editing不変                                                      |
| P04 | P2・P          | 編集開始が実editing作成・下書き削除後に失敗rollback→待機削除再開     | 編集開始失敗、新規editing残存0、削除成功。D1最終不存在、無関係データ不変                                                |
| P05 | P2・P          | 削除がD1ロック・削除commit→待機していた実編集開始を再開              | 削除成功、編集開始404、新規editing0。コピー元消失後にeditingを作らない                                                  |
| P06 | P2・P          | 削除が実destroy後rollback→待機していた実編集開始を再開               | 削除失敗、編集開始成功、新規editing1、D1なし。編集の作成・削除は同じtでcommit                                           |
| P07 | P2・P          | AがD1を保留中、別ユーザーはD3を削除                                  | D3側はD1解放を待たず完了。D1側を成功/rollbackに分け、片方の終了が他方を取り消さない                                     |
| P08 | P2・P          | AのD1削除がロックを保持、別接続でD1のsellerをBへ変更要求             | UPDATEの実ロック待ちを確認。A rollbackなら所有者変更が成功し、その後Aは404/Bは削除可能。A commit側はUPDATE影響0行を確認 |
| P09 | P2・P          | 別接続が先にD1のsellerをA→Bへ更新し未commit→Aが削除で待機            | 更新commit後はA404/D1はB所有で残存。更新rollback後はAが削除成功。WHEREの再評価を実DBで確認                              |
| P10 | P2・P          | AがD1をロック中、Bが所有権不一致でD1削除要求                         | Bは404で削除しない。所有権不一致要求がD1の行ロック待ちになることを前提にしない                                          |

### 再現方法と後片付け

1. transactionごとに `pg_backend_pid()` と分離レベルを記録し、observerを別接続で確保する。プール枯渇をロック待ちと誤認しない。
2. call-throughラッパーで実取得完了/実削除完了を通知する。Bが待つ前に両者の「ロック取得完了」を待つgateを設けない。
3. `pg_stat_activity`/`pg_blocking_pids` を対象PIDとDBへ限定して照会し、BのLock待ちとAとの対応を確認する。期限・試行上限を設け、固定sleep後の未完了だけでロック効果を断定しない。
4. Aを解放しcommit/rollback完了を回収。Bも終了までawaitし、別接続で行とediting件数を取得する。P02などで中間状態を観測する場合は後続の進行もgateで固定する。
5. finallyで全gateを解放、全Promiseの結果を回収し、残ったtransactionを終了させる。その後に限定cleanupする。タイムアウト時は最後の待機状態と順序を記録する。

同時DELETEの一般的な成功率を、逐次モックでnullを返す2回目のテストから推測しない。編集開始競合は実 `createItemEditingDraftUseCase` を呼び、似たSQLをテスト内に再実装して代用しない。

## 14. 観測・仕様上の限界

以下は現行コードから読める挙動と確認予定であり、仕様変更案や実測済み結果ではない。仕様との不一致が判明した場合は期待値を弱めず、結果と残る判断をレポートへ残す。

| ID              | レベル           | 条件                                                                        | 確認・報告する内容                                                                                                                                                             |
| --------------- | ---------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| O01             | V/R              | id=`"01"`,`"+1"`,`"1.0"`,`"1e2"`,`"0x10"`,`" 1 "`,`"1.0000000000000000001"` | coerceにより範囲内整数へ変換される表記は受理される見込み。数値精度による丸めも含め変換後の値を個別確認。十進数字以外を一律400とする契約はない                                  |
| O02             | Vのみ            | id=true/false、[]/[1]/[1,2]/{}                                              | 非HTTP型のcoerce挙動を記録。trueや[1]は1として受理され得る。HTTPの認可回避や新しい拒否要件とは混同しない                                                                       |
| O03 / AF-JSON01 | R                | 不正JSON body＋正常/なし/不正JWT                                            | 共有ErrorHandlerの新契約により400、`{code:"INVALID_JSON",message:"JSONの形式を確認してください。"}`。作成/削除usecaseなし。parserが認証前という順序は維持。旧500観測は履歴扱い |
| O04             | U/R/Tとの対応    | 実COMMITの送受信失敗・接続断                                                | U06/R06の模擬rejectと実DB成否を区別。実COMMIT通信障害の再現は未計画、成否不明をrollback成功に含めない                                                                          |
| O05             | V/R・共有API回帰 | idParamSchemaを利用する既存API                                              | 上限追加は既存APIにも適用。代表の読取API・更新APIで上下限のschema接続と上限超過で後続未実行を確認。各APIの他機能全体は対象外                                                   |

O05の代表は `GET /api/categories/:id/level2` と `PUT /api/item-editing/:id`。各Routerのcontrollerを観測用モックにし、認証・rate・共通params検証を実処理で通す。PUTには既存fixture由来の正常bodyを使う。id=1/2147483647はcontroller到達、2147483648はINVALID_PARAMS/400・controller未実行を期待する。現import先の全依存を遮断し、必要な既存テストの再実行と新規接続ケースを分ける。共通schemaのV01〜V07だけで全既存APIのHTTP回帰を完了したとしない。

## 15. 網羅性・敵対性の確認表

| 詳細設計の観点 / 検出したい誤実装                   | 対応ケース                                |
| --------------------------------------------------- | ----------------------------------------- |
| 正常系：対象1件だけ物理削除、200/JSON               | U01/S05/R01/D01/H01                       |
| 異常系：401/400/404/429/500、後続停止               | M02/U02〜U06/R02〜R06/R09/R10/L01/H02/H03 |
| IDの境界と数値化、共有schemaへの影響                | V01〜V07/R03/R04/O01/O02/O05              |
| 所有者whereを外す・body/queryでユーザーやidを上書き | C01/S01/R08/R12/D03/D04/H02/P09           |
| 対象取得後に別行を削除・商品ID/URL単位で削除        | U01/U10/S05/D01/D05                       |
| transaction引渡し・await・行ロックを削る            | U07〜U09/S01/S07/T01〜T04/P01〜P06        |
| 削除失敗後に成功を返す・再作成して復元              | U05/C03/T04/T07/H04                       |
| 無認証要求やID変更でレート枠を回避                  | L02/L05〜L07/R09/R10                      |
| 成功だけを数える・作成枠と混同する                  | L02〜L04/L10                              |
| 二重削除を両方成功にする・編集開始と両立させる      | D08/P01/P03/P05                           |
| rollbackした別要求や別ユーザーに影響する            | P02/P04/P06〜P09                          |
| 通信失敗後に復元する・内部情報を返す                | C05/T09/R06/O04                           |
| S3・既存editing・参照親・他下書きを削除する         | D01/D05/P03/P04                           |

入力と状態の無制限な直積は作らず、単一原因の拒否と複数不備の優先順位を分ける。変異テストツールの導入は不要だが、上表の誤実装へテストが失敗するassertが存在するかレビューする。成功ケースの件数だけで網羅性を判定しない。

## 16. DB接続条件・スキーマ・cleanup

- 実DBテストは `server/.env.test` を読込元とし、PostgreSQL `test_db` に限定する。DB/model importより前に読込み、NODE_ENV=testと採用URLの由来を検査する。シェルから引き継いだ値へフォールバックしない。
- アプリ、models初期化、observer、competitorの全接続について接続前の設定DB名、接続後の `SELECT current_database()` を検査する。引数なしdotenv.configも制御する。検査完了前にseed/更新/削除しない。
- 不明な読込元、test_db以外、guard後の設定上書きは中断。スキーマ不足・接続拒否と区別し、設定差替えやガード緩和で続行しない。接続情報全体や秘密値を出力しない。
- 反映済みテーブルの列・INTEGER・nullable・FK・削除方向・制約をメタデータで確認する。対象はitem_draft、item_editing、item、user、categories、brands、brand_aliases、item_condition_option、shipping_day_option、shipping_service_option、todouhuken_option。編集競合で必要な制約も確認する。
- モデル・migration・実DB不一致は報告し、migration/sync/テストDB作成/全件削除/TRUNCATEで自動補正しない。既存環境のスキーマを正として観測し、仕様不一致を隠さない。
- commit/rollback可視性のケースを外側の常時rollback transactionで包まない。実usecaseのtransactionを独立して終了させる。observerの通常SELECTも独立し、古いsnapshotを持ち越さない。
- 作成したIDだけを追跡し、下書き・editing→item→参照親の依存順を実FKに合わせてcleanupする。並行処理で作成されたeditingのIDも追跡する。seed途中の失敗でも作成済みIDだけを削除し、残存0をassert。シーケンスは戻さない。
- 保留Promise、transaction、SQL監視、spy、hookを回収・解除して全接続をcloseする。接続先が不明ならcleanupを理由に削除しない。suite用envは接続終了後に復元する。

## 17. 実装優先度・実行方法・完了条件

優先度は各表のP0→P1→P2を基本とする。P2の競合も本仕様の検証対象であり、省略して全体完了としない。V/M/C/U/S→R/L→D/H/T→Pの順で境界を確立し、観測O系と既存回帰は対応する段階で実施する。

将来の実装では既存Vitest/Supertest、TypeScript・ESM、相対import `.js`、型付きmockを使う。テスト名にはIDと日本語の条件・期待結果を含める。ケースID数と `it.each` 展開後件数を分ける。

`server/` での予定コマンド：

```bash
# DBなし：単体
npm run test:run -- src/validators/params/test/id.test.ts src/middleware/validate/test/deleteItemDraft.test.ts src/controllers/itemDraft/test/deleteItemDraft.test.ts src/usecases/itemDraft/test/deleteItemDraft.test.ts src/services/itemDraft/test/deleteItemDraft.test.ts
# DBなし：実Router・レート制限
npm run test:run -- test/integration/usecases/itemDraft/deleteItemDraft/route.test.ts test/integration/usecases/itemDraft/deleteItemDraft/sharedIdRoutes.test.ts --maxWorkers=1
# 全接続ガード確認後だけ：実DB、HTTP＋DB、transaction、並行処理
npm run test:run -- test/integration/database/itemDraft/deleteItemDraft/ test/integration/usecases/itemDraft/deleteItemDraft/routeDatabase.test.ts test/integration/usecases/itemDraft/deleteItemDraft/databaseTransactions.test.ts test/integration/usecases/itemDraft/deleteItemDraft/databaseConcurrency.test.ts --maxWorkers=1
# 共有サービス・作成/編集開始の既存回帰。DB使用有無は対象ごとに分離
npm run test:run -- src/services/itemDraft/test/createItemEditingDraft.test.ts src/usecases/itemDraft/test/createItemDraft.test.ts src/controllers/itemDraft/test/createItemDraft.test.ts
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

`--maxWorkers=1` はファイル間のfixture/spy/レート状態の干渉を抑える指定。ケース内P系の並行性は独立接続とgateで作る。共有IDスキーマ利用API、既存createItemDraftのHTTP、createItemEditingDraftの単体・結合回帰についても、実装時に現存ファイルを列挙し、DB有無を確認して実行結果を追加する。

現ESLintのTS設定は `src/**/*.ts` が対象。test配下の結合・fixtureは既存ESLintとtypescript-eslintを使って対象を明示した追加lintを実施し、方法と結果を記録する。検査のためだけに共有設定を変更しない。本番typecheckは単体テスト型を除外するため、test/tsconfig.jsonの型検査も必要。

テスト実装後の完了条件：

- 各ケースIDに実装ファイル・展開条件・結果が対応し、未実装/未実行/環境停止/観測が成功に混ざっていない。
- 認可、引数・参照、後続停止、非同期待機、公開JSON、実rollback、実ロック待機・解除後の状態を、それぞれ該当レベルで確認できる。
- 別接続の新規SELECT、非対象データ全列比較、限定cleanupと接続終了を確認できる。
- commit通信障害・S3実物・アプリ全体など未確認の保証を明示する。対象外問題は修正せず、許可範囲内の報告先とTodo運用に従う。
- [レポート規則](../../report/AGENTS.md) に従い、実行コマンド、件数、DBなし/あり、mock/実処理、障害注入位置、競合順序、ガード・後片付け、未確認を記録する。

**今回の完了範囲は設計書の作成と、記載・リンク・ケース対応・変更範囲の確認。テストコード作成、テスト再実行、lint・型検査、DB接続は行っていない。**
