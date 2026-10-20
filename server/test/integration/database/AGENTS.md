# DB結合テストの共通ルール

## 適用範囲・配置・参考例

`server/test/integration/database` 配下の永続化・DB制約・所有権・状態遷移の結合テストに適用する。上位の AGENTS.md と [配置規則](../../AGENTS.md) に従い、`<大分類>/<小分類>/` に置く。[設計書](../../docs/architecture/AGENTS.md)、[レポート](../../docs/report/AGENTS.md)、[fixture](../../fixtures/AGENTS.md) の該当規則も読む。

主な検証対象を基準に配置する。transaction の引渡し・commit/rollback の可視性・並行要求の制御を主に扱うテストは [usecases](../usecases/AGENTS.md) に置く。永続化失敗時の rollback や HTTP 拒否時の DB 不変を、この階層で確認する既存形式もある。形式統一だけを理由に移動・重複追加しない。

参考例は目的で選び、特定の一機能を全テストの雛形にしない。

| 参考例 | 主な観点 |
| --- | --- |
| [createItemDraft](itemDraft/createItemDraft/database.test.ts) | 入力 schema と保存値、所有者混入、JSONB、省略値、直接 SQL の制約、逐次再実行 |
| [deleteItemDraft](itemDraft/deleteItemDraft/database.test.ts) | 物理削除、他人・管理者・所有者 null の拒否、同じ参照や URL を持つ非対象行の保持 |
| [createItemEditingDraft](itemEditing/createItemEditingDraft/database.test.ts) | 下書きからのコピーと元行削除、再送、HTTP 入口で拒否した場合の実 DB 不変 |
| [createItemEditingCopy](itemEditing/createItemEditingCopy/database.test.ts) | 任意関連・保存列のコピー、実スキーマと SQLSTATE、元行保護、修復後の再試行 |
| [updateConfirm](itemEditing/updateConfirm/database.test.ts) | 既存行更新、モデル検証と DB 制約の区別、更新途中の rollback、メディア保存値 |
| [createItem/databaseValues](items/createItem/databaseValues.test.ts) | 保存済み JSONB の破損・値域、関連 FK 方向、DECIMAL、未確定条件の観測 |

ファイル名・分割数・ケース ID の接頭辞・件数は機能ごとに異なる。通常の `database.test.ts` と、値や境界を分けた `databaseValues.test.ts` の両方を許容する。

## 作業範囲・期待結果・敵対的ケース

- 対象 usecase から helper・service・Model までの実処理を調べる。入力 schema を通す `run` と直接 usecase/service/SQL を呼ぶケースを区別し、必要な場合に controller・middleware・route も確認する。
- 明示された仕様・変更指示と現行コードを照合し、確定契約、現行挙動の観測、提案、実装済み・検証済みを分ける。指定契約との不一致を、期待値の緩和・削除・skip で隠さない。未確定条件は「観測」と明記し、望ましい仕様を推測で追加しない。
- テスト設計では敵対的なケースを想定する。他人の ID・管理者権限・所有者 null・body の所有者混入、状態や論理削除、参照不在・関連不整合、上下限と特殊表記、空文字・空白・欠落・null、破損 JSONB、後方要素の不正、再送・途中失敗・修復後再試行を、対象の責務に応じて検討する。
- 複数不備のケースではエラーの優先順位も検討する。入力検証を迂回した保存済み不正値の検証を、通常の HTTP 経路で到達可能な入力と混同しない。拒否が未確定なら観測として扱い、不正らしいという理由だけで失敗を期待しない。
- 画像数・価格・在庫・nullable・状態条件・再実行時の挙動は対応する機能の契約から決める。たとえば再送は新規行追加、既存行更新、元行消費後の 404 があり、一律に冪等性や重複拒否を要求しない。
- 設計のみなら設計書だけを変更する。テスト作成の依頼から本番コード・DB・設定・無関係な既存テストの変更許可を推測しない。新ライブラリや共通基盤、テスト専用の本番分岐を独断で追加しない。
- 対象外の問題は `/docs/todo/AGENTS.md` に従う。編集範囲が明示的に限定される場合は、許可された文書または最終回答へ残す。

## テストコード・fixture・モックの境界

