# Service コーディング規約

## 基本方針

- Service は Sequelize Model を使った DB アクセスを担当する。
- Service は検索、件数取得、集計、作成、更新、削除と、DB クエリに必要な条件・関連・並び順の定義を担当する。
- Service は UseCase から受け取った値だけを使い、DB 操作の結果を呼び出し元へ返す。
- Service は Express の Request、Response、NextFunction を扱わない。
- Service は HTTP ステータス、レスポンス形式、入力値の schema validation を扱わない。
- Service に所有権・権限・状態をもとに処理可否を決める業務ロジックを書かない。
- 外部システムとの通信は `/server/src/infra` または既存の専用 Utility に実装し、Service に追加しない。

---

# ファイル構成

以下の順番で記述する。

```ts
import

ファイル内だけで使用する型

ファイル内だけで使用する補助関数

export const serviceFunction = () => {}
```

- Service 関数は名前付き export にする。
- デフォルト export は使用しない。
- 同一ファイル内だけで使用する型と補助関数は export しない。
- Service に Route、Controller、UseCase の 3 行コメントを記載しない。

---

# ファイルとディレクトリの分け方

既存機能の Service を追加・修正する場合は、その機能が採用している次の構成を維持する。

```text
services/example.ts
```

```text
services/example/
├── command.ts
└── query.ts
```

```text
services/example/
├── command/
├── query/
└── index.ts
```

- `query` には取得、件数取得、集計を配置する。
- `command` には作成、更新、削除を配置する。
- `index.ts` は同じ機能の Service を再 export するためだけに使用する。
- `index.ts` に DB 操作やデータ加工を書かない。
- 依頼に含まれない既存 Service の分割、統合、移動は行わない。

---

# import

- ESM 形式で記述し、相対 import には `.js` 拡張子を付ける。
- Sequelize の値、sequelize インスタンス、Model、Service 用の型を責務ごとに import する。
- 型だけを使用する import には `import type` を使用する。
- Model は `/server/src/models` から import する。
- Service の引数型は `/server/src/types/serviceType` または同じファイルから import する。
- Controller、Route、Validator を import しない。
- UseCase を import しない。
- 循環参照を発生させない。

例

```ts
import { Op } from "sequelize";
import type { Transaction, WhereOptions } from "sequelize";

import { Item, Sale } from "../../models/index.js";
import type { ItemListParams } from "../../types/serviceType/items.js";
```

---

# 命名と export

- 関数名は「操作を表す動詞 + 対象」で記述する。
- 取得は `get`、件数取得は `count`、合計は `sum`、作成は `create`、一括作成は `bulkCreate` を使用する。
- 更新は `update`、物理削除は `destroy`、削除処理全体を表す既存命名は `delete` を使用する。
- upsert を実行する関数は `upsert` を使用する。
- 所有者を検索条件に含める関数は `getMyItem`、`getMyShop` のように、通常の取得関数と区別できる名前にする。
- 関連 Model を取得する関数は `getItemWithCategory`、`getUserHasShop` のように、取得内容を名前から判別できるようにする。
- 一覧と件数を同時に返す関数は `getItemsWithCount` のように、複数の結果を返すことを名前で示す。
- Service の配置だけで層を判別できるため、関数名に `Service` 接尾辞を付けない。

例

```ts
export const getItem = ({ itemId }: ItemIdParams) => {
    return Item.findByPk(itemId);
};

export const getMyItem = ({ itemId, userId }: UserItemIdParams) => {
    return Item.findOne({
        where: {
            id: itemId,
            seller_id: userId,
        },
    });
};
```

---

# 引数

- 引数がある Service 関数は、オブジェクト形式で受け取る。
- 引数には `Params` 接尾辞を持つ具体的な型を定義する。
- DB カラムへ保存するデータは、作成または更新を許可するカラムだけを持つ DTO 型にする。
- 識別子、所有者 ID、status、金額などの保護対象カラムを、広い更新型へ混入させない。
- 検索条件を受け取る場合は、対象 Model に対応する `WhereOptions` または具体的な検索条件型を使用する。
- `Request`、`Response`、`NextFunction`、`req.body`、`req.query`、`req.params` を受け取らない。
- 複数の意味を持つプリミティブ値を位置引数で受け取らない。
- 引数がない関数へ空オブジェクトを渡さない。

例

```ts
type UpdateItemParams = {
    item: Item;
    data: UpdateItemData;
    transaction?: Transaction;
};

export const updateItem = async ({ item, data, transaction }: UpdateItemParams): Promise<void> => {
    await item.update(data, { transaction });
};
```

---

# 型

- `any` を使用しない。
- Service の入力型は、実際に検索・作成・更新へ使用する値だけを含める。
- 1 ファイル内だけで使用する型は、その Service ファイル内に定義する。
- 複数の Service または UseCase と共有する型は `/server/src/types/serviceType` に配置する。
- Sequelize Model のインスタンス型には `InstanceType<typeof Model>` または既存の具体的な型を使用する。
- Sequelize の transaction には `Transaction` を使用する。
- 型エラーを隠すための `any`、非 null アサーション、二重型アサーションを使用しない。
- Sequelize の関連取得結果を TypeScript が表現できず型アサーションが避けられない場合は、取得結果を表す具体的な型を定義し、その型にだけ変換する。
- 複数の値を返す関数は、各値の意味が分かるプロパティを持つオブジェクト型を使用する。

