# /item-list 共通コンポーネント概要

## ItemImage

- `itemImage.tsx`。`data`（`first_image_url`・`status`）と `showSold` を受け取り、商品画像を1枚表示する。
- `next/image` を使用し、幅・高さにそれぞれ `80`、代替テキストに「商品画像」を指定する。
- `first_image_url` は `string | null`。空文字やnullなら、`/no-image(1x1).png` を表示する。
- `status` の型は `"active" | "soldout" | null`。`showSold` が真かつ `status === "soldout"` の場合だけ、画像左上に `SOLD` を重ねる。
- ラッパー・画像・売切れ表示には、それぞれ `imageDiv`・`image`・`sold` / `soldP` のスタイルを適用する。
- 状態管理やAPI通信は行わず、親から渡された値に従って描画する。

## ItemPrice

- `itemPrice.tsx`。`data`（価格・セール情報）と `showSale` を受け取り、商品価格を表示する。
- 現在価格 `price` は `number | string` を受け取る。数値と数値文字列はja-JPの桁区切りで整形し「円」を付ける（例：`1,200円`）。表示用文字列「-」等はそのまま表示する。nullは受け付けず、draftの呼出し側だけがnullを「-」へ変換する。
- `showSale` と `data.sale_flag` がともに真の場合だけ、変更前価格と割引情報の表示領域を追加する。
- 変更前価格 `before_price` も数値・数値文字列を同じ通貨形式に整形して `beforePrice` スタイルで表示する。
- `discount_rate > 0` の場合は、整形した割引率に `% OFF` を付けて表示する。
- `discount_amount > 0` の場合は、整形した割引額に「円引き」を付けて表示する。割引率と割引額の両条件が成立すれば両方表示する。
- 価格や割引の再計算は行わず、親から渡された値を表示用に数値化・整形する。割引率と割引額も数値文字列を許容する。レイアウトには `priceColumn`、現在価格には `price`、割引には `sale` を適用する。

## Pagination

- `pagination.tsx`。Client Componentとして、`currentPage`・`totalPages`・`onPageChange` を受け取る。
- `totalPages <= 1` の場合は `null` を返し、ページネーションを表示しない。
- 描画時に `window.innerWidth >= 768` なら現在ページの前後2件、それ以外（サーバー描画時を含む）は前後1件を周辺ページの表示範囲とする。
- 先頭・最終ページを表示し、その間のページ番号は `2` から `totalPages - 1` の範囲で生成する。
- 周辺ページと先頭・最終ページの間に省略するページがある場合は、クリック操作のない `...` を挿入する。
- ページ番号を押すと、その番号を `onPageChange` に渡す。現在ページには `active` スタイルを追加する。
- 「前へ」「次へ」はFont Awesomeのアイコンを使い、前後のページ番号を `1` から `totalPages` に収めて通知する。先頭では「前へ」、最終では「次へ」を無効化する。
- ページ状態の更新やデータ取得は親に委ねる。画面幅の変更を監視する処理はなく、表示範囲は描画時の幅で決まる。

## SearchField

- `searchField.tsx`。Client Componentとして、`searchValue`・`onChange`・`onSubmit` を受け取る。
- テキスト入力の `value` に `searchValue` を設定する制御コンポーネントで、入力値の状態は親が管理する。
- 入力欄の変更イベントは、渡された `onChange` にそのまま委ねる。
- 入力欄は `name="itemList_search"`、プレースホルダーは「検索」とし、`autoComplete="off"` を指定する。
- 入力欄でEnterキーを押すと、引数なしで `onSubmit()` を呼び出す。
- Font Awesomeの検索アイコンをクリックした場合も、引数なしで `onSubmit()` を呼び出す。
- `searchValue.trim()` が空でない場合だけアイコンに `activeIcon` を追加する。この判定は見た目にのみ使い、空文字での送信を制限したり入力値を加工したりしない。
- 検索APIの呼出しや検索条件・ページの更新は親に委ね、自身では行わない。

---

## デザイン・CSS

`listParts.module.css`。4コンポーネントすべて共通でこのファイルにcssを書き込む。

インポート例:

```ts
import styles from "./listParts.module.css";
```
