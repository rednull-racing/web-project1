# getItemTrashList テストレポート

実行日: 2026-11-06。最新結果: 必須ケース・影響回帰125件成功（9ファイル）。失敗・skip・todo・未処理例外なし。
[詳細設計](../../../../../docs/design/backend/detail/itemTrash/getItemTrashList.md)・[テスト設計](../../architecture/itemTrash/getItemTrashList.md)に対応。以下のパス・コマンドはserver/基準。

## 実装・保証範囲

GET /api/item-trash/listを追加。本人限定のname/title OR検索、既存normalizeJapaneseによる入力正規化、6列・null保持、createdAt/id降順、20件ページング、空結果200を実装。
REPEATABLE READ managed transaction内でSET TRANSACTION READ ONLY、一覧、同条件countを順に待機し、transaction完了後に応答する。
新APIの58件（新規5テストファイル57件＋既存登録テストへ追加したH03の1件）と既存回帰67件を、下記一括実行の125件として集計。再実行分は加算しない。

| ID | テストファイル | 最新結果・検証境界 |
| --- | --- | --- |
| V01/V02 | src/validators/query/test/getItemTrashList.test.ts | 成功。実schema、範囲・型・空値・未知キー・元入力不変 |
| U01/U02/U03 | src/usecases/itemTrash/test/getItemTrashList.test.ts | 成功。DB/serviceモック、正規化・OR条件・同一transaction/where・各失敗停止・保留・外側完了失敗 |
| S01 | src/services/itemTrash/test/getItemTrashList.test.ts | 成功。Model/DBモック、6列・AND所有者・順序・READ ONLY設定SQL |
| H01/H02 | test/integration/usecases/itemTrash/getItemTrashList/route.test.ts | 成功。実parser/JWT認証/limiter/schema/controller/errorHandler、一覧usecaseと対象外create usecaseはモック |
| H03 | test/integration/usecases/itemTrash/createItemTrash/registration.test.ts | 成功。実registerRoutesからGETへの到達。対象外Router・業務処理・認証結果はモック |
| D01/D02 | test/integration/usecases/itemTrash/getItemTrashList/database.test.ts | 成功。実usecase/service/Model/PostgreSQL、本人・他人・所有者null、検索・順序・境界・snapshot |
| 既存回帰 | src/services/itemTrash/test/createItemTrash.test.ts、src/usecases/itemTrash/test/createItemTrash.test.ts、test/integration/usecases/itemTrash/createItemTrash/{route,registration}.test.ts | 成功。共有ファイルの新importに対応する依存遮断のみを追加し、既存assertionは維持 |

単体・DB非接続HTTPは実DBの保証と区別する。H03はアプリ全体起動ではなく実registerRoutesの登録検証。
D01は0・20・21件と範囲外、検索記号%/_/バックスラッシュの文字一致、他人/所有者null除外、本人件数不変・再送を確認。
D02は実一覧SELECT後のgateで独立observer接続のDELETEをcommitし、当該応答が元の行・count=1を返すこと、次要求が0件になることを確認。
transaction内の実設定repeatable read/onとobserverのread committedを確認。行ロックを使わないためロック待機は対象外。

## 最終実行（20:40 UTC）

```bash
npm run test:run -- src/validators/query/test/getItemTrashList.test.ts src/services/itemTrash/test/ src/usecases/itemTrash/test/ test/integration/usecases/itemTrash/getItemTrashList/ test/integration/usecases/itemTrash/createItemTrash/route.test.ts test/integration/usecases/itemTrash/createItemTrash/registration.test.ts
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

Vitest出力: Test Files 9 passed (9)、Tests 125 passed (125)。静的検査3種ともexit 0。
通常lint対象外のtest/配下6ファイル（新fixture2・新結合2・既存HTTP2）は、既存ESLint/typescript-eslintのrecommended設定をNode APIのoverrideConfigへ渡して追加検査し、error/warningとも0。共有設定変更なし。
カバレッジは未取得。対象外の全体テスト・フロント検証は未実行。

## DB安全条件・後片付け

fixture: test/fixtures/itemTrash/getItemTrashList/{databaseSetup,databaseFixtures}.ts。
初期化前にserver/.env.testを読み、NODE_ENV=test・PostgreSQL test_db・設定の差替えなしを検査。
アプリsequelize・models用db.sequelize・observerの全3接続で、設定DB名とcurrent_database()=test_dbをseed前に確認。
User/ItemTrashの全Model列存在・NULL制約、一覧のid/priceのINTEGER・createdAtのTIMESTAMPを照合して成功。全DB制約を新規検証したという意味ではない。
seedのUser/ItemTrash IDをafterCreate hookで追跡し、全処理回収後に自作ID限定でItemTrash→Userを削除、残存0件をassert。
D02のobserver削除も自作IDのみ。gateはfinallyで解放しpendingを回収。全3接続close成功、hook/spy/env復元。
migration・sync・DB作成・全件削除・sequence操作は未実行。

## 実行・修正履歴

1. 初回本番型検査でZod pipe先coerceの入力型不一致。F1: coerce.number<string>()として文字列入力を明示し解消。仕様変更なし。
2. 単体3ファイル40件成功。初回HTTPはsandbox listen EPERMで11件失敗・11件の未処理例外。権限手順による同コマンド再実行で11件成功、未処理例外解消。
3. 初回テスト型検査でfixtureのModelStatic union、hook行ID型、Transaction.sequelizeの未公開型参照を検出。F2: ModelStatic<Model>配列・getでIDを型検査・検証済みsequelizeからtransaction付きqueryへ変更し解消。
4. 初回DB接続はsandbox connect EPERMでsetup停止（本体2件未実行、書込みなし、cleanup DELETEなし）。同ガードで権限手順による再実行後2件成功。
5. 検索記号と20件境界を追加しDB6件成功。一括125件成功後、既存service単体のDB importも明示遮断し、整形後の最終一括125件・全静的検査成功。
6. 一度ルートディレクトリで誤ってnpm run lintを起動しrun-p不在で停止。規定のserver/へ訂正し上記3種を成功確認。ルート設定・依存は変更していない。

実COMMIT応答喪失・HTTP送信失敗は未模擬。DB変更・通知・S3処理がないため更新rollback・外部送信は対象外。
旧一覧API・クライアント呼出しの移行、復元・期限削除・既存Todoの完了化は対象外。残る必須ケース・仕様確認待ちはない。
