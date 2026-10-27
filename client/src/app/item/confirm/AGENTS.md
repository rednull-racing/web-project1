# /item/confirmページ

## 概要

商品アップロード時の入力内容確認ページ。

### /item/confirm/[id]

新規出品する商品の入力内容を確認する。

### /item/confirm/edit/[id]

出品中商品の更新する商品情報を確認する。

## 各コンポーネント役割

### コンポーネント構成図

図中のパスは `client/src/app/item/` を基準とする。実線はコンポーネントの包含関係、点線は操作による参照先を示す。HTML要素は構造の説明に必要なものだけ記載する。

#### ページ全体

```mermaid
flowchart TD
    Normal["/item/confirm/[id]<br/>confirm/[id]/page.tsx"]
    Edit["/item/confirm/edit/[id]<br/>confirm/edit/[id]/page.tsx"]
    Page["ItemConfirmPage<br/>confirm/itemConfirmPage.tsx"]
    Container["Container（共通）<br/>@/components"]
    Title["Title<br/>confirm/title.tsx"]
    Back["Back（共通）<br/>@/components"]
    Main["main：動画・商品情報の2カラム"]
    Video["VideoSection<br/>confirm/videoSection.tsx"]
    Item["ItemSection<br/>confirm/itemSection.tsx"]
    Upload["UploadButton<br/>confirm/uploadButton.tsx"]

    Normal --> Page
    Edit --> Page
    Page --> Container
    Container --> Title
    Container --> Back
    Container --> Main
    Main --> Video
    Main --> Item
    Container --> Upload
```

両ルートはセッション・所有者を確認し、`confirm/api/server.ts` の `fetchItemConfirmPage` で取得した `itemEditing` と `id`、`page` を渡す。現行コードでは両ルートとも `page="normal"` を指定している。`ItemConfirmPage` は `attributes.inventory?.current === 0` で `soldout` を算出し、両セクションへ渡す。

#### 動画セクション

```mermaid
flowchart TD
    Video["VideoSection<br/>confirm/videoSection.tsx"]
    Elem["VideoElem<br/>videoSection/videoElem.tsx<br/>動画再生"]
    Title["VideoTitle<br/>videoSection/videoTitle.tsx<br/>動画タイトル"]
    Peek["ItemPeek<br/>videoSection/itemPeek.tsx<br/>商品画像・商品名・価格・対象性別/年齢"]
    Date["保存日時（HTML要素）<br/>updatedAt を formatRelativeTime で整形"]
    Summary["Summary<br/>videoSection/summary.tsx<br/>動画概要・開閉"]
    Target["ItemHeader 内の商品名<br/>id: itemName"]

    Video --> Elem
    Video --> Title
    Video --> Peek
    Video --> Date
    Video --> Summary
    Peek -.->|クリックでスクロール| Target
```

子コンポーネントはすべて `/item/videoSection` の共有部品を使用する。`VideoElem` は `normalPage={false}`、`Summary` は `page="confirm"`・`itemId: null` で表示する。

#### 商品セクション

```mermaid
flowchart TD
    Item["ItemSection<br/>confirm/itemSection.tsx"]
    Slide["Slideshow<br/>itemSection/slideshow.tsx<br/>商品画像・拡大表示"]
    Header["ItemHeader<br/>itemSection/itemHeader.tsx"]
    Variants["VariantsList（colorVariants が1件以上）<br/>itemSection/variantsList.tsx<br/>カラー・サイズ・バリエーション在庫"]
    Detail["Detail<br/>itemSection/detail.tsx<br/>商品説明・開閉"]
    Category["CategoryText<br/>itemSection/categoryText.tsx<br/>カテゴリー名"]
    Delivery["DeliverySection<br/>itemSection/deliverySection.tsx"]
    HeaderInfo["HTML要素：商品名・対象性別/年齢<br/>SOLD OUT または価格・セール情報"]
    DeliveryInfo["HTML要素：状態・配送方法<br/>発送元地域・発送までの日数"]
    Stock["HTML要素：在庫（条件付き）"]
    Materials["HTML要素：素材（条件付き）"]

    Item --> Slide
    Item --> Header
    Item --> Variants
    Item --> Detail
    Item --> Category
    Item --> Delivery
    Header --> HeaderInfo
    Delivery --> DeliveryInfo
    Delivery --> Stock
    Delivery --> Materials
```

子コンポーネントはすべて `/item/itemSection` の共有部品を使用する。`ItemHeader` と `Detail` は `page="confirm"` で表示し、`Detail` の `itemId` は `null`。商品名・価格は `ItemHeader` 内で描画し、`ItemName`・`Price` は呼び出さない。レコメンドマークは確認画面では表示しない。在庫欄は初期在庫が2以上、素材欄は素材が存在し割合の合計が100の場合に表示する。

#### 出品・更新操作

```mermaid
flowchart TD
    Upload["UploadButton<br/>confirm/uploadButton.tsx"]
    Open["出品するボタン（HTML要素）"]
    Link["Link<br/>商品を編集する"]
    Popup["確認ポップアップ（popup が true）"]
    Close["オーバーレイ・X<br/>ポップアップを閉じる"]
    Terms["TermsList（共通・繰り返し）<br/>@/components/terms<br/>動画・画像禁止事項／商品禁止事項"]
    Check["利用規約の同意チェック（HTML要素）"]
    Submit["実行ボタン（HTML要素）<br/>page に応じて出品／更新"]
    Destination["/upload/edit/[id]"]

    Upload --> Open
    Upload --> Link
    Upload --> Popup
    Open -.->|クリックで表示| Popup
    Link -.-> Destination
    Popup --> Close
    Popup --> Terms
    Popup --> Check
    Popup --> Submit
```

実行ボタンは同意を確認し、`confirm/api/client.ts` の `fetchCreateItem`（`page="normal"`）または `fetchEditItem`（`page="edit"`）を呼ぶ。成功時はそれぞれ `/upload/ok/[itemId]`、`/item/[itemId]` へ遷移する。

### Title

ページタイトル。

### ItemConfirmPage

ページの大枠。画面に表示する内容の全体像。

### VideoSection

動画と動画に関連する情報。

- 動画
- 動画概要
- 商品情報欄へスクロール（itemPeek）
- 保存日時
- 動画タイトル

### ItemSection

商品と配送に関連する情報。

- 商品画像
- 商品名
- （レコメンドマーク）
- （SOLD OUT）
- 価格
- （セール情報）
- 対象性別・年齢
- （カラー・サイズ等）
- 商品説明
- カテゴリー
- 配送情報
    - 状態
    - 配送方法
    - 発送元地域
    - 発送までの日数
    - （在庫）
    - （素材）
