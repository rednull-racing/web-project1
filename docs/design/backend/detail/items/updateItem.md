# updateItem 詳細設計

基本設計: [商品アップロードAPI設計](../../itemUpload.md)

## 1. 概要

商品編集セッション（item_editing）から公開商品（item）を更新する。

商品関連データ（video, sale, item_shipping_profile）も商品編集セッション（item_editing）からコピーして更新する。

成功時はコピー元のitem_editingを削除し、取得したitemIdを返す。失敗時はitem_editingを保持し、itemは更新しない。

処理途中で失敗した場合は、公開商品（item）および商品関連データ（video, sale, item_shipping_profile）の更新を取り消す。

## 2. API仕様

- Method: PUT
- Endpoint: /items
- 認証: 必須
- 認可: 商品編集セッション（ItemEditing）所有者のみ（item_editing.seller_idが認証済みuserIdと一致すること）
- Content-Type: application/json
- レート制限: 認証ユーザー単位で10分間に5回。超過時は429。
- 順序: authenticateToken → updateItemRateLimit → validateBody(updateItemBodySchema) → updateItemController
- 不正なbodyも回数に含める。認証・レート制限・body検証で拒否した場合はトランザクションを開始しない。
- JSON構文エラーは共通JSONパーサーで先に拒否されるため、この回数計上の対象外。

### ファイル・関数名

以下のパスは `server/src` 基準。

- route: /routes/items.ts
- rateLimit: /middleware/rateLimit/itemsRateLimit.ts
    - updateItemRateLimit（新規）
- bodyバリデーション: /validators/body/items.ts
    - updateItemBodySchema（新規）
    - type: UpdateItemBody（新規）
    - wrapper: /middleware/validate/validateBody.ts
        - validateBody（既存）
- controller: /controllers/items/items.ts
    - updateItemController（新規）
- usecase: /usecases/items/update/updateItem.ts（ファイル新規）
    - updateItemUseCase（新規）
- service:
    - itemEditing取得: /services/itemEditing/query.ts
        - getMyItemEditing（既存）
    - item取得: /services/items/query/relation.ts
        - getItemWithVideoSaleShipping（既存）
    - video生成: /services/video/video.ts
        - updateVideo（上書き、serviceTypeを更新し、使用しているusecaseはすべて更新）
    - sale生成: /services/sale/sale.ts
        - updateSale（上書き、serviceTypeを更新し、使用しているusecaseはすべて更新）
    - item_shipping_profile生成: /services/itemShippingProfile/itemShippingProfile.ts
        - updateShipping（上書き、serviceTypeを更新し、使用しているusecaseはすべて更新）
    - item生成: /services/items/command/update.ts
        - updateItem（新規）
    - itemEditing削除: /services/itemEditing/command.ts
        - deleteItemEditing（既存）
    - 出品者取得: /services/users/query.ts
        - getUser（既存）
    - カテゴリー・親カテゴリー取得: /services/categories/categories.ts
        - getCategories（既存、transaction対応を拡張。親はparent_idで取得）
    - 通知作成: /services/notification/notification.ts
        - createNotification（既存。コミット後の失敗許容処理）
- utility: /utils/normalizeJapanese.ts
    - normalizeJapanese（既存）

### bodyリクエスト

```json
{
    "itemEditingId": 123
}
```

### バリデーション

- `validateBody(updateItemBodySchema)`（既存middleware）でZodを適用し、結果を `req.validatedBody` に格納する。
- itemEditingId: 1〜2147483647の整数、必須（DBのINTEGER範囲）
- 入力元はbodyのみ。params・queryからitemEditingIdを取得しない。
- `z.object({ itemEditingId: z.number().int().positive().max(2147483647) })` とし、文字列から数値への変換は行わない。未定義キーはparse結果から除外する。
- 未指定・null・文字列・小数・範囲外を含む不正なリクエストは400 / INVALID_BODYを返す。

### レスポンス

成功時: 201 Created

```json
{
    "itemId": 456
}
```

### 三行コメント

```ts
// PUT /items
// summary: 商品情報編集
// page: /item/confirm/edit/[id]
```

## 3. 認証・認可

