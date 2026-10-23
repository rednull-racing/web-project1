# createItemEditingCopy 結合テストレポート

## 2026-10-23 item_id追加・DB反映結果

- `20261023100000-add-item-editing-item-id.js`を追加し、development（neondb）・test（test_db）へこの1件だけUmzugのSequelize履歴管理で適用した。テストDBの過去の未記録migrationは適用していない。両DBでINTEGER・nullable・item(id)へのFK・ON UPDATE NO ACTION（既定）/ON DELETE CASCADEを確認。適用直前/直後の既存編集行は各0件。downは実装済み・DB上では未実行。
- 3作成usecaseのdataに`item_id: null`を追加し、3serviceの引数型（コピーは下書き型を継承）でもnullを必須にした。serviceは受け取ったdataをそのままModelへ渡す。単体fixtureの完全一致と旧「item_idなし」期待値を更新した。DB fixtureのitem_id存在・nullableガード、所有権・コピー・非対象行検査は維持。
- 単体：`npm run test:run -- src/services/itemEditing/test/createItemEditing src/usecases/itemEditing/test/createItemEditing src/usecases/itemEditing/createItemEditingCopy/test --maxWorkers=1`は6ファイル199件成功。
- DB：`npm run test:run -- test/integration/database/itemEditing/createItemEditingDraft --maxWorkers=1`は54件成功。ITEM-ID01はsetupのusecaseモックを`vi.importActual`で回避した実新規作成→別接続SELECTのnull確認。下書きの共通保存検査にもnull確認を追加した。全接続の設定/実DB名test_dbガード・自作ID限定cleanupと残存0検査・closeを通過。
- コピーDB：`npm run test:run -- test/integration/database/itemEditing/createItemEditingCopy --maxWorkers=1`は93成功・1失敗。O05 AF-DEL01は削除済みitem.deleted_atをupdateして404を期待する旧ケースで、実際は作成成功。item_id検査・全コピー項目の再SELECT・元商品削除後のコピー保持などは成功。
- usecase結合：コピー・下書きの2ディレクトリを`--maxWorkers=1 -t '^(?!.*P03 P04 P05 P06 P07 AF-DEL02 AF-DB01)'`で実行し、7ファイル111成功・1失敗・12除外。失敗はコピーdatabaseHttpの同じ旧論理削除ケース（期待404/実際201）。除外12件は既存の先行変更競合ケース。最初の一括実行ではそのケースが約55秒待機して失敗し進行が止まったため中断した。一括実行のcleanup/close完遂は未確認であり、最終集計へ合算しない。
- `npm run lint`・`npm run typecheck`・`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json`は成功。カバレッジ未取得。実行環境Node 20（package要求は26）のためAWS SDK警告あり。通常lint対象外のテストTSへ追加ESLint検査は未実施。
- item_idの追加・保存契約は反映済み。旧deleted_atテストの見直しと結合テスト全件成功は残件として指定Todoへ記録し、Todoは未完了一覧に残す。削除・復元の本番仕様は今回変更していない。



