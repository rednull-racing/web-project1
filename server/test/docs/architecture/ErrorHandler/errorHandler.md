# ErrorHandler / ErrorHandler テスト設計

## 1. 目的・仕様の根拠

2026-10-19のユーザー指示に基づき、共有APIのJSON入力エラー方針を次のように確定する。deleteItemDraft固有処理ではなく、大分類・小分類をともに `ErrorHandler` とする独立機能として検証する。

- body-parserがJSON解析失敗として通知するSyntaxErrorだけを400へ変換する。
- 公開応答は `{code:"INVALID_JSON",message:"JSONの形式を確認してください。"}`。解析message/stack/body等を返さない。
- 任意Errorのstatus/statusCodeを採用しない。通常DB例外・通常Error・無関係なSyntaxErrorは従来の安全な500 JSONを維持する。
- AppErrorの既存HTTP status/code/publicMessage規約は維持する。
- parserは認証より前にある。不正JSONの400は認証状態より先に決まり、正常JSONの未認証401は維持する。
- JSON解析エラーの元オブジェクトにはbodyが含まれるため、400分岐では既存の生Errorログへ渡さない。その他の既存ログ処理は変更しない。

本設計書のパス表は `server/` 基準。ドキュメントは既存配置規則と指定ファイル名に合わせ `ErrorHandler/errorHandler.md`、結合・fixtureは `ErrorHandler/ErrorHandler/` に置く。

## 2. 対象・調査した実装

