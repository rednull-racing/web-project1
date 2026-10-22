# User・Videoの日時列と反映済みDBのNULL定義を照合する

発見日: 2026-10-22。convertedItemEditingVideo開発中の対象外スキーマ差異。

## 問題と確認済みの原因

- `server/src/models/user.ts` と `server/src/models/video.ts` は `createdAt`・`updatedAt` を `allowNull: false` と定義する。
- `server/.env.test` を出所とするPostgreSQL `test_db` の読み取り専用確認では、上記4列すべてが `timestamp with time zone`・`is_nullable=YES` だった。
- 動画変換DBテストの初回準備で `video.createdAt` の差異を検出した。Videoは対象APIが触れないため、過剰だった非対象Videoのseed・ガードを除いた。その後、必要親Userの `createdAt` でガードが停止した。
- この差異はModelと反映済みDBの定義の相違であり、日時NULLが通常APIから書き込まれることやデータ破損は確認していない。既存NULL件数・本番DBの定義・差異が生じた経緯は未調査。

## 対象・参照

- 対象: `server/src/models/user.ts`、`server/src/models/video.ts`、反映済みDBの対応日時列。方針確定後に必要となる新規migration・テスト。
- 参照: `server/test/fixtures/itemEditing/convertedItemEditingVideo/databaseFixtures.ts`、`server/test/integration/database/itemEditing/convertedItemEditingVideo/database.test.ts`。
- 関連する完了履歴 `docs/todo/done/item-uploaded-at-db-nullability.md` は別テーブル・別カラムの対応であり、本件の対応済み根拠にはしない。既存Todo・doneを検索し同一のUser/Video日時列の記録は見つからなかった。

## 修正方針と実装内容

1. 正規の反映済みスキーマ、Model、作成元DDL/migration、各APIの日時保存契約を調査し、NULL許容の意図を確認する。
2. DB反映後はDBを正とする規約を守り、ModelまたはDBのどちらを変更するかを推測で決めない。NOT NULLへ統一するなら既存NULL行の補完方針も確定する。
3. 確定方針の範囲でModel・必要な新規migration・関連テストを整合させる。既存migrationを書き換えず、実行は別途の明示依頼に従う。
4. 動画変換DBテストの必要ガードが成立した後、未実行のD01〜D07（展開後13件）と必要な回帰を実行し、結果を対応レポートへ追記する。

## 安全性・現時点の結果

- 該当DBテストはseed前停止。本体13件未実行、テスト作成行・cleanup DELETEは0、列挙した3接続のcloseは成功。
- 最終停止時は最初の `src/db.ts` 接続の設定/実DB名 `test_db` とItemEditing全列の存在/NULLを確認し、Userの `createdAt` で停止。残り2接続の後続ガードと動画列の型/FK/default検査は未到達。
- 後続の専用読み取り接続では `.env.test` 由来の設定DB名と実DB名 `test_db` を確認して4列のメタデータだけ取得し、書込みなしでcloseした。
- migration・sync・DB作成・既存行の更新/削除・ガード緩和は行っていない。モデル値の一律補完や既存データの変更を本Todoから自動実施しない。