**最新：2026-10-19 修正後は11ファイル・343件すべて成功。** 本番コードのF1〜F3とテスト補完F4を実装した。詳細は末尾の[修正・再検証レポート](#fix-20261019)を参照。以下の初回143件と未実装修正案は当時の履歴として保持する。

## 2026-10-19 実行結果

**5ファイル・143件成功、失敗・skip・todoは各0件。** 実DBを使う4ファイル121件と、DB非接続のRouterテスト1ファイル22件を実行した。最終実行の終了コードは0で、未処理例外の報告もなかった。通常契約に対するテスト失敗・確定したロジックの誤りは確認されなかった。

今回は既存の結合テストの実行・コード照合・報告までを実施した。本番コード、テスト、fixture、設定、スキーマは変更していない。変更ファイルは本書と `docs/log_memo/codex_log.md`。後述の修正案は未実装・未検証である。

根拠は [テスト設計書](../../architecture/itemEditing/createItemEditingCopy.md)、[詳細設計書](../../../../../docs/design/backend/detail/itemEditing/createItemEditingCopy.md)、現行usecase・取得/作成service・validator・HTTP fixtureと実行結果。設計書には過去の設計作成時の制約や未実施記録が残っているため、本書を今回の実行結果とする。

### ファイル別集計

以下のパスは `server/` 基準。全行とも失敗・skip・todoは0件。

| ファイル                                                                                   |    成功 | 実処理・確認範囲                                                                         |
| ------------------------------------------------------------------------------------------ | ------: | ---------------------------------------------------------------------------------------- |
| `test/integration/database/itemEditing/createItemEditingCopy/database.test.ts`             |      94 | コピー値、永続化、所有権、状態、DB制約、再実行、観測                                     |
| `test/integration/usecases/itemEditing/createItemEditingCopy/databaseTransactions.test.ts` |       7 | commit可視性、障害注入、rollback、再試行、ロック解放                                     |
| `test/integration/usecases/itemEditing/createItemEditingCopy/databaseConcurrency.test.ts`  |      16 | 同一/別商品の並行処理、更新/削除競合、関連だけの更新                                     |
| `test/integration/usecases/itemEditing/createItemEditingCopy/databaseHttp.test.ts`         |       4 | 実HTTP→実usecase→DB、401/400/404/429、時間窓                                             |
| 実DB小計                                                                                   | **121** | 4ファイル                                                                                |
| `test/integration/usecases/itemEditing/createItemEditingCopy/route.test.ts`                |      22 | 実Router・認証・validator・controller・レート制限・共通errorHandler。対象usecaseはモック |
| 合計                                                                                       | **143** | 5ファイル                                                                                |

件数はVitest JSON `/tmp/createItemEditingCopy-integration-approved.json` の `assertionResults` から集計した。`it.each` 展開後の実行件数であり、設計表の100ケースID（単体・結合・観測を含む）とは異なる。JSONと実行ログ `/tmp/createItemEditingCopy-integration-approved.log` は作業環境の一時ファイルで、リポジトリには含めない。カバレッジは取得していない。

## 実行環境・再現コマンド

実行ディレクトリは `/home/conta/project/server`、ランナーはVitest 4.1.11。ファイル間のDB負荷・hook干渉を抑えるため `--maxWorkers=1` を使用した。ケース内の並行transactionは維持している。

```bash
npm run test:run -- test/integration/database/itemEditing/createItemEditingCopy/ test/integration/usecases/itemEditing/createItemEditingCopy/ --maxWorkers=1 --reporter=json --outputFile=/tmp/createItemEditingCopy-integration-approved.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

| 確認                              | 結果                                          |
| --------------------------------- | --------------------------------------------- |
| 対象結合テスト                    | 成功：143/143                                 |
| `npm run lint`                    | 成功、終了コード0                             |
| `npm run typecheck`               | 成功、終了コード0。本番src対象                |
| テスト用tsconfigの型検査          | 成功、終了コード0。単体・結合テストを含む全体 |
| 対象結合テスト・fixtureの追加lint | 成功：9ファイル、エラー0・警告0               |
| `git diff --check`                | 成功                                          |

既存lintのTS設定は `src/**/*.ts` が対象なので、test配下の追加lintは既存依存のESLint APIを使用した。共有設定は変更していない。再現用コマンドは以下。

```bash
node --input-type=module <<'JS'
import { ESLint } from 'eslint';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
const eslint = new ESLint({overrideConfigFile: true, overrideConfig: tseslint.config({files:['test/**/*.ts'],extends:[js.configs.recommended,...tseslint.configs.recommended]})});
const paths=['test/integration/database/itemEditing/createItemEditingCopy/**/*.ts','test/integration/usecases/itemEditing/createItemEditingCopy/**/*.ts','test/fixtures/itemEditing/createItemEditingCopy/**/*.ts'];
const results=await eslint.lintFiles(paths);
console.log(await (await eslint.loadFormatter('stylish')).format(results));
console.log(JSON.stringify({files:results.length,errors:results.reduce((n,r)=>n+r.errorCount,0),warnings:results.reduce((n,r)=>n+r.warningCount,0)}));
process.exitCode=results.some(r=>r.errorCount>0)?1:0;
JS
```

### 初回の環境制約と最終結果の区別

初回はサンドボックス内のDB接続とHTTP待受がEPERMで拒否された。DB4ファイルはbeforeAllの接続段階で停止し、121件はランナー上skipだがケース本体未実行。Routerの22件もHTTP待受失敗となり、未処理例外が報告された。fixture作成前の停止で、DB書込みは行われていない。これは機能のassertion不一致ではない。

通信許可後、同じガード・同じ5ファイルを制限外で再実行し、143件すべて成功した。初回JSON `/tmp/createItemEditingCopy-integration.json` の失敗22・skip121は途中経過であり、最終集計には加算していない。

## DB安全条件・後片付け

- 読込元は `/home/conta/project/server/.env.test`。`databaseSetup.ts` がDBモジュール初期化前に読み、`NODE_ENV=test` とPostgreSQL URLのDB名 `test_db` を検査する。引き継いだ環境変数も検証済みファイルの値に揃える。
- アプリ接続 `src/db.ts`、モデル初期化接続 `db.sequelize`、独立確認用接続 `observer` のすべてで、設定DB名と `SELECT current_database()` の結果が `test_db` であることを確認した。ガード通過後だけfixture作成が許可される。
- dotenvの既定呼出しは検証済み値を返し、別envファイルの明示指定や接続URLの差替えを拒否する。最終実行では安全条件違反なし。設定の補正・ガード緩和はしていない。
- 既存スキーマを使用し、必要テーブル・item_editingの列/NULL制約とREAD COMMITTEDを確認した。DB作成、migration、sync、truncate、全件削除は実施していない。
- fixtureは固有ユーザー・商品・関連・マスター・既存編集行を作成し、afterCreateで今回作成したIDだけを記録する。商品/編集/動画/セール/配送の保存結果はobserverの新規SELECTで確認した。
- 各ケース後に外部キー依存順で記録IDのみ削除し、全対象モデルで残存0件のassertionが通った。rollback済みの採番IDも追跡対象。afterAllでhook解除と3接続のcloseが成功した。Promise・transactionの回収を含む後片付けの失敗なし。

## 実処理とモック・障害注入の境界

DBテストでは実usecase、在庫復元、取得service、作成service、Sequelizeモデル、PostgreSQLを接続した。取得serviceはItemのみを先にFOR UPDATEでロックし、その後同じtransactionでVideo/Sale/配送を外部結合して再取得する。nullable側を一括ロックするSQLエラーは発生していない。

transaction/並行テストのラッパーは実serviceを呼んだ前後で通知・保留・意図的な例外を挟む。T03のSELECT失敗はModel hook、作成前失敗はservice差替えによる模擬障害。T04/P02は実INSERT後のcallback例外で実rollbackを確認した。実DBサーバー障害やCOMMIT応答喪失を発生させた結果ではない。

HTTPは最小Expressアプリに実Routerと共通errorHandlerを登録した。`databaseHttp` は対象usecaseも実処理、`route` は対象usecaseをモックする。他エンドポイントのusecaseとAWS/S3境界はモックし、実アップロード・署名・外部通信は行わない。`src/app.ts` 全体の起動・本番Router登録・Redisを使う本番環境・フロントエンドからの通信は未確認。

## 設計ケースとの対応

以下は今回実行した**結合テストでの判定**。U/I/V/S/Cの単体側を含む設計IDについては、そのID全体の完了を意味しない。対応ファイル名は上の集計表と同じ。

| 設計ID                      | 判定・対応ファイル                        | 確認内容・残る範囲                                                                                                                                                                           |
| --------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N01〜N11                    | DB部分成功：database                      | 全コピー項目、価格10000、割引解除、NULL/空文字/0/false、任意関連欠落、画像null/0/1/10枚、ENUM、新ID・日時。Uの引数・呼出し順は未実行                                                         |
| I01/I02/I04/I05/I06/I08/I10 | DB部分成功：database                      | 商品/色/サイズのcurrentを各initialへ復元し、JSONBの追加キー・順序・他の値と元データを保持。I02は全階層initial=0の組合せを確認、currentの階層別全展開までは未実施                             |
| I03/I07/I09                 | 未実行：単体側                            | 大小関係の全展開、入れ子の参照同一性、deep freezeは今回対象外。D08の保存後の独立性とは区別                                                                                                   |
| E01/E02/E09                 | DB部分成功：database                      | 不在/他人/所有者null/soldout/他人かつsoldoutで404、追加なし・非対象行不変。破損属性とsoldoutの複合優先順位は単体側で未実行                                                                   |
| E05/E06/E07                 | DB部分成功：databaseTransactions          | 取得前/再取得/作成前の障害で例外伝播、後続停止、ロック解放、再試行                                                                                                                           |
| E03/E04/E08                 | 未実行：単体側                            | ENUM外status、transaction開始拒否、完了Promise拒否のモック検証は今回対象外                                                                                                                   |
| A01〜A03                    | 未実行：単体側                            | 個別のdeferred契約は未実行。実INSERT保留中の未完了はT02で確認したが全A系の代替としない                                                                                                       |
| V01/V02/V04                 | 一部成功：route                           | 0/文字列/小数/null/欠落を拒否。-1、1/2、その他文字列、primitive body等の全入力展開は未実行                                                                                                   |
| V05                         | HTTP部分成功：route                       | 混入値を除外し認証IDとitemIdだけをusecaseへ渡す                                                                                                                                              |
| V03/V06/V07/V08             | 未実行：単体側                            | schema/middlewareの全境界・直接呼出し。O02では範囲外安全整数2値のschema受理だけ確認                                                                                                          |
| B01〜B03                    | DB部分成功：database                      | 0/254/255文字、日本語・改行・長いTEXT、nullable/有効FK。U側は未実行                                                                                                                          |
| S01〜S09                    | 未実行：service単体側                     | 実service接続とSQLロック効果はD/T/Pで確認。引数・同一参照・transaction省略時等の単体契約は未実行                                                                                             |
| C01/C03                     | 未実行：controller単体側                  | raw bodyとの意図的な差異や例外参照の単体確認は対象外                                                                                                                                         |
| C02                         | HTTP部分成功：route                       | 201とitemEditingIdのみの応答                                                                                                                                                                 |
| R01〜R04/R11                | 成功：route                               | 認証、混入値、不正body、404/500の共通handler応答、内部情報の非公開                                                                                                                           |
| R05〜R10                    | 成功：route                               | 5回許可・6/7回目拒否、ユーザー別枠、別商品でも同じ枠、599999/600000/600001ms、400/404/500も消費、認証/429/400の優先順位                                                                      |
| D01〜D06/D08                | 成功：database                            | 別接続で永続化/元・関連・既存編集不変、保存制約、コピー後の独立編集                                                                                                                          |
| D07                         | 成功：databaseHttp                        | 401/400/429はtransaction開始なし、404は開始後rollback。拒否時追加なし・非対象行不変                                                                                                          |
| T01                         | DB部分成功：database/databaseTransactions | 実commitと別接続可視性。U/S側の完全な引数契約は未実行                                                                                                                                        |
| T02〜T06                    | 成功：databaseTransactions                | INSERT保留中の同一transaction内可視/別接続不可視、解放後commit、保存後rollback・再試行、NOWAITで保持/解放確認                                                                                |
| Q01〜Q04                    | 成功：database                            | 毎回新規生成、既存編集保持、元更新の再反映、soldout/所有者変更/削除後の404、初回コピー保持                                                                                                   |
| Q05                         | 成功：databaseHttp                        | 5件別IDで保存、6回目429で追加なし、600001msで再開し6件目保存                                                                                                                                 |
| P01/P02/P08/P09             | 成功：databaseConcurrency                 | 下記の開始・完了順を実DBで確認                                                                                                                                                               |
| P03〜P07                    | 一部成功：databaseConcurrency             | 商品/関連更新、soldout、所有者変更、削除の各commit/rollbackは成功。P07の「名称・属性・status・関連FKを同時変更してrollback」の複合条件は未実装                                               |
| O01                         | 観測成功：database                        | size.inventory=null/欠落でTypeError、編集行追加なし・元不変。通常の型付き入力とは異なる                                                                                                      |
| O02                         | 一部実施：database                        | 2147483648/MAX_SAFE_INTEGERをschemaが受理し、実取得で404またはSQLSTATE 22003になることと行不変を確認。テストが両方を許容し結果を出力しないため、どちらの分岐だったかは今回のJSONから特定不可 |
| O03                         | 観測成功：databaseConcurrency             | 関連だけの更新はItemロックと独立に完了。再取得前commitは新値、再取得後commitは取得済み値をコピー                                                                                             |
| O04                         | 未実行                                    | 実COMMIT送信後の応答喪失・通信障害は発生させていない                                                                                                                                         |
| O05                         | 観測成功：database                        | activeかつdeleted_at非nullでもコピー成功。仕様適合の確定判断とは区別                                                                                                                         |

### 実DBで確認した順序・制約

- T02：実INSERT→callback保留→同じtransaction内で存在確認→observerでは不在/usecase未完了→解放→commit→observerで全コピー値一致。
- T03〜T05：各障害→rollback→新規行なし/保護対象不変→NOWAITで再ロック可能→再試行成功。実INSERT後の失敗でも失敗行は不在、再試行の別ID行だけ保存された。
- T06：実INSERT後保留→別transactionのFOR UPDATE NOWAITがSQLSTATE 55P03→そのtransactionをrollback→先行commitまたはrollback→再ロック成功。
- P01：先行A/Bが取得・INSERT後保留→後続開始→backend PIDとpg_blocking_pidsで後続が先行を待機と確認→後続の関連再取得/作成は未実行→先行解放・commit→後続取得/INSERT・commit。先行を入れ替えて両方成功し、各1行・別IDで計2行。
- P02：先行INSERT保留→後続の実待機確認→先行を保存後例外でrollback→後続作成・commit。先行IDの行は不在、後続の1行だけ保存。
- P03〜P07：更新側がItemをロックして変更→コピー側の実待機確認→更新側commit/rollback→コピーが取得。commitした商品/関連更新は新値、soldout/所有者変更/削除は404。rollback対照は確定済みの旧値から成功。
- P08：別ユーザー・別商品が双方INSERTまで到達→後発を先にcommit→先発はまだ別接続から不可視→先発commit。所有者・価格・在庫・URLの混同なし。
- P09：コピーINSERT後保留→更新/削除側開始・実待機→コピーcommit→更新/削除commit。コピー値は取得時の値を保持し、後続削除でもitem_id=nullのコピー行が残る。
- D05：既存fixture行限定の直接SQL・rollbackでNOT NULL（23502）、ENUM（22P02）、VARCHAR(255)超過（22001）、9外部キー（23503）を確認。D06の画像11枚拒否はSequelize ValidationErrorであり、DB ARRAYの10枚CHECKの確認ではない。

## 未解決事項と修正案（未実装）

通常契約に対する失敗はないため、即時修正が必要と確定した本番ロジックはない。以下は観測ケースの防御強化候補と、報告精度・設計網羅性を改善するテスト案である。新しい業務仕様を確定せずに期待値だけ変更しない。

| ID  | 根拠・原因・対象                                                                                                                             | 修正方針と修正後の契約案                                                                                                                                                                         | 対象外                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| F1  | O01：`src/usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.ts` のサイズ処理はinventoryを直接参照。破損JSONBでTypeErrorになる | 破損保存データを明示的に拒否する方針なら、在庫変換前に構造を検査し、既存AppError規約に沿った内部整合性エラーで作成前に停止。商品/色/サイズの正常な欠落許容は維持する。エラーコードは実装時に確定 | 不正在庫を0などで補完、既存データの一括修復、通常リクエストの400扱い         |
| F2  | O02：DB列INTEGERに対し `src/validators/body/itemEditing.ts` は正の安全整数まで受理。現テストは404/22003の双方を許容し観測値を残さない        | まず観測テストに実際のエラー分類を残す。上限をAPIで拒否する方針が確定した場合だけitemIdへmax(2147483647)を追加し、超過は400・usecase/transaction未開始にする                                     | 現状をDB例外が必ず起きる不具合と断定、他IDの一括変更                         |
| F3  | O05：取得service `src/services/items/query/relation.ts` にdeleted_at条件がなく、usecaseもactiveのみ判定                                      | 論理削除済み商品を禁止する仕様なら、ロック検索・関連再取得の両方にdeleted_at=nullを条件化し404・編集行追加なしにする。共有serviceの他呼出しへの影響を先に確認                                    | 仕様未確認での条件追加、soldout判定との混同、削除処理全体の変更              |
| F4  | P07/O02：現テストの複合条件・観測記録が設計より限定的                                                                                        | `databaseConcurrency.test.ts` に複合rollbackケース、`database.test.ts` に結果分類の証跡を追加する。通常契約の既存assertionは維持                                                                 | 本番実装の変更、O03へ関連行ロック保証を追加、O04の実通信障害を模擬障害で代替 |

### 追加テスト案と既存ケースの扱い

以下は未作成・未実行で、143件には含めない。

| 追加ID   | 元ID/修正       | レベル・入力/手順                                                                         | 修正後の期待結果案                                                                                                   |
| -------- | --------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| AF-INV01 | O01/F1          | U/D：size.inventory=null/欠落、通常のサイズ在庫、正常な商品/色inventory欠落を独立投入     | 不正構造は決定したAppError、作成未実行/追加なし/ロック解放。通常構造は従来どおり復元し、同じ商品を修復後に再試行成功 |
| AF-ID01  | O02/F2          | D：現行schemaを通した範囲外2値で実取得し、エラー型/codeまたはSQLSTATEを明示記録           | 現行分岐の再現結果がレポートから追跡できる。許容分岐を黙って成功扱いしない                                           |
| AF-ID02  | V06/O02/F2      | V/R/D：2147483646/2147483647/2147483648、MAX_SAFE_INTEGER、0、文字列                      | 上限仕様確定後のみ、上限以下の受理と超過400、後続usecase未実行・DB状態不変を確認                                     |
| AF-DEL01 | O05/F3          | D/HTTP：activeかつdeleted_atあり/なし、soldout、他人所有、再試行                          | 削除禁止仕様確定後、論理削除は404・追加なし、未削除activeは成功。所有権・既存コピー不変を維持                        |
| AF-DEL02 | P03〜P07/O05/F3 | D：更新側がItemをロックしdeleted_atを設定→コピー待機→commit/rollback                      | commitなら404、rollbackなら元データで成功。backendの実待機、後続作成停止、既存行不変まで確認                         |
| AF-DB01  | P07/F4          | D：更新側が名称・属性・status=soldout・関連FKを同時変更し保留→コピー実待機→更新側rollback | コピーは元の名称/在庫initial/関連データで成功、不成立のstatus/FKを採用しない。関連行の残存・後片付けも確認           |

既存の通常契約テストは維持する。O01/O05は仕様が決まり修正が実装された場合だけ新契約へ移行し、今回の旧挙動は履歴として残す。O02はまず観測記録を補い、API上限の変更が承認された場合のみV06等の期待値を更新する。P07は既存8通りのcommit/rollback対照を残して複合ケースを追加する。

結合テスト143件と静的検査は完了した。単体テストの再実行、設計表の全入力組合せ、P07の複合条件、O02の実分岐特定、O04の実通信障害、上記修正案の実装・再検証は完了範囲に含めない。

---

<a id="fix-20261019"></a>

## 2026-10-19 F1〜F4 修正・再検証レポート（最新）

**11ファイル・343件すべて成功。失敗・skip・todoは各0件、終了コード0、未処理例外の報告なし。** 内訳は結合155件（実DB129件、DB非接続Router26件）と単体188件。初回143件へ再実行分を重複加算した件数ではなく、今回の最終JSONからの集計である。

### 変更の根拠と実装済みの契約

今回の「先ほどのレポートをもとに本番コードを修正」の依頼を根拠に、F1〜F3の提案を本機能の契約へ反映した。[テスト設計書の最新契約](../../architecture/itemEditing/createItemEditingCopy.md)と詳細設計も更新した。本番変更は3ファイルで、依存追加・モデル変更・migrationはない。

| 修正          | 修正前の入力・結果                                                               | 実装・検証した修正後の契約                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1 / O01      | 保存済みsize.inventoryがnull/欠落だとTypeError                                   | `src/usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.ts` に在庫構造の検査を追加。attributesがオブジェクト、任意階層が正しい配列/オブジェクト、各在庫のinitial/current/low_stock_ratioが有限数値であることを確認。サイズ在庫は必須。不正ならITEM_ATTRIBUTES_INVALID・500で作成前に停止。商品/色在庫やcolorVariants/sizesの正常な欠落は引き続き許容し、初期値0・追加キー・配列順を保持 |
| F2 / V06・O02 | schemaが2147483648/MAX_SAFE_INTEGERを受理。DB側の404/22003は旧テストが双方を許容 | `src/validators/body/itemEditing.ts` のcopy用schemaだけにmax(2147483647)を追加。超過は400・INVALID_BODY、usecase/transaction未開始。上限直前2147483646・一致2147483647は数値のまま受理                                                                                                                                                                                                                |
| F3 / O05      | activeかつdeleted_atありでもコピー成功                                           | `src/services/items/query/relation.ts` のtransaction付きコピー取得で、ロック検索と関連再取得の両方にdeleted_at=nullを追加。削除済みは404・作成未実行。transactionなしで呼ぶ論理削除usecaseの取得条件は維持し、S07で完全一致を確認                                                                                                                                                                     |
| F4 / P07      | 名称/在庫/status/関連FKを同時変更してrollbackする条件が未実装                    | 実DBの競合テストに複合変更と論理削除を追加し、いずれもcommit/rollback対照を実行。旧P03〜P09の各条件も維持                                                                                                                                                                                                                                                                                             |

在庫検査は保存済みデータの整合性確認であり、リクエストbodyを再検証する処理ではない。材料・分類など在庫以外の構造検査や在庫数値への新たな上下限は追加していない。エラー応答のmessageは「商品の在庫情報を確認できません。時間をおいてもう一度お試しください。」とし、保存内容やSQLは含めない。

### ファイル別の最終集計

パスはserver/基準。全行で失敗・skip・todoは0件。

| ファイル                                                                                   |    成功 | 今回確認した範囲                                                                             |
| ------------------------------------------------------------------------------------------ | ------: | -------------------------------------------------------------------------------------------- |
| `test/integration/database/itemEditing/createItemEditingCopy/database.test.ts`             |      94 | 既存DB回帰、O01のAppError化・修復後再試行、上限直前/一致のDB取得、論理削除拒否・復元後再試行 |
| `test/integration/usecases/itemEditing/createItemEditingCopy/databaseTransactions.test.ts` |       7 | commit可視性、保存前/後の失敗、実rollback、再試行、ロック解放                                |
| `test/integration/usecases/itemEditing/createItemEditingCopy/databaseConcurrency.test.ts`  |      20 | 既存16件と、論理削除・複合変更それぞれのcommit/rollbackの4件                                 |
| `test/integration/usecases/itemEditing/createItemEditingCopy/databaseHttp.test.ts`         |       8 | 既存4件、上限超過2値、論理削除404、在庫構造不正500                                           |
| 実DB小計                                                                                   | **129** | 4ファイル                                                                                    |
| `test/integration/usecases/itemEditing/createItemEditingCopy/route.test.ts`                |      26 | 既存HTTP回帰、上限超過2値でusecase未実行、上限直前/一致の受理                                |
| 結合小計                                                                                   | **155** | 5ファイル                                                                                    |
| `src/usecases/itemEditing/createItemEditingCopy/test/usecase.test.ts`                      |      89 | N/E/A/Q/B系の引数・例外・待機・コピー値。O05はserviceがnullを返す境界へ移行                  |
| `src/usecases/itemEditing/createItemEditingCopy/test/inventoryReset.test.ts`               |      48 | I01〜I10、null/欠落サイズ在庫のAppError化、14種類の構造/数値不正で元データ不変・作成停止     |
| `src/validators/body/test/createItemEditingCopy.test.ts`                                   |      36 | V01〜V08、INTEGER上限、未知キー除去・middleware成功/失敗                                     |
| `src/services/items/query/test/getMyItemWithVideoSaleShipping.test.ts`                     |       8 | S01〜S07、両SELECTのdeleted_at条件とtransaction省略時の条件維持                              |
| `src/services/itemEditing/test/createItemEditingCopy.test.ts`                              |       2 | S08/S09、data/transaction同一参照、例外伝播                                                  |
| `src/controllers/itemEditing/test/createItemEditingCopy.test.ts`                           |       5 | C01〜C03、認証/検証済み値、201、例外と待機                                                   |
| 単体小計                                                                                   | **188** | 6ファイル                                                                                    |
| 全体                                                                                       | **343** | 実DB129件、DB非接続214件                                                                     |

実行ディレクトリは `/home/conta/project/server`。最終結果は `/tmp/createItemEditingCopy-fix-results.json`、実行ログは `/tmp/createItemEditingCopy-fix-results.log`。Vitest 4.1.11で下記を実行した。前回確認済みの接続/HTTP待受制限のため、テストは通信許可のもとで実行し、安全ガードは維持した。今回の修正後テスト実行に収集/setup/ケース本体の失敗はない。

```bash
npm run test:run -- src/usecases/itemEditing/createItemEditingCopy/test/ src/controllers/itemEditing/test/createItemEditingCopy.test.ts src/validators/body/test/createItemEditingCopy.test.ts src/services/items/query/test/getMyItemWithVideoSaleShipping.test.ts src/services/itemEditing/test/createItemEditingCopy.test.ts test/integration/database/itemEditing/createItemEditingCopy/ test/integration/usecases/itemEditing/createItemEditingCopy/ --maxWorkers=1 --reporter=json --outputFile=/tmp/createItemEditingCopy-fix-results.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

lint、本番typecheck、単体/結合全体を含むテスト型検査はいずれも終了コード0。test配下の結合・fixture計9ファイルは初回に記載した既存ESLint APIの追加lintでもエラー0・警告0。`git diff --check` と文書の相対リンクも確認した。カバレッジは取得していない。

### 追加ケース・移行・実DBの証跡

| ケースID                 | 判定と対応                                        | 実行した入力・順序・結果                                                                                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AF-INV01 / O01           | 成功：inventoryReset、database、databaseHttp      | null/欠落のサイズ在庫をAppError・500で拒否し、ItemEditing.create未実行、元/関連/既存編集不変・追加なし。DBではNOWAIT再ロック成功後、保存済みattributesを正常値へ修復して同じ商品で再試行成功。HTTPも明示的なcode/messageを確認。単体はnull属性・配列・不正配列要素・在庫項目欠落/文字列/非有限値など14条件も拒否 |
| AF-ID02 / V06・O02       | 成功：validator、route、database、databaseHttp    | 上限直前/一致はschema/HTTPで受理し、実DBでは不在としてITEM_NOT_FOUND・404。超過2147483648/MAX_SAFE_INTEGERは実HTTPで400・INVALID_BODY、transaction spy0回、編集行追加なし・非対象行不変                                                                                                                          |
| AF-ID01 / O02            | 新契約へ移行：databaseHttp                        | 旧「範囲外整数をDBへ渡し404/22003を分類」は、API上限追加により「超過は400でDB未開始」の確定assertionへ置換。修正前のDB内部でどちらの分岐だったかは未特定のままで、旧挙動を今回の観測結果として断定しない                                                                                                         |
| AF-DEL01 / O05           | 成功：usecase/service単体、database、databaseHttp | 初回コピー成功→元Itemをactiveのまま論理削除→404・作成未実行・全保護対象不変・初回コピー保持→ロック解放確認→deleted_at=nullへ復元→別IDで成功。実HTTPも削除済みの404を確認。service単体は両SELECTの条件とtransaction省略時の従来条件を完全一致で確認                                                               |
| AF-DEL02 / O05・P03〜P07 | 成功：databaseConcurrency                         | 更新側がItemロック→deleted_at設定→コピー開始→backend PID/pg_blocking_pidsで実待機確認→更新側commitならロック検索からnullとなり、関連再取得/作成0回で404。rollback対照は元の全コピー値で1行commit                                                                                                                 |
| AF-DB01 / P07            | 成功：databaseConcurrency                         | 更新側が名称・画像・在庫・status=soldout・Video/Sale/配送の新規FKを同時変更して保留→コピー実待機・関連再取得/作成未実行→更新側rollback→コピーは元の名称/在庫initial/旧関連値を全項目一致で保存。commit対照はsoldoutで404、作成なし                                                                               |

旧O01のTypeError期待、旧O05の削除済みでも成功の期待、V06/O02の範囲外整数受理は、実装した新契約へ更新した。その他の正常・異常・境界・在庫深い複製・価格・レート制限・transaction・並行処理のassertionを弱めず、skip/todo化もしていない。設計の100ケースIDは単体/結合の責務を含み、今回の343実行件数とは別である。初回未実行だったU/I/V/S/C単体6ファイルも今回実行した。

DBの読込元は引き続き `/home/conta/project/server/.env.test`。アプリ・モデル初期化・observerの3接続で設定DB名/実DB名が `test_db`、分離レベルがREAD COMMITTEDであることをガードで確認し、すべて通過した。スキーマの自動補正なし。コピーのcommit/rollback結果はobserverの新規SELECTで確認し、変更前後の対象外行も比較した。

新しい競合ケースも任意sleepで判定せず、backend PIDの実待機を照会し、deferredで解放順を制御した。rollbackした複合変更で新規作成した関連行も追跡IDに含め、fixtureを外部キー順で削除し、各ケースで残存0件のassertionが成功。hook解除、保留Promise/transactionの回収、3接続closeにも失敗なし。実DB・モック・障害注入の境界は初回記載を維持し、実INSERT後の例外によるrollback回帰も今回再実行した。

### 残る範囲・再修正案

今回の修正・再検証で新たなテスト失敗や、再修正が必要なロジックの問題は確認されなかった。F1〜F4と上記回帰の範囲は完了。追加の本番修正案はない。

- O04の実COMMIT送信後の応答喪失は未実施。E08の完了Promise拒否やT04のcallback例外から「通信障害でも必ずrollback」とは保証しない。
- O03は今回も成功したが、関連だけの独立更新をItemロックで排他する契約へ変更していない。
- 保存済み在庫以外のJSONB全項目の検査・既存破損データの一括修復、usecase直接呼出しのitemId検証、実アプリ全体/フロントエンド/本番Redis/AWS通信は対象外。今回の有限数値検査を全属性の業務妥当性保証とは扱わない。
- 設計表の全入力組合せや実通信障害まで網羅した意味での全体完了ではない。将来の別仕様を今回の修正案として追加しない。

### 変更ファイル

本番3ファイル（usecase、取得service、body validator）、単体4ファイル（usecase/inventoryReset/取得service/validator）、結合4ファイル（database/databaseConcurrency/databaseHttp/route）、本レポート、テスト設計書、詳細設計書、Codexログを変更した。controller・作成service・transactionテスト・fixture・接続ガードは変更せず、そのまま回帰確認した。