| 対象                                                                 | 責務・確認内容                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/middleware/errorHandler.ts`                                     | 今回の本番変更箇所。共通エラーの識別・公開応答                                       |
| `src/errors.ts`                                                      | AppErrorのstatusCode/code/publicMessage。変更なし                                    |
| `src/app.ts`                                                         | express.json→認証付きRouter→errorHandler。cronを起動するためテストで直接importしない |
| ローカル `node_modules/body-parser/lib/types/json.js`、`lib/read.js` | 実JSON解析のSyntaxErrorに `type:entity.parse.failed` と400を付ける経路               |
| ローカル `node_modules/http-errors/index.js`                         | 元のErrorを維持しstatus/statusCode等を付ける処理                                     |
| `test/integration/usecases/itemDraft/deleteItemDraft/route.test.ts`  | 旧O03を新契約へ更新し、実JWT3状態でAPI側の解消を確認                                 |
| `test/docs/report/itemDraft/deleteItemDraft.md` のF2                 | 修正前観測。履歴を保持し、完了と独立レポートへの参照を追記                           |

識別条件は `err instanceof SyntaxError`、`err.type === "entity.parse.failed"`、`err.status === 400` のすべて。messageの文面、bodyの内容、status単独は根拠にしない。構造的な識別であり、同一メタデータを自分で生成するサーバー内部コードの由来まで証明するものではない。

## 3. 配置・実処理・モック

| レベル    | ファイル                                                                   | 実処理 / モック境界                                                                                |
| --------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 単体U     | `src/middleware/test/ErrorHandler/ErrorHandler/errorHandler.test.ts`       | 実errorHandler、型付きfixture。Request/Response/nextとconsoleだけをテスト用にする                  |
| HTTP結合H | `test/integration/usecases/ErrorHandler/ErrorHandler/errorHandler.test.ts` | 実Express JSON parser＋実errorHandler。通常経路のhandlerをspy。DB・認証サービス・AWSをimportしない |
| fixture   | `test/fixtures/ErrorHandler/ErrorHandler/fixtures.ts`                      | エラーfactory、固定の公開期待値。実装の判定をfixtureで再実装しない                                 |
| API回帰   | `test/integration/usecases/itemDraft/deleteItemDraft/route.test.ts`        | 実Router/JWT/parser/errorHandler。usecaseは既存境界でモック                                        |
| 結果      | `test/docs/report/ErrorHandler/errorHandler.md`                            | 独立レポート本体。元F2からリンク                                                                   |

## 4. ケース一覧

同じID内の値違いは独立したit.eachへ展開する。優先度は基本分岐と情報非公開をP0、誤判定防止をP1。期待JSONは完全一致、status/json各1回、next未実行を基本とする。consoleのspyは各テスト後に復元する。

| ID        | 優先度・レベル           | 条件・入力・手順                                                                 | 期待結果・後続停止                                                                        |
| --------- | ------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| U01       | P0・単体                 | SyntaxError＋type=entity.parse.failed＋status=400                                | 固定400 JSON。元のmessage/stack/bodyを公開せず、生Errorログなし                           |
| U02       | P0・単体                 | DB例外/通常Error                                                                 | 固定500 JSON。DB message/sql/parameters非公開                                             |
| U03       | P0・単体                 | AppError400/404/429、publicMessageあり/なし/空文字                               | 既存status/code/messageを維持                                                             |
| U04       | P1・単体                 | 通常Errorにstatus=400/401/403/404/413/415/422、statusCodeのみ等                  | すべて500。任意status採用なし                                                             |
| U05       | P1・単体                 | SyntaxErrorだがtypeなし/別type、statusなし/文字列400/別status、statusCodeだけ400 | 500。必要条件の欠落・不一致を区別                                                         |
| U06       | P1・単体                 | Plain Error/通常objectにtype・statusだけを付加                                   | SyntaxErrorでないため500                                                                  |
| U07       | P1・単体                 | null/undefined/文字列/数値/objectをnextへ渡す相当                                | handler直接実行で500 JSON。Expressがこれらを必ずErrorとしてルーティングするとは主張しない |
| H01       | P0・結合                 | 実parserへ壊れたobject/array/文字列を送信                                        | 400 JSON、後続handlerなし、入力・解析情報のレスポンス露出なし                             |
| H02       | P1・結合                 | strict parserが拒否するJSONプリミティブ                                          | 実parserが同じentity.parse.failedを付けるため400。JSON文法そのものの妥当性と区別          |
| H03       | P0・結合                 | 正常object/array/空body/非JSON Content-Type                                      | 後続に到達、従来の正常応答を維持。parserが解析しないbodyへ400を追加しない                 |
| H04       | P0・結合                 | routeから通常DB例外/通常Error/任意statusつきErrorをnext                          | 固定500、内部情報を返さない                                                               |
| H05       | P0・結合                 | routeからAppErrorをnext                                                          | 既存AppError応答を維持                                                                    |
| H06       | P1・結合                 | 実parserのサイズ超過/未対応charset                                               | JSON構文エラーではないため既存500を維持。新しい413/415方針を追加しない                    |
| AF-JSON01 | P0・deleteItemDraft回帰  | 旧O03。正常JWT/なし/不正JWT＋不正JSON                                            | 400/INVALID_JSON、削除・作成usecase未実行。parserが認証より前という順序を維持             |
| AF-JSON02 | P0・独立U02/H04＋API R06 | 通常Error、DB例外の500と公開JSON                                                 | 従来の500・内部情報非公開を維持                                                           |

## 5. 実行・完了条件・対象外

`server/` から以下を実行する。

```bash
npm run test:run -- src/middleware/test/ErrorHandler/ErrorHandler/ test/integration/usecases/ErrorHandler/ErrorHandler/ --maxWorkers=1
npm run test:run -- src/validators/params/test/id.test.ts src/middleware/validate/test/deleteItemDraft.test.ts src/controllers/itemDraft/test/ src/usecases/itemDraft/test/deleteItemDraft.test.ts src/services/itemDraft/test/deleteItemDraft.test.ts test/integration/usecases/itemDraft/createItemDraft/route.test.ts test/integration/usecases/itemDraft/deleteItemDraft/ test/integration/database/itemDraft/deleteItemDraft/ --maxWorkers=1
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

test配下の独立fixture/結合テストと変更したAPIテストは、既存ESLint/typescript-eslintで追加lintする。設定・ライブラリ追加なし。

独立U/HはDB不要。API回帰で既存実DBケースを実行する場合は.env.test/test_db限定ガード・全接続検査・作成ID限定cleanupを既存基盤のまま使用する。

完了条件はケースIDと実行結果の対応、400/500/AppErrorの分類、内部情報非公開、後続停止、API回帰と独立レポートの記録。旧O03の500観測はレポート履歴として保持する。
今回のエラーハンドラーにDB更新・非同期待機・重複排除・行ロックはないため、独立テストにそれらのケースを作らない。DB障害は実際の接続障害の再現ではなく、例外の公開整形として検証する。
