# Route コーディング規約

## 基本方針

- Route はルーティング定義のみを担当する。
- Route 内にリクエスト処理、業務ロジック、DB 操作を書かない。
- Route には HTTP メソッド、パス、middleware、Controller、Route の概要コメントのみを記述する。
- handler には Controller のみを指定する。

---

# ファイル構成

以下の順番で記述する。

```ts
import

const router = Router();

3 行コメント

router.METHOD(...);

export default router;
```

---

# import

- `Router` は `express` から import する。
- Controller は `../controllers/*.js` から import する。
- middleware は用途ごとに分けて import する。
- validator の schema は `../validators/*` から import する。

例

```ts
import { Router } from "express";
import { createItemController } from "../controllers/items.js";
import { authenticateOptional, authenticateToken } from "../middleware/index.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { idParamSchema } from "../validators/params/id.js";
```

---

# Router 初期化

ファイル内で `Router()` を呼び出し、`router` という名前で定義する。

例

```ts
const router = Router();
```

---

# 3 行コメント

各 Route の上に 3 行コメントを記載する。

- パス
- summary
- page

例

```ts
// POST /items
// summary: 商品データ作成
// page: /upload/before
```

---

# Route 定義

- `router.post`、`router.put`、`router.patch`、`router.delete`、`router.get` を使用する。
- 第 1 引数にパス文字列を記述する。
- 第 2 引数以降に middleware と Controller を順番に記述する。
- 1 行で収まらない場合は複数行で記述する。

例

```ts
router.post("/", authenticateToken, createItemRateLimit, createItemController);
```

```ts
router.put(
    "/:id",
    authenticateToken,
    uploadItemRateLimit,
    validateParams(idParamSchema),
    validateQuery(putItemUploadQuerySchema),
    validateBody(itemUploadBodySchema),
    uploadItemController,
);
```

---

# middleware の記述

- 認証が必要な場合は `authenticateToken` を指定する。
- 任意認証の場合は `authenticateOptional` を指定する。
- params の検証は `validateParams(...)` を使用する。
- query の検証は `validateQuery(...)` を使用する。
- body の検証は `validateBody(...)` を使用する。
- レート制限がある処理では、個別の rateLimit middleware を指定する。

例

```ts
router.get("/", getItemListRateLimit, authenticateOptional, validateQuery(itemListQuerySchema), getItemListController);
```

---

# middleware の順序

Route ごとに middleware の順序を定義してから Controller を最後に置く。

`items.ts` では以下のような並びが使われている。

- 認証
- rateLimit
- validateParams
- validateQuery
- validateBody
- Controller

ただし、すべての Route が同じ順序ではなく、実際の定義順をそのまま記述している Route もある。

例

```ts
router.delete(
    "/:id/perfect",
    perfectDeleteItemRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    deleteItemPerfectController,
);
```

---

# Controller の指定

- Route に `async (req, res, next) => {}` を書かない。
- 末尾には対応する Controller を指定する。

例

```ts
router.get("/:id/metadata", validateParams(idParamSchema), getItemMetadataController);
```

---

# export

末尾で `router` を default export する。

例

```ts
export default router;
```
