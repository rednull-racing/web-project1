# Node.js 26でsequelize-cliが設定を読み込めない問題を解消する

発見日: 2026-10-22。優先度: P3-techdebt。User日時列のNOT NULL migration適用準備中に発見。

## 問題と確認済みの原因

- `server/package.json` のNode.js要件は `>=26.12.1 <27`、パッケージは `type: module`。`migration:run`／`migration:revert` は `sequelize-cli` を呼び出す。
- Node.js 26.12.1で `server/` から次を実行すると、DB操作前に `.sequelizerc` の読込みで停止した。

```bash
node node_modules/sequelize-cli/lib/sequelize db:migrate --help
```

```text
ReferenceError: require is not defined in ES module scope
```

- `server/.sequelizerc` は `require("path")` と `module.exports` によるCommonJS記述。今回の実行環境ではESMとして評価されており、これが確認済みの最初の停止原因。
- `server/config/config.cjs` はCommonJS形式、既存migrationはESMの `export default`。設定読込みを直した後のCLIによるESM migration読込み・up/downの互換性は未検証であり、同じ原因と断定しない。
- User日時の今回対応は、対象ESM migrationだけを直接実行し履歴を記録する専用スクリプトで両DBへの適用を完了した。これは通常のCLIコマンドが復旧した根拠にはしない。

## 対象・参照

- 対象候補: `server/.sequelizerc`、`server/config/config.cjs`、`server/package.json` のmigrationコマンド。必要な検証・運用手順も対象とする。
- 参照: `server/migrations/AGENTS.md`、`server/migrations/20261021071500-enforce-item-timestamps-not-null.js`、`server/package-lock.json`、`docs/todo/done/user-video-timestamps-db-nullability.md`。
- 関連Todoと `done/` を検索し、同じCLI起動不具合の既存記録は見つからなかった。NULL制約差異とは原因・対応範囲が異なるため、本Todoへ分けて記録する。

## 修正方針と実装内容

1. 指定Node.jsバージョンとインストール済みsequelize-cliの版・設定探索方法を確認し、DB操作を伴わない `--help` 等で設定読込みの停止を再現する。
2. 既存のESM migration方針を維持し、設定ファイルの形式・CLIの設定指定方法・migration読込み方法を整合させる。新規ライブラリ追加や既存migrationの一括書換えを独断で行わない。
3. CLI起動と設定読込みを先に検証し、その後にESM migrationの読込み、`up`／`down` の呼出しと適用履歴管理の整合を検証する。設定の初期エラーが消えただけで完了にしない。
4. 接続設定の環境別読込みも確認する。`config.cjs` のdotenvは現在 `./.env` を指定しているため、テスト指定時に意図した `test_db` へ接続することを設定元・実DB名の両方で確認する。秘密値をログへ出力しない。
5. DB変更を伴う確認は明示的に許可された接続先・migrationだけで行う。CLI全体の動作確認を理由に未適用migrationを一括実行したり、実DBをundoしたりしない。今回のUser日時2列の適用許可を、本TodoのDB変更許可に拡張しない。
6. 通常のmigration作成・適用・復旧コマンドと環境指定方法を記録し、直接実行したmigrationの既存履歴を保護する。適用済み履歴の削除・DBリセット・`sequelize.sync()` で解決しない。

## 完了条件・現在の結果

- Node.js要件内の環境で通常のCLI設定読込みが成功し、ESM migrationと履歴管理を含む適用／復旧手順を検証・記録している。
- 環境別の接続先を確認し、未許可のDB変更や既存データ／適用履歴の破壊を行っていない。
- 本依頼では記録のみ。設定・コマンド・依存関係は未変更、CLI互換性の修正と再検証は未実施。

## 2026-10-22 依存脆弱性修正に伴う部分対応

旧生成ライブラリの除去に伴い、npmのmig:generate/migration:generateはsequelize-cliの雛形生成へ変更した。
4つのmigration用npmコマンドに`--options-path config/cli-options.json`を追加し、旧.sequelizercの自動読込みを回避。
Node.js 26.12.1でgenerate/run/revertの`--help`が成功。DB操作、実環境の接続先検査、既存ESM migrationと履歴管理は未検証。
直接`npx sequelize-cli ...`で旧.sequelizercを読む経路は未変更。明示optionsを付けるかnpmコマンドを使う。
この部分対応だけでは本Todoの完了条件を満たさないためP3へ保持する。
