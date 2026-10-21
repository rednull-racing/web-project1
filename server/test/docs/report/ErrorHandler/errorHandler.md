# ErrorHandler / ErrorHandler 実装・テストレポート

## 1. 結果（2026-10-19）

ユーザー指示による共有APIの入力エラー方針変更を、deleteItemDraftから独立した大分類・小分類 `ErrorHandler` / `ErrorHandler` として実装した。

**独立単体35件・独立HTTP結合20件、計55件が成功。deleteItemDraftの209件と既存作成API24件も成功し、最終実行は15ファイル288件、失敗・skip・todo・未処理例外0件。** lint・本番/テスト型検査・通常lint対象外の3ファイルへの追加lintもすべて成功した。

共有errorHandlerのJSON解析エラーだけを安全な400 JSONへ変更した。通常DB例外・通常Errorの500と、AppErrorの既存公開規約は維持した。任意Errorのstatus/statusCodeを採用する処理は追加していない。

設計は [独立テスト設計書](../../architecture/ErrorHandler/errorHandler.md)、起点の旧観測と完了連絡は [deleteItemDraftレポート](../itemDraft/deleteItemDraft.md) を参照。独立レポートの本体は本ファイルに集約する。

## 2. 確定した契約・変更内容

変更した本番コードは `server/src/middleware/errorHandler.ts` のみ。

JSON解析エラーの400分岐は、次のすべてを満たす場合に限定する。

1. `err instanceof SyntaxError`
2. `err.type === "entity.parse.failed"`
3. `err.status === 400`（数値）

これはインストール済みbody-parser/http-errorsの実装と実parserの出力を確認して定めた。解析messageの文面や入力本文に依存しない。構造的な判定なので、サーバー内部で同じSyntaxErrorとメタデータを生成した場合の出所まで証明するものではない。

| 分類               | 公開応答                                                                      | 維持・変更した点                          |
| ------------------ | ----------------------------------------------------------------------------- | ----------------------------------------- |
| 上記JSON解析エラー | 400、`{code:"INVALID_JSON",message:"JSONの形式を確認してください。"}`         | 新契約。message/stack/bodyを公開しない    |
| AppError           | 既存statusCode、`{code,message:publicMessage ?? code}`                        | 既存契約維持。publicMessageの空文字も保持 |
| 通常DB例外・その他 | 500、`{error:"INTERNAL_SERVER_ERROR",message:"サーバーエラーが発生しました"}` | 既存契約維持。任意status/statusCodeは無視 |

JSON解析エラーのオブジェクトは入力本文を持つため、400分岐を既存 `console.error(err)` より前に置き、生の入力・解析エラーをログへ渡さない。その他の既存ログ処理は変更していない。

parserが認証より前に動く順序は維持した。正常/なし/不正JWTに不正JSONを組み合わせた場合はすべて400となる。正常なJSONの未認証要求が401となる既存テストも維持した。

サイズ超過・未対応charsetはJSON解析エラーと区別し、今回の変更対象には含めていない。新しい413/415応答方針を暗黙に追加せず、従来の500を維持している。

## 3. ファイル・実処理・モック

パスは `server/` 基準。大分類・小分類はともに `ErrorHandler`。文書のファイル名はユーザー指定の `errorHandler.md` と既存文書配置規則に合わせた。

| 種類          | ファイル                                                                   | 責務                                                                |
| ------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 本番          | `src/middleware/errorHandler.ts`                                           | 共有のJSON解析エラー識別と固定400応答                               |
| 独立単体      | `src/middleware/test/ErrorHandler/ErrorHandler/errorHandler.test.ts`       | 実handlerを呼ぶ。部分Request/Response/nextとconsoleをテスト用にする |
| 独立HTTP結合  | `test/integration/usecases/ErrorHandler/ErrorHandler/errorHandler.test.ts` | 実Express JSON parser・実handlerを接続。後続handlerの到達をspy      |
| 独立fixture   | `test/fixtures/ErrorHandler/ErrorHandler/fixtures.ts`                      | 解析エラー・DB例外のfactory、固定期待JSON、入力例                   |
| 独立設計      | `test/docs/architecture/ErrorHandler/errorHandler.md`                      | 新契約・判定条件・15ケースID・実行方法                              |
| API回帰       | `test/integration/usecases/itemDraft/deleteItemDraft/route.test.ts`        | O03を新契約AF-JSON01へ更新しJWT不正ケースを追加                     |
| API設計・報告 | `test/docs/{architecture,report}/itemDraft/deleteItemDraft.md`             | 新しい400契約と完了を明記し、旧500観測を報告履歴として保持          |

