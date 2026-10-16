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

本節はこのディレクトリ配下の単体テストに適用する。上位の [src/AGENTS.md](../AGENTS.md) の単体テスト共通ルールと、対象までのAGENTS.mdを読む。対象本番コードに最も近いtestへ配置し、fixtureはserver/test/fixturesの大分類/小分類に置く。

- usecase をモックし、実 controller を呼ぶ。認証済みユーザー、検証済み入力、ID の扱いを確認し、未検証 body に混入した別ユーザー ID 等を採用しないことを検証する。
- 成功時はステータスと返却項目を確認する。null、空配列、空辞書、値ありなどレスポンスの該当形を扱う。
- 失敗時は同じエラーを `next` へ渡し、成功レスポンスを送らないことを確認する。
- 同じcontrollerモジュールがimportする対象外usecaseも実パスでモックし、単体テストから実DBやAWSの設定を読み込まない。
- validatedBody等の検証済み入力と認証ユーザーを使う境界を確認し、usecase保留中に成功応答・nextを呼ばないことも契約に応じて検証する。HTTPの経路・認証・レート制限は結合テストへ分ける。
