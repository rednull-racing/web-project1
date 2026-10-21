# マイグレーション作成ルール

## 基本方針

- `/server/src/models` の Model 定義を唯一の正とする。
- migration は Model に忠実に作成し、型・NULL 制約・初期値・一意制約・外部キー制約を漏れなく反映する。
- Model に存在しない制約や仕様を独自判断で追加しない。
- migration 作成のために Model を変更しない。
- 既存の migration ファイルを参照し、命名・記述形式・制約名を統一する。
- CommonJS ではなく ESM 形式の `export default` で記述する。
- `up` と `down` の両方を必ず実装する。
- migration を実行する場合は、特別な指示がない限り、実 DB とテスト DB の両方に適用する。

## Model から反映する項目

以下の定義を必ず確認し、migration へ反映する。

- `type`
- `allowNull`
- `defaultValue`
- `unique`
- `references`
- `onUpdate`
- `onDelete`
- `primaryKey`
- `autoIncrement`

外部キーの削除・更新ルールが Model だけでは判断できない場合は、同じ役割を持つ既存の Model および migration を参照する。独自判断で決定しない。

## createdAt / updatedAt

`timestamps: true` は ORM の動作設定であるため、テーブル作成 migration では `createdAt` と `updatedAt` を明示的に定義する。

```js
createdAt: {
    allowNull: false,
    type: Sequelize.DATE,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
},
updatedAt: {
    allowNull: false,
    type: Sequelize.DATE,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
},
```

## トランザクション

1 つの migration 内で複数のテーブル・カラム・制約を変更する場合は、原則として transaction 内で実行する。

`up` または `down` の途中で失敗した場合に、一部の変更だけが DB へ残らないようにする。

## down の方針

- `down` では `up` の処理を逆順で元に戻す。
- 外部キー制約がある場合は、必要に応じて制約を先に削除してからカラムやテーブルを削除する。
- `up` で追加したテーブル・カラム・制約を漏れなく削除する。
- `up` で削除したカラムを復元する場合は、削除前と同じ定義を使用する。

## 禁止事項

- `sequelize.sync()` の実行
- DB の初期化、リセット、データ削除
- Model に存在しない制約の追加
- 依頼されていない Model や既存 migration の変更
- 既存 migration ファイルの書き換え
- `up` のみの実装
- CommonJS 形式での作成

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
