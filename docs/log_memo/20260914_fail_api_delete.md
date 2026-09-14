# 間違えて必要なAPIを消しちゃった😅

## 必要だったAPI

`/shop-info/:id/bank-account`

## 消しちゃったタイミングと理由

`/shop-signup/:id/bank-account`

shopSignupテーブル作成によるshop登録システム見直し時の話。

/shop-signup/step2の口座登録用にこれを`/shop-info/:id/bank-account`を参考に作り直そうと作業していたが、うっかり`/shop-info/:id/bank-account`が/shop-signup/step2でしか使用していなく、不要になったと思い込んでしまった。

実際には/edit/account/shopページでも使用していたが、通常のshopInfoとshopSignupそれぞれのページでAPIを分ける作業に取り掛かったときに発見した。

## 再発防止策

必ず削除前にVSCodeの検索機能やExcelのAPIリストにAPIを使用する箇所が無いか確認する。

バックエンドAPIの3行コメントのpage部分を改善できないか検討してみる。

---

ただ、この2週間のshopSignupリファクタで、残念ながら他にもうっかり消してしまったところあるかも😅
