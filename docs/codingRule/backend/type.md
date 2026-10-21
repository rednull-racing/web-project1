# Type コーディング規約

## 基本方針

- `/server/src/types` には、複数ファイルで共有する TypeScript の型を配置する。
- 型は、実際に取り得る値、オブジェクトの構造、nullable、プロパティの有無を正確に表現する。
- 1 ファイル内だけで使用する型は、使用するファイル内に定義する。
- 型定義に業務ロジック、入力検証、DB 操作、HTTP 処理を書かない。
- `any` を使用して型チェックを無効化しない。
- API、Model、Service、保存済み JSON など、型が表す対象の実際の契約を確認してから定義する。

---

# ファイル構成

通常の型ファイルは、以下の順番で記述する。

```ts
import

型の元になる runtime 定数

export type

runtime 定数に対応する値
```

- import がない場合は型定義から記述する。
- 型は名前付き export にする。
- デフォルト export は使用しない。
- 同じ責務の型は 1 ファイルにまとめる。
- 型の責務が異なる場合はファイルを分ける。
- 依頼に含まれない既存型の移動、統合、分割は行わない。

型だけでなく実行時にも同じ値の一覧が必要な場合は、`as const` の定数から union 型を生成する。

例

```ts
export const ACCOUNT_TYPES = ["ordinary", "checking", "savings"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
```

---

# ファイルの配置

- 複数の層や機能で共有するドメイン型は `/server/src/types` 直下へ配置する。
- Service のパラメータ型と Service の取得結果を表す共有型は `/server/src/types/serviceType` へ配置する。
- Validator の入力型は schema から推論し、Validator または既存の Validator 用型ファイルへ配置する。
- Sequelize Model のカラム定義は Model に記述し、`types` へ複製しない。
- Express や外部モジュールの型拡張は `.d.ts` ファイルへ配置する。
- ファイルの配置先は、その型を最初に使った場所ではなく、その型が表す責務で決定する。

---

# ファイル名

- 通常の型ファイル名は、対象を表す camelCase にする。
- `.d.ts` は、拡張する対象が分かる名前にする。
- `/server/src/types/serviceType` のファイル名は、対応する Service の機能名に合わせる。
- `type.ts`、`common.ts`、`data.ts` のように対象を判別できない名前を使用しない。
- 同じ責務の型を別表記のファイルへ重複して作成しない。

例

```text
bankSnapshot.ts
itemAttributes.ts
purchaseSnapshot.ts
express.d.ts
serviceType/items.ts
```

---

# import

- ESM 形式で記述し、相対 import には `.js` 拡張子を付ける。
- 型としてだけ使用する依存は `import type` で読み込む。
- runtime 定数を使用する場合だけ、通常の import を使用する。
- `InstanceType<typeof Model>` のためだけに Model を参照する場合は type import にする。
- Sequelize の `Transaction`、`WhereOptions`、`Order`、`InferAttributes` を型としてだけ使用する場合は type import にする。
- `Op.gt`、`Op.lt` などを computed property key に使用する場合は、`Op` を通常の import で読み込む。
- 循環 import を発生させない。

例

```ts
import { Op } from "sequelize";
import type { InferAttributes, Transaction, WhereOptions } from "sequelize";

import type { Item } from "../../models/index.js";
```

---

# 型名

- 型名は PascalCase にする。
- Service 関数の引数オブジェクトには `Params` 接尾辞を付ける。
- 作成処理の引数は `Create...Params`、更新処理の引数は `Update...Params`、削除処理の引数は `Delete...Params` または `Destroy...Params` とする。
- ID だけを受け取る型は、対象を含む `ItemIdParams`、`UserIdParams` のような名前にする。
- Model インスタンスを表す型は `ItemInstance` のように `Instance` 接尾辞を付ける。
- スナップショットは `BankSnapshot`、`PurchaseSnapshot` のように `Snapshot` 接尾辞を付ける。
- 関連取得結果は `ItemLikeWithUser` のように、追加される関連を名前へ含める。
- `Data`、`Info`、`Result` だけで用途が判別できない型名を使用しない。

---

# オブジェクト型

