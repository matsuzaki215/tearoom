# QRメニューWebシステム

お店のメニューをWeb化し、QRコードからスマホで注文できるシステムです。

## 機能

- 📱 QRコードからスマホでメニュー閲覧・注文
- 🍽️ ジャンル別メニュー表示
- ⭐ おすすめ商品の表示
- 📊 リアルタイム注文履歴
- 💾 SQLiteデータベースで注文管理
- 📄 CSVファイルからメニューデータ読み込み

## 技術スタック

- **フロントエンド**: React + Vite
- **バックエンド**: Node.js + Express
- **データベース**: SQLite
- **スタイリング**: CSS3 (レスポンシブデザイン)

## セットアップ

### 1. 依存関係のインストール

```bash
# フロントエンド
cd frontend
npm install

# バックエンド
cd ../backend
npm install
```

### 2. 開発サーバーの起動

```bash
# バックエンドサーバー起動
cd backend
npm run dev

# 別ターミナルでフロントエンド起動
cd frontend
npm run dev
```

### 3. プロダクションビルド

```bash
# フロントエンドをビルド
cd frontend
npm run build

# バックエンドサーバー起動（本番用）
cd ../backend
npm start
```

## 使用方法

1. ブラウザで `http://localhost:5173` にアクセス
2. URLパラメータ `?id=table1` でテーブルIDを指定
3. メニューを選択して注文
4. 注文履歴で確認

## ファイル構成

```
tearoom/
├── frontend/          # Reactフロントエンド
├── backend/           # Expressバックエンド
├── menu.csv          # メニューデータ
├── orders.db         # SQLiteデータベース（自動生成）
└── README.md
```

## APIエンドポイント

- `GET /api/menu` - メニューデータ取得
- `POST /api/orders` - 注文登録
- `GET /api/orders/:qrId` - 特定QR IDの注文履歴
- `GET /api/orders` - 全注文履歴（管理者用）

## メニューデータ形式

CSVファイル（menu.csv）の形式：

```csv
大ジャンル,小ジャンル,日本語名,英語名,金額,おすすめ,在庫
ドリンク,コーヒー,ブレンドコーヒー,Blend Coffee,350,1,1
```

## ライセンス

ISC 