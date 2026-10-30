# getItemConfirmPage 詳細設計

基本設計: [商品アップロードAPI設計](../../itemUpload.md)

検証・契約確定: 2026-10-30。ユーザー回答に基づき、ID/durationは数値、日時はISO文字列、nullable列のnullは保持、認可はItemEditing.seller_idとする。Categoryは確認ページがnameのみを使用するため、include例のid/nameを採用。フロント型は参考であり公開JSON契約と異なる箇所があるが、本作業では変更しない。test_dbは本APIの実DBテストで必要スキーマを確認済み。本番DBの反映状況は未確認。

## 1. 概要

`client/src/app/item/confirm`配下のページで表示するデータをDBから取得し、フロントエンドにJSONで返す。

参照のみを行い、item_editing・関連マスター・商品・S3オブジェクトを変更しない。動画変換、編集開始、商品公開・削除は対象外。

## 2. API仕様

- Method: GET
- Endpoint: /api/item-editing/:id/confirm
- Router内の相対パス: /:id/confirm（`routes/index.ts` の既存 `/api/item-editing` 登録を利用）
- 認証: 必須
- 認可: 商品編集セッション（ItemEditing）所有者のみ（item_editing.seller_idが認証済みuserIdと一致すること）
- Content-Type: application/json（レスポンス。リクエストbodyは不要）
- レート制限: 認証ユーザー単位で1分間に50回。超過時は429。
- 制限設定: `windowMs: 60000`、`limit: 50`、`standardHeaders: true`、`legacyHeaders: false`。既存形式の `admin:${認証済みuserId}` をキーとするAPI専用インスタンスを追加する。
- 制限計上: 認証後の400・404・500も含む。未認証は計上しない。51回目以降は429と既存ライブラリの既定本文・RateLimit/Retry-Afterヘッダーを返し、窓終了後に再受付する。GETでも不正JSONを送った場合はアプリ共通parserが先に400とし、認証・制限へ到達しない。
- 順序: authenticateToken → getItemConfirmPageRateLimit → validateParams(idParamSchema) → getItemConfirmPageController

### ファイル・関数名

以下のパスは `server/src` 基準。上書き・新規・拡張の記載は初回設計時の区分である。

- route: /routes/itemEditing.ts
- rateLimit: /middleware/rateLimit/itemEditingRateLimit.ts
    - getItemConfirmPageRateLimit（新規）
- 認証: /middleware/authMiddleware.ts
    - authenticateToken（既存）
- paramバリデーション: /validators/params/id.ts
    - idParamSchema（既存）
    - wrapper: /middleware/validate/validateParams.ts
        - validateParams（既存）
- controller: /controllers/itemEditing/itemEditing.ts
    - getItemConfirmPageController（新規）
- usecase: /usecases/itemEditing/getItemConfirmPage.ts
    - getItemConfirmPageUseCase（新規）
- service:
    - itemEditing取得: /services/itemEditing/query.ts
        - getMyItemConfirmPage（新規）
        - 引数型: `Pick<ItemEditingUserIdParams, "itemEditingId" | "userId">` をservice内で定義する（既存型はtransaction必須のため、そのまま流用しない）

### リクエスト

`GET /item-editing/123/confirm`（bodyなし）

### バリデーション

- `validateParams(idParamSchema)` で `params.id` を検証し、数値化した値をitemEditingIdとして使用する。
- `z.coerce.number()` による数値化後の値を `req.validatedParams` から取得する。認証IDは `req.user!.id` のみを採用し、body/queryのuserId・seller_idは採用しない。
- id: 1〜2147483647の整数、必須（DBのINTEGER範囲）。不正な値は400を返す。

### レスポンス

成功時: 200 OK

取得完了後に `{ "itemEditing": ... }` の1キーを返す。取得項目は `client/src/app/item/confirm/types.ts` の `ItemEditing` を参考とし、`status`・`item_id`を含める。ID（関連を含む）・durationはnumber、updatedAtはISO文字列。Modelのnullable列は保存値のnullを保持し、補完や文字列変換はしない。normal/editとも取得でき、statusによる絞込みはない。