- 通常のオブジェクト、union、配列要素の型には `type` を使用する。
- `interface` は declaration merging または module augmentation が必要な `.d.ts` で使用する。
- プロパティには実際の値型を指定し、広い `object`、`Object`、`Function` を使用しない。
- プロパティ名は、その型が表すデータの名前と一致させる。
- DB カラム、保存済み JSON、スナップショットを表すプロパティは、実データの snake_case を維持する。
- Service 関数の引数名は、Service 実装で使用する camelCase を維持する。
- 型定義の都合だけでプロパティ名を変換しない。
- ネストしたオブジェクトも、各プロパティの型を具体的に記述する。
- 値が配列であることだけを示す `unknown[]` を、要素型が判明しているデータに使用しない。

例

```ts
export type PurchaseSnapshot = {
    item_id: number;
    item_name: string;
    category: {
        id: number;
        name: string;
    };
};
```

---

# optional と null

- プロパティ自体が存在しない場合だけ `?` を付ける。
- プロパティが存在し、値が空になり得る場合は `| null` を使用する。
- 「省略できる」と「null を格納できる」の両方が契約に含まれる場合は `property?: Type | null` とする。
- 空文字が有効な値として契約に含まれる場合だけ `""` を union に含める。
- 実際には必須のプロパティを、呼び出し側の都合で optional にしない。
- Model の nullable と作成・更新 DTO の nullable を混同しない。各操作で渡せる値だけを型へ含める。

例

```ts
type Profile = {
    profile_image?: string;
    introduction: string | null;
    homepage_url?: string | null;
};
```

---

# literal union と runtime 定数

- 取り得る文字列が有限の場合は、`string` ではなく literal union を使用する。
- 実行時にも値の一覧を使う場合は、`as const` の配列またはオブジェクトを定義し、そこから型を生成する。
- runtime 定数と union 型へ同じ値を別々に手書きしない。
- 値と表示名の対応は `Record<UnionType, string>` のように、すべての値を網羅する型で定義する。
- DB または API が任意の文字列を受け付ける契約の場合だけ `string` を使用する。

例

```ts
export const STATUSES = ["pending", "paid", "completed"] as const;

export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
    pending: "処理待ち",
    paid: "支払い済み",
    completed: "完了",
};
```

---

# 共有と再利用

- 同じ契約を複数ファイルで使用する場合は、責務に合う型ファイルから import する。
- 同じ名前と構造の型を複数ファイルへ複製しない。
- 既存型と一部のプロパティだけが異なる場合は、両者が同じ契約か確認する。
- 契約が同じ場合は既存型、`Pick`、`Omit`、または既存型を構成する共通型を使用する。
- 契約が異なる場合は、構造が似ていても別の型として定義する。
- 型の重複を減らす目的だけで、異なる API、DB 操作、スナップショットの契約を 1 つに統合しない。
- 広い共通型を作り、各利用箇所で型アサーションして使い分けない。

---

# Snapshot と JSON 型

- DB に保存する Snapshot と JSON カラムの型は、保存されるデータ構造を完全に表現する。
- 保存後も必ず存在する値は必須プロパティにする。
- 保存時に省略される値と null で保存される値を区別する。
- Snapshot に Sequelize Model、Express オブジェクト、関数を含めない。
- Snapshot の型へ現在の関連 Model 全体を流用しない。
- JSON カラムの型は、Model の declare、作成・更新 DTO、利用側で同じ構造を参照できる共有型にする。
- JSON の任意キーを仕様として許可していない場合は、`[key: string]: unknown` を追加しない。

---

# 宣言ファイル

- `.d.ts` は、既存ライブラリの型拡張、グローバル型、型定義を持たない外部モジュールの宣言にだけ使用する。
- Express の Request 拡張は `express.d.ts` に記述する。
- 認証 middleware が設定する値は、実際に設定されるプロパティと optional 条件を一致させる。
- 外部モジュールの宣言はモジュール名ごとに 1 回だけ記述する。
- 同じ `declare module` を重複して記述しない。
- 既存の型定義を持つライブラリへ、内容のない `declare module` を追加して型を消去しない。
- 型定義を持たない外部モジュールを宣言する場合は、実際に使用する export の型を具体的に記述する。
- `.d.ts` に実行時の値や処理を記述しない。

