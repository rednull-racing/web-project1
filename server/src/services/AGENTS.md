# services/AGENTS.md

## 対象

このディレクトリ内の Service を作成・修正する場合に適用する。

## Service 層の位置づけ

Service は UseCase と Sequelize Model の間に位置し、DB アクセスを担当する。

```text
Controller
↓
UseCase（業務ロジック）
↓
Service（DBアクセス）
↓
Model
↓
Database
```

## 担当する処理

- Sequelize Model を使った検索、件数取得、集計、作成、更新、削除
- `where`、`attributes`、`include`、`order`、`limit`、`offset` の定義
- DB 取得結果と集計結果の返却
- UseCase から受け取った transaction の Sequelize options への受け渡し

## 担当しない処理

- Express の `Request`、`Response`、`NextFunction` の操作
- HTTP ステータスやレスポンス形式の決定
- 入力値の schema validation
- 所有権、権限、status、存在確認にもとづく業務上の処理可否の決定
- 金額、ポイント、割引、在庫などの業務計算
- transaction の開始、commit、rollback
- 外部システムとの通信

業務ロジックは UseCase、入力検証は Validator、外部システムとの通信は `infra` または既存の専用 Utility に実装する。

## 実装ルール

- 関数は名前付き export とし、「操作を表す動詞 + 対象」で命名する。
- 引数がある関数はオブジェクト形式で受け取り、具体的な `Params` 型を使用する。
- `any` と型回避目的の型アサーションを使用しない。
- 所有者を条件に含める取得は、対象 ID と所有者 ID を同じクエリで絞り込む。
- 必要なカラムと関連だけを `attributes` と `include` で取得する。
- データが見つからない場合は `null` または空配列を返し、`AppError` への変換は UseCase に任せる。
- 更新と削除の可否は UseCase で確認し、Service は受け取った Model と DTO を使って DB 操作を行う。
- transaction を受け取った場合は、対象となるすべての Sequelize 操作へ同じ transaction を渡す。
- DB エラーを握りつぶさず、呼び出し元へ伝播させる。
- ユーザー入力を SQL 文字列へ直接埋め込まない。

## ファイル構成

- 旧直下の単一ファイルは `<名前>/<名前>.ts` に配置し、同じフォルダ内の `test/` に対応する単体テストを置く。空のtestは.gitkeepで保持する。

- 既存機能が単一ファイル、`query.ts` / `command.ts`、または `query` / `command` ディレクトリのどれを採用しているか確認し、その構成を維持する。
- `query` には取得、件数取得、集計を配置する。
- `command` には作成、更新、削除を配置する。
- `index.ts` には再 export だけを記述する。
- 依頼に含まれないファイルの分割、統合、移動は行わない。

## コーディング規約

Service の実装は、次の規約に必ず従う。

`/docs/codingRule/backend/service.md`

既存実装と規約が矛盾する場合は規約を優先し、依頼範囲外の既存実装は変更しない。

## スコープ管理

- 現在依頼されている範囲以外は変更しない。
- 無関係なバグ、改善点、リファクタ候補はその場で修正しない。
- 作業中に見つけた対象外の問題は、ルートの `AGENTS.md` と `/docs/todo/AGENTS.md` に従って Todo に記録する。

## 単体テストの共通ルール

本節はこのディレクトリ配下の単体テストに適用する。[src/AGENTS.md](../AGENTS.md) と対象までの AGENTS.md に従い、[設計書](../../test/docs/architecture/AGENTS.md)・[レポート](../../test/docs/report/AGENTS.md)・[fixture](../../test/fixtures/AGENTS.md) の規則も参照する。

### 配置・参考例・モックの境界

- 対象の実 service を実行し、現在の import 先の Sequelize Model メソッド、インスタンスメソッド、`sequelize.query` を境界でモックする。実 DB 初期化・接続へ進まないことを確認する。
- テストは対象に最も近い `test/` に置き、単一ファイル・query/command 分割など既存構成を維持する。fixture は既存の配置と再利用範囲を確認する。共通 fixture、usecase 近傍の factory、テスト内の最小オブジェクトが混在するため、一律の移動や新設をしない。
- `vi.hoisted` と `vi.mock` で依存を置換し、`beforeEach` で履歴・実装をリセットする。標準応答とケース固有の null・reject・保留を分け、過去テストの不要なモデルモック群をそのまま複製しない。
- fixture の型は対象の `Parameters` 等から得る。Model をモックする呼出し契約だけの検証で最小 DTO・部分インスタンスを使う場合は、必要な境界に型アサーションを限定し、実 schema・Model validation を通るデータとは区別する。

参考例は目的で選び、ケース ID や機能固有条件を他 service に一律適用しない。

