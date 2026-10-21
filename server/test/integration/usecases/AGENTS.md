# usecase・HTTP 結合テストの共通ルール

## 適用範囲・配置・参考資料

`server/test/integration/usecases` 配下に適用する。上位の AGENTS.md と [配置規則](../../AGENTS.md) に従い、`<大分類>/<小分類>/` に置く。実 usecase と helper の接続、HTTP・認証・共通 middleware、実 DB の transaction・競合を扱う。

対応する [設計書](../../docs/architecture/AGENTS.md)、[レポート](../../docs/report/AGENTS.md)、[fixture](../../fixtures/AGENTS.md) を読む。実 DB を使用する場合は [DB 結合テストの全安全条件](../database/AGENTS.md) も適用する。ファイル名だけで判別せず、fixture・re-export を含む import 経路で DB 接続の有無を確認する。

参考例は目的別に選び、一機能のファイル数・ケース数・業務制約を全機能へ適用しない。

| 参考例                                                                                                                    | 主な検証範囲                                                      |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [createItemDraft/masterBrand.test.ts](itemDraft/createItemDraft/masterBrand.test.ts)                                      | 実 usecase・helper と依存モック、変換・失敗位置・待機             |
| [refreshToken/jwt.test.ts](auth/refreshToken/jwt.test.ts)                                                                 | DB なしの実 JWT 検証・生成 helper 接続                            |
| [ErrorHandler/errorHandler.test.ts](ErrorHandler/ErrorHandler/errorHandler.test.ts)                                       | 実 parser と共通 errorHandler、公開情報の境界                     |
| [createItem/route.test.ts](items/createItem/route.test.ts)、[registration.test.ts](items/createItem/registration.test.ts) | 最小アプリの Router 接続と実 registerRoutes の到達性を別々に確認  |
| [deleteItemDraft](itemDraft/deleteItemDraft/)                                                                             | 実 transaction、HTTP 応答の確定順序、削除・編集開始の実ロック競合 |
| [createItem](items/createItem/)                                                                                           | 複数テーブルの原子性、読取り後の障害、公開競合、commit 後の通知   |

## 契約と作業範囲

- 対象 usecase と helper・service・model・validator・middleware・controller・route・型を調べ、入力から保存・応答までの処理順序と境界を把握する。
- 期待結果は明示された仕様・変更指示と現行コードを照合して定める。不一致をテストの期待値変更で隠さない。仕様未確定の現行挙動は「観測」とし、修正案・実装済み契約・実行結果と分ける。
- 過去の観測、旧 import 先や旧カラムを現在の契約として使わない。修正で契約が変わった場合は、設計・ケース ID・レポートに根拠と対応を残す。
- ID 上限、必須項目、画像件数、状態遷移、レート枠、alias の再利用・重複防止などは対象機能の契約に合わせる。別機能の値やエラー形式を複製しない。
- 設計のみの依頼では設計書のみを変更する。テスト作成の依頼から本番コード・設定・DB・対象外テストの変更許可を推測しない。テスト用の分岐・待機処理を本番コードへ追加しない。
- 対象外の問題は `/docs/todo/AGENTS.md` に従う。編集範囲が明示的に限定される場合は、許可された文書または最終回答へ残す。

## 実処理とモックの境界

- 各ファイルで、接続を検証する実処理と、遮断する依存・障害注入の位置を明確にする。対象そのものをモックして設定済み応答だけを検証しない。
- helper 接続では実 usecase・対象 helper を動かし、DB service・外部通信等を境界でモックする。実 JWT が対象なら検証・生成 helper を、共通 middleware が対象なら parser・errorHandler 等を実処理にする。
- Router から controller までの接続では usecase をモックしてよい。HTTP から実 DB までの接続では対象 usecase・helper・service・model を実処理にし、対象外 usecase と外部通信を遮断する。一律に usecase をモックしない。
- 実 DB の spy は実処理を呼ぶ前後に gate・障害注入を置き、どこまで SQL が完了したかを明示する。実検索を固定結果へ置換して認可・行ロック・永続化を確認済みとしない。
- モックした transaction callback の呼出し・例外伝播だけでは実 commit/rollback を保証しない。HTTP 応答、実 DB 保存、実アプリへの登録、外部送信は、それぞれ実行した範囲に限定して判定する。
- 通知・S3 等のモックは呼出し内容・開始時点・待機契約までを確認する。実アップロード・通知送信・外部サービス内の保存は成功済みにしない。

## コード・fixture・テスト間の独立性

