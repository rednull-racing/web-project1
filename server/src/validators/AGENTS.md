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

## 単体テストの共通ルール

本節はこのディレクトリ配下の単体テストに適用する。上位の [src/AGENTS.md](../AGENTS.md) の単体テスト共通ルールと、対象までのAGENTS.mdを読む。対象本番コードに最も近いtestへ配置し、fixtureはserver/test/fixturesの大分類/小分類に置く。

- 実 schema の `safeParse`／`parse` を使う。受理・拒否に加え、変換後の値、未知キーの除去、入力順の保持など対象の契約を確認する。
- validateBody／validateParams の成功時は検証済み値の格納と `next` の呼出しを確認する。失敗時はエラーと、正常系の `next` や検証済み値の設定が行われないことを確認する。
- 独自 refinement は拒否の有無だけでなく、エラーが付く項目・配列位置を確認する。
- schema で受理されることと、usecase の業務条件を満たすことを分ける。usecase や helper への直接呼出しで middleware の検証まで実行されると仮定しない。
- 数値・文字列・null・undefined・欠落、空配列と入れ子、上下限の直前/一致/直後を分ける。未知キー除去・独自refinementのpathと条件間の優先順位を確認する。
- Expressの部分Request/Responseや意図的な型不正入力への型アサーションは必要最小限にし、通常のHTTP経路では到達しない入力は前提を明示する。
