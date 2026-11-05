# createItemTrash 詳細設計

基本設計: [商品削除API設計](../../itemDelete.md)

## 1. 概要

認証済みユーザーが所有する商品（item）を取得し、レコードをコピーする形で論理削除商品（item_trash）を作成する。

論理削除商品を作成後、商品関連データ群（video, sale, item_shipping_profile）を削除し、その後、商品を削除する。

DB処理に失敗した場合はロールバックし、元の商品および商品関連データ群を保持する（再作成による復元は行わない）。

## 2. API仕様

- Method: POST
- Endpoint: /item-trash
- 認証: 必須
- 認可: Item所有者のみ（item.seller_idが認証済みuserIdと一致すること）
- Content-Type: application/json（レスポンス。リクエストbodyは不要）
- レート制限: 認証ユーザー単位で10分間に10回

### 分類名称

- 大分類：itemTrash
- 小分類：createItemTrash

### ファイル・関数名

以下は `/server/src` 基準。新規・変更予定の箇所を併記する。

- route: /routes/itemTrash.ts（ファイル新規作成）
- rateLimit: /middleware/rateLimit/itemTrashRateLimit.ts（ファイル新規作成）
- 認証: /middleware/authMiddleware.ts
    - authenticateToken（既存）
- bodyバリデーション: /validators/body/itemTrash.ts（ファイル新規作成）
    - createItemTrashBodySchema（新規）
    - type: CreateItemTrashBody（新規）
    - wrapper: /middleware/validate/validateBody.ts
        - validateBody（既存）
- controller: /controllers/itemTrash/itemTrash.ts（ファイル新規作成）
    - createItemTrashController（新規）
- usecase: /usecases/itemTrash/createItemTrash.ts（ファイル新規作成）
    - createItemTrashUseCase（新規）
- service:
    - item取得: /services/items/index.ts
        - getMyItemWithVideoSaleShipping（既存）
    - item_trash生成: /services/itemTrash/command.ts（ファイル新規作成）
        - createItemTrash（新規）
        - serviceType: /types/serviceType/itemTrash.ts（ファイル新規作成）
            - CreateItemTrashParams（新規）
    - video削除: /services/video/video.ts
        - deleteVideo（新規）
        - serviceType：/types/serviceType/video.ts
            - videoTransactionParams（新規: VideoとTransactionのみ）
    - sale削除: /services/sale/sale.ts
        - deleteSale（新規）
        - serviceType: /types/serviceType/sale.ts
            - saleTransactionParams（既存）
    - item_shipping_profile削除: /services/itemShippingProfile/itemShippingProfile.ts
        - deleteShipping（新規）
        - serviceType: /types/serviceType/itemShippingProfile.ts
            - shippingTransactionParams（新規: ItemShippingProfileとTransactionのみ）
    - item削除: /services/items/index.ts
        - deleteItem（既存）
    - notification生成: /services/notification/notification.ts
        - createNotification（既存）

### bodyリクエスト

```json
{
    "itemId": 123
}
```

### バリデーション

- `validateBody(createItemTrashBodySchema)`（既存middleware）でZodを適用し、結果を `req.validatedBody` に格納する。
- itemId: 1〜2147483647の整数、必須（DBのINTEGER範囲）
- 入力元はbodyのみ。params・queryからitemEditingIdを取得しない。
- `z.object({ itemId: z.number().int().positive().max(2147483647) })` とし、文字列から数値への変換は行わない。未定義キーはparse結果から除外する。
- 未指定・null・文字列・小数・範囲外を含む不正なリクエストは400 / INVALID_BODYを返す。

### レスポンス

成功時: 201 Created

```json
{
    "message": "商品を削除しました"
}
```

### 三行コメント

```ts
// POST /item-trash
// summary: 論理削除商品作成
// page: /item/[id]
```

## 3. 認証・認可

所有者確認の対象はコピー元のItemとする。ItemやItemDraftを認可対象にしない。

1. authenticateTokenが検証したBearerトークンの `req.user.id` を使用する。bodyのseller_id等は使用しない。
2. トランザクション内でgetMyItemWithVideoSaleShippingへitemId・userId・transactionを渡し、更新用行ロック付きで取得する。
3. 対象が存在しない場合、他人のセッションの場合、先行処理で削除済みの場合はいずれも404 / ITEM_NOT_FOUNDとする。
4. ロック取得後の行で認可と公開前提条件を判定する。事前取得した値をコピーしない。

### getMyItemWithVideoSaleShipping　認可

```ts
where: {
    id: itemId,
    seller_id: userId,
}
```

## 4. 処理フロー

前提: authenticateTokenで認証済みであること。未認証の場合は401を返し、以下の処理を実行しない。

### 処理フロー図

```mermaid
flowchart TD

```

## 5. DB操作仕様

### 参照テーブル

- item: `id = itemId AND seller_id = userId`。更新用行ロックを取得する。
- video、sale、item_shipping_profile

### 書き込みテーブル

- item_trash
- notification

### 削除テーブル

- item
- video
- sale
- item_shipping_profile

### 公開前提条件

判定順は以下。保存済みデータはModelの型だけで検証済みとみなさない。

### item_trashカラム例

元テーブル → item_trash

```ts
{
    id（自動生成）,
    item.id → item_id,
    item.name → name,
    item.detail → detail,
    item.image_url → image_url,
    item.first_image_url → first_image_url,
    sale.before_price → price,
    item.item_condition_id → item_condition_id,
    item.seller_id → seller_id,
    item.gender_type → gender_type,
    item.age_type → age_type,
    item.recommend → recommend,
    item.category_id → category_id,
    item.brand_id → brand_id,
    item.brand_aliases_id → brand_aliases_id,
    item.attributes → attributes,
    video.title → title,
    video.summary → summary,
    video.thumbnail_url → thumbnail_url,
    video.duration → duration,
    video.original_url → original_url,
    video.converted_url → converted_url,
    video.status → video_status,
    item_shipping_profile.shipping_day_id → shipping_day_id,
    item_shipping_profile.shipping_service_id → shipping_service_id,
    item_shipping_profile.shipping_place_id → shipping_place_id,
    item_shipping_profile.shipping_service_free_text → shipping_service_free_text,
    createdAt（自動生成）,
    updatedAt（自動生成）,
}
```

### 更新通知

コミット後にcreateNotificationをtransactionなしで呼び出す。Promiseをawaitせずcatchでエラーを処理する。失敗を成功済み商品のロールバックや500応答へ変換しない。

| 項目          | 値                                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| read_user_id  | 認証済みuserId                                                                                                                                        |
| url           | `/item/deleted/${item_trash.id}`                                                                                                                      |
| message_image | item_trash.first_image_url                                                                                                                            |
| message       | `商品「${item_trash.name}」が削除されました。削除された商品の詳細はこちらのページからご確認ください。なお、復元される場合は削除日から30日以内に行ってください。` |
| type          | `ITEM`                                                                                                                                                |

## 6. トランザクション設計

### 成功時・失敗時

### 排他制御

## 7. エラー設計

## 8. テスト設計

### 正常系

### 入力・認証・境界値

### 保存済みデータ・異常系

### 並行処理・状態遷移
