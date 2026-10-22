# 下書き保存後の動画変換が削除済み編集セッションを参照する

発見日: 2026-10-22

## 完了結果（2026-10-22）

- item_editing版と同じ契約の `PATCH /item-draft/:id/convert` を実装。下書きID返却とフロント接続も完了した。
- 新規動画は署名済みFormData POST成功後に返却itemDraftIdで変換し、編集中の動画変換とはID・ジョブ・S3/一時パス・制限枠を分離。
- 新API実DB36件、DB非接続と関連回帰676件、作成API実DB148件が成功。静的検査とclient簡易検証も成功。
- 実AWS/ffmpeg・ブラウザの保存→編集再開→公開の通し確認は未実施。画面GET API全体の移行は今回の対象外。
- 現行の下書き作成は元編集行を保持しており、以下の「削除する」は基本設計上の想定。実装との差は[別Todo](../P1-bug/create-item-draft-retains-editing-session.md)へ分離した。
- [詳細設計](../../design/backend/detail/itemDraft/convertItemDraftVideo.md)・[テスト結果](../../../server/test/docs/report/itemDraft/convertItemDraftVideo.md)を参照。

以下は対応前の問題・方針の記録。API実装と接続の未対応記述は上記の結果で解消済み。

## 問題と原因

`POST /item-draft` は成功時に元のitem_editingを削除するが、フロントの下書き保存処理はその後に動画アップロードと `PATCH /item-editing/:id/convert` を呼び出している。
新規動画がある場合、変換処理は削除済みの編集セッションIDを参照する。変換APIは202を先に返すため、受付成功だけでは変換完了を確認できない。

今回のAPI URL置換では、ユーザーの明示指示により下書き保存時の変換呼び出しを維持した。2026-10-22の追加指示により、item_editingの動画変換APIと同様にitem_draftテーブルの動画を変換するAPIを新規作成する方針とする。API実装とフロントの接続変更は未対応。

## 修正方針・実装内容

- item_editingの動画変換APIを参考に、item_draftテーブルの動画をHLS変換するAPIを新規作成する。下書きの所有者認可、非同期の変換受付、変換結果の保存、失敗時の扱いを同様に設計・実装する。
- 下書き保存後の動画アップロード完了時には、新しいitem_draft用の動画変換APIを呼び出す。削除済みのitemEditingIdではなく、保存した下書きのIDを渡せるよう、下書き作成APIのレスポンスとフロントの受け渡しも調整する。
- 保存済み動画の再編集・公開までを含め、変換結果とファイルの引継ぎを確認する。新APIのURL・レスポンス等は実装時の設計で定義する。
- 新規動画あり／なしの下書き保存、編集再開、確認・公開を検証し、削除済みセッションへの変換要求がないことを確認する。

## 対象・参照

- `client/src/app/upload/form.tsx`：fetchDraft成功後のvideoUploadAndConvert呼び出し。
- `client/src/app/upload/hooks/useFileUpload.ts`：S3アップロード後の変換要求。
- `client/src/app/upload/api/video.ts`
- `server/src/usecases/itemDraft/createItemDraft.ts`
- `server/src/controllers/itemEditing/itemEditing.ts`
- `docs/design/backend/itemUpload.md`
- `docs/design/backend/detail/itemEditing/convertItemEditingVideo.md`

## 注意事項

下書き作成と動画変換APIそれぞれの成功だけで、下書き動画の変換成功とみなさない。初回のAPI URL置換時点では修正・実動検証を行っていなかった。今回の実装・検証範囲は冒頭に記録。
