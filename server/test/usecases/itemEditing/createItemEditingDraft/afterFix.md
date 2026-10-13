# 下書きから商品編集セッション作成：修正案

## 1. 対象と判断

[testReport.md](./testReport.md) のレビュー・実行結果に基づく提案。対象206件は成功したが、本番共通エラー処理、設計に対する検証不足、追加lintに修正が必要である。**本書は修正案のみで、本番コード・テストの修正や修正後の再実行は行っていない。**

パスは `server/` 基準。下書きコピー・取得where・行ロック・同一transaction・削除の業務処理は維持する。入力ID上限の決定、他機能のimportエラー、スキーマ変更は対象外。

## 2. 本番コードの修正案

### F1（P0）：共通errorHandlerを4引数で登録する

根拠はPR01・R08。現行handlerが3引数なので、Express 4はエラー処理時にスキップする。Routerテストは別の4引数handlerを使うため、この問題を検出できなかった。

対象は `src/middleware/errorHandler.ts`。`ErrorRequestHandler` 型で `(err, req, res, next)` の4引数を明示し、既存のAppErrorと通常ErrorのJSON形式・statusを保持する。利用しない引数もlintに適合する形で明示的に扱い、引数の削除・デフォルト引数化・rest引数化で関数lengthを減らさない。

修正後は、本Routerが渡すINVALID_BODY/400・ITEM_DRAFT_NOT_FOUND/404と、通常Error/500が共通handlerから返る。201応答、認証middleware自身の401、レートmiddleware自身の429、DBの原子性は変更しない。

対象usecase/service/modelに、本テスト結果を理由とした追加修正は提案しない。

## 3. テストコードの修正案

### F2（P1）：実共通handlerの接続テストを追加する

対象は `test/usecases/itemEditing/createItemEditingDraft/route.test.ts`。既存R08の観測handlerテストは維持し、実Router＋実共通errorHandlerの最小アプリを別に組む。usecaseだけをモックしてAppError/通常Errorを返し、statusに加えて既存JSON形式を完全一致で確認する。DBやapp全体の起動は不要。

修正前は共通handlerの登録Layerがエラーを処理せず次へ渡る。修正後はエラーJSONを返し、正常201には影響しないことを確認する。

### F3（P1）：非対象行・要求識別・service境界を補う

根拠はRV01〜RV03。対象は同ディレクトリの `databaseConcurrency.test.ts`、`databaseFixtures.ts`、`services.test.ts`。

- P01〜P08で別下書き・既存編集・Item・参照先の事前snapshotを取り、並行処理後に全列一致を確認する。P09ではBの下書きが操作対象になるため、それを保護対象から除き、残る非対象行を比較する。
- P01はA/Bごとの開始・取得・transaction・完了結果を記録する。A先行/B先行それぞれで、指定した要求が成功し他方が404になることをassertする。入力は同一のまま、ラベルの入替えだけで逆順確認済みとしない。
- E08のSケースでは画像11件の配列をserviceへ渡し、モデルcreateへの同じdata/tの引渡しと、モデル側のValidationErrorの同一参照での伝播を確認する。拒否そのものの保証は既存Dテストに置く。

### F4（P1）：4引数を維持して追加lintを通す

根拠はRV04。対象は `route.test.ts:31` と `database.test.ts:90` の観測用handler。`_next` を削除せず、例えば `void _next;` で未使用が意図的であることを示す。テストに必要な4引数の関数lengthと既存観測結果を維持し、共有ESLint設定は変更しない。

## 4. 追加・移行するケース

