# controllers/AGENTS.md

## 対象

このディレクトリ内の Controller を作成・修正する場合に適用する。

## 基本方針

Controller は以下を担当する。

- req.params、req.query、req.body、req.user から値を取得する
- UseCase を呼び出す
- HTTP レスポンスを返す
- エラーを next へ渡す

## 移行ルール

- 既存 Route 内のハンドラーを、挙動を変えずに Controller へ移動する。
- 条件分岐や一時的な業務ロジックが Route 内にある場合、今回の移行では Controller へそのまま移してよい。
- 共通 UseCase 化、命名変更、レスポンス変更、エラー変更、DB 処理の最適化は行わない。
- TODO コメントは削除しない。
- 新たな仕様や制約を追加しない。
- route の 3 行コメントを、処理の上にそのままコピーする

## 実装形式

- Controller は名前付き export にする。
- 戻り値は Promise<void>とする。
- エラーは try/catch で next(err)へ渡す。
- Express の型は type import を使用する。
- その他、コーディング規約に従って実装する。

## コーディング規約

/docs/codingRule/backend/controller.md

## スコープ管理

現在依頼されている範囲以外は変更しない。

作業中に無関係なバグ、改善点、リファクタ候補を見つけても、
その場では修正しない。

代わりに `/docs/todo` の運用ルールに従い、
以下を含む Todo を作成する。

- 優先順位
- 問題の概要
- 原因
- 修正方針
- 対象ファイル
- そのまま実装へ使用できるプロンプト

Todo 追加自体が現在の依頼範囲に含まれない場合でも、
ルートの `AGENTS.md` と `/docs/todo` のルールに従う。

## 単体テストの共通ルール

本節はこのディレクトリ配下の単体テストに適用する。上位の [src/AGENTS.md](../AGENTS.md) の単体テスト共通ルールと、対象までの AGENTS.md を読む。配置は [test/AGENTS.md](../../test/AGENTS.md)、データ準備は [fixture 規則](../../test/fixtures/AGENTS.md) に従う。既存の近接する usecase 単体 fixture の再利用も認め、配置統一だけを目的とした移動は行わない。

### 実 controller とモックの境界

- usecase をモックし、実 controller を部分的な Request・Response と `next` の spy で直接呼ぶ。`status().json()` の連鎖を再現し、対象呼出しを await する。
- モック先は現在の実 import パスに合わせる。同じ controller モジュール内の他 export が import する対象外 usecase も確認し、実 DB・AWS の設定読込みや初期化を遮断する。必要なら既存の `httpMocks` を再利用するが、名前だけで HTTP テストと判断しない。
- `beforeEach` でモック履歴・実装をリセットし、必要な正常応答を設定し直す。対象外 usecase が実行されないことも責務の境界に応じて確認する。

### 入力の引渡しと敵対的ケース

- `req.user` の認証済み ID と、対象が利用する `validatedBody`・`validatedParams` 等から usecase に渡す引数を、呼出し回数も含めて完全一致で確認する。検証済み body をそのまま渡す契約では参照同一性も確認する。
- raw body・params・query へ、検証済み値と異なる対象 ID や偽装した `userId`・`seller_id` 等を混入させ、採用する入力の境界を確認する。既存 controller が raw params を数値化する箇所などは、実装と確定した契約に合わせて期待値を定め、全対象へ `validatedParams` の使用を一律に仮定しない。
- 敵対的ケースは入力の取り違え、余分な項目の漏出、依存処理の遅延・失敗など対象の責務から考える。単体への直接注入で認証や schema の拒否を保証せず、未確定の制約や controller にない所有権判定を推測で追加しない。

### 成功応答と例外伝播

- 成功時は対象のステータス、JSON の必要項目と値、呼出し回数、`next` の未実行を確認する。新規 ID、削除メッセージ、署名 URL 群など対象の公開契約に合わせ、他の処理の応答形式を一律適用しない。
- JSON は完全一致を基本とし、公開対象外の項目が混ざらないことを確認する。usecase の返却値から項目を選ぶ対象では余剰項目を混入させ、`null`・空配列・空辞書・値ありの形も契約に応じて確認する。
- usecase が `AppError` または予期しない Error で失敗した場合は、元のエラーと同じ参照を `next` へ一度渡し、成功時の `status`・`json` を呼ばないことを確認する。エラーの HTTP 変換は errorHandler の検証へ分ける。
- レスポンス送信自体の例外を扱う場合は、`next` への伝播と usecase の再実行がないことを確認する。既に呼び出した `status`・`json` の未実行や、完了済みの DB 更新の rollback を期待しない。

### 非同期処理と保証の範囲

- usecase の完了待ちは deferred Promise で制御する。保留中は成功応答・`next` が呼ばれないことを確認し、正常完了と reject 後の挙動を契約に応じて分ける。固定 sleep や呼出し順だけを await の根拠にしない。
- 保留中の検証が失敗しても `try/finally` で deferred を解放し、開始した controller の Promise を回収する。開始地点の通知が必要なら解放用 Promise と分ける。
- controller 単体で確認できるのは引数の選択・引渡し、応答の組立て、完了待ち、例外伝播までとする。実認証・schema・レート制限・Router の HTTP 接続・usecase の所有権判定・実 DB の永続化や原子性を確認済みとしない。接続の検証は対応する結合テストへ分ける。

### 参考例と確認

- [deleteItemDraft.test.ts](itemDraft/test/deleteItemDraft.test.ts)：検証済み params と認証 ID、偽装値、正常・失敗の待機、送信失敗後の再実行防止。
- [createItemDraft.test.ts](itemDraft/test/createItemDraft.test.ts)：検証済み body の参照、署名項目の選択、対象外 usecase と DB 初期化の遮断。
- [createItem.test.ts](items/test/createItem.test.ts)：共有 `httpMocks` の利用、新規 ID の応答、usecase の完了待ち。
- [updateConfirm.test.ts](itemEditing/test/updateConfirm.test.ts)：署名の空値・値ありと余剰項目の非公開。[createItemEditingCopy.test.ts](itemEditing/test/createItemEditingCopy.test.ts)：正常・失敗の deferred 制御と近接 fixture の利用。

実装変更時の検証コマンドと報告は上位の単体テスト共通ルールに従う。文書だけの変更は相対リンク・参照例と実ファイルの対応・差分を確認し、テスト・lint・型検査を再実行していないことを報告する。
