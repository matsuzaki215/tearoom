const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

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
    ? ['https://your-app-name.vercel.app'] 
    : ['http://localhost:3000', 'http://localhost:5173']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use('/data/imgs', express.static(path.join(__dirname, '../data/imgs')));
app.use(rateLimit);
app.use(securityHeaders);

// データベース初期化
const db = new sqlite3.Database('./orders.db');

// 注文テーブルを作成
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      qr_id TEXT NOT NULL,
      menu_id TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// CSVファイルを読み込んでJSONに変換
function loadMenuData() {
  return new Promise((resolve, reject) => {
    const menuData = [];
    fs.createReadStream(path.join(__dirname, '../menu.csv'))
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
app.post('/api/orders', (req, res) => {
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

  const stmt = db.prepare('INSERT INTO orders (qr_id, menu_id) VALUES (?, ?)');
  stmt.run([qr_id, menu_id], function(err) {
    if (err) {
      console.error('注文の登録エラー:', err);
      return res.status(500).json({ error: '注文の登録に失敗しました' });
    }
    
    res.json({
      id: this.lastID,
      qr_id,
      menu_id,
      timestamp: new Date().toISOString()
    });
  });
  stmt.finalize();
});

// 特定のQR IDの注文履歴を取得
app.get('/api/orders/:qrId', (req, res) => {
  const { qrId } = req.params;
  
  // 入力値の検証
  if (typeof qrId !== 'string' || qrId.length > 50) {
    return res.status(400).json({ error: '無効なQR IDです' });
  }
  
  db.all(
    'SELECT * FROM orders WHERE qr_id = ? ORDER BY timestamp DESC LIMIT 50',
    [qrId],
    (err, rows) => {
      if (err) {
        console.error('注文履歴の取得エラー:', err);
        return res.status(500).json({ error: '注文履歴の取得に失敗しました' });
      }
      
      res.json(rows);
    }
  );
});

// 全注文履歴を取得（管理者用）
app.get('/api/orders', (req, res) => {
  // 本番環境では認証を追加することを推奨
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: '本番環境では利用できません' });
  }
  
  db.all(
    'SELECT * FROM orders ORDER BY timestamp DESC LIMIT 100',
    (err, rows) => {
      if (err) {
        console.error('全注文履歴の取得エラー:', err);
        return res.status(500).json({ error: '全注文履歴の取得に失敗しました' });
      }
      
      res.json(rows);
    }
  );
});

// ヘルスチェックエンドポイント
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// フロントエンドのルートを処理（SPA対応）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
  console.log(`APIエンドポイント: http://localhost:${PORT}/api`);
  console.log(`環境: ${process.env.NODE_ENV || 'development'}`);
});

// エラーハンドリング
process.on('SIGINT', () => {
  console.log('サーバーを停止しています...');
  db.close((err) => {
    if (err) {
      console.error('データベースのクローズエラー:', err);
    } else {
      console.log('データベース接続を閉じました');
    }
    process.exit(0);
  });
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