- TypeScript・ESM、相対 import は `.js`、型のみの参照は `import type` とする。Vitest と、HTTP 検証には Supertest を使い、新しいライブラリを独断で追加しない。
- テスト名からケース ID と条件・期待結果を追えるようにする。責務・観点ごとに `describe` を分け、同じ検証構造の入力違いは `it.each` 等で失敗した値を識別できるようにする。すべてのファイルへ同じ章立てを強制しない。
- 準備・呼出し・検証を読み取れる構成にし、共通化は [fixture の責務](../../fixtures/AGENTS.md) に合わせる。import 時のモック・hook・cleanup 登録も調べ、DB なしテストから DB fixture を評価しない。
- 標準入力は実 schema を通る値にする。直接 usecase を呼ぶ場合と schema.parse を経由する場合を区別し、正常な HTTP 入力の保証へ拡大しない。個別ケースは原則として検証条件以外を正常に保つ。
- body・配列・入れ子・Date 等は factory で新しく生成し、共有値を変更しない。更新前後、所有者・別ユーザー、関連 ID・画像を取り違えられない値にする。業務ロジックを期待値 helper に再実装しない。
- `any` を避け、既存型・`Parameters`・`Awaited<ReturnType<...>>`・型付きモックを使う。部分的な Model/transaction と意図的な型不正入力のアサーションは境界に限定する。
- `vi.hoisted`・`vi.mock`・`vi.fn`・`vi.spyOn` の評価順と現在の実 import 先を確認する。Router の他 export が読む対象外依存も遮断し、モック漏れを実 env 読込みで回避しない。
- `beforeEach` または明示的な setup で履歴・実装・標準応答を初期化し、ケース固有の reject・保留を残さない。履歴消去と実装リセットを混同しない。
- 時刻・UUID は必要な観点だけ既知値に制御する。spy・fake timer・stubEnv を復元し、モジュール内状態は必要に応じて `vi.resetModules` と再 import で分離する。DB suite の env は全接続終了後に復元してよい。
- JWT 鍵は生成したテスト用の値等を使い、実認証情報を使わない。固定ダミー値と実 JWT の検証に使う鍵を区別する。秘密情報やデバッグ用ログを残さない。

## 敵対的ケースとアサーション

- [設計書の敵対的ケース](../../docs/architecture/AGENTS.md) に従い、呼出し側の制約破りや依存先・実行順序が不利になる状況を検討する。対象の責務に応じ、所有者 ID 混入・他人の ID・未知キー、不正 JWT/payload、破損した保存済み構造、途中失敗、再送・競合を選ぶ。
- 欠落・undefined・null・空・0・負数・小数・文字列・上下限を区別し、配列の欠落・重複・順序・元 index と値の対応も確認する。NaN・Infinity・疎配列等の直接注入を HTTP JSON や保存済み JSONB で到達可能とみなさない。
- 正常系は戻り値・公開レスポンスと主要な引渡し引数・回数を確認する。完全一致を基本に、部分一致は確認範囲が一部である場合に使う。同じ transaction/オブジェクトを渡す契約は参照同一性も確認する。
- 含める値に加え、更新引数・レスポンスへ混入してはいけない項目、非対象行やコピー元の不変も確認する。HTTP に所有者を混入しても認証本人の ID が渡されることと、実 DB の所有権照合は別に検証する。
- `AppError` は型・code・statusCode、元例外の伝播は参照同一性を確認する。HTTP では公開 status・JSON・必要なヘッダーと内部情報の非公開を確認し、内部 Error と同じ形式を一律に求めない。
- 依存処理を段階ごとに失敗させ、停止位置と後続未実行を確認する。複数不備では契約上のエラー優先順位を検証する。開始済み並行処理の取消しなど、実装にない保証は追加しない。
- 観測ケースには注入位置・実行順・保証できない範囲を示す。確定した拒否・再認可・重複防止契約と混ぜず、修正済みの旧不具合を将来の期待動作として固定しない。

## HTTP・認証・共通 middleware

- 最小 Express に必要な parser・対象 Router・errorHandler を明示して接続する。実アプリ全体の import に伴う cron 等を持ち込まない。実 registerRoutes の到達性が対象の場合は別ケースで登録関数を実行し、対象外 Router を遮断する。
- 正常応答、認証なし・署名不正・期限切れ、params/body/query の採用元・不正値・未知キー、複数不備時の優先順位、usecase 未実行を対象に応じて確認する。
- parser の構文エラー・strict モードのプリミティブ拒否と、body validator・サイズ超過・charset エラーを区別する。raw JSON を送るケースで通常の `.send(object)` だけを使わない。
- レート制限は実 middleware/store で許容回数と次の要求、ユーザー単位の枠、トークン・対象 ID・IP 変更、窓の直前・一致・直後、不正入力・業務失敗による消費と優先順位を実装に合わせて確認する。
- 新しい Express を作っただけで rate limiter の状態が消えたとみなさない。モジュール再読込みや対象キーの reset 等で分離し、実 DB HTTP では DB 初期化済みモジュールへの影響も確認する。時間制御は Date・必要な interval 等に限定して HTTP I/O を妨げない。
- 共通 errorHandler の応答を保証する場合は実 handler を使う。テスト専用の 4 引数 middleware はエラー観測用と明記し、共通応答や実アプリの登録まで保証しない。
- usecase の待機中と確定後の応答を区別する。実 DB HTTP では commit/rollback 後の保存結果と応答を対応付け、実 commit 後の送信失敗から DB の復元を期待しない。

