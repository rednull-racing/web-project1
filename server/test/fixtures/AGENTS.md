# fixture・setup の共通ルール

## 適用範囲・配置・参考資料

`server/test/fixtures` 配下に適用する。上位の AGENTS.md と [配置規則](../AGENTS.md) に従い、`<大分類>/<小分類>/` に配置する。`backend` 等の中間階層を挟まない。機能固有の値・列・制約は、対応する [設計書](../docs/architecture/AGENTS.md) と現行コードを確認する。

既存ファイルにはデータ factory、モック登録、HTTP 構成、DB hook 登録、他 fixture の再 export がある。ファイル数や名前を一律に揃えず、必要な責務だけを設ける。短い fixture に DB 用の空ファイルを追加しない。

| ファイル例               | 主な責務                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `fixtures.ts`            | 標準入力・取得値・期待値の factory、境界値、共通アサーション、deferred             |
| `usecaseMocks.ts`        | usecase の依存モック登録、正常応答の再設定                                         |
| `httpMocks.ts`           | Router/controller が読み込む対象外依存の遮断                                       |
| `httpFixtures.ts`        | 最小 Express、実 Router/errorHandler の接続、テスト用 JWT・リクエスト helper       |
| `databaseSetup.ts`       | DB 初期化前の env 検査、dotenv 制御、必要な外部通信モック                          |
| `databaseFixtures.ts`    | 全接続・スキーマ検査、seed、ID 追跡、snapshot、DB アサーション、cleanup と接続終了 |
| `concurrencyFixtures.ts` | 実処理を呼ぶ gate、transaction の PID、期限付きの実ロック待機監視                  |

参考例は目的別に選び、特定の一実装を全機能の雛形にしない。

- [items/createItem](items/createItem/)：データ・usecase モック・HTTP・DB の分離。
- [deleteItemDraft/databaseFixtures.ts](itemDraft/deleteItemDraft/databaseFixtures.ts)：既存 DB 基盤を利用した seed・保護対象の拡張。
- [deleteItemDraft/concurrencyFixtures.ts](itemDraft/deleteItemDraft/concurrencyFixtures.ts)：gate と対象 PID 間の実待機監視。
- [ErrorHandler/fixtures.ts](ErrorHandler/ErrorHandler/fixtures.ts)、[refreshToken/fixtures.ts](auth/refreshToken/fixtures.ts)：DB 接続を伴わない小さな factory。

## 型・factory・期待値

- TypeScript・ESM、相対 import は `.js`、型のみの参照は `import type` とする。`any` や不要な型アサーションを避け、既存型・`Parameters`・`Awaited<ReturnType<...>>` を利用する。
- 部分的な Model/transaction の代用品や意図的な型不正入力のアサーションは境界に限定する。型を Model に合わせた plain object を、保存済みの実インスタンスとみなさない。
- 通常入力の factory は実 schema を通る値にする。取得値・保存済みデータの factory はその境界の契約に合わせ、HTTP body と混同しない。標準 fixture は正常にし、不正値・破損構造・所有権違反は名前の分かるケースデータや変更で作る。
- body・配列・入れ子・Date 等の可変値は呼出しごとに新しく生成する。共有の期待 JSON や境界値一覧も使用側で変更しない。更新前後・複数ユーザー・画像・関連 ID を識別できる値にする。
- 通常の期待値は既知の値で明示し、本番の変換・集計・業務ロジックを helper に再実装して算出しない。期待値用 factory で差分を明示することは可とし、入力と期待値が可変オブジェクトを共有しないようにする。
- 敵対的ケース用の欠落・null・不正型・上下限・特殊表記・破損した入れ子等を準備する場合は、変えた条件と到達させる境界を明示する。NaN・Infinity・undefined・疎配列等の直接注入を HTTP JSON や保存済み JSONB のデータと混同しない。
- 共通アサーションは確認範囲が分かる名前と引数にする。AppError は型・code・statusCode、元例外の伝播は参照同一性を確認する。戻り値だけで保存・認可・外部通信まで保証せず、準備・実行・検証を過度な抽象化で隠さない。

## 再利用と import の副作用