- TypeScript・ESM・Vitest を使い、相対 import は `.js`、型だけの参照は `import type` とする。`any` と不要な型アサーションを避け、既存型・`Parameters`・`Awaited<ReturnType<...>>` を利用する。
- `describe` は責務・観点・優先度が分かる単位にし、テスト名は設計書のケース ID と日本語の条件・期待結果に対応させる。同じ検証構造の値違いは `it.each`・`describe.each` を使い、失敗値を名前から特定できるようにする。
- 準備・対象呼出し・結果の検証を読み取れる構成にする。factory は body・配列・入れ子等を毎回新しく作り、更新前後・所有者・関連行を識別できる値にする。共通 helper で本番の変換・集計を再実装して期待値を算出しない。
- seed・snapshot・保護行の検証・cleanup は既存 fixture を利用する。`beforeEach` の seed とケース内の seed のどちらも可とし、ケース間で可変状態を共有しない。import 時の hook・mock・接続終了も再利用されることを確認する。
- DB setup は DB・Model・それらに依存する usecase より先に評価する。明示 import と fixture 内からの import のいずれも、実際の評価順で安全ガードが先に働くことを確認する。
- 検証対象の usecase・helper・service・Model と PostgreSQL は実処理を呼ぶ。対象の DB アクセスをモックした成功を実 DB 検証としない。外部署名・通知等は境界でモックし、実通信・アップロード・外部処理の成功まで保証しない。
- spy は実処理の観測と障害注入を区別し、置換した境界を記録する。モックを使う場合だけ履歴・実装・標準応答を初期化する。spy・fake timer・stubEnv を復元し、DB suite 全体で必要な env は全接続終了後に戻してよい。
- HTTP 拒否と DB 不変を確認する場合は Supertest と最小 Express を使い、対象の実 Router・必要な middleware を接続する。テスト用の生成鍵を使い、対象外依存・timer・rate limiter の状態を分離する。テスト用 error handler の結果を本番 error handler の保証とみなさない。
- コメントは意図的な型不正・検証境界・制御理由を説明し、デバッグログを残さない。

## DB 接続ガードと中断条件

DB テストは `server/.env.test` を接続設定の読込元とし、PostgreSQL の `test_db` だけを使う。`NODE_ENV=test` の指定だけでは安全確認は完了しない。以下を再実行時にも働くガードで検証する。

1. `server/` を実行ディレクトリとし、コマンド・dotenv 読込箇所・DB/Model の実 import 経路を確認する。
2. DB モジュール初期化前に `.env.test` を読み、採用値の出所、`NODE_ENV=test`、URL の DB 名 `test_db` を検査する。親 process の接続設定にフォールバックせず、読込失敗・URL 不正は秘密情報を含まないエラーで停止する。
3. アプリ用・Model 初期化用・observer・competitor など全接続を列挙し、接続前に Sequelize の設定 DB 名を検査する。
4. 全接続で接続後の `SELECT current_database()` が `test_db` であることを確認する。必要なスキーマ検査も終わるまで fixture 書込み・更新・削除を行わない。

- 引数なし `dotenv.config()` が `.env` を開かないように制御し、検証済み `.env.test` の値だけを返す。呼出し側が使う `parsed` 等の契約は維持する。dotenv をモックした事実だけで安全と判断しない。
- 明示的な別 env 指定、読込後の DATABASE_URL・NODE_ENV 等の差替え、ガード後の上書きも検出する。DB 非接続テストに import 経由の実 DB 接続を持ち込まない。
- **`.env.test` 以外、`test_db` 以外、読込元・接続先が不明な場合は中断し、続行判断をユーザーに委ねる。** 確認事実・停止位置・書込みの有無を秘密情報なしで報告する。設定を黙って差し替えたりガードを外したりしない。接続先不明時は cleanup を理由に DELETE しない。書込み不明も報告する。
- 接続拒否は安全条件違反と区別する。サンドボックスの通信拒否は承認手順に従い、許可後も同じガードで再実行する。通信許可を別 DB の利用許可と解釈しない。安全条件を満たす許可済みテストの通常再実行には追加確認を求めない。
- 証跡は読込元・DB 名・検査結果に限定する。URL 全体、ユーザー名・パスワード・token・env 内容を出力しない。

## 反映済みスキーマ・seed・cleanup

- 用意済みテスト DB と反映済みスキーマを使う。現行 Model・migration・実 DB の必要な列・型・NULL・default・FK・unique 等を照合し、古い fixture の定義を正としない。不一致をスキーマ検査・fixture 不備・アプリ契約不一致に切り分ける。
- テスト依頼だけを根拠に DB 作成・migration・`sequelize.sync()`・全件削除・TRUNCATE・sequence 巻戻しを行わず、スキーマを自動補正しない。
- 必須の親・マスターを FK 順で作り、対象ユーザー・他ユーザー・既存関連行を区別する。他実行と衝突しない固有名を使い、ランダム値は主に分離へ用いる。業務期待値は明示する。
- 固定 ID・共有データの存在や不存在に依存する場合は前提を先に確認する。不在 ID は自作行の削除等で準備し、不在にする目的で既存共有行を削除しない。連続 ID や異テーブル間の ID 不一致を期待しない。
- 自作行は fixture 作成途中・usecase 内・競合側の作成分も ID で追跡する。hook を使う場合は追跡領域を初期化してから書き込み、rollback 済み採番 ID も残す。直接 SQL 等の hook を通らない作成も管理する。
- 全 Promise・transaction を回収後、検証済み接続で追跡した ID だけを FK 順に削除し、残存 0 件を assert する。途中失敗でも既存行・他テストの行へ削除条件を広げない。
- 追加 hook・SQL 記録・spy を解除し、作成した全接続の close を試みて失敗を検出する。env は接続終了後に復元する。ガード停止で書込みがなければ、cleanup DELETE 未実施と接続終了の結果を分けて記録する。

