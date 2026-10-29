# getItemDraftPage 詳細設計

基本設計: [商品アップロードAPI設計](../../itemUpload.md)

## 1. 概要

`client/src/app/item/draft/[id]`ページで表示するデータをDBから取得し、フロントエンドにJSONで返す。

## 2. API仕様

- Method: GET
- Endpoint: /item-draft/:id/item-page
- 認証: 必須
- 認可: 下書き商品（ItemDraft）所有者のみ（item_draft.seller_idが認証済みuserIdと一致すること）
- Content-Type: application/json
- レート制限: 認証ユーザー単位で1分間に50回。超過時は429。
- 順序: authenticateToken → getItemDraftPageRateLimit → validateParams(idParamSchema) → getItemDraftPageController

### ファイル・関数名

以下のパスは `server/src` 基準。上書き・新規・拡張の記載は初回設計時の区分である。

- route: /routes/itemDraft.ts
- rateLimit: /middleware/rateLimit/itemDraftRateLimit.ts
    - getItemDraftPageRateLimit（新規）
- 認証: /middleware/authMiddleware.ts
    - authenticateToken（既存）
- paramバリデーション: /validators/params/id.ts
    - idParamSchema（既存）
    - wrapper: /middleware/validate/validateParams.ts
        - validateParams（既存）
- controller: /controllers/itemDraft/itemDraft.ts
    - getItemDraftPageController（新規）
- usecase: /usecases/itemDraft/getItemDraftPage.ts
    - getItemDraftPageUseCase（新規）
- service:
    - itemDraft取得: /services/itemDraft/query.ts
        - getMyItemDraftPage（新規）
        - serviceType: /types/serviceType/itemDraft.ts の ItemDraftUserIdParams（既存）

### リクエスト

`GET /item-draft/123/item-page`（bodyなし）

### バリデーション

- `validateParams(idParamSchema)` で `params.id` を検証し、数値化した値をitemDraftIdとして使用する。
- id: 1〜2147483647の整数、必須（DBのINTEGER範囲）。不正な値は400を返す。

### レスポンス

成功時: 200 OK

```json
{ itemDraft }
```

### 三行コメント

```ts
// GET /item-draft/:id/item-page
// summary: 下書き商品ページ　データ取得
// page: /item/draft/[id]
```

## 3. 認証・認可

`authenticateToken` の認証済みuserIdと、URLのitemDraftIdで所有者の下書きを検索する。未認証は401、存在しない場合・他人の下書きの場合はともに404を返す。

### getMyItemDraftPage 認可

```ts
where: {
    id: itemDraftId,
    seller_id: userId,
}
```

## 4. 処理フロー

1. 認証を確認する（未認証は401）。
2. レート制限を確認する（超過は429。不正なパラメータも回数に含む）。
3. params.idを検証し、itemDraftIdと認証済みuserIdをusecaseに渡す（不正は400）。
4. itemDraftデータを取得する。
5. itemDraftをusecaseからcontrollerへ返す
6. データ取得したら200を返す。itemDraftをそのまま返す。

### 処理フロー図

```mermaid
flowchart TD
```

## 5. DB操作仕様

### 参照テーブル

- item_draft
    - `id = itemDraftId AND seller_id = userId` で取得する。

## 6. エラー設計

## 7. 取得データ・レスポンス詳細

取得データ内容は、`client/src/app/item/draft/types.ts`に基づく。

- getItemDraftPageのattributes:

```ts
attributes: [
    "id",
    "seller_id",
    "name",
    "detail",
    "price",
    "image_url",
    "first_image_url",
    "gender_type",
    "age_type",
    "recommend",
    "attributes",
    "thumbnail_url",
    "title",
    "summary",
    "duration",
    "original_url",
    "converted_url",
    "before_price",
    "discount_rate",
    "discount_amount",
    "sale_flag",
    "shipping_service_free_text",
];
```

- getItemDraftPageのinclude:

```ts
include: [
    {
        model: Categories,
        as: "Category",
        include: [
            {
                model: Categories,
                attributes: ["id", "name", "level", "parent_id", "allowed_gender", "allowed_age"],
                as: "children",
                required: false,
            },
            {
                model: Categories,
                attributes: ["id", "name", "level", "allowed_gender", "allowed_age"],
                as: "parent",
                required: false,
            },
        ],
    },
    {
        model: Brands,
        as: "Brand",
        required: false,
    },
    { model: ItemConditionOption },
    { model: ShippingDayOption },
    { model: ShippingServiceOption },
    { model: TodouhukenOption },
];
```

## 8. テスト設計