Express Request 拡張の例

```ts
declare namespace Express {
    interface Request {
        user?: {
            id: number;
            name: string;
        };
    }
}
```

---

# serviceType

`/server/src/types/serviceType` には、`/server/src/services` で共有するパラメータ型と取得結果型を配置する。

- 対応する Service の機能単位でファイルを分ける。
- Service 関数の引数と `Params` 型のプロパティを一致させる。
- ID、検索条件、ページング値、作成・更新データ、Model インスタンス、transaction のうち、その関数が受け取る値だけを含める。
- 作成・更新の `data` には、その Service 関数が DB へ渡せるカラムだけを含める。
- 所有者条件が必要な取得型には、対象 ID と `userId` を含める。
- Model インスタンスは `InstanceType<typeof Model>` で表す。
- Sequelize の検索条件は、対象 Model のインスタンス型に対応する `WhereOptions` または具体的な条件オブジェクトで表す。
- Model クラスを直接 import して検索条件を定義する場合は、`WhereOptions<InferAttributes<Item>>` のように Model の属性型を指定する。
- 一覧の並び順には Sequelize の `Order` を使用する。
- transaction を必ず使う Service では `transaction: Transaction` とする。
- transaction の有無どちらでも実行する Service では `transaction?: Transaction` とする。
- 関連取得結果は Model インスタンス型と関連プロパティを組み合わせ、関連が存在しない場合は `| null` を明示する。
- 1 つの Service ファイル内だけで使う型は Service ファイル内へ定義する。
- HTTP の Request、Response、NextFunction、ステータスコード、Validator の schema を含めない。
- 業務上の処理順序、計算、存在確認を型として表現しようとしない。

例

```ts
export type UpdateItemParams = {
    item: InstanceType<typeof Item>;
    data: {
        price: number;
    };
    transaction: Transaction;
};
```

---

# Validator、Model、Service との境界

- 入力値の形式、文字数、範囲を検証する処理は Validator に実装する。
- Validator で検証した値の型は、schema から推論された型または既存の Validator 型を使用する。
- DB カラムの型と nullable は Model を正とし、Model と矛盾する保存 DTO を作成しない。
- Service の引数型は Service の関数シグネチャと DB 操作を表し、HTTP リクエスト全体を表さない。
- 型ファイルで値の変換、default 値の適用、認証、認可を行わない。
- 型だけで入力値の安全性が保証されたと判断せず、外部入力は Validator で検証する。

---

# 型安全性

- `any` を使用しない。
- 外部から入り、まだ型を判定できない値には `unknown` を使用し、利用側で絞り込む。
- `Record<string, unknown>` を、既知のプロパティを持つデータの代わりに使用しない。
- 型エラーを回避するためだけの型アサーション、二重型アサーション、非 null アサーションを前提にした型を作成しない。
- 配列、union、Model インスタンス、Sequelize 検索条件には、それぞれの具体的な型を使用する。
- `string` や `number` へ広げると不正な値を許す有限集合には literal union を使用する。
- 型の利用側で毎回プロパティ存在確認が必要になるような、根拠のない optional を追加しない。

---

# コメント

- 型名とプロパティ名だけで意味が分かる場合はコメントを付けない。
- 単位、保存形式、互換性など、型だけでは表現できない制約がある場合は短いコメントを付ける。
- 処理内容、実装手順、未確定の仕様をコメントへ記載しない。
- Route、Controller、UseCase の 3 行コメントを型ファイルへ記載しない。

---

# 禁止事項

- `any`、`Object`、`Function` による型情報の消去
- 既知の構造に対する広い index signature と `Record<string, unknown>`
- 型回避だけを目的とする型アサーションと非 null アサーション
- 1 ファイル内だけで使う型の共有ディレクトリへの追加
- 異なる契約を持つ型の無理な共通化
- Model、Validator、Service と矛盾するプロパティ型
- 型ファイルへの業務ロジック、DB 操作、HTTP 処理、入力検証の追加
- runtime 定数と literal union の値の重複定義
- `.d.ts` 内の重複した module 宣言
- 既存ライブラリ型を失わせる空の module 宣言
- 依頼範囲外の既存型の移動、改名、統合、分割
