# getItemDraftList テスト設計

2026-11-07。パスはserver基準。根拠は[詳細設計](../../../../../docs/design/backend/detail/itemDraft/getItemDraftList.md)とユーザー回答。
P0は入力・認可・snapshot、P1は失敗・待機・HTTP接続。全ケース必須。

| ID          | レベル・配置                                                              | 条件・手順・期待結果                                                                                                      |
| ----------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| V01         | validators/query/test/getItemDraftList.test.ts                            | page省略・1・10000・指数表記は正しく変換、0/10001/小数/空/配列等は拒否                                                    |
| V02         | 同上                                                                      | keyword省略/null/空/空白/文字列nullはnull、通常文字列はtrim、配列・object拒否、未知所有者キー除去                         |
| U01         | usecases/itemDraft/test/getItemDraftList.test.ts                          | 正規化・文字エスケープ・OR条件・offset・20件・件数切上げ・空結果を確認                                                    |
| U02         | 同上                                                                      | READ ONLY設定・一覧・件数の各失敗で後続未実行、開始/完了失敗伝播                                                          |
| U03         | 同上                                                                      | 各依存と外側transactionをdeferredで保留、完了前は次段階・成功なし                                                         |
| S01         | services/itemDraft/test/getItemDraftList.test.ts                          | Model境界モックで6列・順序・AND所有者条件・同一transaction・count条件確認                                                 |
| C01/C02/C03 | controllers/itemDraft/test/getItemDraftList.test.ts                       | 認証ID/検証済みqueryのみ採用、空/値あり応答、元エラー伝播、保留/成功/失敗の待機、応答送信失敗で再実行なし                 |
| H01         | test/integration/usecases/itemDraft/getItemDraftList/route.test.ts        | 実parser/認証/limiter/schema/controller/errorHandler、業務usecaseのみモック。正常・未知キー・不正query・401・500非公開    |
| H02         | 同上                                                                      | 実limiterの50/51、別本人・窓終了、400/500計上、未認証/不正JSON非計上、超過優先                                            |
| H03         | test/integration/usecases/itemDraft/getItemDraftList/registration.test.ts | 実registerRoutesにGETが接続され、検証済みpageと認証IDが渡る                                                               |
| D01         | test/integration/usecases/itemDraft/getItemDraftList/database.test.ts     | 実DBで本人限定・name/title OR・null列・createdAt/id降順・20件境界・0件・範囲外・再送・不変                                |
| D02         | 同上                                                                      | 実service後gateで別接続削除commit。同snapshotのcount維持、次要求へ反映。実READ ONLY/REPEATABLE READ設定確認               |
| D03         | 同上                                                                      | READ ONLY設定後の一覧service境界へ実UPDATEを注入しSQLSTATE 25006で拒否、count未実行、自作行の全列不変、次要求の成功を確認 |

unitはDBをモック、DBなしHTTPでは対象外の作成・削除・変換・ページ/metadata取得usecaseも遮断。dotenvを遮断し生成したテストJWT鍵のみ使用する。
fixtureはtest/fixtures/itemDraft/getItemDraftList/。DB setupは.env.testを初期化前に検査し、全接続の設定と実DB名test_db、必要スキーマ検査後のみseed。
UserとItemDraftを作成しIDを追跡。失敗時もgate解放・全Promise回収後、自作IDのみ削除し残存0を確認、全接続close・env復元。
DB分離レベルは実transaction内のcurrent_settingで確認する。ロックを要求しないAPIのためロック待機テストは対象外。
本APIは書込み・JSONB変換・外部通信がないため、それらの制約・状態遷移・通知送信の検証は対象外。

実行はserver/で対象各ファイルを指定してnpm run test:run -- <対象>。静的検査はnpm run lint、npm run typecheck、./node_modules/.bin/tsc --noEmit -p test/tsconfig.json。
通常lint対象外の`test/**/*.ts`も既存typescript-eslintで追加検査する。完了には全必須ケースと影響回帰・静的検査の成功が必要。
結果・修正履歴は[レポート](../../report/itemDraft/getItemDraftList.md)へ記録する。

検索語はユーザー回答に基づき既存normalizeJapaneseを使用し、正規表現記号を通常の文字として扱う。U01/D01では半角カナ・全角英数字・空白・記号%/\_/バックスラッシュ/\*/./[]を確認する。
C01〜C03はcontrollers/itemDraft/test/getItemDraftList.test.tsに配置し、偽装raw入力の不採用、成功/空応答、usecaseの失敗・保留・送信失敗を確認する。
