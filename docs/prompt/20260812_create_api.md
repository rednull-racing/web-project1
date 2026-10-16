# PurchaseSession作成API実装

## 目的

今までDeliveryに購入中セッション保持を任せていたものを、PurchaseSessionテーブルを新たに作成したため、セッション保持をすべてPurchaseSessionに寄せるリファクタの一環として、PurchaseSession作成APIの実装をする。

## 概要

- /server/src/routes/delivery.tsの POST /delivery/:id

ここで行う業務をそのまま変えずにコピーして、使用テーブルをPurchaseSessionに移行し、新たに POST /purchase-session/:id として使用できるAPIを作成する。

## PurchaseSessionカラム構成

- /server/src/models/purchaseSession.ts

この Model にカラム構成の詳細を記載している。なお、この Model は今回は一切編集しないこと。

---

## 3行コメント

```ts
// POST /purchase-session/:id
// summary: 購入セッションデータ作成
// page: /item
```

この3行コメントを、Route、Controller、Usecaseのコードの上に記載する。

---

## Route

### ファイル作成

- /server/src/routes/purchaseSession.ts

上記の通りにファイルを作成する。

#### app.ts登録

- PurchaseSessionRouteをimportする。
- /api/purchase-sessionで使えるようにする。

これ以外のapp.tsの内容については編集しない。

### ルーティング実装

/routes/purchaseSession.tsに

- POST /purchase-session/:id
  を作成する。

```ts
router.post(
    "/:id",
    validateParams(idParamSchema),
    authenticateToken,
    createPurchaseSessionRateLimit,
    purchaseSessionPostByItemIdController,
);
```

#### createPurchaseSessionRateLimit

- /server/src/middleware/rateLimit/purchaseSession.tsを作成する
- createDeliveryRateLimitと同じ内容で実装する

---

## Controller purchaseSessionPostByItemIdController

### 参考

- /controllers/delivery.ts deliveryPostByIdController

```ts
export const deliveryPostByIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;
        const itemId = Number(req.params.id);

        const deliveryId = await postDeliveryBuyUseCase({ itemId, userId });

        res.status(200).json({ deliveryId });
    } catch (err) {
        next(err);
    }
};
```

### 実装内容

- すべての処理をtry/catchで囲む
- userId取得
- パラメータの:idからitemIdを取得
- UseCaseからpurchaseSessionIdを受け取る
- purchaseSessionIdを返す（200）
- エラーが発生したらcatch{}で`next(err)`を返す

---

## UseCase postPurchaseSessionUseCase

### 現在の進捗

- ここだけすでにファイルを作成している
- /server/src/usecases/purchaseSession/post.ts
- transaction外はすべて変更済み

### やること

- transaction内の`newDelivery`を、`newPurchaseSession`に変更する。
- `createDelivery`の使用をやめ、新たに作成するService`createPurchaseSession`を使用する。

---

## Service createPurchaseSession

### 参考

/server/src/services/delivery/delivery.ts

- createDelivery

```ts
export const createDelivery = async ({ data, transaction }: CreateDeliveryParams) => {
    return Delivery.create(data, { transaction });
};
```

/server/src/types/serviceType/delivery.ts

- CreateDeliveryParams

```ts
export type CreateDeliveryParams = {
    data: {
        buyer_phone_number: string;
        shipping_day_id: number;
        shipping_service_id: number;
        delivery_status_id: number;
        shipping_place_id: number;
        item_id: number;
        address_id: number;
        name_id: number;
        shipping_from_name: string;
        shipping_from_postcode: string;
        shipping_from_prefecture: string;
        shipping_from_address_line1: string;
        shipping_from_address_line2: string;
        shipping_from_phone: string;
    };
    transaction?: Transaction;
};
```

### やること

- ファイル作成
    - /server/src/services/purchaseSession/purchaseSession.ts
    - /server/src/types/serviceType/purchaseSession.ts
- serviceType CreatePurchaseSessionParams 作成
    - 上記CreateDeliveryParamsとカラム構成は同じはずだが、微妙にカラム名が違う箇所がある可能性があるため、必ずModelを確認する。カラム名が異なる場合は、必ずModelに合わせてServiceTypeを修正する。
- service createPurchaseSession作成
    - 型はCreatePurchaseSessionParamsをimportして使用する

---

## 実装上の注意

- 必ず/server配下の関係する各AGENTS.mdを読んで、仕様を合わせること
- 指示したファイル以外、既存の実装には編集を加えないこと
- 必要あらば、テストコードも/server/testに実装する
- 実装後、作業内容を振り返り、セルフレビューする
- 最後に必ずlintとtypecheckを行う
- 今回のタスクと関係ないバグや改善点を見つけたら、その場で修正せず、`/docs/todo`配下の適切なディレクトリに記録すること
- 終了したら、作業内容を報告する