```json
{
    "itemEditing": {
        "id": 123,
        "status": "normal",
        "item_id": 456,
        "seller_id": 7,
        "name": "商品名",
        "detail": null,
        "price": 1000,
        "image_url": [],
        "first_image_url": "https://example.test/item.jpg",
        "gender_type": "unisex",
        "age_type": "both",
        "recommend": false,
        "attributes": {},
        "thumbnail_url": "https://example.test/thumbnail.jpg",
        "title": "動画タイトル",
        "summary": null,
        "duration": null,
        "original_url": "https://example.test/original.mp4",
        "converted_url": null,
        "before_price": 1000,
        "discount_rate": null,
        "discount_amount": null,
        "sale_flag": false,
        "shipping_service_free_text": null,
        "updatedAt": "2026-10-29T00:00:00.000Z",
        "Category": null,
        "Brand": null,
        "ItemConditionOption": null,
        "ShippingDayOption": null,
        "ShippingServiceOption": null,
        "TodouhukenOption": null
    }
}
```

参照元は `client/src/app/item/confirm/types.ts`。Brand/Option、Category・parent・childrenの取得列はid/nameとする。Category/parentや任意関連の未設定はnull、childrenがなければ空配列。Categoryのchildren順序は保証しない。フロント型そのものは今回変更しない。

### 三行コメント

```ts
// GET /item-editing/:id/confirm
// summary: 編集セッション確認ページ データ取得
// page: /item/confirm/[id]・/item/confirm/edit/[id]
```

## 3. 認証・認可

`authenticateToken` の認証済みuserIdと、URLのitemEditingIdで所有者の編集セッションを検索する。未認証は401、存在しない場合・他人の編集セッションの場合はともに404を返す。

### getMyItemConfirmPage 認可

```ts
where: {
    id: itemEditingId,
    seller_id: userId,
}
```

## 4. 処理フロー

1. 認証を確認する（未認証は401）。
2. レート制限を確認する（超過は429。不正なパラメータも回数に含む）。
3. params.idを検証し、itemEditingIdと認証済みuserIdをusecaseに渡す（不正は400）。
4. serviceで編集セッションと関連を所有者条件付きで取得する。
5. nullならusecaseで `new AppError("ITEM_EDITING_NOT_FOUND", 404)` を送出する。DB例外はそのまま伝播させる。
6. 編集セッションがあればusecaseからcontrollerへ返し、controllerが200で `{ itemEditing }` を返す。
7. controllerは例外を `next(err)` へ渡し、共通errorHandlerが公開応答を生成する。

### 処理フロー図

```mermaid
flowchart TD
    A[リクエスト・共通parser] --> B{認証済みか}
    A -->|不正JSON| E400J[400 INVALID_JSON]
    B -->|No| E401[401]
    B -->|Yes| C{レート制限内か}
    C -->|No| E429[429]
    C -->|Yes| D{パラメータは正しいか}
    D -->|No| E400[400 INVALID_PARAMS]
    D -->|Yes| F[所有者条件付き・関連付き取得]
    F --> G{編集セッションが存在するか}
    F -->|DB例外| E500[共通errorHandler・500]
    G -->|No| E404[共通errorHandler・404]
    G -->|Yes| H[controller・200 JSON]
```

## 5. DB操作仕様

### 参照テーブル

- item_editing
    - `id = itemEditingId AND seller_id = userId` で取得する。

- 関連参照: categories（Category・parent・children）、brands（Brand）、item_condition_option、shipping_day_option、shipping_service_option、todouhuken_option。aliasはModelのassociate定義に合わせる。
- `status`（"normal" | "edit"）と`item_id`を確認ページ用の取得項目に含める。
- 取得列・関連は以下を確定契約とする。createdAt・video_status・各FKなど列挙しない列は公開しない。
- 実DBの検証結果は本APIのテストレポートに記録し、他APIの検証結果で代替しない。

### 取得データ・レスポンス詳細

取得データの記載は `client/src/app/item/confirm/types.ts` の `ItemEditing` を参考とする。

- getItemConfirmPageのattributes:

```ts
attributes: [
    "id",
    "status",
    "item_id",
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
    "updatedAt",
];
```

- getItemConfirmPageのinclude:

