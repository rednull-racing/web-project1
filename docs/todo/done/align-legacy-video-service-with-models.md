# 旧Video Serviceを現在の関連・カラム仕様と照合する

## 進捗（2026-10-15・完了）

- createVideoの削除済みitem_id・user_id保存が残っていたため修正。空の作成データでVideoを作成し、結果を返す。
- 商品作成UseCaseでVideoを先に作成し、同じtransactionのcreateItemへvideoIdを渡してItem.video_idに保存。seller_idとsale_idの保存・商品idの戻り値を維持。
- getMyVideoはVideo.idで絞り込み、Itemへのrequiredなincludeでseller_idを照合する。所有者が一致する関連Itemがない動画は取得しない。
- server全体lint・typecheck通過。DBモックで関連ID・所有者・共通transaction・各作成段階のエラー伝播と後続停止を確認。生成SQLのINNER JOIN・seller_id条件・旧カラム不使用も確認。
- Model・DBスキーマの変更なし。DB接続・migration実行なし。

## 問題の概要・原因（修正前）

onPlayのVideo.item_id参照を修正する作業で、旧Video Serviceにも削除済みカラムの参照が残っていることを確認した。
createVideoはitem_id・user_idを作成データへ渡し、getMyVideoはuser_idで検索するが、現在のVideo Modelには両カラムがない。
Itemがvideo_id・seller_idを保持するため、作成時の関連設定と所有者の確認方法を現在の仕様と照合する。

## 対象・参照ファイル

- `server/src/services/video.ts` のcreateVideo・getMyVideo
- `server/src/types/serviceType/video.ts`
- `server/src/models/video.ts`、`server/src/models/item.ts`
- 該当Serviceの呼び出し元と動画作成・更新の仕様

## 修正方針・実装内容

各ディレクトリのAGENTS.mdを確認する。
修正対象にする場合は、作成したVideo.idをItem.video_idへ設定する流れと、Item.seller_idによる所有者確認を整合させる。
作成・関連更新のtransactionと認可を維持し、lint・typecheck・関連取得の確認を行う。

## 実装時の注意事項

旧APIを参考用に残すユーザー方針に従い、明示的な依頼があるまで旧Serviceは変更しない。
Videoへitem_id・user_idを独断で復活させない。
今回の修正はonPlayの関連Item取得に限定している。
