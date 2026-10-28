# フロントエンドテスト

パスはリポジトリルートを基準とする。ページ大分類はページ機能領域（例：`item`）、ページ小分類は対象のページ（例：`itemDraftPage`）、コンポーネント分類は対象のコンポーネント機能（例：`editButton`）、E2E分類は対象の機能のフロントからバックエンド、DBを含む機能全体の名称（例：`createItemEditingDraft`）を表す。

## ディレクトリ構成

### 単体テスト

単体テストは `client/src` 配下の対象本番コードに最も近いディレクトリに `test` を設け、その配下に置く。対象本番コードが専用ディレクトリにある場合は、そのディレクトリ内に `test` を設ける。

例：

| 本番コード | 単体テストの配置先 |
| ---------- | ------------------ |
| `client/src/app/item/draft/editButton.tsx` | `client/src/app/item/draft/test/` |
| `client/src/app/item/draft/api/client.ts` | `client/src/app/item/draft/api/test/` |
| `client/src/components/follow-button/followButton.tsx` | `client/src/components/follow-button/test/` |

### コンポーネント結合テスト

コンポーネント結合テストは `client/test/integration/components/<ページ大分類>/<ページ小分類>/<コンポーネント分類>/` に置く。ファイルの主な検証対象に合わせて役割を選び、ページ大分類・ページ小分類・コンポーネント分類（あれば）までディレクトリを分ける。

### ページ結合テスト

ページ結合テストは `client/test/integration/pages/<ページ大分類>/<ページ小分類>/` に置く。ファイルの主な検証対象に合わせて役割を選び、ページ大分類・ページ小分類（あれば）までディレクトリを分ける。

### E2Eテスト

E2Eテストは `test/E2E/<ページ大分類>/<ページ小分類>/<E2E分類>/` に置く。ファイルの主な検証対象に合わせて役割を選び、ページ大分類・ページ小分類・E2E分類（あれば）までディレクトリを分ける。

### fixture・setup

fixture とテスト用 setup は `client/test/fixtures/<ページ大分類>/<ページ小分類>/` に置く。`client` などの中間ディレクトリは挟まない。

例：`client/test/fixtures/item/itemDraftPage/` に `fixtures.ts`、`setup.ts` を置く。

### ドキュメント

ドキュメントは設計書・報告書など種類ごとにディレクトリを分ける。テストの新規作成・既存テスト利用に関わらず、単体テストからE2Eテストまでの内容を一貫してページごとに記載する。例外としてコンポーネント結合テストのみの場合もある。

ページ大分類をディレクトリ名、ページ小分類をMarkdownのファイル名にする。コンポーネント結合テストのみの場合も、対象ページのファイルにまとめる。

| 種類 | 配置先 | 配置例 |
| ---- | ------ | ------ |
| テスト設計書 | `client/test/docs/architecture/<ページ大分類>/<ページ小分類>.md` | `client/test/docs/architecture/item/itemDraftPage.md` |
| テストレポート | `client/test/docs/report/<ページ大分類>/<ページ小分類>.md` | `client/test/docs/report/item/itemDraftPage.md` |

修正・再検証のレポートも、同じページのテストレポートにまとめる。

### 構成例

```text
client/
├── src/
│   └── app/item/draft/
│       ├── itemDraftPage.tsx
│       ├── editButton.tsx
│       ├── test/
│       │   └── editButton.test.tsx
│       └── api/
│           ├── client.ts
│           └── test/
│               └── client.test.ts
└── test/
    ├── integration/
    │   ├── components/item/itemDraftPage/editButton/
    │   └── pages/item/itemDraftPage/
    ├── fixtures/
    │   └── item/itemDraftPage/
    │       ├── fixtures.ts
    │       └── setup.ts
    └── docs/
        ├── architecture/item/itemDraftPage.md
        └── report/item/itemDraftPage.md
test/
└── E2E/
    └── item/itemDraftPage/createItemEditingDraft/
```