## 永続化・制約・非対象行のアサーション

- 戻り値に加え新規 SELECT で保存値・関連 ID・件数を確認する。更新に使った Model インスタンスの値だけで永続化を断定しない。主要なコピー列・JSONB は完全一致を基本とし、部分一致は確認範囲を明確にする。
- 作成・更新・削除・元行消費の契約をそれぞれ確認する。公開側、元行、他ユーザー、同じ参照や URL の別行等を前後比較し、対象外への波及を検出する。所有者・作成日時など維持すべき列も確認する。
- 所有権・状態による除外は where 引数だけでなく実行結果と DB 不変で検証する。拒否時の追加行なし・更新なし・削除なしと、後続処理や外部境界の未実行も対象に応じて確認する。
- `AppError` は型・code・statusCode、伝播が契約の例外は元 Error の参照同一性を確認する。Model/DB の例外は型・SQLSTATE・発生箇所を区別する。schema 拒否や Model validation の成功から同じ DB 制約を推測しない。
- DB 制約自体は必要に応じ自作行への直接 SQL で確認する。NOT NULL・ENUM・VARCHAR・FK・unique・onDelete/onUpdate は実定義に対応付ける。制約が欠けて SQL が成功しても元へ戻せる transaction 等を使う。値は bind/replacements、動的識別子は固定許可リスト等に限定する。
- JSONB は欠落キー・JSON null・SQL NULL・空配列・配列順・重複識別子・追加キーと値の対応を区別する。数値の 0・負数・小数、文字列・空白・nullable も対象契約に応じて扱う。DECIMAL 等の返却表現を区別し、正規化で不正値を隠さない。
- JSONB へ保存できない `undefined`・NaN・Infinity・疎配列等の直接注入は、HTTP JSON・保存済みデータのケースと分ける。Model validation を迂回して破損した保存値を作る場合も、自作行と準備方法を明示する。

## transaction・再実行・競合の扱い

- transaction callback 内というだけで全書込みの参加を保証しない。helper・service・Model までの引渡しを確認し、途中失敗は先行書込みが実行済みであることと、rollback 後の新規 SELECT による全対象列・関連行の復元を確認する。
- callback 内の throw・SQL 制約失敗と、実 COMMIT の応答喪失・commit 後の HTTP 送信失敗を分ける。transaction/commit のモック reject だけから、実通信障害でも必ず rollback されると保証しない。
- commit の可視性を扱う場合は別接続で commit 前の旧値・commit 後の新値を確認する。外側の transaction で常に rollback するだけでは実 commit を検証できない。これらが主目的の追加テストは usecases 側へ置く。
- 逐次再送・失敗後の再試行・並行実行を分け、関連行件数・再利用・成功済み行の維持・ロック解放を対象契約に応じて確認する。逐次成功から並行時の一意性を推測しない。
- 順序制御や競合を扱う場合は実処理を維持した gate と独立接続/transaction を使う。実分離レベルを確認し、PID と `pg_blocking_pids` 等の実待機を根拠にする。固定 sleep・未完了・単なる `Promise.all` だけで排他を断定しない。
- 通知用と解放用 Promise を分け、拒否の検証を先に登録する。`try/finally` で全 gate を解放し、途中失敗でも処理・transaction を回収してから cleanup する。後続ロック取得完了を先行ロックの解放条件にしない。
- 古い Model の変更検知や取得後の所有者・状態変更が影響する場合は SQL と最終行を併せて確認する。実装にない再認可・排他・単純な後勝ちを保証しない。SQL 記録に秘密情報を含めず hook を解除する。

## 変更後の確認・報告

実装変更時は `server/` で対象の `npm run test:run -- test/integration/database/<大分類>/<小分類>/`、`npm run lint`、`npm run typecheck`、`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` を実行する。実 DB 実行は接続ガードを先に確認する。fixture 変更時は利用側も確認する。

fixture/hook のファイル間干渉を抑えるため `--maxWorkers=1` を使う場合は理由を記録する。ケース内の並行 transaction 検証を代替したとはみなさない。通常 lint 対象外の TS は既存 ESLint・typescript-eslint で追加検査し、共有設定を回避目的で変更しない。

[レポート規則](../../docs/report/AGENTS.md) に従い、接続ガード・スキーマ・新規 SELECT・非対象行・cleanup・全接続終了・未実行範囲を記録する。本番型検査とテスト型検査の対象差、既知エラー・環境制限と今回の失敗を区別する。文書のみの変更は相対リンク・参照例・実ファイルとの対応・差分を確認し、テスト・lint・型検査未実行と明記する。
