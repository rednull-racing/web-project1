# getItemLikeList テストレポート

実行日: 2026-11-10。対象: GET /api/item-like/item-list。パスはserver/基準。
最新結果: **7ファイル・123件すべて成功**。失敗0、skip/pending/todo0、未処理例外0。
単体74件、DB非接続HTTP/登録31件、実DB18件。必須の未実装・未実行・未解決事項なし。
カバレッジは未取得。全アプリ起動・全リポジトリのテスト実行は対象外。

[詳細設計](../../../../../docs/design/backend/detail/itemLike/getitemLikeList.md) /
[テスト設計](../../architecture/itemLike/getItemLikeList.md)

## 実装と検証結果

ユーザー回答5点を反映し、出品者を限定せず本人のItemLikeを取得するAPIを実装した。
ItemのINNER JOIN条件を一覧とcountで共有し、ItemLike.createdAt/id降順でページングする。
公開itemだけを`{ item }`に包み、uploaded_at等を除外する。
認証・本人単位の50回/分・query検証・検索語正規化・ILIKE文字エスケープを接続した。
本番変更はroutes/itemLike.ts、controllers/itemLike/itemLike.ts、middleware/rateLimit/itemLikeRateLimit.ts、
validators/query/itemLike.ts、usecases/itemLike/getItemLikeList.ts、services/itemLike/query.ts、types/serviceType/itemLike.ts。
Model・migration・フロント・既存APIの処理は変更していない。

| ファイル                                                         | ID                | 成功 | 確認内容                                                                                  |
| ---------------------------------------------------------------- | ----------------- | ---: | ----------------------------------------------------------------------------------------- |
| src/validators/query/test/getItemLikeList.test.ts                | V01〜V03          |   39 | page境界/型、status正規化、keyword空値/長文、偽装キー除去と元入力不変                     |
| src/controllers/itemLike/test/getItemLikeList.test.ts            | C01〜C03          |    7 | 認証ID/検証済み入力、公開2項目、元例外、送信失敗、保留                                    |
| src/usecases/itemLike/test/getItemLikeList.test.ts               | U01〜U04          |   22 | 正規化/escape、同一where/transaction、各段階失敗/保留、完了待機、公開列/取得順/ページ算出 |
| src/services/itemLike/test/getItemLikeList.test.ts               | S01〜S04          |    6 | 本人条件、INNER/LEFT JOIN、count条件、日時/ID順、固定READ ONLY SQL、空結果/元例外         |
| test/integration/usecases/itemLike/getItemLikeList/route.test.ts | H01〜H08/H10〜H12 |   30 | 実認証/制限/schema/controller/parser/errorHandler、401/400/429/500、偽装/窓境界/HTTP待機  |
| 同ディレクトリregistration.test.ts                               | H09               |    1 | 実registerRoutesで対象URLに到達                                                           |
| 同ディレクトリdatabase.test.ts                                   | D01〜D07          |   18 | 本人限定/出品者無制限、検索・page・公開列・いいね順・RR snapshot・READ ONLY拒否           |

単体はDB/transactionまたはusecaseを境界でモックし、実DBや実認証の保証とは分けた。
HTTPは最小Expressの実parser・JWT認証・制限store・schema・controller・errorHandlerを使い、対象usecaseと対象外依存をモック。
登録テストは実registerRoutesと対象Routerを動かし、対象外Routerと認証をモックした。
実DBではusecase/service/Modelを実行し、D05/D06だけ実処理前後のgate/障害をspyで注入した。
D01/D02/D03/D04/D06/D07で新規SELECTによる自作行の不変を確認した。

## 実行コマンド・静的検査

以下はserver/で実行した最終コマンド。

```bash
npm run test:run -- src/validators/query/test/getItemLikeList.test.ts src/controllers/itemLike/test/getItemLikeList.test.ts src/usecases/itemLike/test/getItemLikeList.test.ts src/services/itemLike/test/getItemLikeList.test.ts test/integration/usecases/itemLike/getItemLikeList/ --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/item-like-list-results.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

すべてexit 0。Vitest実出力は`Test Files 7 passed (7)`、`Tests 123 passed (123)`。
一時集計元は/tmp/item-like-list-results.json。testResultsの7実ファイル/各assertionResultsから上表を集計した。
--maxWorkers=1はDB fixture/hookのファイル間干渉を抑えるためで、D05の独立接続競合は実行している。
本番typecheckはテストを除外し、test/tsconfig.jsonは単体・結合を含む。
通常lintの対象外であるtest/配下の今回の6TSは、Node ESMからESLint APIを使い、
`overrideConfigFile:true`と既存`@eslint/js`/`typescript-eslint`のrecommendedを`**/*.ts`へ適用して追加検査した。
対象はtest/fixtures/itemLike/getItemLikeList/**/\*.tsとtest/integration/usecases/itemLike/getItemLikeList/**/\*.ts。
結果は`Additional test lint: 6 files, 0 diagnostics`。共有設定の変更なし。

## 実DBの安全確認と保証範囲

server/.env.testをDB import前に読み、NODE_ENV=test/PostgreSQL/test_dbを検査した。
アプリ用sequelize・models用db.sequelize・observerの全接続で設定名と`current_database()=test_db`を確認し、
ItemLike/Item/Video/Sale/Userの列存在/NULL、主要な整数/日時/TEXT型、item.status enum、
Itemのseller/video/sale FK、ItemLikeのitem/user FKとonDelete/onUpdate CASCADEをseed前に照合した。
本番DBのスキーマ確認は行っていない。migration・sync・DB作成・全件削除は行っていない。

D05では一覧SELECT完了後、別PIDのobserverで自作いいねを削除commitした。
実transaction_isolation=repeatable read、transaction_read_only=onを確認し、一覧と件数は削除前snapshot、
次要求は空一覧/総0ページとなった。商品は保持される。行ロックを保証するテストではない。
D06では同じtransaction内の実UPDATEがSQLSTATE25006で拒否され、count未実行・自作行不変・再試行成功を確認した。
COMMIT応答喪失・HTTP送信失敗によるDB復元は保証しない。

全テストで自作IDだけをItemLike→Item→Video→Sale→Userの順でcleanupし、残存0件を確認した。
D05の保留Promise/transactionはfinallyで解放・回収済み。hook/spyを解除し、3接続のclose成功とenv復元を確認した。

## 初回実行と修正履歴（解消済み）

- F1 / H01〜H12: 初回HTTP実行は30件がsetup段階で失敗。middleware/index.tsがisAdmin経由で対象外DBを読み込んだため、httpMocks.tsでisAdminを遮断した。実認証は維持。期待値の緩和なし。
- 同初回 / H09: Supertestのローカル待受がEPERMで失敗し、未処理例外1件。環境権限の手順に従って再実行し、HTTP/登録31件成功。最終実行でも成功し例外なし。
- 初回DB / D01〜D07: 127.0.0.1:5432へのEPERMでbeforeAll失敗、18件はランナー上skipped（本体未実行）。seed/cleanup DELETEなし。安全ガードを維持して権限付き再実行し18件成功。最終実行でも成功。
- D07のレビューで商品日時順と期待順が偶然一致していたため、商品日時順といいね順が異なるfixtureへ強化。最終18件で検証済み。
- 最終確認でV02の長文受理を補完し、H03の401本文/H06の不正JSON本文を完全一致で確認。上表は補完・整形後の最終実行結果であり、途中結果は重複加算していない。

対象範囲内の設計・実装・テスト・静的検査が整合し、API開発の完了条件を満たす。
