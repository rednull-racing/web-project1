## このディレクトリについて

server/src はバックエンドのソースコードを配置するディレクトリです。

各ディレクトリは責務を明確に分離してください。

```
src/
├── app.ts                 # アプリケーション初期化
├── routes/                # URL・HTTPメソッド・middleware・Controller呼び出し
├── controllers/           # HTTPリクエスト・レスポンス
├── usecases/              # 業務ロジック
├── services/              # DBアクセス
├── models/                # Sequelize Model定義
├── validators/            # Zodバリデーション
├── middleware/            # Express Middleware
├── utils/                 # 汎用ユーティリティ
├── types/                 # 型定義
├── config/                # 定数
├── cron/                  # 定期実行バッジ処理
├── infra/                 # 外部システム連携
├── maintenance/           # 管理者実行機能
├── prototype/             # 未使用仮置きロジック
├── scripts/               # CLI実行スクリプト
├── bin/                   # www
├── errors.ts              # AppError等
├── db.ts                  # Sequelizeをdbにつなぐ
└── ...
```

## レイヤー構成

```
Frontend
    ↓
Route
    ↓
Controller
    ↓
UseCase
    ↓
Service
    ↓
Model
    ↓
Database
```

データは上から下へ流れることを基本とする。

## レイヤー依存

各レイヤーは直下のレイヤーのみを呼び出す。

例

Route → Controller → UseCase → Service → Model

Controller から Service を直接呼ばない。

UseCase から Model を直接呼ばない。

責務

Route
ルーティングのみ

Controller
HTTP 処理のみ

UseCase
業務ロジックのみ

Service
DB アクセスのみ

許可

Route
→ Controller

Controller
→ UseCase

UseCase
→ Service
→ Utils

Service
→ Model

Model
→ Sequelize

禁止

Route → Service
Route → Model

Controller → Model

UseCase → Express

Service → Express

## 基本方針

- 各レイヤーは責務を守る
- 他レイヤーの責務を持ち込まない
- 既存の設計方針に合わせる
- 詳細な実装ルールは各ディレクトリの AGENTS.md に従う
- 新しい実装を行う前に、同じ種類の既存実装を確認し、命名・構成・実装方法をできるだけ合わせる。既存の設計を壊す新しい書き方は行わない。

---

## ユーザー向け文章

ユーザーへ表示する文章（お知らせ、メール、通知、画面メッセージ、エラーメッセージなど）は、
使いやすいアプリがユーザーへ自然に話しかけるような文章を心掛ける。

文章は、親しみやすく、分かりやすく、安心感のあるものにする。

専門用語や開発者向けの表現はできるだけ避け、
初めて利用するユーザーでもすぐ理解できる文章を書く。

丁寧語（です・ます調）を基本とし、
必要以上に堅い敬語や事務的な表現は使用しない。

一文はできるだけ短くし、
読みやすさを優先する。

エラーが発生した場合は、
何が起きたのかだけではなく、
ユーザーが次に何をすればよいかも伝える。

ユーザーを責めるような表現や、
不安を与える表現は避ける。

「正常終了しました」「処理を実行しました」
「認証に失敗しました」のような機械的な文章ではなく、

「保存しました」
「もう一度お試しください」
「注文が完了しました」

のように、自然でシンプルな表現を優先する。

迷った場合は、

「初めて利用するユーザーでも、
説明なしで理解できるか」

を基準に文章を作成する。

---

## お願い

実装前に、
このディレクトリ配下および親ディレクトリの AGENTS.md を確認し、
内容に従って実装する。