- 参照・optional options：[categories/test/createItem.test.ts](categories/test/createItem.test.ts)、[users/test/createItem.test.ts](users/test/createItem.test.ts)。
- 集計：[items/test/createItem.count.test.ts](items/test/createItem.count.test.ts)、[follow/test/createItem.count.test.ts](follow/test/createItem.count.test.ts)。
- 作成・戻り値：[items/command/test/createItem.test.ts](items/command/test/createItem.test.ts)、[itemEditing/test/createItemEditingCopy.test.ts](itemEditing/test/createItemEditingCopy.test.ts)。
- インスタンス削除・待機：[itemDraft/test/deleteItemDraft.test.ts](itemDraft/test/deleteItemDraft.test.ts)。
- 画像の変更通知・保存：[itemDraft/test/createItemDraft.test.ts](itemDraft/test/createItemDraft.test.ts)、[itemEditing/test/updateConfirm.test.ts](itemEditing/test/updateConfirm.test.ts)。
- 関連付き二段階取得：[items/query/test/getMyItemWithVideoSaleShipping.test.ts](items/query/test/getMyItemWithVideoSaleShipping.test.ts)。
- advisory lock・再検索：[brandAliases/test/createItemDraft.test.ts](brandAliases/test/createItemDraft.test.ts)。

### 取得・集計の呼出し契約

- 戻り値だけでなく、対象 Model、メソッド、引数、呼出し回数を確認する。主要 options は完全一致を基本とし、`where`・`attributes`・`include` の欠落や余分な項目を検出する。
- 所有者限定の取得は ID と `seller_id` 等を同じ `where` に渡すことを確認する。対象 ID・ユーザー ID に区別できる値を使う。Model モックが返す null は検索結果の伝達確認であり、実 DB の所有権絞込みを証明しない。
- 集計は対象のユーザーカラム、必要な status と `Op.in` 等の演算子、返却数値を確認する。例えば販売数とフォロワー数では条件が異なるため、他関数の条件を流用しない。
- 関連取得は関連 Model・alias・列・`required` の契約を確認する。単純参照は行の同一参照と null の伝達を検証し、service 独自の存在判定や AppError 変換を要求しない。
- transaction や attributes が optional な関数は指定あり・なしを分ける。options 自体の省略、空 options、`transaction: undefined` を含む options の違いも現在の確定契約に合わせて確認する。

### 作成・更新・削除と transaction

- `create`・`update` へ渡す data と transaction は、値の一致に加えて契約上同じオブジェクトであることを `toBe` で確認する。複数の DB 操作では全操作へ同じ transaction を渡すことを確認する。
- 戻り値は関数ごとに確認する。生成モデルを返す関数、生成 ID を返す関数、undefined を返す関数を区別し、一律にモデル参照の返却を要求しない。
- インスタンスを受け取る更新・削除は、そのインスタンスの `update`・`destroy` を確認する。不要な再検索、別 Model の作成、静的な全体削除などが実行されないことも対象の契約に応じて検証する。
- 画像配列等は `setDataValue` の項目・値、`changed(<項目>, true)`、`save({ transaction })` の順序を確認する。空配列と複数要素、要素順、同じ配列の引渡しを対象に応じて検証し、save 完了待ちと例外伝播も確認する。
- service が transaction を受け取る契約と、usecase が開始・commit・rollback を管理する責務を分ける。単体 service テストで transaction の実終了まで保証しない。

### ロック・二段階取得・非同期と失敗

- ロック対象の検索条件、`transaction.LOCK.UPDATE` 等の指定、同じ transaction を確認する。transaction なしの経路がある場合は、ロックや追加検索の有無を別ケースにする。
- 二段階取得は、対象行だけのロック取得後に関連付き再取得へ進むこと、両検索の所有者条件・取得列・関連・transaction を検証する。最初の取得が null なら後続未実行、再取得が null ならそのまま返却する等、各段階の契約を分ける。全取得へ一律に lock を要求しない。
- advisory lock を使う関数では、固定 SQL と bind 値、ロック完了後の再検索、既存行の再利用または作成、各操作の transaction を確認する。transaction なしでは同じ再検索・重複防止があると仮定しない。
- 非同期の依存を段階ごとに reject／保留する。元の Error は `rejects.toBe(error)` で同一性を確認し、失敗後の後続検索・作成・再試行がないことを契約に応じて確認する。
- 待機契約は呼出し順の assert だけで終えず、deferred Promise で前段を保留し、後続未実行・service 未完了と解放後の結果を確認する。固定 sleep に依存せず、reject の回収を先に登録し、`try/finally` で gate を解放して開始した処理を回収する。

### 敵対的ケースと保証の限界

- 所有者の取り違え、status 条件の欠落、ロック後の再取得 null、既存行出現、各依存先の途中失敗・保留、空配列や順序の異なる更新値など、対象の責務に応じて不利な条件を検討する。確定契約に基づく期待値と、仕様未確定の観測を分け、新しい業務制約や service 独自の検証処理を発明しない。
- ValidationError をモデルモックから返したケースは伝播の確認に限る。実 Model validation、DB 制約、SQL の有効性・結果、実ロック待ち、重複排除、永続化・commit/rollback の成立を検証済みとしない。
- 実 DB の保存・制約・競合を確認する場合は integration へ分け、[DB 結合テスト](../../test/integration/database/AGENTS.md) と fixture の規則を適用する。単体の呼出し契約と実 DB の結果を設計書・レポートで区別する。
