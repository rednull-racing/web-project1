# createItemEditingCopy 結合テストレポート

## 2026-10-19 実行結果

**5ファイル・143件成功、失敗・skip・todoは各0件。** 実DBを使う4ファイル121件と、DB非接続のRouterテスト1ファイル22件を実行した。最終実行の終了コードは0で、未処理例外の報告もなかった。通常契約に対するテスト失敗・確定したロジックの誤りは確認されなかった。

今回は既存の結合テストの実行・コード照合・報告までを実施した。本番コード、テスト、fixture、設定、スキーマは変更していない。変更ファイルは本書と `docs/log_memo/codex_log.md`。後述の修正案は未実装・未検証である。

根拠は [テスト設計書](../../architecture/itemEditing/createItemEditingCopy.md)、[詳細設計書](../../../../../docs/design/backend/detail/itemEditing/createItemEditingCopy.md)、現行usecase・取得/作成service・validator・HTTP fixtureと実行結果。設計書には過去の設計作成時の制約や未実施記録が残っているため、本書を今回の実行結果とする。

### ファイル別集計

以下のパスは `server/` 基準。全行とも失敗・skip・todoは0件。

| ファイル | 成功 | 実処理・確認範囲 |
| --- | ---: | --- |
| `test/integration/database/itemEditing/createItemEditingCopy/database.test.ts` | 94 | コピー値、永続化、所有権、状態、DB制約、再実行、観測 |
| `test/integration/usecases/itemEditing/createItemEditingCopy/databaseTransactions.test.ts` | 7 | commit可視性、障害注入、rollback、再試行、ロック解放 |
| `test/integration/usecases/itemEditing/createItemEditingCopy/databaseConcurrency.test.ts` | 16 | 同一/別商品の並行処理、更新/削除競合、関連だけの更新 |
| `test/integration/usecases/itemEditing/createItemEditingCopy/databaseHttp.test.ts` | 4 | 実HTTP→実usecase→DB、401/400/404/429、時間窓 |
| 実DB小計 | **121** | 4ファイル |
| `test/integration/usecases/itemEditing/createItemEditingCopy/route.test.ts` | 22 | 実Router・認証・validator・controller・レート制限・共通errorHandler。対象usecaseはモック |
| 合計 | **143** | 5ファイル |

件数はVitest JSON `/tmp/createItemEditingCopy-integration-approved.json` の `assertionResults` から集計した。`it.each` 展開後の実行件数であり、設計表の100ケースID（単体・結合・観測を含む）とは異なる。JSONと実行ログ `/tmp/createItemEditingCopy-integration-approved.log` は作業環境の一時ファイルで、リポジトリには含めない。カバレッジは取得していない。

## 実行環境・再現コマンド

実行ディレクトリは `/home/conta/project/server`、ランナーはVitest 4.1.11。ファイル間のDB負荷・hook干渉を抑えるため `--maxWorkers=1` を使用した。ケース内の並行transactionは維持している。

