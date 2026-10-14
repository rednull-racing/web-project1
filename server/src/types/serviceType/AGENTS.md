# serviceType/AGENTS.md

## 対象

このディレクトリ内の Service 用型定義を作成・修正する場合に適用する。

## このディレクトリの役割

`/server/src/services` の関数で使用するパラメータ型を定義する。

主に以下の型を配置する。

- 検索条件や ID を受け取るパラメータ型
- 作成・更新データを受け取るパラメータ型
- Sequelize の `Transaction`、`WhereOptions`、`Order` を含むパラメータ型
- Service が受け取る Model インスタンスの型
- Service の関連取得結果を表す共有型

## ファイル構成

- 対応する Service の機能単位でファイルを分ける。
- ファイル名は既存の Service と型ファイルの対応に合わせる。
- 1 つの Service ファイル内だけで使用する型は、Service 側へ定義する。
- 複数の Service または UseCase で共有する Service 用型をこのディレクトリへ配置する。
- HTTP リクエスト、レスポンス、Validator の schema、業務ロジックを定義しない。

## コーディング規約

Service 用型の実装は、次の規約に必ず従う。

`/docs/codingRule/backend/type.md`

## スコープ管理

- 現在依頼されている範囲以外は変更しない。
- 依頼に含まれない既存型の移動、統合、命名変更は行わない。
- 対象外の問題は、ルートの `AGENTS.md` と `/docs/todo/AGENTS.md` に従って Todo に記録する。
