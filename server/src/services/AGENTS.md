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

本節はこのディレクトリ配下の単体テストに適用する。上位の [src/AGENTS.md](../AGENTS.md) の単体テスト共通ルールと、対象までのAGENTS.mdを読む。対象本番コードに最も近いtestへ配置し、fixtureはserver/test/fixturesの大分類/小分類に置く。

- 実serviceを実行し、Sequelizeモデルメソッド・DB queryを境界でモックする。引数・where・attributes・include・lock・transaction・呼出し回数・必要な順序と戻り値/参照を確認する。
- 所有者を条件に含む取得はIDとuser_id等の組合せ、作成・更新はdataと同じtransactionの引渡し、画像等の保存は変更フラグ・saveの順序を検証する。
- 元の例外の同一参照、Promise完了待ち、失敗時の後続未実行を確認する。ロック指定やSQL呼出しを確認しただけで実ロック待ち・commit/rollback・DB制約の効果を保証しない。
- 実DBでの保存・制約・transactionの結果はintegrationの対象へ分け、DB結合テストとfixtureのルールを適用する。
