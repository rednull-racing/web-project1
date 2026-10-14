# 下書きから商品編集セッション作成：修正案

## 1. 対象と判断

[testReport.md](./testReport.md) のレビュー・実行結果に基づく提案。対象 206 件は成功したが、本番共通エラー処理、設計に対する検証不足、追加 lint に修正が必要である。**本書は修正案のみで、本番コード・テストの修正や修正後の再実行は行っていない。**

パスは `server/` 基準。下書きコピー・取得 where・行ロック・同一 transaction・削除の業務処理は維持する。入力 ID 上限の決定、他機能の import エラー、スキーマ変更は対象外。

## 2. 本番コードの修正案

### F1（P0）：共通 errorHandler を 4 引数で登録する

根拠は PR01・R08。現行 handler が 3 引数なので、Express 4 はエラー処理時にスキップする。Router テストは別の 4 引数 handler を使うため、この問題を検出できなかった。

対象は `src/middleware/errorHandler.ts`。`ErrorRequestHandler` 型で `(err, req, res, next)` の 4 引数を明示し、既存の AppError と通常 Error の JSON 形式・status を保持する。利用しない引数も lint に適合する形で明示的に扱い、引数の削除・デフォルト引数化・rest 引数化で関数 length を減らさない。

修正後は、本 Router が渡す INVALID_BODY/400・ITEM_DRAFT_NOT_FOUND/404 と、通常 Error/500 が共通 handler から返る。201 応答、認証 middleware 自身の 401、レート middleware 自身の 429、DB の原子性は変更しない。

対象 usecase/service/model に、本テスト結果を理由とした追加修正は提案しない。

## 3. テストコードの修正案

### F2（P1）：実共通 handler の接続テストを追加する

対象は `test/usecases/itemEditing/createItemEditingDraft/route.test.ts`。既存 R08 の観測 handler テストは維持し、実 Router ＋実共通 errorHandler の最小アプリを別に組む。usecase だけをモックして AppError/通常 Error を返し、status に加えて既存 JSON 形式を完全一致で確認する。DB や app 全体の起動は不要。

修正前は共通 handler の登録 Layer がエラーを処理せず次へ渡る。修正後はエラー JSON を返し、正常 201 には影響しないことを確認する。

### F3（P1）：非対象行・要求識別・service 境界を補う

根拠は RV01〜RV03。対象は同ディレクトリの `databaseConcurrency.test.ts`、`databaseFixtures.ts`、`services.test.ts`。

- P01〜P08 で別下書き・既存編集・Item・参照先の事前 snapshot を取り、並行処理後に全列一致を確認する。P09 では B の下書きが操作対象になるため、それを保護対象から除き、残る非対象行を比較する。
- P01 は A/B ごとの開始・取得・transaction・完了結果を記録する。A 先行/B 先行それぞれで、指定した要求が成功し他方が 404 になることを assert する。入力は同一のまま、ラベルの入替えだけで逆順確認済みとしない。
- E08 の S ケースでは画像 11 件の配列を service へ渡し、モデル create への同じ data/t の引渡しと、モデル側の ValidationError の同一参照での伝播を確認する。拒否そのものの保証は既存 D テストに置く。

### F4（P1）：4 引数を維持して追加 lint を通す

根拠は RV04。対象は `route.test.ts:31` と `database.test.ts:90` の観測用 handler。`_next` を削除せず、例えば `void _next;` で未使用が意図的であることを示す。テストに必要な 4 引数の関数 length と既存観測結果を維持し、共有 ESLint 設定は変更しない。

## 4. 追加・移行するケース