---

# 戻り値と非同期処理

- Service は Sequelize の取得結果、作成結果、件数、集計値、またはそれらをまとめたオブジェクトを返す。
- 呼び出し元が作成済み Model または ID を使う場合は、その値を返す。
- 呼び出し元が結果を使わない更新・削除処理は `Promise<void>` を返す。
- DB 操作の結果をそのまま返す関数は、Promise を切り離さず `return` する。
- 複数の DB 操作、結果の抽出、または更新完了の保証がある関数は `async` と `await` を使用する。
- Service 内で開始した Promise を未処理のまま残さない。
- `.catch(console.error)` で DB エラーを握りつぶさない。
- 独立して実行できる DB 操作だけを `Promise.all` で並行実行する。
- 実行順序または同一 transaction が必要な DB 操作は、順番に `await` する。

例

```ts
export const createShop = ({ data, transaction }: CreateShopParams) => {
    return ShopInfo.create(data, { transaction });
};

export const updateShop = async ({ shop, data, transaction }: UpdateShopParams): Promise<void> => {
    await shop.update(data, { transaction });
};
```

---

# 取得処理

- 主キーだけで取得する場合は `findByPk` を使用する。
- 主キー以外の条件、複数条件、所有者条件を使う場合は `findOne` または `findAll` の `where` に条件を記述する。
- 所有権が必要な取得は、対象 ID と所有者 ID を同じクエリの条件に含める。
- 所有者 ID が対象 Model にある場合は、対象 Model の `where` に指定する。
- 所有者を関連 Model から確認する場合は、`include` に所有者条件、`attributes: []`、`required: true` を指定する。
- Service で取得後に `model.user_id === userId` を判定して所有権確認を完了させない。
- 業務上必要な status、公開状態、削除状態は UseCase が決定し、Service は型付けされた検索条件として受け取るか、用途が固定された取得関数の `where` に記述する。
- 取得対象が存在しない場合は `null` または空配列をそのまま返す。
- データの存在を理由に Service から `AppError` を throw しない。

関連 Model で所有者を絞り込む例

```ts
export const getMyAddress = ({ addressId, userId }: AddressUserIdParams) => {
    return Address.findOne({
        where: { id: addressId },
        include: [
            {
                model: User,
                where: { id: userId },
                attributes: [],
                required: true,
            },
        ],
    });
};
```

---

# attributes と include

- 呼び出し元が一部のカラムだけを使う取得では、`attributes` に必要なカラムを列挙する。
- パスワード、token、本人確認情報、口座情報などの機密カラムを、用途を確認せず取得しない。
- 関連データが必要な取得だけに `include` を指定する。
- `include` では Model を明示し、関連名が定義されている場合は `as` を Model の associate 定義に合わせる。
- 関連データの存在が検索条件になる場合は `required: true` を指定する。
- 関連データが存在しなくても親データを返す場合は `required: false` を指定する。
- 絞り込みだけに使う関連 Model は `attributes: []` とし、不要なカラムを結果へ含めない。
- 一覧取得で JOIN により親レコードが重複する場合は `distinct: true` を指定する。
- include、alias、外部キーの指定は Model の associate 定義と一致させる。

---

# 一覧、ページング、件数、集計

- 一覧を絞り込む場合は `where`、返却順を保証する場合は `order`、取得上限を設ける場合は `limit`、ページングする場合は `offset` を明示する。
- `limit` と `offset` は Validator と UseCase を通過した値だけを使用する。
- 一覧と総件数を返す場合は、一覧取得と `count` に同じ絞り込み条件を適用する。
- `count` に関連 Model の条件が必要な場合は、一覧取得と同じ条件の `include` を指定する。
- Service は一覧と `totalCount` を返し、総ページ数や次ページの有無など API 向けの値は UseCase で計算する。
- `sum`、`count`、`MAX` など DB の集計機能で取得できる値は Service で取得する。
- 一覧の Model から関連 Model を取り出すだけの処理は、DB 取得結果の整形として Service に記述してよい。
- 金額、ポイント、割引、在庫などの業務計算を Service に記述しない。

例

```ts
const items = await Item.findAll({ where, limit, offset, order });
const totalCount = await Item.count({ where });

return { items, totalCount };
```

---

# 作成処理

- 作成には Model の `create` または `bulkCreate` を使用する。
- `create` へ渡す値は、許可された作成 DTO または Service 内で明示的に組み立てたオブジェクトにする。
- リクエスト由来のオブジェクトを未検証のままスプレッドしない。
- Model の defaultValue に任せるカラムを、Service で重複して設定しない。
- 複数件を同じ条件で作成し、1 件ごとの hook、作成結果、実行順序を使わない処理では `bulkCreate` を使用する。
- 1 件ごとの hook、作成結果、実行順序を使う処理では、各 `create` を同じ transaction 内で順番に `await` する。
- transaction を受け取った場合は、`create` と `bulkCreate` の options に渡す。

