# 出品した商品一覧 テスト設計

作成日: 2026-11-13。対象URL: /item-list/uploaded。
パスは、特記のない限りclient/基準。E2Eはリポジトリルートtest/基準。
結果は[レポート](../../report/item-list/uploaded.md)へ記録する。

## 根拠・範囲

仕様の根拠はsrc/app/item-list/uploaded/AGENTS.md、同page.tsx・uploadedItemList.tsx・uploadedItem.tsx・api/client.ts、
親のtabHeader.tsx・itemListHeaderUI.tsx・types.tsと共通fetcher。
APIはserver/src/routes/items.tsのGET /items/list/uploaded、
controllers/items/items.ts、services/items/query/list/userItemList.tsを照合する。
既存の一覧返却整合履歴はdocs/todo/done/align-item-list-response-with-client.md（ルート基準）。
ユーザー指示によりF1の取得失敗表示を本番UIにも反映する。
取得失敗時は0件と同じ「商品が見つかりません」を表示し、一覧とページネーションを非表示にする。未取得中は空案内を出さない。
API変更、DB構造変更、migration実行は対象外。

Pageがtab（省略時all）をタブと一覧へ渡す。一覧は入力値・確定検索語・ページ番号から
URLを作りSWR→fetcher→Bearer認証付きGET→wrapped配列→商品行・Paginationの順で接続する。
allはstatusなし、sellingはactive、soldはsoldout。不正/未指定タブはURL null。
バックエンドが本人・status条件、20件単位、uploaded_at DESC/id DESCを保証する。
価格はnumber|string、name/image/Video/Saleはnullable。日時はISO文字列。
表示時にラップ解除を行い、IDは数値で詳細リンクへ渡す。

## 配置・境界・fixture

| レベル | 配置 | 実処理・置換 |
| --- | --- | --- |
| 単体URL | src/app/item-list/uploaded/api/test/client.test.ts | URL生成実物、環境変数のみ固定 |
| 単体行 | src/app/item-list/uploaded/test/uploadedItem.test.tsx | 行・画像・価格実物、実ネットワークなし |
| コンポーネント結合 | test/integration/components/item-list/uploaded/list/integration.test.tsx | SWR/検索/ページ/行/fetcher実物、MSWで実ルートHTTP境界、token取得のみ固定 |
| ページDOM結合 | test/integration/pages/item-list/uploaded/page.test.tsx | 実タブ・ページ枠・一覧を接続、router要求をspy、共通barrelは対象部品に限定 |
| E2E | test/E2E/item-list/uploaded/getUploadedItemList/flow.spec.ts | Next/Express/DB実接続。業務APIは置換しない |

fixtureはtest/fixtures/item-list/uploaded/{fixtures.ts,setup.tsx}。
標準はID101、価格文字列1200、active/men/adult、nullable画像、Video titleあり、Saleなし。
JSONは {itemList:[{item:Item}],totalPages:2}。テストごとにSWR Mapを分離、
focus/reconnect再取得・エラー自動retryを停止。共通setupがDOM・MSWを後片付けする。
遅延応答はPromise gateで制御し固定sleepを使わない。MSWは未定義通信を成功応答で隠さない。

非同期Server ComponentをVitestで直接呼ばない。DOMページ結合はPage自体・実ルーティング・
SSR/Hydrationの保証を含まない。それらの実接続はE2E、画面観測はO01へ分担する。
共通部品の網羅分岐は既存item-list/_componentsの設計・テストを再利用する。

## 自動ケース

U=単体、I=コンポーネント結合、P=ページDOM結合、E=E2E。
N=正常、V=境界、A=競合/認可、E=障害。IDと優先度は独立。

