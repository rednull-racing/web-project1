# 下書き保存後の動画変換が削除済み編集セッションを参照する

発見日: 2026-10-22

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

下書き作成と動画変換APIそれぞれの成功だけで、下書き動画の変換成功とみなさない。今回は修正・実動検証を行っていない。