- 既存のデータ factory・DB 基盤を再利用できる場合は責務と依存を確認する。`src/**/test` の単体 fixture を再 export する既存形式も可とし、配置を揃えるだけの移動や重複実装を行わない。
- DB fixture の再利用は関数だけでなく、import 時の `vi.mock`、hook、ID 追跡、接続 close、env 復元も引き継ぐ。追加 seed 行が既存追跡の対象になるか確認し、同じ接続・Model に cleanup 用 hook を重複登録しない。
- データだけを使う単体・DB 非接続テストから DB setup/fixture を import しない。型だけの参照で実モジュールを評価させず、barrel/re-export を含む実 import 経路を確認する。
- `databaseSetup.ts` は DB・モデル・それらに依存する usecase より先に評価する。`vi.hoisted` とモジュールモックの評価順を確認し、後から env を設定して初期化済みモジュールを救済しない。
- fixture 整理の依頼から共通基盤の新設や既存利用側の全面移行を推測しない。変更した export・import・mock 先と利用側テストの対応を確認する。

## モック・HTTP・テスト間の独立性

- `vi.hoisted`・`vi.mock`・`vi.fn`・`vi.spyOn` を使い、対象の実処理を維持して依存先を置換する。モジュールモックは現在の実 import 先へ合わせ、mock factory から hoist 前の変数を参照しない。
- モック登録と正常応答の再設定を区別する。`beforeEach` または明示的な setup 関数で履歴・実装・標準応答を初期化し、ケース固有の reject/保留を持ち越さない。履歴消去だけでは実装も戻ると仮定しない。
- HTTP helper は対象 Router と共通 middleware を最小 Express へ接続し、実アプリの import に伴う cron 等の起動を持ち込まない。parser・認証・レート制限・validator・errorHandler の実処理とモックの境界を明示する。
- Router/controller の他 export が読む対象外 usecase・管理者 middleware・外部通信も確認する。DB 非接続テストのモック漏れを実 env 読込みや接続ガード緩和で回避しない。
- HTTP helper と依存モックは、実 DB HTTP テストでも対象 usecase を誤ってモックせず使える範囲で分離する。最小アプリを生成しただけでレート制限等のモジュール内状態が初期化されたとみなさず、必要に応じて `vi.resetModules` と再 import を使う。
- 外部通信・署名は境界でモックする。固定のダミートークンやエラー内の秘密情報検出用マーカーと、実 JWT 検証に使う生成済みテスト鍵を区別する。実認証情報を使わず、秘密情報をログへ出さない。
- 時刻・UUID は必要なケースで既知値に制御し、別呼出しを区別する場合は異なる既知値を返す。spy・fake timer・stubEnv を復元する責務を使用側と分担する。DB suite 全体で保持する env は全接続終了後に復元してよい。

## deferred・gate・並行処理

- deferred は型付きの promise・resolve・reject を返し、開始通知・実処理到達通知・解放用 Promise を分ける。先に reject の検証または結果回収を登録し、未処理 rejection を残さない。
- gate 到達待ちは、対象が到達前に成功・失敗していないかも監視する。期限付きの場合はタイマーを必ず解除し、期限超過をロック成立や成功の根拠にしない。
- 実 DB の gate/障害注入は実 service を呼んだ前後に置き、SQL の意味や取得結果を変えたモックで実ロック検証を代用しない。待機する後続の「ロック取得完了」を先行処理の解放条件にしてデッドロックを作らない。
- transaction と接続 PID を対応付け、observer から `pg_blocking_pids` 等で対象 PID 間の実待機を確認する。固定 sleep・処理の未完了・単なる `Promise.all` だけで排他を判断しない。分離レベルと観測用接続を確保できるプール構成も確認する。
- 途中の assert が失敗しても `try/finally` で全 gate を解放し、開始した Promise の結果と transaction の終了を回収する。処理回収より先に行削除・接続 close を行わない。本番コードにテスト用の待機・障害分岐を追加しない。

## DB setup と接続ガード

実 DB 用 fixture は [DB 結合テストの全安全条件](../integration/database/AGENTS.md) を読む。既存の [createItemEditingDraft/databaseSetup.ts](itemEditing/createItemEditingDraft/databaseSetup.ts) は初期化順・dotenv 制御・環境再検査の参考とし、対象固有のモックを無条件に複製しない。