---

# 更新処理

- 取得済み Model を更新する関数は、対象インスタンスと更新 DTO を引数で受け取る。
- 更新にはインスタンスの `update` または、値の明示的な変更後に `save` を使用する。
- JSON や配列カラムを `setDataValue` で更新する場合は、`changed` で変更を明示してから `save` する。
- 更新 DTO には、その関数が更新を許可するカラムだけを含める。
- API 入力全体を `update` へ渡さない。
- 所有権、権限、status による更新可否は UseCase で確認する。
- transaction を受け取った場合は、`update` と `save` の options に渡す。

---

# 削除処理

- 取得済み Model の物理削除にはインスタンスの `destroy` を使用する。
- 条件に一致する複数レコードの削除には Model の `destroy({ where, transaction })` を使用する。
- Sequelize の options は 1 つのオブジェクトにまとめる。`destroy({ where }, { transaction })` のように分割しない。
- 論理削除は、既存 Model が定める status、削除日時、関連カラムを更新する専用関数として実装する。
- 物理削除と論理削除を同じ関数名で曖昧にしない。
- 削除可否と削除順序は UseCase で決定する。
- transaction を受け取った場合は、`destroy` または論理削除の `update` へ渡す。

例

```ts
export const deleteItemLikesByUser = async ({ userId, transaction }: DeleteParams): Promise<void> => {
    await ItemLike.destroy({
        where: { user_id: userId },
        transaction,
    });
};
```

---

# トランザクション

- transaction の開始、commit、rollback は UseCase で管理する。
- Service で transaction を開始しない。
- transaction 対象の Service は、引数オブジェクトで `transaction` を受け取る。
- transaction 内で呼ばれるすべての DB 操作へ、UseCase から受け取った同じ transaction を渡す。
- `create`、`update`、`save`、`destroy`、`bulkCreate`、`upsert` の options に transaction を含める。
- transaction 内の読み取り結果に整合性が必要な場合は、読み取り Service も transaction を受け取り、検索 options に渡す。
- transaction を受け取った Service 内で、対象の DB 操作だけを transaction 外で実行しない。
- transaction を Service の更新データへ混入させない。

例

```ts
await Item.create(data, { transaction });
await item.update(data, { transaction });
await item.destroy({ transaction });
```

---

# 業務ロジックとの境界

- Service は UseCase が決定した検索条件と保存データを DB 操作へ変換する。
- 対象データの存在、所有権、権限、status、他データとの整合性をもとに処理を続行するかどうかは UseCase で決定する。
- API 入力名から DB カラム名への変換と、保存を許可する値の選別は UseCase または専用 mapper で行う。
- Service で複数の DB 操作を組み合わせて業務フローを完成させない。
- Service から別の Service や UseCase を呼び出して処理順序を制御しない。
- DB クエリ固有の関連取得、集計、並び順、取得結果からの単純な関連 Model 抽出は Service に記述する。

---

# エラー処理

- DB エラーは握りつぶさず、呼び出し元へ伝播させる。
- 同じエラーを投げ直すだけの `try/catch` を追加しない。
- データが見つからない場合の業務エラーは UseCase で `AppError` に変換する。
- Service で HTTP ステータスを持つエラーを作成しない。
- パスワード、token、Cookie、個人情報、シークレットをログへ出力しない。
- Service に `console.log`、`console.error` などのデバッグコードを残さない。

---

# SQL とセキュリティ

- Sequelize の query builder、`where`、`Op`、`fn`、`col` を使用し、入力値を SQL 文字列へ直接埋め込まない。
- `literal` が不可欠な固定 SQL 断片にだけ `sequelize.literal` または `literal` を使用する。
- ユーザー入力、検索語、ID、並び順をテンプレートリテラルで SQL へ連結しない。
- 動的な値を生 SQL で扱う場合は、Sequelize の bind parameter または replacements を使用する。
- order のカラム名と方向は、Validator または UseCase で許可リストに限定した値だけを使用する。
- 認証・認可が必要なデータは、公開用 Service と所有者用 Service を分け、所有者用検索から所有者条件を省略しない。

禁止例

```ts
sequelize.literal(`name ILIKE '${keyword}%'`);
```

正しい例

```ts
where: {
    name: {
        [Op.iLike]: `${keyword}%`,
    },
}
```

---

# 禁止事項

- Express オブジェクトの受け取りと操作
- HTTP ステータスまたはレスポンス形式の決定
- Validator が担当する入力検証
- UseCase が担当する業務条件の判定と業務計算
- Controller、Route、UseCase の import
- Service から別の Service を呼ぶ業務フローの実装
- transaction の開始、commit、rollback
- transaction の DB options への渡し忘れ
- 所有権が必要な検索からの所有者条件の省略
- `any` と型回避目的の型アサーション
- ユーザー入力を含む SQL 文字列の組み立て
- DB エラーの握りつぶしと未処理 Promise
- 依頼範囲外の Service 構成変更とリファクタ