| 追加 ID | 元 ID・根拠         | レベル | 入力・手順                                                | 修正後の期待結果                                                         |
| ------- | ------------------- | ------ | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| AF-R01  | V02/V03・PR01       | R      | 正常認証＋不正 ID、実共通 handler を接続                  | 400、`{ code: "INVALID_BODY", message: "INVALID_BODY" }`、usecase 未実行 |
| AF-R02  | E01/E02/R08・PR01   | R      | usecase が ITEM_DRAFT_NOT_FOUND/404 を返す                | 共通 handler から 404 と code/message の JSON、201 なし                  |
| AF-R03  | E04〜E06/R08・PR01  | R      | usecase が通常 Error を返す                               | 500、既存の error/message の JSON。内部 Error の詳細なし                 |
| AF-R04  | C02/R02             | R      | F1 後に正常要求                                           | 201・`{ itemEditingId }` を維持                                          |
| AF-DB01 | P01〜P08/ST06・RV01 | D      | 既存の各競合を実行し非対象 snapshot も比較                | commit/rollback 後も非対象行全列不変                                     |
| AF-DB02 | P09/ST06・RV01      | D      | 別所有者・別下書きの成功を交差                            | 対象 2 行は移行、対象外下書き・既存編集・参照先は不変                    |
| AF-DB03 | P01・RV02           | D      | A 先行/B 先行を要求別 trace で独立展開                    | 指定した先行要求だけ成功、後続 404、編集 1 行、実ロック待機あり          |
| AF-S01  | E08・RV03           | S      | モデル create に ValidationError を設定し画像 11 件を渡す | 同じ配列/data/t を引き渡し、同じ例外を伝播。DB 拒否は既存 E08 で別確認   |
| AF-R05  | R08/ST03・RV04      | R/D    | 未使用引数を明示した 4 引数 handler で既存要求を再実行    | 既存結果と関数 length=4 を維持し、追加 lint エラー 0                     |

既存 206 件は原則維持する。P01 は手順と assert を補強し、P01〜P09 は非対象行 assert を追加する。E08 の D 検証・R08 の観測用 handler の期待値は変更しない。初回の通信制限を理由に skip 化や期待値変更を行わない。

## 5. 修正後の確認と完了条件

F1/F2 → F3/F4 の順に実施する。対象 Vitest、npm run lint、npm run typecheck、テスト TS の型検査と追加 lint を再実行する。DB 検査は引き続き `.env.test`・test_db の全接続ガードを通し、別接続の結果と後片付けを確認する。

完了条件は、共通 handler の 400/404/500 と正常 201、要求別の競合結果、並行後の非対象行不変、E08 の S/D 責務、追加 lint 成功が確認できること。ケース ID・追加テスト・実行件数の対応を報告し、対象外の既知 import エラーを全体成功へ混ぜない。未確定の ID 上限と実 commit 障害の検証は引き続き保留／対象外とする。

## 6. 追加修正レポート（2026-10-13）

### 6.1 結果と今回の範囲

修正済みの対象 8 テストファイルを実行し、通信を許可した最終実行で**220 件すべて成功**した。失敗・skip・todo・未処理例外は 0 件。DB 非接続 143 件、実 DB77 件である。対象 11 個の TypeScript ファイルの型検査と追加 lint も成功した。テスト全体の型検査は、対象外の既知 import エラー 2 件により失敗しており、全体成功とは扱わない。

1〜5 節は修正前の提案として保存する。本節が F1〜F4 の修正後の検証結果であり、[testReport.md](./testReport.md) の初回判定を更新する。今回の編集は本ファイルへの追記のみ。本番コード・テストコード・共有設定の追加修正は行っていない。

検証した修正済みコードは以下のとおり。

- F1：`src/middleware/errorHandler.ts` に実装済みの `ErrorRequestHandler` 型と 4 引数を、実 Router の HTTP 経路で検証した。
- F2：`route.test.ts` の別 Express アプリに実共通 handler を接続し、400・404・500 の JSON 完全一致と正常 201 を確認した。既存 R08 の観測 handler テストも維持した。
- F3：`databaseConcurrency.test.ts` と `databaseFixtures.ts` で P01〜P09 の非対象行比較を追加した。P01 は AsyncLocalStorage で要求名を保持し、開始・取得・transaction・完了結果を要求別に確認した。`services.test.ts` には画像 11 件の同一参照での引渡しと ValidationError 伝播を追加した。
- F4：`route.test.ts` と `database.test.ts` の観測 handler で未使用引数を `void` で扱い、`length === 4` を確認した。共有 ESLint 設定は変更していない。

### 6.2 ファイル別件数と追加・移行ケース

件数は `/tmp/createItemEditingDraft-afterFix-results-escalated.json` の Vitest JSON 結果から集計した。各ファイルの失敗・skip・todo はすべて 0 件。

