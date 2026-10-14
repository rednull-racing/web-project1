# Model コーディング規約

## 基本方針

- Modelを唯一の正（Single Source of Truth）とする。
- DB設計は必ずModelから始める。
- migrationはModelを忠実に反映して作成する。
- Modelのみを変更せずmigrationだけ変更することは禁止。
- ModelにはDB設計を完全に表現するため、型・制約・外部キー情報を省略せず明示的に記述する。

---

# ファイル構成

以下の順番を必ず守る。

```ts
import

型定義(type)

class

associate()

associations

init()

export default
```

---

# import

- 外部ライブラリ
- sequelizeインスタンス
- 関連Model

の順に記述する。

例

```ts
import { Association, DataTypes, Model } from "sequelize";
import sequelize from "../db.js";

import User from "./user.js";
import Shop from "./shop.js";
```

---

# 型定義

Model専用で使用するJSON型などはclassより前に定義する。

例

```ts
type SelectedVariant = {
    color?: string;
    size?: string;
    [key: string]: string | undefined;
};
```

---

# class

## declare

DBカラムはすべてdeclareする。

nullableなら

```ts
string | null;
```

```ts
number | null;
```

```ts
Date | null;
```

とする。

createdAt

updatedAt

も必ずdeclareする。

例

```ts
class Test extends Model {
    declare id: number;
    declare title: string;
    declare createdAt: Date;
    declare updatedAt: Date;
}
```

---

# associate()

belongsTo

hasOne

hasMany

belongsToMany

を定義する。

foreignKeyは必ず明示する。

例

```ts
static associate() {
    Item.belongsTo(User, {
        foreignKey: "user_id",
    });
}
```

---

# associations

Association型を必ず定義する。

例

```ts
static associations: {
    User: Association<Item, User>;
};
```

---

# init()

initにはDB設計を完全に表現する。

以下は必ず省略しない。

- type
- allowNull
- defaultValue
- primaryKey
- autoIncrement
- unique
- references
- onDelete
- onUpdate

DataTypes.INTEGERの省略記法は禁止。

❌

```ts
user_id: DataTypes.INTEGER;
```

必ず

✅

```ts
user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
}
```

と書く。

---

# references

外部キーを持つ場合は必ず記述する。

例

```ts
references: {
    model: "user",
    key: "id",
},
```

---

# onDelete / onUpdate

外部キーを持つ場合は必ず記述する。

例

```ts
onDelete: "CASCADE",
onUpdate: "CASCADE",
```

---

# defaultValue

defaultValueを持つ場合は必ず記述する。

例

```ts
defaultValue: {},
```

または

```ts
defaultValue: DataTypes.NOW,
```

---

# createdAt / updatedAt

Modelでは通常カラムとして必ず定義する。

例

```ts
createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
},
updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
},
```

また、Modelオプションでは

```ts
timestamps: true,
```

を必ず指定する。

---

# Modelオプション

必ず以下を書く。

```ts
{
    sequelize,
    modelName: "Item",
    tableName: "item",
    freezeTableName: true,
    timestamps: true,
}
```

---

# 命名規則

テーブル名

```
snake_case
```

カラム名

```
snake_case
```

Model名

```
PascalCase
```

型名

```
PascalCase
```

ローカル変数

```
camelCase
```
