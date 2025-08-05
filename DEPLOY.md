# QRメニューシステム デプロイ手順

## オンライン公開の手順

### 1. Vercelでの公開（推奨）

#### 1.1 Vercelアカウント作成
1. https://vercel.com にアクセス
2. GitHubアカウントでサインアップ

#### 1.2 プロジェクトをGitHubにプッシュ
```bash
git add .
git commit -m "QRメニューシステム完成"
git push origin main
```

#### 1.3 Vercelでデプロイ
1. Vercelダッシュボードで「New Project」
2. GitHubリポジトリを選択
3. 設定を確認して「Deploy」
4. デプロイ完了後、URLをコピー

#### 1.4 環境変数の設定
Vercelダッシュボードで以下を設定：
- `NODE_ENV`: `production`

### 2. QRコード生成

#### 2.1 依存関係のインストール
```bash
npm install qrcode
```

#### 2.2 QRコード生成スクリプトの更新
`generate-qr.js`の`baseURL`を実際のURLに変更：
```javascript
const baseURL = 'https://your-actual-app-name.vercel.app';
```

#### 2.3 QRコード生成
```bash
node generate-qr.js
```

#### 2.4 QRコードの印刷・設置
- `qr-codes/`ディレクトリのPNGファイルを印刷
- 各テーブルに設置

### 3. セキュリティ設定

#### 3.1 CORS設定の更新
デプロイ後、`backend/server.js`のCORS設定を更新：
```javascript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-actual-app-name.vercel.app'] 
    : ['http://localhost:3000', 'http://localhost:5173']
}));
```

#### 3.2 環境変数の設定
Vercelダッシュボードで以下を設定：
- `NODE_ENV`: `production`

### 4. 動作確認

#### 4.1 アクセス制限の確認
- 直接URLアクセス: アクセス拒否画面が表示される
- QRコード経由アクセス: メニューが表示される

#### 4.2 API動作確認
```bash
# ヘルスチェック
curl https://your-app-name.vercel.app/api/health

# メニュー取得
curl https://your-app-name.vercel.app/api/menu
```

### 5. 運用開始

#### 5.1 お客様の利用方法
1. テーブルのQRコードをスマホでスキャン
2. メニューを閲覧・選択
3. 注文ボタンをタップ
4. 注文履歴で確認

#### 5.2 管理者の確認方法
- 注文履歴は各テーブルIDごとに管理
- データベースは自動で注文を記録

### 6. トラブルシューティング

#### 6.1 よくある問題
- **QRコードが読み取れない**: URLが正しいか確認
- **画像が表示されない**: 画像ファイルのパスを確認
- **注文が保存されない**: データベースの権限を確認

#### 6.2 ログの確認
Vercelダッシュボードでログを確認：
- Functions > プロジェクト名 > Functions
- エラーログを確認

### 7. カスタマイズ

#### 7.1 メニューの変更
1. `menu.csv`を編集
2. GitHubにプッシュ
3. Vercelが自動デプロイ

#### 7.2 デザインの変更
1. `frontend/src/App.css`を編集
2. `npm run build`でビルド
3. GitHubにプッシュ

### 8. バックアップ

#### 8.1 データベースのバックアップ
```bash
# SQLiteファイルのバックアップ
cp orders.db orders_backup_$(date +%Y%m%d).db
```

#### 8.2 設定ファイルのバックアップ
- `menu.csv`
- `vercel.json`
- `package.json`

### 9. 監視・メンテナンス

#### 9.1 定期的な確認項目
- Vercelダッシュボードでのエラー確認
- 注文データの確認
- QRコードの破損確認

#### 9.2 更新手順
1. ローカルで変更・テスト
2. GitHubにプッシュ
3. Vercelが自動デプロイ
4. 動作確認

## 注意事項

- **セキュリティ**: 本番環境では適切な認証を追加することを推奨
- **バックアップ**: 定期的にデータベースのバックアップを取得
- **監視**: エラーや異常なアクセスを監視
- **更新**: 依存関係の定期的な更新を推奨 