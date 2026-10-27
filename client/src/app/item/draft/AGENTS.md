# /item/draftページ

## 概要

下書き商品データ（`ItemDraft`）を使い、下書き保存した編集中の商品の内容を確認するページ。

この文書では `draft` 配下のページ・専用コンポーネント・API・CSSを説明する。共有コンポーネントは構成図の参照先として示し、詳細は各配置先のAGENTS.mdで扱う。

---

## 各コンポーネント役割

### コンポーネント構成図

図中のパスは `client/src/app/item/` を基準とする。実線はコンポーネントの包含関係、点線は操作による参照先を示す。HTML要素は構造の説明に必要なものだけ記載する。

#### ページ全体

```mermaid

```

両ルートはセッション・所有者を確認し、`draft/api/server.ts` の `fetchItemDraftPage` で取得した `itemEditing` と `id`、`page` を渡す。現行コードでは両ルートとも `page="normal"` を指定している。`ItemDraftPage` は `attributes.inventory?.current === 0` で `soldout` を算出し、両セクションへ渡す。

#### 動画セクション

```mermaid

```

子コンポーネントはすべて `/item/videoSection` の共有部品を使用する。`VideoElem` は `normalPage={false}`、`Summary` は `page="draft"`・`itemId: null` で表示する。

#### 商品セクション

```mermaid

```

子コンポーネントはすべて `/item/itemSection` の共有部品を使用する。`ItemHeader` と `Detail` は `page="draft"` で表示し、`Detail` の `itemId` は `null`。商品名・価格の表示は `ItemHeader` に委ねる。価格が`null`の場合は`price="-"`を表示する。共有部品内の表示条件の詳細は、配置先の文書で扱う。

#### 編集・削除操作

```mermaid

```

### ItemDraftPage

### VideoSection

### ItemSection

### EditButton

### DeleteItemDraft・削除確認ポップアップ

---

## API

APIパスは共通fetch関数へ渡す相対パスを記載する。URLの `id` は商品編集IDであり、作成・更新APIが返す `itemId` とは区別する。

### SSR 商品編集データ取得

### CSR 商品作成・更新API

### 表示データの型

`draft/types.ts` に `ItemDraft` と関連する選択肢・カテゴリー等の型を定義する。商品・動画・セール情報は `ItemDraft` の各フィールド、バリエーションや在庫等は共通の `ItemAttributes` 型を使用する。画面用の `page` はルートから渡す。

---

## デザイン・CSS

### draftページ専用CSS。

`draft` 直下のファイルからのインポート例：

```ts
import styles from "./draft.module.css";
```

### itemページ共通CSSの利用

`item/itemCommon.module.css` を `ItemDraftPage`・`VideoSection`・`ItemSection` から参照する。`main2column` は画面幅768px以上で動画側と商品側を6:4の比率で横並びにし、それ未満では通常の縦並びとなる。

`draft` 直下のファイルからのインポート例：

```ts
import CStyles from "../itemCommon.module.css";
```

共有コンポーネント内部のスタイルは各配置先で管理する。
