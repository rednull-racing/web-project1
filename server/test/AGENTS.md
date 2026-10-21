# テスト関連ファイルのディレクトリ構成

パスはリポジトリルートを基準とする。大分類は機能領域（例：`itemEditing`）、小分類は対象の処理（例：`createItemEditingDraft`）を表す。

## テスト手順の参照

- 作業開始前に [APIテストスキル](../../.agents/skills/api-test/SKILL.md) を読み、適用範囲とテスト設計・実装・実行・修正・報告の手順を確認する。
- 中断条件・完了条件も参照し、実行範囲はユーザーが依頼した工程に限定する。

## 単体テスト

単体テストは `server/src` 配下の対象本番コードに最も近いディレクトリに `test` を設け、その配下に置く。対象本番コードが専用ディレクトリにある場合は、そのディレクトリ内に `test` を設ける。

例：

| 本番コード | 単体テストの配置先 |
| --- | --- |
| `server/src/usecases/itemEditing/createItemEditingDraft.ts` | `server/src/usecases/itemEditing/test/` |
| `server/src/usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.ts` | `server/src/usecases/itemEditing/createItemEditingCopy/test/` |
| `server/src/controllers/itemEditing/itemEditing.ts` | `server/src/controllers/itemEditing/test/` |
| `server/src/services/itemEditing/command.ts` | `server/src/services/itemEditing/test/` |
| `server/src/validators/body/itemEditing.ts` | `server/src/validators/body/test/` |

## 結合テスト

結合テストは `server/test/integration/<役割>/<大分類>/<小分類>/` に置く。ファイルの主な検証対象に合わせて役割を選び、大分類・小分類までディレクトリを分ける。

| 役割 | 配置するテスト | 配置例 |
| --- | --- | --- |
| `database` | 永続化・DB制約などの結合テスト | `server/test/integration/database/itemEditing/createItemEditingDraft/` |
| `usecases` | usecaseのtransaction・並行処理・HTTP接続などの結合テスト | `server/test/integration/usecases/itemEditing/createItemEditingDraft/` |
| `services` | serviceの結合テスト | `server/test/integration/services/<大分類>/<小分類>/` |

## fixture・setup

fixture とテスト用 setup は `server/test/fixtures/<大分類>/<小分類>/` に置く。`backend` などの中間ディレクトリは挟まない。

例：`server/test/fixtures/itemEditing/createItemEditingDraft/` に `databaseFixtures.ts`、`databaseSetup.ts` を置く。

## ドキュメント

ドキュメントは種類ごとに分け、大分類をディレクトリ名、小分類をMarkdownのファイル名にする。

| 種類 | 配置先 | 配置例 |
| --- | --- | --- |
| テスト設計書 | `server/test/docs/architecture/<大分類>/<小分類>.md` | `server/test/docs/architecture/itemEditing/createItemEditingDraft.md` |
| テストレポート | `server/test/docs/report/<大分類>/<小分類>.md` | `server/test/docs/report/itemEditing/createItemEditingDraft.md` |

修正・再検証のレポートも、同じ小分類のテストレポートにまとめる。

## 構成例

```text
server/
├── src/
│   └── usecases/
│       └── itemEditing/
│           ├── createItemEditingDraft.ts
│           └── test/
│               └── createItemEditingDraft.test.ts
└── test/
    ├── integration/
    │   ├── database/itemEditing/createItemEditingDraft/
    │   ├── usecases/itemEditing/createItemEditingDraft/
    │   └── services/<大分類>/<小分類>/
    ├── fixtures/
    │   └── itemEditing/createItemEditingDraft/
    └── docs/
        ├── architecture/itemEditing/createItemEditingDraft.md
        └── report/itemEditing/createItemEditingDraft.md
```
