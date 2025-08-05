// 環境変数の読み込み（開発環境用）
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const supabase = require('./supabase');

const app = express();
const PORT = process.env.PORT || 3001;

// レート制限用のMap
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1分
const RATE_LIMIT_MAX = 100; // 1分間に100リクエスト

// レート制限ミドルウェア
function rateLimit(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!requestCounts.has(clientIP)) {
    requestCounts.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  } else {
    const clientData = requestCounts.get(clientIP);
    if (now > clientData.resetTime) {
      clientData.count = 1;
      clientData.resetTime = now + RATE_LIMIT_WINDOW;
    } else {
      clientData.count++;
    }
    
    if (clientData.count > RATE_LIMIT_MAX) {
      return res.status(429).json({ error: 'Too many requests' });
    }
  }
  
  next();
}

// セキュリティヘッダーミドルウェア
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

// ミドルウェア
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://tearoom-fxneny2fx-shigerus-projects-3d4cd7f8.vercel.app', 'https://tearoom-msoaj7pv2-shigerus-projects-3d4cd7f8.vercel.app'] 
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use('/data/imgs', express.static(path.join(__dirname, '../data/imgs')));
app.use(rateLimit);
app.use(securityHeaders);

// メモリベースのデータストア（フォールバック用）
const orders = [];
let orderIdCounter = 1;