## 非同期処理・transaction・競合

- 対象 Promise と非同期アサーションを await し、開始した処理の結果を回収する。開始通知・実処理到達・解放用 Promise を分け、呼出し順の assert だけで await を保証しない。
- 待機契約がある依存を保留し、保留中に後続や応答へ進まないこと、解放後の完了を確認する。commit 後の通知など、完了を待たない契約もあるため、すべての依存の完了を usecase の成功条件にしない。
- reject の検証・結果回収は先に登録する。gate 到達前の成功・失敗も監視し、途中の assert 失敗でも `try/finally` で全 gate を解放して Promise・transaction を回収する。cleanup や接続 close はその後に行う。
- 実 DB の原子性は、helper・service・Model まで同じ transaction が渡ることと、commit/rollback 後の新規 SELECT の両方で確認する。先行書込みの実完了、対象の全列・関連行・非対象行、失敗後の再試行を検証する。
- 可視性は別接続から commit 前の旧値・commit 後の新値を確認する。外側 transaction で常に rollback する方式だけで実 commit を検証済みとしない。
- transaction callback 内の障害、外側 Promise の模擬 reject、実 SQL エラー、実 COMMIT 応答喪失、commit 後の HTTP 送信失敗を分ける。模擬障害から実通信断での rollback を保証しない。
- 逐次再実行・失敗後の再試行・並行実行を分ける。検索結果を変えるモックから実 DB の一意性を推測せず、取得済み snapshot とロック後の再検索・状態再評価も区別する。
- 実競合は独立 transaction/接続で制御する。同一対象・別対象、所有者変更・削除・関連行変更、commit/rollback の順序を責務に応じて検討する。実分離レベルと observer を含むプールの余裕も確認する。
- ロック待機は transaction と接続 PID を対応付け、`pg_blocking_pids` 等で対象 PID 間の実待機を期限付きで確認する。固定 sleep、未完了、`Promise.all` だけで排他を断定しない。後続のロック取得完了を先行の解放条件にしない。

## 実 DB の準備・後片付け

詳細は [DB 結合テスト規則](../database/AGENTS.md) と [DB fixture 規則](../../fixtures/AGENTS.md) に従う。

- `server/` から `.env.test` を読み、DB/model 初期化前の読込元・`NODE_ENV=test`・設定 DB 名、全接続の接続後 `current_database()=test_db` を検査する。必要なスキーマ検査まで終えてから seed する。
- `.env.test` 以外、`test_db` 以外、読込元・接続先不明なら中断してユーザー判断を待つ。設定差替え・ガード緩和・接続先不明時の cleanup DELETE を行わない。サンドボックスの通信拒否は別の問題として承認手順に従い、同じガードで再実行する。
- DB なし HTTP/helper テストには DB 設定を持ち込まない。実 DB の schema 不一致を migration・sync・DB 作成で補正しない。
- fixture・対象 usecase・競合側が作った行を ID で追跡し、全処理回収後に検証済み接続で FK 順に削除して残存を確認する。全件削除・TRUNCATE・sequence 巻戻しを行わない。hook・spy を解除し、全接続を閉じて env を復元する。

## 実行確認と報告

実装変更時は `server/` で対象ファイルを指定して `npm run test:run -- test/integration/usecases/<大分類>/<小分類>/`、`npm run lint`、`npm run typecheck`、`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` を実施する。実 DB を含むディレクトリを DB なし回帰として一括実行しない。先に接続ガードを確認し、干渉を抑えるため `--maxWorkers=1` を使う場合は理由を記録する。

通常 lint の対象外 TS は既存 ESLint・typescript-eslint で追加検査する。検査回避のため共有設定を変更せず、本番型検査とテスト型検査の対象差も区別する。結果は [レポート規則](../../docs/report/AGENTS.md) に従い、ケース ID・DB なし/実 DB の件数・モック範囲・未確認事項・既知エラー・実行環境の制限を示す。失敗を隠す期待値変更・skip/todo 化を行わない。

文書だけの変更では、相対リンク・参照例・実ファイルとの責務の対応・差分を確認し、テスト・lint・型検査を再実行していないと明記する。