| 追加ID | 元ID・根拠 | レベル | 入力・手順 | 修正後の期待結果 |
| --- | --- | --- | --- | --- |
| AF-R01 | V02/V03・PR01 | R | 正常認証＋不正ID、実共通handlerを接続 | 400、`{ code: "INVALID_BODY", message: "INVALID_BODY" }`、usecase未実行 |
| AF-R02 | E01/E02/R08・PR01 | R | usecaseがITEM_DRAFT_NOT_FOUND/404を返す | 共通handlerから404とcode/messageのJSON、201なし |
| AF-R03 | E04〜E06/R08・PR01 | R | usecaseが通常Errorを返す | 500、既存のerror/messageのJSON。内部Errorの詳細なし |
| AF-R04 | C02/R02 | R | F1後に正常要求 | 201・`{ itemEditingId }` を維持 |
| AF-DB01 | P01〜P08/ST06・RV01 | D | 既存の各競合を実行し非対象snapshotも比較 | commit/rollback後も非対象行全列不変 |
| AF-DB02 | P09/ST06・RV01 | D | 別所有者・別下書きの成功を交差 | 対象2行は移行、対象外下書き・既存編集・参照先は不変 |
| AF-DB03 | P01・RV02 | D | A先行/B先行を要求別traceで独立展開 | 指定した先行要求だけ成功、後続404、編集1行、実ロック待機あり |
| AF-S01 | E08・RV03 | S | モデルcreateにValidationErrorを設定し画像11件を渡す | 同じ配列/data/tを引き渡し、同じ例外を伝播。DB拒否は既存E08で別確認 |
| AF-R05 | R08/ST03・RV04 | R/D | 未使用引数を明示した4引数handlerで既存要求を再実行 | 既存結果と関数length=4を維持し、追加lintエラー0 |

既存206件は原則維持する。P01は手順とassertを補強し、P01〜P09は非対象行assertを追加する。E08のD検証・R08の観測用handlerの期待値は変更しない。初回の通信制限を理由にskip化や期待値変更を行わない。

## 5. 修正後の確認と完了条件

F1/F2 → F3/F4の順に実施する。対象Vitest、npm run lint、npm run typecheck、テストTSの型検査と追加lintを再実行する。DB検査は引き続き `.env.test`・test_dbの全接続ガードを通し、別接続の結果と後片付けを確認する。

完了条件は、共通handlerの400/404/500と正常201、要求別の競合結果、並行後の非対象行不変、E08のS/D責務、追加lint成功が確認できること。ケースID・追加テスト・実行件数の対応を報告し、対象外の既知importエラーを全体成功へ混ぜない。未確定のID上限と実commit障害の検証は引き続き保留／対象外とする。

## 6. 追加修正レポート（2026-10-13）

### 6.1 結果と今回の範囲

修正済みの対象8テストファイルを実行し、通信を許可した最終実行で**220件すべて成功**した。失敗・skip・todo・未処理例外は0件。DB非接続143件、実DB77件である。対象11個のTypeScriptファイルの型検査と追加lintも成功した。テスト全体の型検査は、対象外の既知importエラー2件により失敗しており、全体成功とは扱わない。

1〜5節は修正前の提案として保存する。本節がF1〜F4の修正後の検証結果であり、[testReport.md](./testReport.md) の初回判定を更新する。今回の編集は本ファイルへの追記のみ。本番コード・テストコード・共有設定の追加修正は行っていない。

検証した修正済みコードは以下のとおり。

- F1：`src/middleware/errorHandler.ts` に実装済みの `ErrorRequestHandler` 型と4引数を、実RouterのHTTP経路で検証した。
- F2：`route.test.ts` の別Expressアプリに実共通handlerを接続し、400・404・500のJSON完全一致と正常201を確認した。既存R08の観測handlerテストも維持した。
- F3：`databaseConcurrency.test.ts` と `databaseFixtures.ts` でP01〜P09の非対象行比較を追加した。P01はAsyncLocalStorageで要求名を保持し、開始・取得・transaction・完了結果を要求別に確認した。`services.test.ts` には画像11件の同一参照での引渡しとValidationError伝播を追加した。
- F4：`route.test.ts` と `database.test.ts` の観測handlerで未使用引数を `void` で扱い、`length === 4` を確認した。共有ESLint設定は変更していない。

### 6.2 ファイル別件数と追加・移行ケース

件数は `/tmp/createItemEditingDraft-afterFix-results-escalated.json` のVitest JSON結果から集計した。各ファイルの失敗・skip・todoはすべて0件。

| ファイル | 初回件数 | 今回成功 | 変更内容 |
| --- | ---: | ---: | --- |
| usecase.test.ts | 55 | 55 | 既存回帰を維持 |
| services.test.ts | 10 | 11 | AF-S01を1件追加 |
| validation.test.ts | 33 | 33 | 既存回帰を維持 |
| controller.test.ts | 4 | 4 | 既存回帰を維持 |
| route.test.ts | 27 | 40 | AF-R01を10条件、AF-R02〜04を各1件追加。R08にAF-R05を対応付け |
| database.test.ts | 54 | 54 | ST03の3条件にAF-R05を対応付け |
| databaseTransactions.test.ts | 11 | 11 | E08の実モデル拒否・rollbackを含む既存回帰を維持 |
| databaseConcurrency.test.ts | 12 | 12 | P01〜P09の既存12件を補強 |
| **合計** | **206** | **220** | **既存206件を維持し、14件追加** |

