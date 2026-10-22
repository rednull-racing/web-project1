⚠ 開発中

開発者：Rednull Racing

2026/07/31版

# 動画投稿 × ECプラットフォームサービス開発プロジェクト（名称未定）

## 概要

本プロジェクトは、**商品情報として動画投稿を必須とする動画中心型のECプラットフォーム**です。
出品者は動画と構造化された商品情報を組み合わせて商品を掲載でき、**BtoCおよびCtoCの両方の取引に対応**しています。

従来のECサイトでは、商品情報が画像やテキストに依存しているため、商品の理解が十分に伝わらない場合があります。
本プラットフォームでは商品情報に動画を必須とすることで、より豊富な情報を提供し、**出品者と購入者のマッチング精度の向上**を目指しています。
また、従来のマーケットプレイスシステムでは情報がテキストに依存していたため、主にセールスポイント等の情報を動画に移すことで、**UI最適化とCVR向上**を目指しています。

現在、本プロジェクトは開発中です。

## 開発の進捗

2026年7月31日現在の開発進捗

### フロントエンド

ページ単位では**63%**完成。

商品ページ・ユーザー登録および個人情報登録・認証系・検索系・商品リスト系・その他インプット系・規約・ガイドが完成。決済系・取引系・チャット系・トップページ・LP・売上管理・管理者機能は未実装。

一部、以前のサービス（アウトドア系CtoC EC）から未改修の部分あり。

### バックエンド

Sequelizeモデル・APIルート・ユースケース層・サービス層を、フロントエンドと連動して開発中。その他、cron、認証ミドルウェア、インフラ、マイグレーション等も並行して開発中。

---

# 主な機能・設計

1. **動画を活用した商品出品機能**

    商品出品時に動画の投稿を必須とすることで、よりリッチな商品情報を提供できる仕組みを構築します。

2. **モバイル最適化されたシングルスクリーン商品ページ**

    スマートフォンでは、動画・商品情報・購入操作などの主要要素が
    **1画面内で把握できるUI**として設計されています。

    これにより、スクロールを必要とせずに商品理解と購入操作が可能になります。

3. **2種類のUIを切り替え可能な商品リスト**

    商品一覧は以下の2つの表示形式を切り替えることができます。
    - 動画サムネイル表示
    - 商品カード表示

4. **多ジャンル展開を前提としたスケーラブルな設計**

    現在はアパレル分野を中心に開発していますが、将来的に**複数の商品ジャンルへ拡張可能なアーキテクチャ**を採用しています。

---

# UIサンプル

### 商品ページ

<img src="images/readme_UI_mobile.png" width="300">

モバイルUIでは、動画・商品説明・購入手続きがすべて1画面で収まるように設計されています。PCでも、これらを近い位置に配置し、迷いのない設計になっています。また、薄いグレー背景の概要セクションをクリックすることで、詳細情報が書かれたセクションへ遷移します。

<img src="images/readme_UI_pc.png" width="600">

---

# 技術スタック

### フロントエンド

- Next.js（App Router）
- TypeScript
- CSS Modules
- SWR
- NextAuth.js

![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)

### バックエンド

- Node.js
- Express
- Sequelize ORM
- TypeScript
- JWT
- bcrypt
- Multer
- FFmpeg

![Node.js](https://img.shields.io/badge/Node.js-5FA04E?style=flat&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)

### データベース

- PostgreSQL

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)

### ストレージ

- Amazon S3

