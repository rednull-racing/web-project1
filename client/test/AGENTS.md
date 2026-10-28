# フロントエンドテスト

パスはリポジトリルートを基準とする。ページ大分類はページ機能領域（例：`item`）、ページ小分類は対象のページ（例：`itemDraftPage`）、コンポーネント分類は対象のコンポーネント機能（例：`editButton`）、E2E分類は対象の機能のフロントからバックエンド、DBを含む機能全体の名称（例：`createItemEditingDraft`）を表す。

## ディレクトリ構成

### 単体テスト

単体テストは `client/src` 配下の対象本番コードに最も近いディレクトリに `test` を設け、その配下に置く。対象本番コードが専用ディレクトリにある場合は、そのディレクトリ内に `test` を設ける。

例：

| 本番コード                                                  | 単体テストの配置先                                   |
| ------------------------------------------------------ | ------------------------------------------- |
| `client/src/app/item/draft/editButton.tsx`             | `client/src/app/item/draft/test/`           |
| `client/src/app/item/draft/api/client.ts`              | `client/src/app/item/draft/api/test/`       |
| `client/src/components/follow-button/followButton.tsx` | `client/src/components/follow-button/test/` |

### コンポーネント結合テスト

コンポーネント結合テストは `client/test/integration/components/<ページ大分類>/<ページ小分類>/<コンポーネント分類>/` に置く。対象ページとコンポーネントに合わせてディレクトリを分ける。

### ページ結合テスト

ページ結合テストは `client/test/integration/pages/<ページ大分類>/<ページ小分類>/` に置く。対象ページに合わせてディレクトリを分ける。

### E2Eテスト

E2Eテストは `test/E2E/<ページ大分類>/<ページ小分類>/<E2E分類>/` に置く。対象ページと機能全体のシナリオに合わせてディレクトリを分ける。

### fixture・setup

ページ固有のfixtureとテスト用setup は `client/test/fixtures/<ページ大分類>/<ページ小分類>/` に置く。`client` などの中間ディレクトリは挟まない。

例：`client/test/fixtures/item/itemDraftPage/` に `fixtures.ts`、`setup.ts` を置く。

### ドキュメント

ドキュメントは設計書・報告書など種類ごとにディレクトリを分ける。テストの新規作成・既存テスト利用に関わらず、単体テストからE2Eテストまでの内容を一貫してページごとに記載する。例外としてコンポーネント結合テストのみの場合もある。

ページ大分類をディレクトリ名、ページ小分類をMarkdownのファイル名にする。コンポーネント結合テストのみの場合も、対象ページのファイルにまとめる。

| 種類             | 配置先                                                              | 配置例                                                   |
| -------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| テスト設計書         | `client/test/docs/architecture/<ページ大分類>/<ページ小分類>.md`             | `client/test/docs/architecture/item/itemDraftPage.md` |
| テストレポート        | `client/test/docs/report/<ページ大分類>/<ページ小分類>.md`                   | `client/test/docs/report/item/itemDraftPage.md`       |

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

---

## フロントエンドのテスト全体像

| テスト階層           | 検証範囲                                | 実行環境・依存先                                                       |
| --------------- | ----------------------------------- | -------------------------------------------------------------- |
| E2Eテスト（システムテスト） | ブラウザー操作から画面遷移・API処理・永続化までの機能全体      | 実ブラウザー → Next.js → Express → テスト用PostgreSQL                    |
| ページ結合テスト        | ページを構成する複数コンポーネント、表示・操作・APIレスポンスの連携 | Vitest + jsdom。HTTP通信はMSWで置き換える。実ブラウザーが必要な場合はPlaywright        |
| コンポーネント結合テスト    | 親子コンポーネント、フォーム、状態管理、イベントの連携         | Vitest + React Testing Library + jsdom。HTTP通信がある場合はMSW         |
| 単体テスト           | 関数、Hooks、個別UIコンポーネント、バリデーション        | Vitest。DOMを使う対象はReact Testing Library + jsdom、DOMが不要な処理はNode環境 |

