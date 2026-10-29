# getItemDraftPage テスト設計

設計日: 2026-10-29。根拠は[詳細設計](../../../../../docs/design/backend/detail/itemDraft/getItemDraftPage.md)と同日のユーザー回答。パスはserver基準。数値ID、updatedAt、配列children、null関連が確定契約。結果は[レポート](../../report/itemDraft/getItemDraftPage.md)に記載する。

## 対象・境界・fixture

P0は認証・所有権・公開列・入力、P1は層間接続と失敗待機、P2は再送と並行読取。書込み・外部通信・transactionがないため、rollback、通知、在庫検証、ロック競合は対象外。保存JSONBは加工せず返す契約であり、新たな保存済み構造検証は追加しない。

- `src/services/itemDraft/test/getItemDraftPage.test.ts`: 実service、ModelのfindOneをモック。完全options・alias・列・所有者条件・null/例外伝播を保証。SQL実行は保証しない。
- `src/usecases/itemDraft/test/getItemDraftPage.test.ts`: 実usecase、取得serviceをモック。404・引渡し・待機・交差した結果を確認。
- `src/controllers/itemDraft/test/getItemDraftPage.test.ts`: 実controller、全usecaseをモック。Express境界だけ部分Request/Responseを使用。認証情報・validatedParams採用、応答・nextを確認。
- `test/integration/usecases/itemDraft/getItemDraftPage/route.test.ts`: 最小Expressへ実parser・Router・認証・schema・rateLimit・errorHandlerを接続。対象usecaseのみDB境界としてモックし、対象外usecaseも遮断。cronを含むapp全体は起動しない。prefixはroutes/index.tsの既存登録も照合する。
- `test/integration/database/itemDraft/getItemDraftPage/database.test.ts`: 実usecase→service→Model→test_db。既存のcreateItemEditingDraftのsetup・全4接続ガード・作成ID追跡cleanupを再利用し、必要なマスター列を追加検査。DB importより先に.env.testを検査し、全接続のcurrent_database()=test_dbとスキーマ確認後にseed。自作IDだけ削除・残存0確認・全接続close。ガード/スキーマ不備は停止し補正しない。
- fixtureは `test/fixtures/itemDraft/getItemDraftPage/` に置く。型付きdeferred等の純粋helperは既存deleteItemDraft fixtureから再利用。factoryは呼出しごとに別参照とする。DB用helperを非接続単体からimportしない。

## ケース

同じID内の条件違いはit.eachへ展開する。全正常ケースは値・回数・必要引数を確認し、拒否時は後続と成功応答の未実行を確認する。

