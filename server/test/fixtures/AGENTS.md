# fixture・setupの共通ルール

## 適用範囲と配置

`server/test/fixtures` 配下に適用する。上位のAGENTS.mdと [配置規則](../AGENTS.md) に従い、`<大分類>/<小分類>/` に配置する。backendなどの中間階層は挟まない。

標準入力・既存データのfactory、共通アサーション、deferred Promiseは `fixtures.ts`、DB接続前の環境検査・外部通信モックは `databaseSetup.ts`、DBデータ作成・別接続での検証・後片付けは `databaseFixtures.ts` を基本とする。役割のない空ファイルは作らない。

基準例は [updateConfirmのfixture](itemEditing/updateConfirm/)。固有の項目・数値・ケース数を他機能にそのまま適用しない。テストとの対応・処理の責務は [設計書規則](../docs/architecture/AGENTS.md) と各機能の設計書で確認する。

## factoryと型

- TypeScript・ESMを使い、相対importは.js、型のみのimportはimport typeとする。anyと不要な型アサーションを避け、既存型・Parameters・ReturnTypeを使う。
- 標準入力は実schemaを通る値にする。ケースでは原則として検証対象だけを変更し、他の条件は正常に保つ。
- body・配列・入れ子・既存データ相当の値はfactoryで毎回新しく生成し、共有状態を持ち越さない。更新前後・複数ユーザー・複数画像は識別できる値にする。
- helperで本番の変換・業務ロジックを再実装しない。期待値は契約から明示し、過度な共通化で準備・実行・検証を隠さない。
- AppErrorは型・code・statusCode、予期しない例外は同一参照の伝播を検証する。共通アサーションで責務の異なる保証を混ぜない。

## deferred・モック・独立性

- deferredは開始通知と解放用Promiseを分ける。先にrejectの検証を登録し、未回収Promiseを残さない。途中のassert失敗時もtry/finallyで解放・回収する。
- モックはVitestのvi.hoisted・vi.mock・vi.fn・vi.spyOnを使う。対象の実処理をモックしない。beforeEachで履歴・実装と標準応答を再設定する。
- 時刻・UUID等は既知の値で制御し、呼出しを区別する場合は既知の異なる値を順に返す。spy・timer・stubEnv・モジュール内状態は適切なhookで復元する。
- 外部通信は境界でモックし、モックしたサービス内部まで成功したとは扱わない。認証鍵はテスト用に生成し、秘密情報をログへ出さない。

## DB setupと接続ガード

実DBに触れるfixture・setupは [DB結合テストの全安全条件](../integration/database/AGENTS.md) を必ず読む。基準実装は [databaseSetup.ts](itemEditing/updateConfirm/databaseSetup.ts) と [databaseFixtures.ts](itemEditing/updateConfirm/databaseFixtures.ts)。

- server/を実行ディレクトリとし、DB関連モジュールの初期化前にserver/.env.testを読む。採用する値が同ファイル由来であり、NODE_ENV=test、DB名=test_dbであることを検査する。
- アプリ・モデル初期化・observer・competitor等の全接続について、接続前の設定DB名と接続後のSELECT current_database()を検査する。検査が終わるまでfixtureを書き込まない。
- 引数なしdotenv.config()も制御し、別envの明示指定・接続URL差替え・ガード後の上書きを検出する。dotenvをモックしただけで安全と判断しない。
- `.env.test`以外・test_db以外・読込元や接続先が不明な場合は中断し、ユーザー判断を待つ。設定を黙って差し替えたりガードを外したりして続行しない。接続先不明時は後片付けを理由に削除しない。
- サンドボックスによる接続拒否は安全条件違反と区別し、承認手順に従って同じガードで再実行する。通信許可を別DBの利用許可と解釈しない。

## DBデータの作成・検証・後片付け

- 反映済みのスキーマを使い、モデル・migration・実DBの制約を確認する。テスト実装だけを根拠にDB作成・migration・sync・全件削除・truncateを行わない。不一致は報告し自動補正しない。
- 必要な親・マスター行と対象外行を用意する。衝突しない固有名を使い、作成IDを記録する。固定IDや共有データへ依存する場合は先に前提を検査する。
- 結果は更新済みインスタンスだけで判定せず、新規SELECTで取得する。commit/rollbackの可視性確認には別接続を使う。
- 作成したIDだけを外部キーに応じた順序で削除し、残存0件をassertする。既存データへ削除条件を広げず、シーケンスを戻さない。
- 保留Promise・transactionを回収してから後片付けし、hook・SQL記録・spyを解除して全接続を閉じる。suite用環境変数は接続終了後のafterAllで復元してよい。
- 接続URL・認証情報・env内容をログへ出さず、読込元・DB名・ガード・後片付けの成否を [レポート](../docs/report/AGENTS.md) に残す。

## 変更後の確認

import元・モック先・実行ディレクトリと接続ガードの初期化順を確認し、fixtureを使用する依頼範囲のテストで検証する。server/でlint・本番typecheck・test/tsconfig.jsonの型検査を行う。test配下のTSは既存ESLintとtypescript-eslintで追加lintする。未実行項目と既知エラーを明記し、無関係なコード・設定・テストを修正しない。