上に進むほど実際のユーザー操作に近づき、実行コストや環境依存が増える傾向がある。

---

## フロントエンド特有のテスト観点

| テスト観点            | 主な確認内容                                 |
| ---------------- | -------------------------------------- |
| 正常系              | 正しい入力・操作で期待どおり動く                       |
| 異常系              | APIエラー、不正入力、通信障害                       |
| 境界値              | 文字数、数値、ファイルサイズ、件数                      |
| UI表示             | 条件分岐、テキスト、画像、表示状態                      |
| ユーザー操作           | クリック、入力、選択、ドラッグ                        |
| 状態管理             | state更新、初期化、リセット                       |
| 非同期処理            | Loading、通信完了、通信失敗                      |
| 並行処理             | 二重送信、連続操作、リクエスト競合                      |
| 状態遷移             | 編集→確認→保存→完了                            |
| ナビゲーション          | ページ遷移、戻る、リロード                          |
| レスポンシブ           | PC、タブレット、スマホ                           |
| アクセシビリティ         | キーボード、ラベル、フォーカス                        |
| セキュリティ           | XSS、認証切れ、機密情報の露出                       |
| パフォーマンス          | 描画速度、再レンダリング、画像読込                      |
| ブラウザ互換性          | Chromium、Firefox、WebKit                |
| SSR・Hydration    | サーバー描画とクライアント描画の整合性                    |

---

## テストツール

以下をフロントエンドテストで使用する。導入時は `client/package.json` の開発依存関係として追加し、既存のNext.js・React・Node.jsとの互換性を確認してバージョンを固定する。現時点ではテストツールと実行設定は未導入であり、この文書の記載だけで実行可能になったものとはみなさない。

| ツール・パッケージ                                                              | 用途                                                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Vitest（`vitest`）                                                       | 単体・コンポーネント結合・DOM上のページ結合テストの実行、アサーション、モック                               |
| React Testing Library（`@testing-library/react`、`@testing-library/dom`） | コンポーネント・Hooksの描画と、利用者から見たDOMの検証                                        |
| `@testing-library/user-event`                                          | クリック、入力、キーボードなどのユーザー操作                                                 |
| `@testing-library/jest-dom`                                            | DOM専用マッチャー。Vitest用setupで `@testing-library/jest-dom/vitest` を読み込む      |
| `jsdom`                                                                | Vitestで使うDOM環境。実際のレイアウト・描画やブラウザー互換性の検証はPlaywrightで行う                   |
| Mock Service Worker（`msw`）                                             | 単体・結合テストのHTTP通信をリクエスト単位で置き換え、成功・エラー・遅延を再現                              |
| Playwright Test（`@playwright/test`）                                    | 実ブラウザー上のページ結合・E2Eテスト。Chromium・Firefox・WebKit、画面幅、画面遷移、SSR・Hydrationを検証 |
| `@vitejs/plugin-react`、`vite-tsconfig-paths`                           | Vitest設定でReactとTypeScriptのパスエイリアスを扱う                                   |

### テスト階層とツールの使い分け

- Vitestでは同期Server ComponentとClient Componentを対象とする。非同期Server Component、Next.jsの実ルーティング、SSR・Hydrationは、Next.jsを起動してPlaywrightで検証する。Server ComponentをClient Componentへ変更してテストに合わせない。
- DOM上のページ結合テストで `next/navigation` などをモックした場合は、遷移要求の引数までを検証範囲とする。実際の遷移・戻る・リロードはPlaywrightで検証する。
- Playwrightを使うページ結合テストはHTTP通信を `page.route()` などで置き換え、DBを検証対象に含めない。`page.route()` はブラウザー発の通信のみを対象とするため、Server ComponentなどNext.jsサーバー発のHTTP通信はテスト用APIサーバーなどで置き換える。E2EはNext.js・Express・テスト用DBを接続し、対象の業務APIをモックしない。外部サービスを置き換えた場合は設計書・レポートに記録する。
- SWRのキャッシュ、モック、イベント、タイマー、fixtureはテスト間で共有状態が残らないよう初期化・後片付けする。MSWでは未定義の対象APIへの通信を失敗として扱う。
- UIはrole・ラベル・表示テキストから取得し、非同期更新は非同期クエリや待機アサーションで確認する。固定時間の待機や内部stateへの直接依存を避ける。