```ts
include: [
    {
        model: Categories,
        as: "Category",
        attributes: ["id", "name"],
        required: false,
        include: [
            {
                model: Categories,
                attributes: ["id", "name"],
                as: "children",
                required: false,
            },
            {
                model: Categories,
                attributes: ["id", "name"],
                as: "parent",
                required: false,
            },
        ],
    },
    {
        model: Brands,
        as: "Brand",
        attributes: ["id", "name"],
        required: false,
    },
    { model: ItemConditionOption, attributes: ["id", "name"], required: false },
    { model: ShippingDayOption, attributes: ["id", "name"], required: false },
    { model: ShippingServiceOption, attributes: ["id", "name"], required: false },
    { model: TodouhukenOption, attributes: ["id", "name"], required: false },
];
```

## 6. トランザクション設計

- 関連を含む単一の参照であり、明示的なtransaction・行ロック・更新は行わない。更新用ロックを持つ既存 `getMyItemEditing` は利用しない。
- 繰返し取得はその時点の保存値を返す。並行する更新・削除との厳密な直列化や、取得後も行が残ることは保証しない。取得時点で存在しなければ404。
- 書込み・外部通信・通知がないため、rollback・補償・副作用の再送は該当しない。

## 7. エラー設計

| 発生条件                                  | HTTP | 公開応答                                                                          |
| ----------------------------------------- | ---- | --------------------------------------------------------------------------------- |
| bodyの不正JSON（共通parser）              | 400  | `{ "code": "INVALID_JSON", "message": "JSONの形式を確認してください。" }`         |
| Bearerトークンなし                        | 401  | `{ "message": "トークンがありません。" }`                                         |
| トークン不正・期限切れ                    | 401  | `{ "message": "トークンが無効です。" }`                                           |
| 認証後の制限超過                          | 429  | express-rate-limitの既定本文・ヘッダー                                            |
| id検証失敗                                | 400  | `{ "code": "INVALID_PARAMS", "message": "INVALID_PARAMS" }`                       |
| 編集セッション不存在・他人の所有・seller_idがnull | 404  | `{ "code": "ITEM_EDITING_NOT_FOUND", "message": "ITEM_EDITING_NOT_FOUND" }`           |
| 予期しないDB等の例外                      | 500  | `{ "error": "INTERNAL_SERVER_ERROR", "message": "サーバーエラーが発生しました" }` |

400/404は既存AppError、予期しない例外は元の例外を共通errorHandlerへ渡す。認証・制限の応答をAppError形式へ変更しない。拒否時は後続処理を実行せず、500に内部エラー内容を含めない。

## 8. テスト設計

- 正常: 所有者の取得、取得列・関連・任意項目のnull/値あり・画像配列・JSONBの保持、対象外カラムの非公開、取得完了後の200を確認する。公開レスポンスは第2・5章に合わせる。
- 認証・認可: 未認証/不正JWTの401、他人・不存在・所有者nullの404、body/queryへの所有者偽装の無視。認証拒否時は制限・DBが未実行であることを確認する。
- 入力境界: 1/2147483647を許可し、0/負数/小数/非数値/上限超過を拒否する。数値coerceの実契約と検証済みparamsの採用を確認する。
- 制限・優先順位: 同じユーザーの50回と51回目、他ユーザーとの分離、窓終了後の再開、不正paramsと404の計上、制限超過と不正idが重なる場合の429を確認する。parser拒否は別経路として確認する。
- 失敗・待機: DB失敗の伝播と500、usecase/controllerの完了待ち、取得失敗時の成功応答未実行を確認する。
- 再送・並行: 参照に副作用がなく対象・他人の編集セッションとマスターが不変であること、別リクエスト間で結果が混ざらないことを確認する。書込みの状態遷移・rollback・ロック待機は本APIには該当しない。
- 検証レベル: service/usecase/controller単体、実Router・認証・schema・制限・errorHandlerのHTTP接続、実DBによる所有者絞込み・関連取得・非対象不変を分ける。DB検証はtest_dbガードと必要スキーマ確認後に自作IDで行う。
- 次工程成果物: `server/test/docs/architecture/itemEditing/getItemConfirmPage.md` と `server/test/docs/report/itemEditing/getItemConfirmPage.md`。実行結果はレポートに記録する。


検証結果: [テスト設計](../../../../../server/test/docs/architecture/itemEditing/getItemConfirmPage.md)・[テストレポート](../../../../../server/test/docs/report/itemEditing/getItemConfirmPage.md)を参照。