独立テストはDB・AWS・実JWT認証・アプリ全体のcronをimportしない。SequelizeのDatabaseErrorは例外オブジェクトの作成にのみ使用し、独立テストからDB接続は作っていない。DB例外のテストはDB接続障害そのものの再現ではなく、公開整形の検証である。

HTTP結合はparserをモックせず、実際に壊れたJSONを送った。単体のメタデータfixtureだけでbody-parserとの接続を確認済みにしていない。

## 4. 最終件数とケースID対応

最終Vitest JSONの `assertionResults` から集計した。設計ID数とit.each展開後件数は分け、複数回の実行を重複加算していない。

| 分類・ファイル                                                |    成功 | 失敗/skip/todo |
| ------------------------------------------------------------- | ------: | -------------- |
| 独立単体 `ErrorHandler/ErrorHandler/errorHandler.test.ts`     |      35 | 0/0/0          |
| 独立HTTP結合 `ErrorHandler/ErrorHandler/errorHandler.test.ts` |      20 | 0/0/0          |
| **独立機能合計**                                              |  **55** | **0/0/0**      |
| deleteItemDraft単体5ファイル                                  |      97 | 0/0/0          |
| deleteItemDraft HTTP                                          |      57 | 0/0/0          |
| 共有ID Router回帰                                             |       6 | 0/0/0          |
| deleteItemDraft DB保存                                        |      16 | 0/0/0          |
| deleteItemDraft HTTP＋実DB                                    |       9 | 0/0/0          |
| deleteItemDraft transaction                                   |      10 | 0/0/0          |
| deleteItemDraft並行処理                                       |      14 | 0/0/0          |
| **deleteItemDraft回帰合計**                                   | **209** | **0/0/0**      |
| 作成API controller単体                                        |       5 | 0/0/0          |
| 作成API HTTP                                                  |      19 | 0/0/0          |
| **全体：15ファイル**                                          | **288** | **0/0/0**      |

deleteItemDraftは旧208件のO03を500から400へ更新し、JWT不正を1件追加したため209件になった。既存の通常Error500（R06）・DB失敗500（H04）・認証401・レート制限429の期待値は変更していない。

| 設計ID    | 実施レベル・結果                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------- |
| U01       | 単体成功：3条件を満たす解析エラーは400。入力本文・解析情報のレスポンス露出と生ログ出力なし         |
| U02       | 単体成功：DB例外・通常Errorは500、固定JSONのみ                                                     |
| U03       | 単体成功：AppError400/404/429とpublicMessageあり/なし/空文字の既存契約                             |
| U04       | 単体成功：status/statusCode単独の400/401/403/404/413/415/422を採用しない                           |
| U05       | 単体成功：type欠落/別type、status欠落/文字列/別値、statusCodeだけ、通常SyntaxErrorは500            |
| U06       | 単体成功：普通のError/objectにtype・statusがあっても500                                            |
| U07       | 単体成功：null/undefined/文字列/数値/objectでも固定500。Expressがすべてをerror扱いする保証ではない |
| H01       | HTTP成功：実parserへ壊れたobject/array/JSON外文字列を送ると400、後続handlerなし                    |
| H02       | HTTP成功：strict parserが拒否するJSONプリミティブも同じ解析エラーとして400                         |
| H03       | HTTP成功：正常object/array/空body/非JSON Content-Typeは正常経路を維持                              |
| H04       | HTTP成功：DB例外・通常Error・任意statusつきError・無関係SyntaxErrorは500、内部情報非公開           |
| H05       | HTTP成功：AppErrorの既存公開JSONを維持                                                             |
| H06       | HTTP成功：実parserのサイズ超過/未対応charsetをJSON構文エラーへ誤分類しない                         |
| AF-JSON01 | API回帰成功：O03の正常/なし/不正JWT＋不正JSONは400/INVALID_JSON。作成・削除usecase0回              |
| AF-JSON02 | 独立U02/H04とAPI R06/H04成功：通常Error・DB例外500、内部情報非公開を維持                           |

