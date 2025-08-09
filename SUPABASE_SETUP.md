# Supabase セットアップ & マイグレーション

## 概要
tearoom アプリケーションの管理画面機能を使用するために、Supabaseデータベースの`orders`テーブルに追加のカラムが必要です。

## 必要なカラム

| カラム名 | データ型 | デフォルト値 | 説明 |
|---------|----------|-------------|------|
| `paid` | BOOLEAN | false | 会計済みフラグ |
| `table_id` | TEXT | NULL | テーブル識別子 |
| `price` | INTEGER | 0 | 注文価格 |
| `paid_at` | TIMESTAMP WITH TIME ZONE | NULL | 会計処理時刻 |

## マイグレーション手順

### 1. Supabase ダッシュボードにアクセス
1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. プロジェクトを選択
3. 左メニューの「SQL Editor」をクリック

### 2. マイグレーションSQLの実行
`supabase-migration.sql` ファイルの内容をコピーして実行：

```sql
-- 1. paid カラムの追加（会計済みフラグ）
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT false;

-- 2. table_id カラムの追加（テーブル識別）
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS table_id TEXT;

-- 3. price カラムの追加（注文価格）
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS price INTEGER DEFAULT 0;

-- 4. paid_at カラムの追加（会計処理時刻）
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- 5. 既存データの table_id を qr_id と同じ値に設定
UPDATE orders 
SET table_id = qr_id 
WHERE table_id IS NULL;

-- 6. インデックスの追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_orders_paid ON orders(paid);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_qr_id_paid ON orders(qr_id, paid);
```

### 3. 実行確認
以下のクエリでカラムが追加されたことを確認：

```sql
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;
```

## フォールバック機能

マイグレーション前でも、アプリケーションは以下のフォールバック機能で動作します：

### 管理画面
- `paid`カラムが存在しない場合：全ての注文を表示
- `table_id`が存在しない場合：`qr_id`を使用
- `price`が存在しない場合：0円で表示

### ユーザー画面
- `paid`カラムが存在しない場合：全ての注文履歴を表示
- 注文機能は通常通り動作

### 会計処理
- `paid`カラムが存在しない場合：エラーメッセージを表示
- マイグレーション案内を表示

## トラブルシューティング

### エラー: column "orders.paid" does not exist
**解決方法**: 上記のマイグレーションSQLを実行してください。

### 既存データの価格情報がない
**対処法**: 
1. メニューデータと照合して価格を更新
2. 管理画面で手動調整
3. 新規注文から正確な価格が記録される

### パフォーマンスが遅い
**対処法**: インデックスが正しく作成されているか確認

```sql
-- インデックス確認
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'orders';
```

## 開発環境での動作

開発環境（ローカル）では、Supabaseを使用せずにメモリ内データを使用するため、マイグレーションは不要です。

## 本番環境での注意事項

1. **ダウンタイム**: マイグレーション中は短時間のダウンタイムが発生する可能性があります
2. **バックアップ**: 実行前にデータベースのバックアップを取得することを推奨
3. **ロールバック**: 問題が発生した場合のロールバック計画を準備

## サポート

マイグレーションで問題が発生した場合は、開発チームまでお問い合わせください。 