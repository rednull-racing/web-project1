# JSON構文エラーの公開応答方針を整理する

完了（2026-10-19）：ユーザー指示で400/INVALID_JSONの方針を確定し、共有ErrorHandlerとして独立実装・検証した。
独立55件と削除API209件・既存作成24件が成功。レポート本体は `server/test/docs/report/ErrorHandler/errorHandler.md`。
以下は方針確定前の観測・提案として残す。

## 観測と原因

deleteItemDraftのO03テストで、壊れたJSON bodyが認証前のexpress.json()で失敗し、共通errorHandlerで500になることを確認した。
JWTあり/なしの両方で同じ応答となり、usecase・DBへは到達しない。
AppError以外の例外を一律500にする現実装による挙動で、削除APIの現在の観測設計には一致している。

## 対象・参照

- `server/src/app.ts` のparserと認証の順序
- `server/src/middleware/errorHandler.ts`
- `server/test/docs/report/itemDraft/deleteItemDraft.md` のF2
- `server/test/docs/architecture/itemDraft/deleteItemDraft.md` のO03

## 対応方針

まず、全API共通のJSON構文エラーのHTTP・公開code/messageを仕様として決める。
400として扱う場合はbody-parserの構文エラーだけを識別し、安全な応答へ変換する。
任意Errorのstatusを無条件に採用せず、通常DB例外の500と内部情報非公開は維持する。

## 検証内容・注意点

方針確定後にAF-JSON01/02を実装し、JWTあり/なし/不正とJSON構文エラーの組合せ、通常Errorの500維持を確認する。
修正した場合だけO03の期待値を新契約へ更新し、旧観測は同じレポートの履歴に残す。
現時点で本番コードを変更する依頼とはしない。認証より前にparserがある事実を隠すようなテストへ変えない。