| ファイル                     | 初回件数 | 今回成功 | 変更内容                                                              |
| ---------------------------- | -------: | -------: | --------------------------------------------------------------------- |
| usecase.test.ts              |       55 |       55 | 既存回帰を維持                                                        |
| services.test.ts             |       10 |       11 | AF-S01 を 1 件追加                                                    |
| validation.test.ts           |       33 |       33 | 既存回帰を維持                                                        |
| controller.test.ts           |        4 |        4 | 既存回帰を維持                                                        |
| route.test.ts                |       27 |       40 | AF-R01 を 10 条件、AF-R02〜04 を各 1 件追加。R08 に AF-R05 を対応付け |
| database.test.ts             |       54 |       54 | ST03 の 3 条件に AF-R05 を対応付け                                    |
| databaseTransactions.test.ts |       11 |       11 | E08 の実モデル拒否・rollback を含む既存回帰を維持                     |
| databaseConcurrency.test.ts  |       12 |       12 | P01〜P09 の既存 12 件を補強                                           |
| **合計**                     |  **206** |  **220** | **既存 206 件を維持し、14 件追加**                                    |

追加 ID はテストの観点を表す。既存ケースに複数 ID を付けた箇所は件数を重複計上しない。

| 追加 ID／元 ID          | 対応ファイル・展開件数                                | 判定と確認内容                                                                                                  |
| ----------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| AF-R01／V02・V03        | route.test.ts・10 件追加                              | 成功。不正 ID は 400、code/message 完全一致、usecase 未実行                                                     |
| AF-R02／E01・E02・R08   | route.test.ts・1 件追加                               | 成功。ITEM_DRAFT_NOT_FOUND は共通 handler から 404 と code/message を返す                                       |
| AF-R03／E04〜E06・R08   | route.test.ts・1 件追加                               | 成功。通常 Error は 500 と既存 error/message のみを返し、内部詳細を含まない                                     |
| AF-R04／C02・R02        | route.test.ts・1 件追加                               | 成功。正常 201 と `{ itemEditingId: 456 }`、認証所有者・検証済み ID の引渡しを維持                              |
| AF-DB01／P01〜P08・ST06 | databaseConcurrency.test.ts・既存 11 件               | 成功。commit/rollback 後も別下書き・既存編集・Item・参照先・所有者の全列が事前 snapshot と一致                  |
| AF-DB02／P09・ST06      | databaseConcurrency.test.ts・既存 1 件                | 成功。操作対象の B 下書きだけを保護対象から除き、残る非対象行の全列一致を確認                                   |
| AF-DB03／P01            | databaseConcurrency.test.ts・既存 2 件                | 成功。A 先行は A 成功/B404、B 先行は B 成功/A404。要求別 trace、独立 transaction、実ロック待機、編集 1 行を確認 |
| AF-S01／E08             | services.test.ts・1 件追加                            | 成功。11 件の同じ配列・data・transaction をモデル create へ渡し、設定した ValidationError を同じ参照で伝播      |
| AF-R05／R08・ST03       | route.test.ts・既存 2 件、database.test.ts・既存 3 件 | 成功。観測 handler の 4 引数、例外参照、HTTP 拒否時の DB 不変を維持。追加 lint もエラー 0                       |

初回の RV01〜RV04 は上表で補完できた。E08 は S/D の双方を確認済み、P01〜P09 は競合と非対象行不変を確認済みとなる。PR01 は実共通 handler 経由の 400・404・500 と正常 201 を確認済みとなる。

### 6.3 実処理・モック・並行処理・DB 後片付け

Router 検証は実 Router・controller・認証・validator・レート制限・共通 handler を使用し、usecase をモックした最小アプリで行った。アプリ全体は起動していない。AF-S01 は実 service とモデル create のモックによる境界検証であり、件数拒否そのものは既存 E08 の実モデル validation で確認した。これを DB 制約による拒否とは扱わない。

DB 読込元は `server/.env.test`。アプリ・モデル初期化・observer・competitor の全 4 接続について、接続前の設定 DB 名と接続後の `SELECT current_database()` が `test_db` であることを既存ガードで確認した。別 env 読込み、接続設定差替え、DB 名不一致は発生していない。既存の列・nullable・型・ENUM・FK 検査、および並行処理の READ COMMITTED 検査も通過した。

