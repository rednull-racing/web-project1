# /item-list 共通コンポーネント概要

## ItemImage

`itemImage.tsx`。商品画像を1枚（first_image_url）を表示する。商品画像の左上に `SOLD OUT` を表示する場合もある。

## ItemPrice

`itemPrice.tsx`。商品の値段を表示する。セール情報を表示する場合もある。

## Pagination

`pagination.tsx`。商品リストのページネーション。

## SearchField

`searchField.tsx`。検索インプット・検索ボタン。

---

## デザイン・CSS

`listParts.module.css`。4コンポーネントすべて共通でこのファイルにcssを書き込む。

インポート例:

```ts
import styles from "./listParts.module.css";
```
