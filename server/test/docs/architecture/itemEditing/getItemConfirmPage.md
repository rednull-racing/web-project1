# getItemConfirmPage テスト設計

2026-10-30。根拠は詳細設計と同日のユーザー確定回答。パスはserver/基準。
GET /api/item-editing/:id/confirmの参照専用契約を検証する。Category関連はid/nameのみ、ID/durationはnumber、日時はISO文字列、nullは保持。

## 検証境界と配置

- service単体: src/services/itemEditing/test/getItemConfirmPage.test.ts。実service、Modelメソッドをモックし検索optionsと返却・例外を検証。
- usecase単体: src/usecases/itemEditing/test/getItemConfirmPage.test.ts。serviceをモックし引渡し・存在判定・完了待ち・並行の分離を検証。
- controller単体: src/controllers/itemEditing/test/getItemConfirmPage.test.ts。usecaseをモックし検証済みparams/認証ID採用・応答待機・nextを検証。
- HTTP: test/integration/usecases/itemEditing/getItemConfirmPage/route.test.ts。実Router/parser/JWT/validator/limiter/errorHandler、対象usecaseと対象外usecaseをモック。最小Expressを使用し実registerRoutesはソースのprefix登録を照合する。
- 実DB: test/integration/database/itemEditing/getItemConfirmPage/database.test.ts。実usecase/service/Model、専用test/fixtures/itemEditing/getItemConfirmPage/databaseSetup.ts・databaseFixtures.tsを使用。外部通信なし。

## ケース

全て必須。P0は取得・認可・入力、P1は各層接続・失敗・待機、P2は再送/並行。

| ID群 | 条件・手順 | 期待結果・停止位置 |
| --- | --- | --- |
| S01〜 | Model取得を成功/null/reject/保留 | 所有者where、許可列/関連完全一致、ロック/transactionなし、戻り値参照・例外保持 |
| U01〜 | serviceを成功/null/reject/保留/逆順完了 | ID/認証IDのみ引渡し、同じModel返却、nullはAppError ITEM_EDITING_NOT_FOUND/404、待機と混線なし |
| C01〜 | raw値偽装、正常/保留/reject | validatedParams/req.user採用、200 {itemEditing}のみ、失敗nextは同じ例外、成功応答未実行 |
| H01 | GET正常、query/body所有者偽装 | 200、数値ID/認証ID採用、null/数値/ISO JSON保持 |
| H02 | 認証なし/空/不正署名/期限切れ＋不正id | 401固定本文、usecase未実行 |
| H03 | 1/2147483647/数値coerce表記と0/負数/小数/非数/上限超過 | 合法値のみ数値で採用、不正400 INVALID_PARAMS・usecase未実行 |
| H04 | usecase404/DB例外 | 公開404/500完全一致、内部情報非公開 |
| H05 | 50回/51回目・別ユーザー・別対象 | 50回許可、同じユーザー51回目429、別ユーザー別枠、標準headers/Retry-After |
| H06 | 窓終了の直前/一致/直後 | 59999ms拒否、60000/60001ms再受付 |
| H07 | 400/404/500を50回、次は不正id | 失敗も計上、51回目は429を優先 |
| H08 | 未認証/不正JSONを51回、正常要求 | 拒否は枠未消費、parser400は認証より先、内部内容非公開 |
| DB01〜 | 所有者normal/edit、全関連/null/空配列/値ありJSONB、他人/null所有者/不存在 | 選択列のみ、関連id/name、ID/duration数値、日時ISO、他人等404 |
| DB再送・並行 | 自作複数ユーザー/行を逐次と並行取得、前後snapshot比較 | 対象と非対象・マスター不変、結果混線なし |

DBケースIDの詳細はテスト名とレポートへ対応付ける。fixtureはUUIDで区別した自作ユーザー/編集/関連マスターを準備し、全接続を.env.test由来test_dbと検査し、接続後current_databaseと必要な列/型/NULL/FK等を確認してから書き込む。全Promise回収後、自作IDのみFK順に削除、残存0件・全接続closeを確認する。不成立時は自動補正せず中断。

参照のみのため状態遷移・rollback・更新ロック・通知/S3実通信は対象外。保存済みJSONBは加工・再検証しないため、構造ごとの業務検証も対象外。厳密な更新/削除との直列化は保証しない。

## 実行と完了条件

server/で npm run test:run -- src/services/itemEditing/test/getItemConfirmPage.test.ts src/usecases/itemEditing/test/getItemConfirmPage.test.ts src/controllers/itemEditing/test/getItemConfirmPage.test.ts test/integration/usecases/itemEditing/getItemConfirmPage/route.test.ts を実行し、実DBは npm run test:run -- test/integration/database/itemEditing/getItemConfirmPage/ を別実行する。
共有controllerへのimport追加の影響は既存itemEditingの単体・HTTPテストを対象指定して回帰する。
npm run lint、npm run typecheck、./node_modules/.bin/tsc --noEmit -p test/tsconfig.json、通常lint対象外のtest/**/*.tsは既存typescript-eslintで追加検査する。
全必須ケース成功、skip/未実行/未処理例外なし、静的検査とcleanup成功を完了条件とする。実行履歴は[レポート](../../report/itemEditing/getItemConfirmPage.md)へ記録する。