実 DB では対象 usecase・service・モデルを使用した。HTTP 結合で読み込まれる対象外 usecase は引き続きモックし、外部通信を実行していない。rollback 検証の障害注入、gate による取得待機制御、文字数超過の実 SQL 拒否、画像超過の実モデル拒否の責務は従来どおり維持した。

P01 は同一入力の A/B を非同期コンテキストで識別し、先行取得・後続ロック待機を確認後に先行を解放した。先行 commit 後に後続の取得結果が null となり、後続解放後に 404 で完了すること、作成・削除が先行 transaction だけで行われることを確認した。A→B/B→A の両展開で、指定した要求名と開始・取得・完了結果が一致した。

P02〜P08 は INSERT 後 rollback、更新・削除・所有者変更の commit/rollback、usecase 先行時の後続再評価を検証した。P09 は A がロックを保持したまま B を commit し、その後 A を commit して、対象 2 行の移行と値の混在がないことを確認した。ロック待機は `pg_blocking_pids()` で確認し、保存結果と非対象行は observer の新規 SELECT で比較した。

全 DB ケースで、保留 Promise・transaction の回収、作成 ID だけを対象にした後片付け、残存 0 件の assert が成功した。接続終了・hook 解除もエラーなし。migration・sync・truncate は実行せず、シーケンスを戻していない。

### 6.4 実行履歴と静的検査

実行ディレクトリは `server/`。`--maxWorkers=1` はファイル間の fixture・hook・ストアの干渉を抑えるためであり、ケース内の並行処理は独立 transaction で別途実行している。

```bash
npm run test:run -- test/usecases/itemEditing/createItemEditingDraft/ --maxWorkers=1 --reporter=default --reporter=json --outputFile.json=/tmp/createItemEditingDraft-afterFix-results.json
# 通信を許可して同じ接続ガードで再実行
npm run test:run -- test/usecases/itemEditing/createItemEditingDraft/ --maxWorkers=1 --reporter=default --reporter=json --outputFile.json=/tmp/createItemEditingDraft-afterFix-results-escalated.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

初回はサンドボックスが DB 接続と Supertest の HTTP 待受けを EPERM で拒否した。103 件成功・40 件失敗・77 件 skip・未処理例外 40 件。DB3suite の 77 件は接続時の setup 失敗による本体未実行で、fixture 書込み前に停止した。これは対象ロジックの失敗と区別する。通信を許可して設定・ガード・期待値を変更せず再実行した結果が、上記 220 件成功である。

| 検査                            | 結果と対象                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| 対象 Vitest                     | 成功。8 ファイル・220 件、失敗/skip/todo/未処理例外 0                                        |
| npm run lint                    | 成功。現行設定の recommended ルールは src の TS を対象とし、テスト TS の検証は下記で別に実施 |
| npm run typecheck               | 成功。本番コードの型検査                                                                     |
| test/tsconfig.json の全体型検査 | 失敗。shopSignup/signup1.test.ts:33、signup5.test.ts:27 の既知 TS2307 のみ                   |
| 対象 11 ファイルの型検査        | 成功。同 test/tsconfig のオプションと対象 TS の rootNames で診断 0 件                        |
| 対象 11 ファイルの追加 lint     | 成功。recommended ルールを明示的に適用し、エラー 0・警告 0                                   |

対象 TS への追加検査は、次の Node API による方法で実施した。共有設定を編集せず、DB やテスト本体も起動しない。

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

F1〜F4 および AF-R01〜05・AF-DB01〜03・AF-S01 の必須確認は完了した。今回の検証範囲で本番ロジックと期待契約の不一致、修正したテストのロジック誤りは検出していない。

入力 ID 上限の決定、実 commit 障害、対象外機能の import 修復は引き続き対象外。カバレッジは取得していない。対象外の既知型エラーが残るため、リポジトリ全体の検査完了を意味しない。

## 7. 追加修正レポート後の再修正案の判断

対象テストは通信許可後に全件成功し、対象の追加 lint・型検査も成功したため、今回の対象コードへの再修正案は追加しない。初回 EPERM は実行環境の制限であり、skip 化・期待値変更・接続ガード緩和の根拠にはしない。

全体型検査に残る 2 件は初回レポートで記録済みの対象外 import エラーである。今回の変更によるエラーとして扱わず、対象外コードや Todo の編集、修正範囲の拡大は行っていない。
