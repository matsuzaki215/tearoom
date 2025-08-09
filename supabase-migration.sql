-- Supabase orders テーブルの更新
-- 管理画面機能に必要なカラムを追加

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

-- 5. served カラムの追加（提供済みフラグ）
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS served BOOLEAN DEFAULT false;

-- 6. served_at カラムの追加（提供完了時刻）
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS served_at TIMESTAMP WITH TIME ZONE;

-- 7. 既存データの table_id を qr_id と同じ値に設定
UPDATE orders 
SET table_id = qr_id 
WHERE table_id IS NULL;

-- 8. インデックスの追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_orders_paid ON orders(paid);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_qr_id_paid ON orders(qr_id, paid);
CREATE INDEX IF NOT EXISTS idx_orders_served ON orders(served);
CREATE INDEX IF NOT EXISTS idx_orders_paid_served ON orders(paid, served);

-- 9. RLS (Row Level Security) ポリシーの更新（必要に応じて）
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 実行後の確認用クエリ
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'orders' 
-- ORDER BY ordinal_position; 