![AWS S3](https://img.shields.io/badge/Amazon_S3-FF9900?style=flat&logo=amazons3&logoColor=white)

### インフラ / デプロイ

- Docker
- Amazon EC2
- Amazon ECR
- GitHub Actions

![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![Amazon EC2](https://img.shields.io/badge/Amazon%20EC2-FF9900?style=flat&logo=amazonec2&logoColor=white)
![Amazon ECR](https://img.shields.io/badge/Amazon%20ECR-FF9900?style=flat&logo=amazonaws&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?style=flat&logo=githubactions&logoColor=white)

### バージョン管理

- Git
- GitHub

![Git](https://img.shields.io/badge/Git-F05032?style=flat&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)

## 技術選定理由

| 技術                 | 選定理由                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Next.js (App Router) | SSR・SSGを柔軟に使い分けられ、SEOと表示速度を両立できるため                                                       |
| TypeScript           | フロント・バック共通で型安全に開発でき、スケール時のバグを減らせるため                                            |
| Express              | シンプルで学習コストが低く、柔軟なルーティング設計ができるため                                                    |
| Sequelize            | TypeScriptとの親和性が高く、マイグレーション管理が容易なため                                                      |
| PostgreSQL           | リレーション設計が複雑なECデータ（商品・注文・ユーザー）に適しているため                                          |
| Amazon S3            | 大容量の画像・動画ファイルを低コストかつ高可用性で保存できるため。DBにはURLのみ保存し、ファイル管理を分離する設計 |
| Docker               | 開発環境と本番環境を統一し、環境差異によるトラブルを防止できるため                                                |
| Amazon EC2           | 権限やスケーラビリティ等設計の自由度が高いのと、パフォーマンス最適化を図るため                                    |
| Amazon ECR           | Dockerイメージを安全に管理でき、EC2へのデプロイを効率化できるため                                                 |
| GitHub Actions       | ビルド・テスト・デプロイを自動化し、CI/CDを実現するため                                                           |

## システム構成

```mermaid
graph TD
  subgraph Client
    A[Next.js Client]
  end

  subgraph AWS
    E[Amazon S3<br/>画像・動画ストレージ]
    G[Amazon ECR]

    subgraph EC2インスタンス
      B[Amazon EC2<br/>Express Server]
      D[(PostgreSQL)]
    end
  end

  F[GitHub Actions]

  A -->|REST API| B
  B --> C[Sequelize ORM]
  C --> D
  B -->|画像・動画アップロード| E
  D -->|S3 URLを保存| E
  A -->|S3 URLで表示| E

  F -->|Build & Push| G[Amazon ECR]
  G -->|docker pull| B
```

## 開発環境

| 環境     | 内容   |
| -------- | ------ |
| OS       | Ubuntu |
| コンテナ | Docker |

ローカル開発・テストは Docker コンテナ上で動作確認しています。

Node.jsは26.12.1（2026-10-21公開のセキュリティ修正版、Current）を使用します。
Dockerを使わない場合は、リポジトリルートで `nvm install` → `nvm use` を実行し、
ルート・`client`・`server`それぞれで `npm ci` を実行してください。
Linuxの公式バイナリには `libatomic` が必要です（Ubuntu/Debian: `libatomic1`）。
Docker利用時は `docker compose build --pull` でイメージを再ビルドしてください。
本番環境への反映には、更新イメージのビルド・デプロイが必要です。

- [Node.js公式リリース](https://github.com/nodejs/node/releases/tag/v26.12.1)
- [Linuxの実行要件](https://github.com/nodejs/node/blob/main/BUILDING.md)

---

# プロジェクト構成

web-project1

/client
フロントエンドアプリケーション（Next.js）

/server
バックエンドAPI（Node.js + Express）

/docs
アーキテクチャおよび技術ドキュメント

---

# セットアップ

リポジトリをクローン

```
git clone https://github.com/daddydirty420-app/web-project1
```

依存関係をインストール

```
cd client
npm install

cd ../server
npm install
```

開発サーバーを起動

client

```
npm run dev
```

server

```
npm run dev
```

---

# 現在実装されている機能

フロントエンドのページ単位では **63%** 完了（7月31日現在）

- 商品ページ
- 商品出品機能
- ユーザー認証
- ユーザープロフィール
- 商品リスト
- お知らせ
- 商品検索機能
- フォロー機能
- コメント機能
- ショップ登録
- 振込関連機能
- お問い合わせ機能
- ユーザーガイド
- 利用規約・ポリシー関連ページ

---

# 直近の実装予定

- 注文 / 決済 / 取引機能
- メール通知機能
- トップページ / LP（ランディングページ）
- 管理者ツール

---

# 今後の計画

- レコメンド機能
- 機械学習の導入
- 多ジャンル展開
- 決済ゲートウェイ連携
- モバイルアプリ開発
- 配送API連携

---

# 開発者

GitHub: https://github.com/daddydirty420-app

Rednull Racing

エンジニア1年目として、最初のWebアプリフルスタック開発に挑戦中。2026年内リリースを目指す。

以前はノーコードツール Bubble を使って同様のWebアプリを2つ開発。
1つ目はPVが伸びず撤退、2つ目はパフォーマンスが目標水準に達せず断念。

パフォーマンス課題の解決と機能拡張を目的に、 Typescript を用いたフルスタック開発を行っている。

### AI 利用方針

ChatGPT・Claude などのLLMと設計や実装について壁打ちしながら開発を進める。

基本方針として、設計や仕様を考えながら実装する工程では、自ら手を動かして実装を行う。技術的理解を深めることを重視するとともに、要件や設計が曖昧な状態でコーディングエージェントへ実装を委ねることによる技術的負債を避けるためである。

2026/07/31 追記

以下の条件を満たす場合、codexを用いた開発が可能になる。

- あらかじめドキュメントがあるまたはmodelやmigration、usecaseなど決まった粒度で、新たに設計を考えながら開発する作業ではなく、ドキュメントや参照ファイルから決まったものを実装する場合
- 手作業やチャットだと時間がかかるが、codexで大幅に短縮できる場合
- コードレビューとコード修正を同時に行う場合
- コードから設計やルールを抽出しドキュメントにする場合

また、以下の場合には ChatGPT の work を使用することができる。

- githubのPRレビュー
- githubのissueから次の作業内容を策定
- 設計レビュー
- リファクタ候補調査
- 影響範囲調査
- ドキュメント生成
- セキュリティ監査
- 技術負債診断

AIは開発効率向上のための補助ツールとして活用するが、最終的な設計判断・コードレビュー・品質保証はRednull Racing自身が責任を持って行う。

# ライセンス

本リポジトリは個人学習・事業用途・技術力証明用途で公開しています。
無断でのコードの複製・使用・改変・再配布は禁止します。

コードの利用・転用などを検討される方は以下の問い合わせ先へご相談ください。

# お問い合わせ・ご相談

以下の理由でコードの利用やリポジトリの利用を検討されている方は、お気軽に下記メールアドレスからRednull Racing宛てにご相談ください。

- 学習用途でコードを利用したい
- コードの利用・ライセンスについて相談したい
- アドバイスしたい
- バグ・改善点を教えたい
- 開発に参加したい
- 事業化したい
- 販売商品ジャンルを変更して事業化したい
- 商品販売者として開発段階から関わりたい
- 開発主（Rednull Racing）と共同なら事業化したい
- スポンサー・投資・協業について相談したい
- 開発者として興味を持った
- 情報交換・意見交換したい
- 開発主とお話ししたい
- メディア掲載・取材について相談したい

お問い合わせ先：newproject893420@gmail.com

その他の理由で開発主に問い合わせしたい場合でも、どうぞお気軽に上記メールアドレスからお問い合わせください。