## 5. 実行・検査・DB回帰の範囲

実行ディレクトリは `server/`。

```bash
npm run test:run -- src/middleware/test/ErrorHandler/ErrorHandler/ test/integration/usecases/ErrorHandler/ErrorHandler/ src/validators/params/test/id.test.ts src/middleware/validate/test/deleteItemDraft.test.ts src/controllers/itemDraft/test/ src/usecases/itemDraft/test/deleteItemDraft.test.ts src/services/itemDraft/test/deleteItemDraft.test.ts test/integration/usecases/itemDraft/createItemDraft/route.test.ts test/integration/usecases/itemDraft/deleteItemDraft/ test/integration/database/itemDraft/deleteItemDraft/ --maxWorkers=1 --reporter=json --outputFile=/tmp/error-handler-final.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

すべて終了コード0。テストはHTTP待受と実DBへの接続制限があるため、権限付きで実行した。独立テストにDB設定を持ち込む方法や、DB接続ガードを緩める方法は使っていない。`--maxWorkers=1` はファイル間干渉を抑える指定で、既存並行処理ケースの独立transactionは維持した。

DB非接続239件、実DB49件。実DB回帰は前回と同じ.env.test由来のPostgreSQL test_db限定ガードを使用した。アプリ・models・observer・competitorの全接続で接続前の設定DB名/接続後current_databaseを検査し、実commit/rollback・ロック待機・非対象行不変・作成ID限定cleanup・残存0件・closeの既存assertが成功した。DB作成・sync・migration・TRUNCATE・シーケンス巻戻しは実施していない。接続情報やenv内容は出力していない。

通常lint対象外の独立fixture・結合テストと変更したAPI HTTPテストは、既存ESLint APIとtypescript-eslintで次の追加検査を行った。3ファイル、error/warning0。共有設定は変更していない。

```bash
node --input-type=module <<'JS'
import { ESLint } from 'eslint';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
const runner = new ESLint({ overrideConfig: tseslint.config({ files: ['test/**/*.ts'], extends: [eslint.configs.recommended, ...tseslint.configs.recommended] }) });
const results = await runner.lintFiles(['test/fixtures/ErrorHandler/ErrorHandler/**/*.ts','test/integration/usecases/ErrorHandler/ErrorHandler/**/*.ts','test/integration/usecases/itemDraft/deleteItemDraft/route.test.ts']);
process.stdout.write((await runner.loadFormatter('stylish')).format(results));
const errors = results.reduce((sum,r)=>sum+r.errorCount,0), warnings = results.reduce((sum,r)=>sum+r.warningCount,0);
console.info(`Additional lint: ${results.length} files, ${errors} errors, ${warnings} warnings`);
process.exitCode = errors ? 1 : 0;
JS
```

実装後のテスト失敗はなく、初回の独立単体35件と独立HTTP20件も成功した。旧500期待値を400へ更新した理由は今回のユーザー指定による契約変更であり、テストを通すためのassert緩和ではない。テスト件数やカバレッジ率だけで完了を判断せず、判定条件・誤判定防止・実parser接続・API回帰で確認した。

## 6. 完了範囲・残る事項

共有JSON入力エラーの実装修正、独立設計/テスト/レポート、deleteItemDraftでの解消確認と完了連絡まで完了。F2の判断用Todoも完了を記録した。

実アプリ全体の起動・cron・NGINX・全共有API・ログ基盤の全面監査は対象外。サイズ超過やcharsetエラーを独立した4xxとして公開する追加仕様は今回決めていない。実COMMIT通信障害・実回線切断・実S3残存など、deleteItemDraft側の既存未確認範囲はそのまま残る。