| ID  | 優先度・レベル | 前提・入力・手順                                               | 期待結果                                                                        |
| --- | -------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| S01 | P0 service     | itemDraftId=101/userId=7で実serviceを呼ぶ                      | findOneが完全な列/include/所有者whereを受け、transaction/lockなし。同一参照返却 |
| S02 | P1 service     | findOneがnull/例外                                             | nullまたは元例外を返し、再試行なし                                              |
| U01 | P0 usecase     | 所有者取得値あり/null                                          | 同一引数と同一返却参照、nullはAppError/404/ITEM_DRAFT_NOT_FOUND                 |
| U02 | P1 usecase     | service例外                                                    | 元例外を伝播                                                                    |
| U03 | P1 usecase     | serviceをdeferredで保留後成功/null/失敗                        | 保留中未完了、解放後に各結果、全Promise回収                                     |
| U04 | P2 usecase     | 別ID/所有者の読取を逆順完了                                    | 結果が混ざらない                                                                |
| C01 | P0 controller  | validatedParams=101/user=7、raw params/body/queryに別所有者/ID | 認証IDと検証済みIDのみ採用、200と{itemDraft}、対象外usecaseなし                 |
| C02 | P1 controller  | usecaseがAppError/通常Error                                    | 同じ参照をnextへ一度、成功応答なし                                              |
| C03 | P1 controller  | deferredで成功/失敗まで保留                                    | 保留中はstatus/json/nextなし、解放後のみ応答                                    |
| C04 | P1 controller  | json送信がthrow                                                | nextへ伝播、usecase再実行なし                                                   |
| R01 | P0 HTTP        | 正常GET、数値ID境界1/2147483647、body/query偽装                | 200 JSONと認証ID/数値ID引渡し                                                   |
| R02 | P0 HTTP        | トークンなし/Basic/空Bearer/破損/別鍵/期限切れ + 不正ID        | 401でusecaseなし                                                                |
| R03 | P0 HTTP        | 0/負数/小数/非数値/上限超過/SQL文字列等                        | 400 INVALID_PARAMS、usecaseなし                                                 |
| R04 | P1 HTTP        | 01/+1/1.0/1e2/0x10/空白付き整数                                | z.coerceの既存数値化を維持                                                      |
| R05 | P0 HTTP        | 業務404/内部DB例外                                             | 公開404/500完全一致、内部SQL等を漏らさない                                      |
| R06 | P1 HTTP        | 不正JSON＋未認証/正常認証/不正認証                             | parserの400 INVALID_JSONを優先、usecaseなし                                     |
| R07 | P1 HTTP        | 不正メソッド/余分なパス/ID欠落                                 | 404で対象usecaseなし                                                            |
| R08 | P1 HTTP        | usecaseをdeferredで保留                                        | JSON未送信、解放後に1回送信                                                     |
| L01 | P0 HTTP        | 同じユーザーで50回→51/52回目                                   | 200→429、既定本文・標準ヘッダー・legacyなし                                     |
| L02 | P0 HTTP        | 400/404/500各50回                                              | 51回目429、認証後失敗も計上                                                     |
| L03 | P0 HTTP        | 無認証連打、同じIP別ユーザー、JWT再発行/ID/IP変更              | 無認証は非計上、ユーザー別独立、同じ所有者は枠共有                              |
| L04 | P1 HTTP        | 枠消費後不正ID、窓59999/60000/60001ms                          | 制限をschemaより優先、境界から再開                                              |
| L05 | P2 HTTP        | 51要求同時、他APIのstore                                       | 50成功/1拒否、既存POST枠と独立                                                  |
| D01 | P0 DB          | 全列と関連、親と複数childrenをseed                             | 数値ID・updatedAt・公開列完全一致、非公開列なし、全DB不変                       |
| D02 | P0 DB          | 任意値/関連なし                                                | null関連と保存値の保持、DB不変                                                  |
| D03 | P1 DB          | 親なし/子なし                                                  | parent=null/children=[]、DB不変                                                 |
| D04 | P0 DB          | 他人/不存在/所有者null                                         | AppError 404、DB不変                                                            |
| D05 | P2 DB          | 同一対象を逐次再送                                             | 同じ値、DB不変                                                                  |
| D06 | P2 DB          | 別対象・別所有者の並行読取                                     | 結果の分離、DB不変。ロック保証とは扱わない                                      |
| D07 | P1 DB          | 取得後にfixture所有の行を削除して再読取                        | 最初成功、後続404。取得が後の存在を保証しない                                   |

## 実行・完了条件

server/で `npm run test:run -- src/services/itemDraft/test/getItemDraftPage.test.ts src/usecases/itemDraft/test/getItemDraftPage.test.ts src/controllers/itemDraft/test/getItemDraftPage.test.ts test/integration/usecases/itemDraft/getItemDraftPage/route.test.ts`、DBは対象database.test.tsを別実行する。変更で同じcontrollerを読む既存テストはモック境界を補完し関連回帰を実行する。npm run lint/typecheckと `./node_modules/.bin/tsc --noEmit -p test/tsconfig.json`、通常対象外TSの追加ESLintを実行する。

全必要ケース成功、静的検査成功、fixture cleanup/close成功、設計・コード・レポート整合を完了条件とする。未実行・環境不足・対象外の検査失敗があれば完了とせず区別して記録する。フロント型修正は関連fixture・単体回帰・型検査で確認する。
