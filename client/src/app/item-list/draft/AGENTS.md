# /item-list/draftページ

## 概要

下書き商品のリストを作成日が新しいほうから順に表示する。20件ずつAPIで下書き商品データを取得する。商品の検索、削除ボタンによる下書き商品削除も可能。

---

## 各コンポーネントの役割

### コンポーネント構成図

図中のパスは `client/src/app/item-list/draft` を基準とする。実線は包含関係、点線は操作先を示す。

```mermaid
flowchart TD

```

### Page

`page.tsx`。

### DraftItem

`draftItem.tsx`。

### DraftItemList

`draftItemList.tsx`。

### RemoveFloat

`removeFloat.tsx`。

---

## API

`api/client.ts`。

### GetListUrl

### fetchRemoveItem

### 表示データの型

`../types.ts`の`ItemDraft`を使用。

---

## デザイン・CSS

### DraftItem・DraftItemList CSS

インポート例：

```ts
import styles from "./draftItemList.module.css";
```


### RemoveFloat CSS

インポート例：

```ts
import styles from "./removeFloat.module.css";
```