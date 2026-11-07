# getItemDraftList テストレポート

実行日: 2026-11-07。最新結果: 23ファイル379件成功（対象API78件・影響回帰301件）。失敗・skip・todo・未処理例外なし。
[詳細設計](../../../../../docs/design/backend/detail/itemDraft/getItemDraftList.md)・[テスト設計](../../architecture/itemDraft/getItemDraftList.md)に対応。以下のパス・コマンドはserver/基準。

## 実装と検証範囲

GET /api/item-draft/listを追加。認証本人のitem*draftだけをname/titleのORで検索し、6列・null保持・createdAt/id降順・20件ページング・総ページ数を返す。
検索語は現行normalizeJapaneseによるNFKC・小文字化・カナ変換・空白除去を使用し、正規化後の%・*・バックスラッシュだけをILIKE用にエスケープする。正規表現検索・新しい文字制限は追加していない。
REPEATABLE READのmanaged transactionでREAD ONLY設定→一覧→同条件countを順に待機し、外側transaction完了後に200応答する。
ユーザー指示により、未使用のgetDeletedItemsへのimport・返却型・deleted分岐をsrc/usecases/items/itemList/userItems.tsから削除。controllerの呼出し先にある参照切れを解消し、当該typeは既存のINVALID_TYPE/400分岐へ進む。

| ケース      | ファイル                                                                                                                                                                                                                                                           | 件数・最新結果と境界                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| V01/V02     | src/validators/query/test/getItemDraftList.test.ts                                                                                                                                                                                                                 | 26成功。実schemaでpage境界・指数表記・型拒否、keyword空/null/trim、未知所有者キー除去、元入力不変                               |
| U01/U02/U03 | src/usecases/itemDraft/test/getItemDraftList.test.ts                                                                                                                                                                                                               | 16成功。DB/serviceモック。半角カナ・全角英数字・空白・記号、OR条件、ページング、同一transaction/where、各障害・保留・完了待機   |
| S01         | src/services/itemDraft/test/getItemDraftList.test.ts                                                                                                                                                                                                               | 1成功。Model/DB境界モック。6列・順序・AND所有者条件・READ ONLY SQL・一覧/countへのtransaction引渡し                             |
| C01/C02/C03 | src/controllers/itemDraft/test/getItemDraftList.test.ts                                                                                                                                                                                                            | 7成功。usecaseモック。偽装raw入力不採用、値あり/空応答、同じ例外のnextへの伝播、保留・応答送信失敗                              |
| H01/H02     | test/integration/usecases/itemDraft/getItemDraftList/route.test.ts                                                                                                                                                                                                 | 11成功。実parser/JWT認証/limiter/schema/controller/errorHandler。対象・対象外usecaseはモック。401/400/500/429・枠計上と優先順位 |
| H03         | test/integration/usecases/itemDraft/getItemDraftList/registration.test.ts                                                                                                                                                                                          | 1成功。実registerRoutesからGETへ到達。対象外Routerと業務処理・認証結果はモック                                                  |
| D01/D02/D03 | test/integration/usecases/itemDraft/getItemDraftList/database.test.ts                                                                                                                                                                                              | 16成功。実usecase/service/Model/PostgreSQL。本人限定・記号検索・ページ境界・snapshot・READ ONLY拒否・不変・再試行               |
| 既存回帰    | src/services/itemDraft/test/内の既存6ファイル、src/controllers/itemDraft/test/内の既存5ファイル、test/integration/usecases/itemDraft/{createItemDraft,deleteItemDraft,getItemDraftPage,getItemDraftPageMetadata}/route.test.ts、convertItemDraftVideo/http.test.ts | 計16ファイル301成功。共有query/controllerに加えたimportの依存遮断のみ追加し、既存assertionは維持                                |

単体・DB非接続HTTPは実DBの保証と区別する。H03は登録関数の検証であり、cron等を含む実アプリ全体の起動ではない。
D01は本人・他人・所有者null、name/title片側null、全null、20/21件、0件・範囲外・再送を確認。%/\_/バックスラッシュ/\*/./[]/()/^/$/+/?/{}を文字として検索し、本人・他人・所有者nullの自作行は全列snapshotで不変を確認した。
D02は実一覧SELECT後にgateで保留し、独立observerのDELETEをcommitしてから解放。一覧とcountは旧snapshot、次要求は削除済みを反映する。実transaction設定repeatable read/on、observer設定read committedも確認した。
D03は一覧service境界へ実UPDATEを障害注入し、実READ ONLYがSQLSTATE 25006で拒否すること、count未実行、自作行不変・次要求成功を確認。APIに通常の書込み経路があるという意味ではない。