// CSVファイルを読み込んでJSONに変換
function loadMenuData() {
  return new Promise((resolve, reject) => {
    const menuData = [];
    const csvPath = path.join(__dirname, '../menu.csv');
    
    // CSVファイルが存在しない場合のフォールバック
    if (!fs.existsSync(csvPath)) {
      console.log('CSVファイルが見つかりません。フォールバックデータを使用します。');
      resolve([
        { 大ジャンル: 'ドリンク', 小ジャンル: 'コーヒー', 日本語名: 'ブレンドコーヒー', 英語名: 'Blend Coffee', 金額: 350, おすすめ: 1, 在庫: 1, 画像パス: 'drinks/coffee-blend.png' },
        { 大ジャンル: 'ドリンク', 小ジャンル: 'コーヒー', 日本語名: 'カフェラテ', 英語名: 'Cafe Latte', 金額: 450, おすすめ: 1, 在庫: 1, 画像パス: 'drinks/coffee-latte.png' },
        { 大ジャンル: 'ドリンク', 小ジャンル: 'コーヒー', 日本語名: 'カプチーノ', 英語名: 'Cappuccino', 金額: 450, おすすめ: 0, 在庫: 1, 画像パス: 'drinks/coffee-cappuccino.png' },
        { 大ジャンル: 'ドリンク', 小ジャンル: '紅茶', 日本語名: 'アールグレイ', 英語名: 'Early Grey', 金額: 400, おすすめ: 1, 在庫: 1, 画像パス: 'drinks/tea-earl-grey.png' },
        { 大ジャンル: 'ドリンク', 小ジャンル: '紅茶', 日本語名: 'ダージリン', 英語名: 'Darjeeling', 金額: 400, おすすめ: 0, 在庫: 1, 画像パス: 'drinks/tea-darjeeling.png' },
        { 大ジャンル: 'ドリンク', 小ジャンル: '紅茶', 日本語名: 'レモンティー', 英語名: 'Lemon Tea', 金額: 450, おすすめ: 0, 在庫: 1, 画像パス: 'drinks/tea-lemon.png' },
        { 大ジャンル: 'ドリンク', 小ジャンル: 'その他', 日本語名: 'オレンジジュース', 英語名: 'Orange Juice', 金額: 300, おすすめ: 0, 在庫: 1, 画像パス: 'drinks/juice-orange.png' },
        { 大ジャンル: 'ドリンク', 小ジャンル: 'その他', 日本語名: 'アップルジュース', 英語名: 'Apple Juice', 金額: 300, おすすめ: 0, 在庫: 1, 画像パス: 'drinks/juice-apple.png' },
        { 大ジャンル: 'ドリンク', 小ジャンル: 'その他', 日本語名: 'ミネラルウォーター', 英語名: 'Mineral Water', 金額: 200, おすすめ: 0, 在庫: 1, 画像パス: 'drinks/water.png' },
        { 大ジャンル: 'ケーキ', 小ジャンル: 'チョコレート', 日本語名: 'チョコレートケーキ', 英語名: 'Chocolate Cake', 金額: 500, おすすめ: 1, 在庫: 1, 画像パス: 'sweets/cake-chocolate.png' },
        { 大ジャンル: 'ケーキ', 小ジャンル: 'チョコレート', 日本語名: 'チョコレートムース', 英語名: 'Chocolate Mousse', 金額: 550, おすすめ: 0, 在庫: 1, 画像パス: 'sweets/mousse-chocolate.png' },
        { 大ジャンル: 'ケーキ', 小ジャンル: 'フルーツ', 日本語名: 'ストロベリーショートケーキ', 英語名: 'Strawberry Shortcake', 金額: 600, おすすめ: 1, 在庫: 1, 画像パス: 'sweets/cake-strawberry.png' },
        { 大ジャンル: 'ケーキ', 小ジャンル: 'フルーツ', 日本語名: 'アップルパイ', 英語名: 'Apple Pie', 金額: 550, おすすめ: 0, 在庫: 1, 画像パス: 'sweets/pie-apple.png' },
        { 大ジャンル: 'ケーキ', 小ジャンル: 'チーズ', 日本語名: 'チーズケーキ', 英語名: 'Cheesecake', 金額: 500, おすすめ: 1, 在庫: 1, 画像パス: 'sweets/cake-cheese.png' },
        { 大ジャンル: 'ケーキ', 小ジャンル: 'チーズ', 日本語名: 'ティラミス', 英語名: 'Tiramisu', 金額: 650, おすすめ: 1, 在庫: 1, 画像パス: 'sweets/tiramisu.png' },
        { 大ジャンル: '軽食', 小ジャンル: 'サンドイッチ', 日本語名: 'ハムサンドイッチ', 英語名: 'Ham Sandwich', 金額: 400, おすすめ: 0, 在庫: 1, 画像パス: 'meals/sandwich-ham.png' },
        { 大ジャンル: '軽食', 小ジャンル: 'サンドイッチ', 日本語名: 'チキンサンドイッチ', 英語名: 'Chicken Sandwich', 金額: 450, おすすめ: 1, 在庫: 1, 画像パス: 'meals/sandwich-chicken.png' },
        { 大ジャンル: '軽食', 小ジャンル: 'サンドイッチ', 日本語名: 'ツナサンドイッチ', 英語名: 'Tuna Sandwich', 金額: 400, おすすめ: 0, 在庫: 1, 画像パス: 'meals/sandwich-tuna.png' },
        { 大ジャンル: '軽食', 小ジャンル: 'パスタ', 日本語名: 'カルボナーラ', 英語名: 'Carbonara', 金額: 800, おすすめ: 1, 在庫: 1, 画像パス: 'meals/pasta-carbonara.png' },
        { 大ジャンル: '軽食', 小ジャンル: 'パスタ', 日本語名: 'ペペロンチーノ', 英語名: 'Peperoncino', 金額: 750, おすすめ: 0, 在庫: 1, 画像パス: 'meals/pasta-peperoncino.png' },
        { 大ジャンル: '軽食', 小ジャンル: 'パスタ', 日本語名: 'ナポリタン', 英語名: 'Napolitan', 金額: 700, おすすめ: 0, 在庫: 1, 画像パス: 'meals/pasta-napolitan.png' }
      ]);
      return;
    }

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        // 数値フィールドを適切に変換
        menuData.push({
          ...row,
          金額: parseInt(row.金額),
          おすすめ: parseInt(row.おすすめ),
          在庫: parseInt(row.在庫)
        });
      })
      .on('end', () => {
        resolve(menuData);
      })
      .on('error', (error) => {
        console.error('CSV読み込みエラー:', error);
        reject(error);
      });
  });
}

// メニューデータをキャッシュ
let cachedMenuData = null;

// APIエンドポイント

// メニューデータを取得
app.get('/api/menu', async (req, res) => {
  try {
    if (!cachedMenuData) {
      cachedMenuData = await loadMenuData();
    }
    res.json(cachedMenuData);
  } catch (error) {
    console.error('メニューデータの読み込みエラー:', error);
    res.status(500).json({ error: 'メニューデータの読み込みに失敗しました' });
  }
});

