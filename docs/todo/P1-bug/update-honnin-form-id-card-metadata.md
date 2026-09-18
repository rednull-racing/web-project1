# 本人確認フォームの旧IdCardプロパティ参照を更新する

## 問題と原因

`client`で`npm run typecheck`を実行すると、`honninEditForm.tsx`の36〜40行付近に4件のTS2339が発生する。`IdCard`型が`FrontIdCard`・`RearIdCard`のS3Metadataを持つ構造に変わった一方、フォームは削除済みの`id_card_front`・`id_card_rear`を参照している。

## 修正方針・実装内容

本人確認の取得APIと身分証画像の取得経路を確認し、フォームの初期値・プレビューを現在のメタデータ構造に合わせる。既存画像の維持と画像差し替えを確認し、`client`のlint・typecheckを実行する。

## 対象・参照ファイル

- `client/src/app/edit/honnin/honninEditForm.tsx`
- `client/src/app/edit/type.ts`
- `client/src/app/edit/api/honnin/client.ts`

## 注意事項

型アサーションや旧プロパティの型追加だけでエラーを隠さない。身分証の非公開性を保ち、認証済みの画像取得方式に合わせる。代表者氏名編集のアップロード方式変更とは別タスクとして扱う。
