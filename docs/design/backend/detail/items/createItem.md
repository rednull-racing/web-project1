# createItem 詳細設計

基本設計: ../../itemUpload.md

## 1. 概要

商品編集セッション（item_editing）から公開商品（item）を生成する。

商品関連データ（video, sale, item_shipping_profile）も商品編集セッション（item_editing）からコピーして生成する。

処理途中で失敗した場合は、公開商品（item）および商品関連データ（video, sale, item_shipping_profile）の作成を取り消す。

## 2. API仕様

- Method: POST
- Endpoint: /items
- 認証: 必須
- 認可: 商品編集セッション（ItemEditing）所有者のみ（item_editing.seller_idが認証済みuserIdと一致すること）
- Content-Type: application/json
- レート制限: 10分間に5回

### ファイル・関数名

/server/src

- route: /routes/items.ts
- rateLimit: /middleware/rateLimit/itemsRateLimit.ts
    - createItemRateLimit（上書き）
- 認証: /middleware/authMiddleware.ts
    - authenticateToken（既存）
- bodyバリデーション: /validators/body/items.ts
    - createItemBodySchema（新規）
    - type: CreateItemBody（新規）
    - wrapper: /middleware/validate/validateBody.ts
        - validateBody（既存）
- controller: /controllers/items/items.ts
    - createItemController（上書き）
- usecase: /usecases/itemEditing/createItem.ts
    - createItemUseCase（新規）
- service:
    - itemEditing取得: /services/itemEditing/query.ts
        - getMyItemEditing（既存）
    - フォロワー数取得: /services/follow/follow.ts
        - countFollower（既存）
    - 出品商品数取得: /services/items/items.count.ts
        - countSellItem（既存）
    - video生成: /services/video/video.ts
        - createVideo（上書き）
    - sale生成: /services/sale/sale.ts
        - createSale（上書き）
    - item_shipping_profile生成: /services/itemShippingProfile/itemShippingProfile.ts
        - createShipping（上書き）
    - item生成: /services/items/command/create.ts
        - createItem（上書き）

### bodyリクエスト

```json
{
    "itemEditingId": 123
}
```

### バリデーション

- validatedBody使用（既存関数）
    - validatedBody内でzodを適用
- itemEditingId: 1〜2147483647の整数、必須（DBのINTEGER範囲）
- 不正なリクエストは400を返す

### レスポンス

成功時: 201 Created

```json
{
    "itemId": 456
}
```

※レスポンス形式は実装時の共通API規約に合わせて確定する。

### 三行コメント

```ts
// POST /items
// summary: 販売中商品作成
// page: /item/confirm/[id]
```

## 3. 認証・認可

所有者確認の対象はコピー元のItemとし、ItemDraftは使用しない。

1. 認証ミドルウェア（authenticateToken）からuserIdを取得する
2. itemEditingIdをもとにitem_editingを取得する
3. item_editing.seller_idとuserIdを比較する
4. 一致しない場合は404を返す

存在しないitemに対しては404を返す。

### getMyItemEditing 認可

```ts
where: {
    id: itemId,
    seller_id: userId,
}
```

## 4. 処理フロー

前提: authenticateTokenで認証済みであること。未認証の場合は401を返し、以下の処理を実行しない。

### 処理フロー図

## 5. DB操作仕様

### 参照テーブル

- item_editing

### 書き込みテーブル

- item
- item_shipping_profile
- sale
- video

### コピー仕様

- 保存済みattributesの在庫構造が不正な場合はITEM_ATTRIBUTES_INVALID・500で作成前に停止する。商品/色のinventoryとcolorVariants/sizesの欠落は許容するが、各サイズのinventoryは必須。在庫オブジェクトのinitial/current/low_stock_ratioは有限数値とする。元データの補完・補正は行わない。
- seller_idは認証済みユーザーのIDを使用する
- item.idは新規採番する
- createdAt、updatedAtは新規生成する
- 商品入力データはitem_editingから引き継ぐ
- attributesの在庫情報は、コピー時に以下の各inventory.currentを同じinventory内のinitialに戻す
    - 商品: attributes.inventory.current
    - 色: attributes.colorVariants[].inventory.current
    - サイズ: attributes.colorVariants[].sizes[].inventory.current
    - initialおよびその他の在庫情報は引き継ぐ
- 関連レコードの外部キーは新しいitem.idに対応させる

### コピー対応

- item_editing → item

```ts
{
    name,
    detail,
    image_url,
    price,
    item_condition_id,
    seller_id（認証済みユーザーのID）,
    first_image_url,
    gender_type,
    age_type,
    recommend,
    category_id,
    brand_id,
    brand_aliases_id,
    attributes,
    views_count: 0,
    sort_number: sort（後述）,
    sort_buzz_number: sort（後述）,
    search_text: searchText（後述）,
    video_id: videoId,
    sale_id: saleId,
    shipping_id: shippingId,
}
```

- item_editing → video

```ts
{
    thumbnail_url,
    title,
    summary,
    duration,
    play_count: 0,
    original_url,
    converted_url,
    video_status → status,
}
```

- item_editing → sale

```ts
{
    before_price,
    discount_rate: null,
    discount_amount: null,
    sale_flag: false,
}
```

- item_editing → item_shipping_profile

```ts
{
    shipping_day_id,
    shipping_service_id,
    shipping_place_id,
    shipping_service_free_text,
}
```

## 6. トランザクション設計

## 7. エラー設計

## 8. テスト設計

## 9. 削除する旧API

- usecase: createItemsUseCase
- usecase: patchPublishUseCase
- controller: publishItemController
- route: post("/")
- route: patch("/:id/publish")
- rateLimit: uploadPublishItemRateLimit

## 10. sort仕様

旧publishItemControllerから引用

```ts
// sort_number
const followerCount = await countFollower({ userId });

const sellItemCount = await countSellItem({ userId });

let sort =
    Number(itemEditing.price) / 10 +
    (itemEditing.detail?.length ?? 0) +
    (itemEditing.Video?.summary?.length ?? 0) +
    (itemEditing.User?.user_introduction?.length ?? 0) +
    followerCount * 10 +
    sellItemCount * 10;

if (Number(item.User?.penalty_points) <= 5) {
    sort = sort + 5000;
}

// search_text
const searchText = `
    ${itemEditing.name}
    ${itemEditing.Video?.title ?? ""}
    ${itemEditing.Category?.name ?? ""}
    ${itemEditing.Category?.parent?.name ?? ""}
    ${itemEditing.User?.user_name ?? ""}
    `;

const normalizeSearchText = normalizeJapanese(searchText ?? "");
```