所有者確認の対象はコピー元のItemEditingとする。ItemやItemDraftを認可対象にしない。

1. authenticateTokenが検証したBearerトークンの `req.user.id` を使用する。bodyのseller_id等は使用しない。
2. トランザクション内でgetMyItemEditingへitemEditingId・userId・transactionを渡し、更新用行ロック付きで取得する。
3. 対象が存在しない場合、他人のセッションの場合、先行処理で削除済みの場合はいずれも404 / ITEM_EDITING_NOT_FOUNDとする。
4. ロック取得後の行で認可と公開前提条件を判定する。事前取得した値をコピーしない。

### getMyItemEditing 認可

```ts
where: {
    id: itemEditingId,
    seller_id: userId,
}
```

## 4. 処理フロー

前提: authenticateTokenで認証済みであること。未認証の場合は401を返し、以下の処理を実行しない。

### 処理フロー図

```mermaid

```

## 5. DB操作仕様

### 参照テーブル

- item_editing
- item
- user
- categories

### 書き込みテーブル

- item
- item_shipping_profile
- sale
- video

### 削除テーブル

- item_editing

### 公開前提条件

### コピー仕様

- 保存済みattributesの在庫構造が不正な場合はITEM_ATTRIBUTES_INVALID・500で作成前に停止する。商品/色のinventoryとcolorVariants/sizesの欠落は許容するが、各サイズのinventoryは必須。在庫オブジェクトのinitial/current/low_stock_ratioは有限数値とする。元データの補完・補正は行わない。
- updatedAtは新規生成する
- 商品入力データはitem_editingから引き継ぐ
- attributesの在庫情報は、コピー時に以下の各inventory.currentを同じinventory内のinitialに戻す
    - 商品: attributes.inventory.current
    - 色: attributes.colorVariants[].inventory.current
    - サイズ: attributes.colorVariants[].sizes[].inventory.current
    - initialおよびその他の在庫情報は引き継ぐ
- materials・body_category・lifestyle_category・layer・uiId・色名・サイズ名・画像URLを含め、current以外のJSON値を維持する。
- 画像・動画URLは文字列をコピーする。S3実体のコピー・削除や署名URL発行は本処理で行わない。成功後も公開商品が参照するオブジェクトを保持する。

### コピー対応

- item_editing → item

```ts
{
    name,
    detail,
    image_url,
    price,
    item_condition_id,
    first_image_url,
    gender_type,
    age_type,
    recommend,
    category_id,
    brand_id,
    brand_aliases_id,
    attributes,
    search_text: normalizedSearchText,
    status: （attributes.inventory.currentが1以上なら）"active"、（0なら）"soldout",
    save_at: now,
}
```

- item_editing → video

```ts
{
    thumbnail_url,
    title,
    summary,
    duration,
    original_url,
    converted_url,
    status: video_status,
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

### search_text

```ts
const searchText = `
    ${itemEditing.name}
    ${itemEditing.title ?? ""}
    ${category?.name ?? ""}
    ${parentCategory?.name ?? ""}
    ${user.user_name ?? ""}
    `;
const normalizedSearchText = normalizeJapanese(searchText);
```

### 更新通知

コミット後にcreateNotificationをtransactionなしで呼び出す。旧APIの失敗許容動作を継承し、Promiseをawaitせずcatchでエラーを処理する。失敗を成功済み商品のロールバックや500応答へ変換しない。

| 項目          | 値                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| read_user_id  | 認証済みuserId                                                                                              |
| url           | `/item/${itemId}`（商品ID）                                                                             |
| message_image | コピーしたfirst_image_url                                                                                   |
| message       | `商品「${name}」が更新されました。商品の詳細はこちらの商品ページからご確認ください。` |
| type          | `ITEM`                                                                                                      |

expires_at等は既存createNotificationの規約に従う。コミット前の失敗や404の再リクエストでは通知を作成しない。通知の永続化・再送は本APIの成功条件に含めない。

## 6. トランザクション設計

### 成功時・失敗時

### 排他制御

## 7. エラー設計

## 8. テスト設計

### 正常系・コピー内容

### 入力・認証・境界値

### 保存済みデータ・異常系

### 並行処理・状態遷移