// 注文を登録
app.post('/api/orders', async (req, res) => {
  try {
    const { qr_id, menu_id } = req.body;
    
    if (!qr_id || !menu_id) {
      return res.status(400).json({ error: 'qr_id と menu_id が必要です' });
    }

    // 入力値の検証
    if (typeof qr_id !== 'string' || typeof menu_id !== 'string') {
      return res.status(400).json({ error: '無効なデータ形式です' });
    }

    if (qr_id.length > 50 || menu_id.length > 100) {
      return res.status(400).json({ error: 'データが長すぎます' });
    }

    const newOrder = {
      qr_id,
      menu_id,
      timestamp: new Date().toISOString()
    };

    if (supabase) {
      // Supabaseを使用
      const { data, error } = await supabase
        .from('orders')
        .insert([newOrder])
        .select();

      if (error) {
        console.error('Supabase注文登録エラー:', error);
        return res.status(500).json({ error: '注文の登録に失敗しました' });
      }

      res.json(data[0]);
    } else {
      // メモリベースのフォールバック
      newOrder.id = orderIdCounter++;
      orders.push(newOrder);
      res.json(newOrder);
    }
  } catch (error) {
    console.error('注文処理エラー:', error);
    res.status(500).json({ error: '注文処理に失敗しました' });
  }
});

// 特定のQR IDの注文履歴を取得
app.get('/api/orders/:qrId', async (req, res) => {
  try {
    const { qrId } = req.params;
    
    // 入力値の検証
    if (typeof qrId !== 'string' || qrId.length > 50) {
      return res.status(400).json({ error: '無効なQR IDです' });
    }
    
    if (supabase) {
      // Supabaseを使用
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('qr_id', qrId)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Supabase注文履歴取得エラー:', error);
        return res.status(500).json({ error: '注文履歴の取得に失敗しました' });
      }

      res.json(data);
    } else {
      // メモリベースのフォールバック
      const filteredOrders = orders
        .filter(order => order.qr_id === qrId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 50);
      
      res.json(filteredOrders);
    }
  } catch (error) {
    console.error('注文履歴取得エラー:', error);
    res.status(500).json({ error: '注文履歴の取得に失敗しました' });
  }
});

// 全注文履歴を取得（管理者用）
app.get('/api/orders', async (req, res) => {
  try {
    // 本番環境では認証を追加することを推奨
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: '本番環境では利用できません' });
    }
    
    if (supabase) {
      // Supabaseを使用
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Supabase全注文履歴取得エラー:', error);
        return res.status(500).json({ error: '全注文履歴の取得に失敗しました' });
      }

      res.json(data);
    } else {
      // メモリベースのフォールバック
      const allOrders = orders
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 100);
      
      res.json(allOrders);
    }
  } catch (error) {
    console.error('全注文履歴取得エラー:', error);
    res.status(500).json({ error: '全注文履歴の取得に失敗しました' });
  }
});

// デバッグ用エンドポイント
app.get('/api/debug', (req, res) => {
  res.json({
    message: 'API is working',
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    headers: req.headers,
    url: req.url
  });
});

// ヘルスチェックエンドポイント
app.get('/api/health', async (req, res) => {
  try {
    let ordersCount = orders.length;
    let supabaseStatus = 'Not configured';
    
    if (supabase) {
      supabaseStatus = 'Connected';
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        ordersCount = count;
      }
    }

    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      ordersCount,
      database: supabase ? 'Supabase' : 'Memory',
      supabaseStatus,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY
    });
  } catch (error) {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      ordersCount: orders.length,
      database: 'Memory',
      supabaseStatus: 'Error',
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY
    });
  }
});

// フロントエンドのルートを処理（SPA対応）
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../frontend/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not found' });
  }
});

// サーバー起動（Vercelでは自動的にポートが設定される）
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`サーバーが起動しました: http://localhost:${PORT}`);
    console.log(`APIエンドポイント: http://localhost:${PORT}/api`);
    console.log(`環境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`データベース: ${supabase ? 'Supabase' : 'Memory'}`);
  });
}

// エラーハンドリング
process.on('SIGINT', () => {
  console.log('サーバーを停止しています...');
  process.exit(0);
});

// 未処理エラーのハンドリング
process.on('uncaughtException', (err) => {
  console.error('未処理の例外:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未処理のPromise拒否:', reason);
  process.exit(1);
});

// Vercel用のエクスポート
module.exports = app; 