### 導入時の設定・実行規則

- Vitestの設定は `client/vitest.config.mts`、Playwrightの設定は `client/playwright.config.ts` に置く。共通setupは `client/test/fixtures/setup.ts` とし、ページ固有のfixture・setupは前述のページ別ディレクトリに置く。
- Vitestは `client/src/**/test/` と `client/test/integration/` の `*.test.ts`・`*.test.tsx` を対象とする。Playwrightのページ結合テストは `client/test/integration/pages/` の `*.spec.ts`、E2Eは `test/E2E/` の `*.spec.ts` とし、両ランナーの収集対象を分離する。
- `client/package.json` に `test:unit`、`test:integration`、`test:pages:browser`、`test:e2e` を用意する。Vitestは `vitest run` で単体・結合の対象を分離し、Playwrightはページ結合・E2Eのprojectを分ける。E2Eディレクトリは設定ファイルから見て `../test/E2E/` に指定する。
- 導入後は `client` で `npm run test:unit`、`npm run test:integration`、`npm run test:pages:browser`、`npm run test:e2e` のうち変更範囲に必要なものを実行し、`npm run lint` と `npm run typecheck` も確認する。未導入のスクリプトを実行済みとして報告しない。
- Playwrightはテスト用環境を使用し、本番相当の `next build`・`next start` で確認する。E2EではExpress・テスト用DBの起動とデータの準備・後片付けを実行条件に含める。マイグレーションは実行しない。
- 設計書・レポートには対象階層、実行コマンド、環境、モック範囲、結果、未実施項目とその理由を記載する。自動テストだけでアクセシビリティ全般や体感性能を保証したものとはみなさない。

### 公式資料

- [Next.js：Vitest](https://nextjs.org/docs/app/guides/testing/vitest)
- [Next.js：Playwright](https://nextjs.org/docs/app/guides/testing/playwright)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [user-event](https://testing-library.com/docs/user-event/intro/)
- [jest-dom：Vitest連携](https://github.com/testing-library/jest-dom#with-vitest)
- [MSW](https://mswjs.io/docs/)

---

## テスト観点 × テスト階層の対応表

記号は ◎＝重点的に実施、○＝必要に応じて実施、—＝通常は対象外。

| テスト観点            | 単体   | コンポーネント結合 | ページ結合      | E2E |
| ---------------- | ---- | --------- | ---------- | --- |
| 正常系              | ◎    | ◎         | ◎          | ◎   |
| 異常系              | ◎    | ◎         | ◎          | ○   |
| 境界値              | ◎    | ○         | ○          | —   |
| UI表示             | ◎    | ◎         | ◎          | ○   |
| ユーザー操作           | ○    | ◎         | ◎          | ◎   |
| 状態管理             | ◎    | ◎         | ◎          | ○   |
| 非同期処理            | ○    | ◎         | ◎          | ○   |
| 並行処理             | ○    | ◎         | ◎          | ○   |
| 状態遷移             | ○    | ◎         | ◎          | ◎   |
| ナビゲーション          | —    | ○         | ◎          | ◎   |
| API連携            | —    | ◎         | ◎          | ◎   |
| DB整合性            | —    | —         | —          | ◎   |
| SSR・Hydration    | —    | —         | ○          | ◎   |
| レスポンシブ           | —    | ○         | ○          | ◎   |
| アクセシビリティ         | ○    | ◎         | ◎          | ○   |
| セキュリティ           | ○    | ○         | ◎          | ◎   |
| パフォーマンス          | ○    | ○         | ○          | ◎   |
| ブラウザ互換性          | —    | —         | ○          | ◎   |

この表はテスト設計上の優先度の目安であり、必須件数や対象外の制約ではない。対象機能のリスクに応じて選ぶ。ページ結合でSSR・Hydration、レスポンシブ、ブラウザー互換性を検証する場合はPlaywrightを使用する。