```bash
npm run test:run -- test/integration/database/itemEditing/createItemEditingCopy/ test/integration/usecases/itemEditing/createItemEditingCopy/ --maxWorkers=1 --reporter=json --outputFile=/tmp/createItemEditingCopy-integration-approved.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

| 確認 | 結果 |
| --- | --- |
| 対象結合テスト | 成功：143/143 |
| `npm run lint` | 成功、終了コード0 |
| `npm run typecheck` | 成功、終了コード0。本番src対象 |
| テスト用tsconfigの型検査 | 成功、終了コード0。単体・結合テストを含む全体 |
| 対象結合テスト・fixtureの追加lint | 成功：9ファイル、エラー0・警告0 |
| `git diff --check` | 成功 |

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

| 設計ID | 判定・対応ファイル | 確認内容・残る範囲 |
| --- | --- | --- |
| N01〜N11 | DB部分成功：database | 全コピー項目、価格10000、割引解除、NULL/空文字/0/false、任意関連欠落、画像null/0/1/10枚、ENUM、新ID・日時。Uの引数・呼出し順は未実行 |
| I01/I02/I04/I05/I06/I08/I10 | DB部分成功：database | 商品/色/サイズのcurrentを各initialへ復元し、JSONBの追加キー・順序・他の値と元データを保持。I02は全階層initial=0の組合せを確認、currentの階層別全展開までは未実施 |
| I03/I07/I09 | 未実行：単体側 | 大小関係の全展開、入れ子の参照同一性、deep freezeは今回対象外。D08の保存後の独立性とは区別 |
| E01/E02/E09 | DB部分成功：database | 不在/他人/所有者null/soldout/他人かつsoldoutで404、追加なし・非対象行不変。破損属性とsoldoutの複合優先順位は単体側で未実行 |
| E05/E06/E07 | DB部分成功：databaseTransactions | 取得前/再取得/作成前の障害で例外伝播、後続停止、ロック解放、再試行 |
| E03/E04/E08 | 未実行：単体側 | ENUM外status、transaction開始拒否、完了Promise拒否のモック検証は今回対象外 |
| A01〜A03 | 未実行：単体側 | 個別のdeferred契約は未実行。実INSERT保留中の未完了はT02で確認したが全A系の代替としない |
| V01/V02/V04 | 一部成功：route | 0/文字列/小数/null/欠落を拒否。-1、1/2、その他文字列、primitive body等の全入力展開は未実行 |
| V05 | HTTP部分成功：route | 混入値を除外し認証IDとitemIdだけをusecaseへ渡す |
| V03/V06/V07/V08 | 未実行：単体側 | schema/middlewareの全境界・直接呼出し。O02では範囲外安全整数2値のschema受理だけ確認 |
| B01〜B03 | DB部分成功：database | 0/254/255文字、日本語・改行・長いTEXT、nullable/有効FK。U側は未実行 |
| S01〜S09 | 未実行：service単体側 | 実service接続とSQLロック効果はD/T/Pで確認。引数・同一参照・transaction省略時等の単体契約は未実行 |
| C01/C03 | 未実行：controller単体側 | raw bodyとの意図的な差異や例外参照の単体確認は対象外 |
| C02 | HTTP部分成功：route | 201とitemEditingIdのみの応答 |
| R01〜R04/R11 | 成功：route | 認証、混入値、不正body、404/500の共通handler応答、内部情報の非公開 |
| R05〜R10 | 成功：route | 5回許可・6/7回目拒否、ユーザー別枠、別商品でも同じ枠、599999/600000/600001ms、400/404/500も消費、認証/429/400の優先順位 |
| D01〜D06/D08 | 成功：database | 別接続で永続化/元・関連・既存編集不変、保存制約、コピー後の独立編集 |
| D07 | 成功：databaseHttp | 401/400/429はtransaction開始なし、404は開始後rollback。拒否時追加なし・非対象行不変 |
| T01 | DB部分成功：database/databaseTransactions | 実commitと別接続可視性。U/S側の完全な引数契約は未実行 |
| T02〜T06 | 成功：databaseTransactions | INSERT保留中の同一transaction内可視/別接続不可視、解放後commit、保存後rollback・再試行、NOWAITで保持/解放確認 |
| Q01〜Q04 | 成功：database | 毎回新規生成、既存編集保持、元更新の再反映、soldout/所有者変更/削除後の404、初回コピー保持 |
| Q05 | 成功：databaseHttp | 5件別IDで保存、6回目429で追加なし、600001msで再開し6件目保存 |
| P01/P02/P08/P09 | 成功：databaseConcurrency | 下記の開始・完了順を実DBで確認 |
| P03〜P07 | 一部成功：databaseConcurrency | 商品/関連更新、soldout、所有者変更、削除の各commit/rollbackは成功。P07の「名称・属性・status・関連FKを同時変更してrollback」の複合条件は未実装 |
| O01 | 観測成功：database | size.inventory=null/欠落でTypeError、編集行追加なし・元不変。通常の型付き入力とは異なる |
| O02 | 一部実施：database | 2147483648/MAX_SAFE_INTEGERをschemaが受理し、実取得で404またはSQLSTATE 22003になることと行不変を確認。テストが両方を許容し結果を出力しないため、どちらの分岐だったかは今回のJSONから特定不可 |
| O03 | 観測成功：databaseConcurrency | 関連だけの更新はItemロックと独立に完了。再取得前commitは新値、再取得後commitは取得済み値をコピー |
| O04 | 未実行 | 実COMMIT送信後の応答喪失・通信障害は発生させていない |
| O05 | 観測成功：database | activeかつdeleted_at非nullでもコピー成功。仕様適合の確定判断とは区別 |

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

| ID | 根拠・原因・対象 | 修正方針と修正後の契約案 | 対象外 |
| --- | --- | --- | --- |
| F1 | O01：`src/usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.ts` のサイズ処理はinventoryを直接参照。破損JSONBでTypeErrorになる | 破損保存データを明示的に拒否する方針なら、在庫変換前に構造を検査し、既存AppError規約に沿った内部整合性エラーで作成前に停止。商品/色/サイズの正常な欠落許容は維持する。エラーコードは実装時に確定 | 不正在庫を0などで補完、既存データの一括修復、通常リクエストの400扱い |
| F2 | O02：DB列INTEGERに対し `src/validators/body/itemEditing.ts` は正の安全整数まで受理。現テストは404/22003の双方を許容し観測値を残さない | まず観測テストに実際のエラー分類を残す。上限をAPIで拒否する方針が確定した場合だけitemIdへmax(2147483647)を追加し、超過は400・usecase/transaction未開始にする | 現状をDB例外が必ず起きる不具合と断定、他IDの一括変更 |
| F3 | O05：取得service `src/services/items/query/relation.ts` にdeleted_at条件がなく、usecaseもactiveのみ判定 | 論理削除済み商品を禁止する仕様なら、ロック検索・関連再取得の両方にdeleted_at=nullを条件化し404・編集行追加なしにする。共有serviceの他呼出しへの影響を先に確認 | 仕様未確認での条件追加、soldout判定との混同、削除処理全体の変更 |
| F4 | P07/O02：現テストの複合条件・観測記録が設計より限定的 | `databaseConcurrency.test.ts` に複合rollbackケース、`database.test.ts` に結果分類の証跡を追加する。通常契約の既存assertionは維持 | 本番実装の変更、O03へ関連行ロック保証を追加、O04の実通信障害を模擬障害で代替 |

### 追加テスト案と既存ケースの扱い

以下は未作成・未実行で、143件には含めない。

| 追加ID | 元ID/修正 | レベル・入力/手順 | 修正後の期待結果案 |
| --- | --- | --- | --- |
| AF-INV01 | O01/F1 | U/D：size.inventory=null/欠落、通常のサイズ在庫、正常な商品/色inventory欠落を独立投入 | 不正構造は決定したAppError、作成未実行/追加なし/ロック解放。通常構造は従来どおり復元し、同じ商品を修復後に再試行成功 |
| AF-ID01 | O02/F2 | D：現行schemaを通した範囲外2値で実取得し、エラー型/codeまたはSQLSTATEを明示記録 | 現行分岐の再現結果がレポートから追跡できる。許容分岐を黙って成功扱いしない |
| AF-ID02 | V06/O02/F2 | V/R/D：2147483646/2147483647/2147483648、MAX_SAFE_INTEGER、0、文字列 | 上限仕様確定後のみ、上限以下の受理と超過400、後続usecase未実行・DB状態不変を確認 |
| AF-DEL01 | O05/F3 | D/HTTP：activeかつdeleted_atあり/なし、soldout、他人所有、再試行 | 削除禁止仕様確定後、論理削除は404・追加なし、未削除activeは成功。所有権・既存コピー不変を維持 |
| AF-DEL02 | P03〜P07/O05/F3 | D：更新側がItemをロックしdeleted_atを設定→コピー待機→commit/rollback | commitなら404、rollbackなら元データで成功。backendの実待機、後続作成停止、既存行不変まで確認 |
| AF-DB01 | P07/F4 | D：更新側が名称・属性・status=soldout・関連FKを同時変更し保留→コピー実待機→更新側rollback | コピーは元の名称/在庫initial/関連データで成功、不成立のstatus/FKを採用しない。関連行の残存・後片付けも確認 |

既存の通常契約テストは維持する。O01/O05は仕様が決まり修正が実装された場合だけ新契約へ移行し、今回の旧挙動は履歴として残す。O02はまず観測記録を補い、API上限の変更が承認された場合のみV06等の期待値を更新する。P07は既存8通りのcommit/rollback対照を残して複合ケースを追加する。

結合テスト143件と静的検査は完了した。単体テストの再実行、設計表の全入力組合せ、P07の複合条件、O02の実分岐特定、O04の実通信障害、上記修正案の実装・再検証は完了範囲に含めない。