| ID / 優先度 | 条件・操作 | 期待結果・停止位置 |
| --- | --- | --- |
| U-N01 / P0 | all/selling/sold、page2、前後空白付き日本語・&・% | 対応status、trim済みkeywordのURLエンコード。3展開 |
| U-V01 / P0 | 空白検索、未指定/型外不正tab | keywordなし。不正tabはnullで通信停止 |
| U-N02 / P1 | men/women/unisex、kids、数値文字列価格 | 詳細href /item/101、各性別・キッズ・動画・1,200円。3展開 |
| U-V02 / P0 | name/Video/image/日時null、soldout、Sale価格/割引文字列・割引額null | 空見出し、代替画像、SOLD、2,000円・40% OFF。クラッシュなし |
| I-N01 / P0 | 各tabで標準wire応答 | wrapped商品表示・数値IDリンク、page1/status、Bearerヘッダー。3展開 |
| I-N02 / P0 | page2→入力→Enter→clear | 入力でpage1へ、確定前keywordなし、Enter後keyword反映、clearで解除 |
| I-N03 / P1 | 入力後検索アイコン、0件応答 | 検索確定後のみ空案内、paginationなし |
| I-A01 / P0 | 旧検索を保留、新検索を先に完了、旧応答解除 | 新検索結果を維持、旧結果を表示しない |
| I-E01 / P1 | 初回HTTP500→unmount→正常再mount | 0件と同じ案内を表示、リンクなし、再取得で復帰 |
| P-N01 / P1 | 実ページ枠と一覧、3タブと戻る操作 | 検索/一覧が接続、router.pushが各tab URL、router.back呼出し |

E2Eのケース・前提は下記を実装ファイルと照合し、環境停止は成功に含めない。

| ID / 優先度 | 条件・操作 | 期待結果 |
| --- | --- | --- |
| E-N01 / P0 | 実ログイン→本人21件・他人1・所有者null1、同一日時、page1→2 | 本人のみID DESCで20+1、Video/Sale null、機密列非公開、実リンクと一致、DB行不変 |
| E-N02 / P0 | selling/sold URL、%通常文字検索・不一致検索、seller_id偽装要求 | status条件と本人制約を維持、検索結果/0件一致、DB不変 |
| E-A01 / P0 | Cookieなしで実一覧GET | 401、商品情報非公開、DB不変 |

E2E fixtureはtest/fixtures/item-list/uploaded/harness.ts（ルート基準）。
既存draft/backendHarnessを再利用し実NextAuth・itemsルート・隔離test_dbへ接続。
item_draft/item_editingの追加schema guardも前提となる。
専用IDを投入してfinallyで削除。認証テーブルのログイン更新と商品行不変性は分ける。
日時の異なる並び順、関連Video/Saleありの実DB検証は今回の自動範囲外
（同日時ID順序はE-N01、関連表示分岐はU-N02/U-V02）。
タブprops変更時のページ・検索保持は現実装で初期化なし。新しいリセット仕様は定めない。

## 人間の観測

| ID | 担当・前提 | 手順 | 期待・状態 |
| --- | --- | --- | --- |
| O01 | 人間、Chromium/Firefox/WebKit、359/768/1280px、ログイン済み、販売中・売切れ・Saleあり | 一覧・画像・SOLD・価格を比較、3タブ/詳細/戻る、キーボードとフォーカス確認 | 文字切れ・重なりなし、意図した詳細へ遷移、フォーカス追跡可能。人間確認待ち |
| O02 | 人間、同環境、遅い通信・500・0件を準備 | 読込→正常/空/失敗を観測 | ちらつき・操作応答・状態差を記録。失敗時も0件と同じ案内。人間確認待ち |

## 実行順・完了条件

1. Node/依存確認→単体→代表I-N01→独立の結合・ページDOM結合。
2. clientで以下を実行する。
   - npm run test:unit -- src/app/item-list/uploaded
   - npm run test:integration -- test/integration/components/item-list/uploaded test/integration/pages/item-list/uploaded
   - npm run lint
   - npm run typecheck
   - ./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
3. E2Eは[準備と代表コマンド](../../../../../test/E2E/item-list/uploaded/getUploadedItemList/README.md)（ルートtest/配下）を参照。
   代表E-N01で実接続を確認後、grepを外し3ブラウザーへ展開する。testでnpm run typecheckも実行。
4. schema/auth/起動失敗時は依存E2Eを保留。DB構造を自動変更しない。環境復旧と本番build/API URL照合後に代表から再開。
5. 自動完了は全自動ケースと静的検査の成功。人間観測完了はO01/O02の結果受領後に別判定。
   失敗時は収集/setup/業務assertを分け、後続未到達をレポートへ残す。
