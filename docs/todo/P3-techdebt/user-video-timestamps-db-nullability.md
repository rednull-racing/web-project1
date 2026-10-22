# 全Modelと実DB・test_dbのNULL制約をModelに合わせる

発見日・方針確定日: 2026-10-22。優先度: P3-techdebt。
User・Videoの日時列の差異を起点に、同じ問題の再発防止として全Modelへ調査対象を広げる。
既存レポートから参照されるため、ファイル名は維持する。

## 現在の方針と対応範囲

- ユーザーは、Modelと実DB・テストDBでNOT NULL制約が異なる箇所を、Modelに合わせる方針を明示した。ModelとDBのどちらを正とするかは確認済みであり、未確定ではない。
- `user.createdAt`・`user.updatedAt` は、新規migration `20261022080000-enforce-user-timestamps-not-null.js` を `neondb`／`test_db` へ適用して2026-10-22に対応完了。両DBで2列のNOT NULL、型 `timestamp with time zone` とdefault `now()` の保持、適用履歴各1件を確認した。事前NULL件数は両列とも0で、既存行の補完・削除は行っていない。
- その他の列は、本依頼ではTodoへの記録まで。`video.createdAt`・`video.updatedAt` と全Modelの棚卸し・整合は未完了であり、本Todoを `done/` へ移動しない。
- Modelの `allowNull: false` に対しDBがNULL許容の差異と、ModelがNULL許容なのにDBがNOT NULLの差異を両方調べ、DB側をModelへ揃える。差異の解消目的でModelの制約を緩和しない。

## 問題と確認済みの原因

- `server/src/models/user.ts` と `server/src/models/video.ts` は `createdAt`・`updatedAt` を `allowNull: false` と定義する。
- 初回の `server/.env.test` 由来PostgreSQL `test_db` の読み取り専用調査では、上記4列がすべて `timestamp with time zone`・`is_nullable=YES` だった。これは初回調査時点の記録であり、今回のmigration適用後の状態を示すものではない。
- 動画変換DBテストの初回準備で `video.createdAt` の差異を検出した。対象APIが触れないVideoの過剰なseed・ガードを除いた後、必要親Userの `createdAt` で停止した。
- 確認済みの直接原因はModelとDBのNULL制約の相違。差異が生じた経緯、通常APIから日時NULLが保存されること、データ破損は確認していない。
- 初回調査では既存NULL件数・実DBの定義・全Modelの差異一覧は未確認。Userの今回対応結果と、残る列の未調査事項を分けて管理する。

## 対象・参照

- 調査対象: `server/src/models/` の全Modelと、実DB・`test_db` の対応テーブル／カラム。日時列やUser・Videoだけに限定しない。Modelのテーブル名・`field`・自動生成属性・関連付け適用後の実効 `allowNull` も確認する。
- 変更対象: 調査で確定した差異に対応する `server/migrations/` の新規ESM migration、必要な検証・結果文書。既存Model・APIの業務仕様変更や、NULL制約以外のスキーマ整合は本Todoの対象外。
- 起点Model: `server/src/models/user.ts`、`server/src/models/video.ts`。関連fixture: `server/test/fixtures/itemEditing/convertItemEditingVideo/databaseFixtures.ts`。
- 検証・結果の参照: `server/test/integration/database/itemEditing/convertItemEditingVideo/database.test.ts`、`server/test/docs/report/itemEditing/convertItemEditingVideo.md`。
- 関連完了履歴: `docs/todo/done/item-uploaded-at-db-nullability.md` と `server/migrations/20261021071500-enforce-item-timestamps-not-null.js`。Itemの対応済み履歴をUser・Videoや他Modelの解消根拠にしない。
- 別件: `docs/todo/P3-techdebt/sequelize-cli-node26-esm-compatibility.md` はNode.js 26でのCLI設定読込み停止。NULL制約差異と原因を分けて扱う。
- 着手時は本Todo全文、対象に適用されるAGENTS.md、関連migration・設計・最新レポートを読み、既存Todo／`done/` と適用済みmigration履歴を照合して重複対応を避ける。

## 修正方針と実装内容

1. 実DBと `test_db` それぞれの設定元・接続先DB名・スキーマ名を確認し、読み取り専用で全対象列のメタデータを取得する。接続情報の秘密値は記録しない。
2. Modelの実効 `allowNull` と両DBの `is_nullable` を比較し、DBごとにテーブル・列・Model値・DB値・既存NULL件数・対応済みmigration・残件を一覧化する。列不存在や型など別種の差異はNULL制約差異と分けて記録し、独断で修正範囲を広げない。
3. NOT NULL化する列は事前に既存NULL行と依存するAPI契約を確認する。NULL行があれば中断し、補完値・補完元・削除の可否を確認する。現在時刻や他日時の一律補完、既存行の削除を推測で行わない。
4. Modelに合わせ、NOT NULL化は `SET NOT NULL`、NULL許容化は `DROP NOT NULL` を行う新規ESM migrationを作成する。`up`／`down` を実装し、適用前のNULL制約へ戻す定義を明示する。両DBで初期状態が異なる場合は適用／復旧方法を先に確定する。
5. 列の型・default・FK（参照先と更新／削除動作）・unique・主キーを保持する。主キーなど他制約とModelのNULL許容方針が両立しない場合は中断して確認する。必要なtransaction・ロックと適用影響を検討し、既存migrationの編集や `sequelize.sync()` による補正はしない。
6. 実DB／`test_db` への実行は対象と実行許可を確認して行う。今回のUser日時2列の実行指示を、他列のmigration実行許可と解釈しない。NOT NULLへ戻す `down` は新たなNULL行により失敗し得るため、事前検査と中断条件を備え、データを削除して通さない。
7. 適用後は両DBのメタデータを再比較し、NULL制約・既存NULL件数・他制約の保持・migration履歴を確認する。`test_db` では関連する実DBテストと必要な回帰を実行し、実SQLのNOT NULL拒否とModel validationを区別する。実DBへテスト用データを作らない。
8. 再発防止として今後のModel／migration変更時にも両DBとのNULL制約比較を確認手順へ含める。検出・修正・検証結果をDB別に残し、未対応差異を一覧で追跡する。

## 完了条件

- 全Modelの対応列を実DB・`test_db` と比較し、差異一覧と適用前後の根拠を記録している。
- 確認が必要なデータ補完・制約矛盾を解決したうえで、全対象のNULL制約がModelと一致している。
- 型・default・FK・unique等の保持、適用履歴、必要なテスト結果と復旧手順を記録している。未実行の確認を成功扱いにしない。
- User対応や動画変換テスト再開だけで全体完了としない。Videoと全Modelの残件を解消し、完了日・結果・関連レポートを記録してから `done/` へ移動する。

## 初回停止時の安全性記録

- 該当DBテストはseed前停止。本体D01〜D07（展開後13件）は未実行、テスト作成行・cleanup DELETEは0、列挙した3接続のcloseは成功した。
- 最初の `src/db.ts` 接続の設定／実DB名 `test_db` とItemEditing全列の存在／NULLを確認し、Userの `createdAt` で停止。残り2接続の後続ガードと動画列の型／FK／default検査は未到達だった。
- 後続の専用読み取り接続では `.env.test` 由来の設定DB名と実DB名 `test_db` を確認して4列のメタデータだけを取得し、書込みなしでcloseした。
- 以上は初回停止時の履歴。今回のUser migrationと動画変換DBテストの再実行結果は、対応レポートの最新結果と照合する。