- `server/` を実行ディレクトリとし、DB 初期化前に `server/.env.test` を読み、採用値の出所・`NODE_ENV=test`・PostgreSQL の `test_db` を検査する。親 process の値へフォールバックせず、読み込み失敗や不正 URL は接続情報を含まないエラーにする。
- 引数なし `dotenv.config()` も検証済みの値に限定し、呼出し元が必要とする `parsed` 等の契約を維持する。別 env の明示指定、DATABASE_URL・NODE_ENV 等の接続前提の差替えやガード後の上書きを検出する。
- アプリ用・models 初期化用・observer・competitor 等の全接続を列挙し、接続前の設定 DB 名と接続後の `SELECT current_database()` を検査する。必要なスキーマ検査も含めて完了するまで seed を許可しない。
- `.env.test` 以外、`test_db` 以外、読込元・接続先不明は中断してユーザー判断を待つ。設定を黙って差し替えたりガードを外したりしない。接続先不明時は cleanup を理由に削除しない。
- サンドボックスの接続拒否は安全条件違反と区別し、承認手順に従って同じガードで再実行する。通常の許可済みテスト再実行に追加確認を求めず、通信許可を別 DB の利用許可と解釈しない。

## seed・snapshot・cleanup

- 反映済みスキーマを使い、現行 Model・migration・実 DB の必要な列・型・NULL・FK 等を照合する。過去 fixture の旧カラムや制約を正としない。Model validation と DB 制約を分け、不一致を migration・sync 等で自動補正しない。
- 必須の親・マスターを FK 順で作成し、所有者・他ユーザー・非対象行を用意する。UUID 等は主に固有名と実行間分離に用い、業務上の期待値は明示する。固定 ID・既存共有データへ依存する場合は前提を先に検査し、不存在 ID を作るため既存行を削除しない。
- seed の戻り値から `Awaited<ReturnType<typeof seed>>` 等で型を得て、run・snapshot・保護対象検証へ渡す。run が schema.parse を行うか直接 usecase を呼ぶか明示し、HTTP や通常入力検証の保証と混同しない。
- snapshot は新規 SELECT を使い、可視性には別接続を使う。同一 transaction 内の確認では transaction が属する接続を使用する。rollback 前のモデルインスタンスを保存結果の根拠にしない。
- SQL の値は bind/replacements で渡す。動的なテーブル名は固定の許可リスト等へ限定する。JSONB のキー有無・配列順、SQL NULL と JSON null、DECIMAL 等の返却表現を区別し、正規化で不正値を隠さない。
- 自作行は fixture 作成途中・usecase 内・競合側の作成分も追跡する。名前付き afterCreate hook 等を使う場合は追跡領域を初期化してから書き込み、rollback 済みの採番 ID も追跡対象に残す。直接 SQL 等、hook を通らない作成行も管理する。
- cleanup は全処理回収後、検証済み接続で記録した ID だけを FK 順で削除し、残存 0 件を assert する。全件削除・TRUNCATE・sequence 巻戻しを行わず、連続 ID や異テーブル間の ID 不一致を期待しない。
- import で登録した hook・SQL 記録・spy を解除し、作成した全接続の close を試みて失敗を検出する。env は接続終了後に復元する。安全ガードが通らず書込みがなかった場合は、cleanup DELETE を行わなかったことと接続終了の結果を区別する。
- DB 作成・migration・sync はテスト実装だけを根拠に実行しない。読込元・DB 名・ガード・スキーマ・cleanup の確認範囲は [レポート](../docs/report/AGENTS.md) に記録し、認証情報・接続 URL 全体・env 内容は出力しない。

## 変更後の確認

fixture の実装変更時は export/import 元・モック先・DB 初期化順・hook の登録と解除を確認し、使用する依頼範囲のテストを実行する。共有 fixture の変更は利用側も確認する。本番コードや設定を検査回避のため変更しない。

`server/` で対象 Vitest、`npm run lint`、`npm run typecheck`、`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` を実施する。通常 lint 対象外の TS は既存 ESLint・typescript-eslint で追加検査する。本番型検査とテスト型検査の対象差、未実行項目、既知エラー、今回の変更との関係を報告する。

文書だけの変更では、相対リンク・参照例・実ファイルとの責務の対応・差分を確認し、テスト・lint・型検査を再実行していないと明記する。対象外の問題は `/docs/todo/AGENTS.md` に従い、明示的に編集範囲が限定される場合は許可された文書または最終回答へ残す。