## 最終一括実行と静的検査

```bash
npm run test:run -- src/validators/query/test/getItemDraftList.test.ts src/usecases/itemDraft/test/getItemDraftList.test.ts src/services/itemDraft/test/ src/controllers/itemDraft/test/ test/integration/usecases/itemDraft/getItemDraftList/ test/integration/usecases/itemDraft/createItemDraft/route.test.ts test/integration/usecases/itemDraft/deleteItemDraft/route.test.ts test/integration/usecases/itemDraft/getItemDraftPage/route.test.ts test/integration/usecases/itemDraft/getItemDraftPageMetadata/route.test.ts test/integration/usecases/itemDraft/convertItemDraftVideo/http.test.ts --reporter=default --reporter=json --outputFile.json=/tmp/get-item-draft-list-results.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

Vitest出力: Test Files 23 passed (23)、Tests 379 passed (379)。JSONは一時成果物`/tmp/get-item-draft-list-results.json`。再実行分を加算していない。
lint・本番型検査・テスト型検査はいずれもexit 0。本番型検査が除外する単体・結合テストもテスト用tsconfigで検査した。
通常lint対象外の変更TS10ファイル（新fixture2・新結合3・既存fixture1・既存HTTP4）にはESLint Node APIのoverrideConfigで既存typescript-eslint recommendedを適用し、error/warningとも0。共有設定変更なし。
実行環境はNode v20.20.2。package.json指定のNode >=26.12.1 <27環境での再実行、カバレッジ、全体テスト・フロント検証は今回未実施。

## DB安全条件と後片付け

fixtureはtest/fixtures/itemDraft/getItemDraftList/{databaseSetup,databaseFixtures}.ts。setupは機能固有モック・DB初期化を含まない既存itemTrash/getItemTrashList/databaseSetupを再利用する。
初期化前にserver/.env.test由来のPostgreSQL test_db・NODE_ENV=testを検査し、別env・差替えを拒否する。アプリsequelize・models用db.sequelize・observerの3接続すべてで設定DB名・current_database()=test_dbを確認後にseedする。
User/ItemDraftの全Model列の存在・NULL許可、一覧id/priceのINTEGER・createdAtのTIMESTAMPを照合して成功。全FK/unique等を新規検証したという意味ではない。
afterCreate hookで自作User/ItemDraft IDを追跡。全処理回収後にID限定でItemDraft→Userを削除し、各テストで残存0をassert。D02の独立削除とD03のUPDATEも自作IDに限定する。
gateはfinallyで解放しpendingを回収。hook/spy/envを復元し、3接続のclose成功を確認した。migration・sync・DB作成・全件削除・sequence操作なし。

## 実行・修正履歴

1. 初回単体・既存service回帰は9ファイル74件成功。ルートでの誤ったtypecheck起動はrun-p不在で停止し、実行先をserver/へ訂正した。
2. server本番型検査で既存userItems.ts→getDeletedItems.jsの参照切れを確認。ユーザーへ確認後、未使用参照の削除指示に基づきimport・返却型・分岐を削除。再検査で解消（F1）。対象外の機能復元は行っていない。
3. 初回HTTP実行はsandbox listen EPERMで250件・未処理例外250件が失敗。controllerの空配列パラメータ1件も失敗。権限手順に従いHTTPテストを再実行し、環境制限を解消した。
4. F2（C01・テスト型検査）: it.eachが空配列を引数なしへ展開する問題を、オブジェクト形式のケースへ修正。部分Requestの型をPartial<Request>で明示した。
5. F3（既存ページ回帰）: 新一覧controllerを既存item-page経路にも誤って挿入したため、既存ページ/metadata回帰27件が失敗。item-pageは従来のcontrollerだけへ接続するよう訂正。再実行13ファイル286件成功。
6. 初回DB実行はsandbox connect EPERMでsetup停止、15件本体未実行・fixture書込み/cleanup DELETEなし。権限手順で同じ安全ガードのまま再実行し15件成功。READ ONLY拒否・不変検証を補完し、最終一括で上記379件成功。

実COMMIT応答喪失は未模擬。更新・S3・通知・行ロックを持たないAPIのため、それらの外部送信・状態遷移・実ロック待機は対象外。残る必須ケース・仕様確認待ち・検査エラーはない。