追加IDはテストの観点を表す。既存ケースに複数IDを付けた箇所は件数を重複計上しない。

| 追加ID／元ID | 対応ファイル・展開件数 | 判定と確認内容 |
| --- | --- | --- |
| AF-R01／V02・V03 | route.test.ts・10件追加 | 成功。不正IDは400、code/message完全一致、usecase未実行 |
| AF-R02／E01・E02・R08 | route.test.ts・1件追加 | 成功。ITEM_DRAFT_NOT_FOUNDは共通handlerから404とcode/messageを返す |
| AF-R03／E04〜E06・R08 | route.test.ts・1件追加 | 成功。通常Errorは500と既存error/messageのみを返し、内部詳細を含まない |
| AF-R04／C02・R02 | route.test.ts・1件追加 | 成功。正常201と `{ itemEditingId: 456 }`、認証所有者・検証済みIDの引渡しを維持 |
| AF-DB01／P01〜P08・ST06 | databaseConcurrency.test.ts・既存11件 | 成功。commit/rollback後も別下書き・既存編集・Item・参照先・所有者の全列が事前snapshotと一致 |
| AF-DB02／P09・ST06 | databaseConcurrency.test.ts・既存1件 | 成功。操作対象のB下書きだけを保護対象から除き、残る非対象行の全列一致を確認 |
| AF-DB03／P01 | databaseConcurrency.test.ts・既存2件 | 成功。A先行はA成功/B404、B先行はB成功/A404。要求別trace、独立transaction、実ロック待機、編集1行を確認 |
| AF-S01／E08 | services.test.ts・1件追加 | 成功。11件の同じ配列・data・transactionをモデルcreateへ渡し、設定したValidationErrorを同じ参照で伝播 |
| AF-R05／R08・ST03 | route.test.ts・既存2件、database.test.ts・既存3件 | 成功。観測handlerの4引数、例外参照、HTTP拒否時のDB不変を維持。追加lintもエラー0 |

初回のRV01〜RV04は上表で補完できた。E08はS/Dの双方を確認済み、P01〜P09は競合と非対象行不変を確認済みとなる。PR01は実共通handler経由の400・404・500と正常201を確認済みとなる。

### 6.3 実処理・モック・並行処理・DB後片付け

Router検証は実Router・controller・認証・validator・レート制限・共通handlerを使用し、usecaseをモックした最小アプリで行った。アプリ全体は起動していない。AF-S01は実serviceとモデルcreateのモックによる境界検証であり、件数拒否そのものは既存E08の実モデルvalidationで確認した。これをDB制約による拒否とは扱わない。

DB読込元は `server/.env.test`。アプリ・モデル初期化・observer・competitorの全4接続について、接続前の設定DB名と接続後の `SELECT current_database()` が `test_db` であることを既存ガードで確認した。別env読込み、接続設定差替え、DB名不一致は発生していない。既存の列・nullable・型・ENUM・FK検査、および並行処理のREAD COMMITTED検査も通過した。

実DBでは対象usecase・service・モデルを使用した。HTTP結合で読み込まれる対象外usecaseは引き続きモックし、外部通信を実行していない。rollback検証の障害注入、gateによる取得待機制御、文字数超過の実SQL拒否、画像超過の実モデル拒否の責務は従来どおり維持した。

P01は同一入力のA/Bを非同期コンテキストで識別し、先行取得・後続ロック待機を確認後に先行を解放した。先行commit後に後続の取得結果がnullとなり、後続解放後に404で完了すること、作成・削除が先行transactionだけで行われることを確認した。A→B/B→Aの両展開で、指定した要求名と開始・取得・完了結果が一致した。

P02〜P08はINSERT後rollback、更新・削除・所有者変更のcommit/rollback、usecase先行時の後続再評価を検証した。P09はAがロックを保持したままBをcommitし、その後Aをcommitして、対象2行の移行と値の混在がないことを確認した。ロック待機は `pg_blocking_pids()` で確認し、保存結果と非対象行はobserverの新規SELECTで比較した。

全DBケースで、保留Promise・transactionの回収、作成IDだけを対象にした後片付け、残存0件のassertが成功した。接続終了・hook解除もエラーなし。migration・sync・truncateは実行せず、シーケンスを戻していない。

