# validators/AGENTS.md

## 対象

このディレクトリ内の Validator を作成・修正する場合に適用する。

## このディレクトリの役割

各 Route が受け取る入力値を検証する Zod schema と、その推論型を定義する。

Validator は入力値の構造と形式を扱う。
データの存在、所有権、権限、status などの業務条件は UseCase で確認する。

## ディレクトリ

- `/body`
    - `req.body` の schema を配置する。
- `/params`
    - `req.params` の schema を配置する。
- `/query`
    - `req.query` の schema を配置する。

admin、maintenance などの下位ディレクトリは、対応する Route の機能構成に合わせる。

## Route との関係

- body schema は `validateBody` から使用する。
- params schema は `validateParams` から使用する。
- query schema は `validateQuery` から使用する。
- schema は対応する Controller より前の middleware として Route に指定する。
- Route や Controller に同じ入力検証を重複して実装しない。

## コーディング規約

Validator の実装は、次の規約に必ず従う。

`/docs/codingRule/backend/validator.md`

schema の構成、命名、型推論、値変換、レイヤー境界などの詳細はコーディング規約を参照する。

## スコープ管理

- 現在依頼されている範囲以外は変更しない。
- 依頼に含まれない Validator の移動、統合、分割、命名変更は行わない。
- 対象外の問題は、ルートの `AGENTS.md` と `/docs/todo/AGENTS.md` に従って Todo に記録する。
