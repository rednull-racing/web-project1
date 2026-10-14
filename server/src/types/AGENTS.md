# types/AGENTS.md

## 対象

このディレクトリ内の型定義を作成・修正する場合に適用する。

## このディレクトリの役割

複数のファイルや層で共有する TypeScript の型を配置する。

`/server/src/types` 直下には、主に以下を配置する。

- DB に保存する Snapshot や JSON の共有型
- 複数機能で使用するドメイン型
- 型と実行時処理で共有する定数
- Express や外部モジュールを拡張する `.d.ts`

1 ファイル内だけで使用する型は、使用するファイル内に定義する。

## ファイルの配置

- 型が表すデータや責務ごとにファイルを分ける。
- 既存の Snapshot、商品属性、共通データ型は、対応する直下の型ファイルへ配置する。
- Express や外部モジュールの型拡張は、対象が分かる `.d.ts` へ配置する。
- Service のパラメータ型と取得結果型は `/server/src/types/serviceType` へ配置する。
- 依頼に含まれない既存型の移動、統合、分割、命名変更は行わない。

## serviceType

`/server/src/types/serviceType` を作成・修正する場合は、次の指示に従う。

`/server/src/types/serviceType/AGENTS.md`

## コーディング規約

型定義の実装は、次の規約に必ず従う。

`/docs/codingRule/backend/type.md`

詳細な命名、構成、型安全性、宣言ファイル、Service 用型のルールはコーディング規約を参照する。

## スコープ管理

- 現在依頼されている範囲以外は変更しない。
- 無関係なバグ、改善点、リファクタ候補はその場で修正しない。
- 対象外の問題は、ルートの `AGENTS.md` と `/docs/todo/AGENTS.md` に従って Todo に記録する。