### 6.4 実行履歴と静的検査

実行ディレクトリは `server/`。`--maxWorkers=1` はファイル間のfixture・hook・ストアの干渉を抑えるためであり、ケース内の並行処理は独立transactionで別途実行している。

```bash
npm run test:run -- test/usecases/itemEditing/createItemEditingDraft/ --maxWorkers=1 --reporter=default --reporter=json --outputFile.json=/tmp/createItemEditingDraft-afterFix-results.json
# 通信を許可して同じ接続ガードで再実行
npm run test:run -- test/usecases/itemEditing/createItemEditingDraft/ --maxWorkers=1 --reporter=default --reporter=json --outputFile.json=/tmp/createItemEditingDraft-afterFix-results-escalated.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

初回はサンドボックスがDB接続とSupertestのHTTP待受けをEPERMで拒否した。103件成功・40件失敗・77件skip・未処理例外40件。DB3suiteの77件は接続時のsetup失敗による本体未実行で、fixture書込み前に停止した。これは対象ロジックの失敗と区別する。通信を許可して設定・ガード・期待値を変更せず再実行した結果が、上記220件成功である。

| 検査 | 結果と対象 |
| --- | --- |
| 対象Vitest | 成功。8ファイル・220件、失敗/skip/todo/未処理例外0 |
| npm run lint | 成功。現行設定のrecommendedルールはsrcのTSを対象とし、テストTSの検証は下記で別に実施 |
| npm run typecheck | 成功。本番コードの型検査 |
| test/tsconfig.jsonの全体型検査 | 失敗。shopSignup/signup1.test.ts:33、signup5.test.ts:27の既知TS2307のみ |
| 対象11ファイルの型検査 | 成功。同test/tsconfigのオプションと対象TSのrootNamesで診断0件 |
| 対象11ファイルの追加lint | 成功。recommendedルールを明示的に適用し、エラー0・警告0 |

対象TSへの追加検査は、次のNode APIによる方法で実施した。共有設定を編集せず、DBやテスト本体も起動しない。

```bash
node --input-type=module <<'JS'
import { ESLint } from 'eslint';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import ts from 'typescript';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const target = 'test/usecases/itemEditing/createItemEditingDraft';
const files = readdirSync(target).filter(name => name.endsWith('.ts')).map(name => `${target}/${name}`);
const runner = new ESLint({ overrideConfigFile: true, overrideConfig: tseslint.config({ files: [`${target}/**/*.ts`], extends: [eslint.configs.recommended, ...tseslint.configs.recommended], rules: { '@typescript-eslint/no-explicit-any': 'off' } }) });
const results = await runner.lintFiles(files);
console.log('Additional lint:', files.length, 'files');
console.log(await (await runner.loadFormatter('stylish')).format(results));
console.log(JSON.stringify({errors: results.reduce((n,r) => n+r.errorCount,0), warnings: results.reduce((n,r)=>n+r.warningCount,0)}));
const config = ts.readConfigFile('test/tsconfig.json', ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve('test'));
const program = ts.createProgram(files.map(file => resolve(file)), parsed.options);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
console.log('Target typecheck:', files.length, 'root files,', diagnostics.length, 'diagnostics');
if (diagnostics.length) console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, {getCanonicalFileName: f=>f, getCurrentDirectory:()=>process.cwd(), getNewLine:()=> '\n'}));
process.exitCode = diagnostics.length || results.some(r=>r.errorCount) ? 1 : 0;
JS
```

### 6.5 完了範囲と未確認事項

F1〜F4およびAF-R01〜05・AF-DB01〜03・AF-S01の必須確認は完了した。今回の検証範囲で本番ロジックと期待契約の不一致、修正したテストのロジック誤りは検出していない。

入力ID上限の決定、実commit障害、対象外機能のimport修復は引き続き対象外。カバレッジは取得していない。対象外の既知型エラーが残るため、リポジトリ全体の検査完了を意味しない。

## 7. 追加修正レポート後の再修正案の判断

対象テストは通信許可後に全件成功し、対象の追加lint・型検査も成功したため、今回の対象コードへの再修正案は追加しない。初回EPERMは実行環境の制限であり、skip化・期待値変更・接続ガード緩和の根拠にはしない。

全体型検査に残る2件は初回レポートで記録済みの対象外importエラーである。今回の変更によるエラーとして扱わず、対象外コードやTodoの編集、修正範囲の拡大は行っていない。
