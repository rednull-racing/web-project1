# 依存パッケージ修正の互換性確認

基準パス: server/。2026-10-22。
Sequelize配下のuuidをCommonJS対応の11.1.1へ限定overrideする変更を対象とする。
本番と同じSequelizeを実行し、PostgreSQLへは接続しない。DB永続化・SQL実行・実transactionは対象外。

| ID  | 優先度 | 入力・操作                                                       | 期待結果                                                              |
| --- | ------ | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| N01 | P0     | UUIDV1/UUIDV4をデフォルト値とするModelを各2回build               | 妥当なversion別UUID、別インスタンスでは異なる値。model validation成功 |
| N02 | P0     | Transactionを2回構築                                             | PostgreSQL query generatorがUUIDv4の異なるtransaction idを生成        |
| E01 | P0     | Sequelizeの解決先にあるuuidのv3/v5へ8byte bufferとoffset=4を渡す | RangeError。無言の部分書込みを許容しない                              |

対象: test/integration/usecases/security/dependencyCompatibility/sequelize.test.ts。
実Sequelize・内部uuidを使い、DB設定読込み・外部サービス・接続を行わない。
関連するmultipartの境界確認は[multipart設計](../multipart/security.md)を参照する。
