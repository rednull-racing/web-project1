# 下書き保存後の動画変換が削除済み編集セッションを参照する

発見日: 2026-10-22

## 問題と原因

`POST /item-draft` は成功時に元のitem_editingを削除するが、フロントの下書き保存処理はその後に動画アップロードと `PATCH /item-editing/:id/convert` を呼び出している。
新規動画がある場合、変換処理は削除済みの編集セッションIDを参照する。変換APIは202を先に返すため、受付成功だけでは変換完了を確認できない。

今回のAPI URL置換では、ユーザーの明示指示により下書き保存時の変換呼び出しを維持した。呼び出し順序・変換タイミングの修正は未対応。

## 修正方針・実装内容

- 下書き保存時には変換しない方針、または編集セッション削除前にアップロード・変換を完了させる方針を確認する。
- 保存済み動画の再編集・公開までを含め、変換タイミングとファイルの引継ぎを設計した上で、保存処理と動画アップロード処理を調整する。
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
