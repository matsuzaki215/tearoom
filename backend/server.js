// 環境変数の読み込み（開発環境用）
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const supabase = require('./supabase');

const app = express();
const PORT = process.env.PORT || 3002;

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
app.use('/data/imgs', express.static(path.join(__dirname, '../data/imgs'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
  }
}));
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
        { category: 'Drinks', subcategory: 'コーヒー', name_ja: 'ブレンドコーヒー', name_en: 'Blend Coffee', price: 350, recommended: 1, new: 0, stock: 1, image_path: 'drinks/coffee-blend.png' },
        { category: 'Drinks', subcategory: 'コーヒー', name_ja: 'カフェラテ', name_en: 'Cafe Latte', price: 450, recommended: 1, new: 0, stock: 1, image_path: 'drinks/coffee-latte.png' },
        { category: 'Drinks', subcategory: 'コーヒー', name_ja: 'カプチーノ', name_en: 'Cappuccino', price: 450, recommended: 0, new: 0, stock: 1, image_path: 'drinks/coffee-cappuccino.png' },
        { category: 'Drinks', subcategory: '紅茶', name_ja: 'アールグレイ', name_en: 'Early Grey', price: 400, recommended: 1, new: 0, stock: 1, image_path: 'drinks/tea-earl-grey.png' },
        { category: 'Drinks', subcategory: '紅茶', name_ja: 'ダージリン', name_en: 'Darjeeling', price: 400, recommended: 0, new: 0, stock: 1, image_path: 'drinks/tea-darjeeling.png' },
        { category: 'Drinks', subcategory: '紅茶', name_ja: 'レモンティー', name_en: 'Lemon Tea', price: 450, recommended: 0, new: 0, stock: 1, image_path: 'drinks/tea-lemon.png' },
        { category: 'Drinks', subcategory: 'その他', name_ja: 'オレンジジュース', name_en: 'Orange Juice', price: 300, recommended: 0, new: 0, stock: 1, image_path: 'drinks/juice-orange.png' },
        { category: 'Drinks', subcategory: 'その他', name_ja: 'アップルジュース', name_en: 'Apple Juice', price: 300, recommended: 0, new: 0, stock: 1, image_path: 'drinks/juice-apple.png' },
        { category: 'Drinks', subcategory: 'その他', name_ja: 'ミネラルウォーター', name_en: 'Mineral Water', price: 200, recommended: 0, new: 0, stock: 1, image_path: 'drinks/water.png' },
        { category: 'Specials', subcategory: 'チョコレート', name_ja: 'チョコレートケーキ', name_en: 'Chocolate Cake', price: 500, recommended: 1, new: 0, stock: 1, image_path: 'sweets/cake-chocolate.png' },
        { category: 'Specials', subcategory: 'チョコレート', name_ja: 'チョコレートムース', name_en: 'Chocolate Mousse', price: 550, recommended: 0, new: 0, stock: 1, image_path: 'sweets/mousse-chocolate.png' },
        { category: 'Specials', subcategory: 'フルーツ', name_ja: 'ストロベリーショートケーキ', name_en: 'Strawberry Shortcake', price: 600, recommended: 1, new: 0, stock: 1, image_path: 'sweets/cake-strawberry.png' },
        { category: 'Specials', subcategory: 'フルーツ', name_ja: 'アップルパイ', name_en: 'Apple Pie', price: 550, recommended: 0, new: 0, stock: 1, image_path: 'sweets/pie-apple.png' },
        { category: 'Specials', subcategory: 'チーズ', name_ja: 'チーズケーキ', name_en: 'Cheesecake', price: 500, recommended: 1, new: 0, stock: 1, image_path: 'sweets/cake-cheese.png' },
        { category: 'Specials', subcategory: 'チーズ', name_ja: 'ティラミス', name_en: 'Tiramisu', price: 650, recommended: 1, new: 0, stock: 1, image_path: 'sweets/tiramisu.png' },
        { category: 'Snacks', subcategory: 'サンドイッチ', name_ja: 'ハムサンドイッチ', name_en: 'Ham Sandwich', price: 400, recommended: 0, new: 0, stock: 1, image_path: 'meals/sandwich-ham.png' },
        { category: 'Snacks', subcategory: 'サンドイッチ', name_ja: 'チキンサンドイッチ', name_en: 'Chicken Sandwich', price: 450, recommended: 1, new: 0, stock: 1, image_path: 'meals/sandwich-chicken.png' },
        { category: 'Snacks', subcategory: 'サンドイッチ', name_ja: 'ツナサンドイッチ', name_en: 'Tuna Sandwich', price: 400, recommended: 0, new: 0, stock: 1, image_path: 'meals/sandwich-tuna.png' },
        { category: 'Snacks', subcategory: 'パスタ', name_ja: 'カルボナーラ', name_en: 'Carbonara', price: 800, recommended: 1, new: 0, stock: 1, image_path: 'meals/pasta-carbonara.png' },
        { category: 'Snacks', subcategory: 'パスタ', name_ja: 'ペペロンチーノ', name_en: 'Peperoncino', price: 750, recommended: 0, new: 0, stock: 1, image_path: 'meals/pasta-peperoncino.png' },
        { category: 'Snacks', subcategory: 'パスタ', name_ja: 'ナポリタン', name_en: 'Napolitan', price: 700, recommended: 0, new: 0, stock: 1, image_path: 'meals/pasta-napolitan.png' }
      ]);
      return;
    }

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        // 空行やカテゴリが空のデータをスキップ
        if (!row.category || !row.category.trim()) {
          console.warn('Skipping row with empty category:', row);
          return;
        }
        
        // 数値フィールドを適切に変換
        menuData.push({
          ...row,
          price: parseInt(row.price),
          recommended: parseInt(row.recommended),
          new: parseInt(row.new || 0),
          stock: parseInt(row.stock)
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



// 画像ファイル専用エンドポイント
app.get('/data/imgs/:category/:filename', (req, res) => {
  const { category, filename } = req.params;
  const filePath = path.join(__dirname, '../data/imgs', category, filename);
  
  // ファイル存在チェック
  if (!fs.existsSync(filePath)) {
    console.log(`Image not found: ${filePath}`);
    return res.status(404).json({ error: 'Image not found' });
  }
  
  // Content-Typeを自動設定
  const mimeType = mime.lookup(filename);
  if (mimeType) {
    res.setHeader('Content-Type', mimeType);
  }
  
  // キャッシュヘッダーを設定
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  
  // ファイルを送信
  res.sendFile(filePath);
});

// APIエンドポイント

// メインAPIエンドポイント
app.get('/api', (req, res) => {
  res.json({
    message: 'QRメニューシステムAPI',
    version: '1.0.0',
    endpoints: {
      menu: '/api/menu',
      orders: '/api/orders',
      health: '/api/health',
      debug: '/api/debug'
    },
    timestamp: new Date().toISOString()
  });
});

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

    // メニューアイテムの価格を取得
    let menuItem = null;
    if (cachedMenuData && cachedMenuData.length > 0) {
      menuItem = cachedMenuData.find(item => item.name_ja === menu_id || item.name_en === menu_id);
    }

    const newOrder = {
      qr_id,
      menu_id,
      table_id: qr_id, // QR IDをテーブルIDとして使用
      price: menuItem ? menuItem.price : 0,
      timestamp: new Date().toISOString(),
      paid: false, // 初期状態は未会計
      served: false // 初期状態は未提供
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
      // Supabaseを使用：paidカラムの存在を確認
      let { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('qr_id', qrId)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) {
        // paidカラムが存在しない場合のフォールバック
        if (error.code === '42703') {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('orders')
            .select('id, qr_id, menu_id, timestamp')
            .eq('qr_id', qrId)
            .order('timestamp', { ascending: false })
            .limit(50);
          
          if (fallbackError) {
            console.error('Supabase注文履歴取得エラー:', fallbackError);
            return res.status(500).json({ error: '注文履歴の取得に失敗しました' });
          }
          
          return res.json(fallbackData || []);
        }
        
        console.error('Supabase注文履歴取得エラー:', error);
        return res.status(500).json({ error: '注文履歴の取得に失敗しました' });
      }

      // paidカラムが存在する場合は未会計のもののみフィルター
      const unpaidOrders = (data || []).filter(order => !order.paid).map(order => {
        // table_idやpriceが不正な場合の補正
                 return {
           ...order,
           table_id: order.table_id || order.qr_id || 'unknown',
           price: order.price || 0,
           served: order.served || false
         };
      });
      res.json(unpaidOrders);
    } else {
      // メモリベースのフォールバック：未会計のもののみ
      const filteredOrders = orders
        .filter(order => order.qr_id === qrId && !order.paid)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 50);
      
      res.json(filteredOrders);
    }
  } catch (error) {
    console.error('注文履歴取得エラー:', error);
    res.status(500).json({ error: '注文履歴の取得に失敗しました' });
  }
});

// 管理画面用：未会計の注文履歴をテーブル別に取得
app.get('/api/admin/orders', async (req, res) => {
  try {
    if (supabase) {
      // Supabaseを使用：paidカラムの存在を確認
      let { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        // paidカラムが存在しない場合は全ての注文を返す
        if (error.code === '42703') {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('orders')
            .select('id, qr_id, menu_id, timestamp')
            .order('timestamp', { ascending: false });
          
          if (fallbackError) throw fallbackError;
          
          // paid, table_id, priceを追加してフォールバック
          const ordersWithDefaults = (fallbackData || []).map(order => {
            // メニューデータから価格を取得
            let price = 0;
            if (cachedMenuData && cachedMenuData.length > 0) {
              const menuItem = cachedMenuData.find(item => 
                item.name_ja === order.menu_id || item.name_en === order.menu_id
              );
              if (menuItem) {
                price = menuItem.price;
              }
            }
            
                         return {
               ...order,
               paid: false,
               table_id: order.qr_id || 'unknown',
               price: price,
               served: false
             };
          });
          
          return res.json(ordersWithDefaults);
        }
        throw error;
      }

      // paidカラムが存在する場合は未会計のもののみフィルター
      const unpaidOrders = (data || []).filter(order => !order.paid);
      res.json(unpaidOrders);
    } else {
      // ローカル開発用：メモリ内データから未会計のもののみ
      const unpaidOrders = orders.filter(order => !order.paid);
      res.json(unpaidOrders);
    }
  } catch (error) {
    console.error('管理画面注文履歴取得エラー:', error);
    res.status(500).json({ error: '注文履歴の取得に失敗しました' });
  }
});

// 管理画面用：テーブルの会計処理
app.post('/api/admin/checkout', async (req, res) => {
  try {
    const { table_id } = req.body;
    
    if (!table_id) {
      return res.status(400).json({ error: 'テーブルIDが必要です' });
    }

    if (supabase) {
      // Supabaseを使用：まずテーブル構造をチェック
      try {
        const { error } = await supabase
          .from('orders')
          .update({ paid: true, paid_at: new Date().toISOString() })
          .eq('table_id', table_id)
          .eq('paid', false);

        if (error) throw error;
        
        res.json({ success: true, message: `テーブル ${table_id} の会計が完了しました` });
      } catch (error) {
        // paidカラムまたはtable_idカラムが存在しない場合
        if (error.code === '42703' || error.code === 'PGRST204') {
          console.warn('Supabaseテーブルの構造が不完全です。フォールバック処理を実行:', error.message);
          
          // qr_idを使って該当注文を削除（疑似的な会計処理）
          try {
            const { error: deleteError } = await supabase
              .from('orders')
              .delete()
              .eq('qr_id', table_id);
            
            if (deleteError) {
              console.error('フォールバック処理エラー:', deleteError);
              return res.status(500).json({ 
                error: 'データベースの更新が必要です。マイグレーションを実行してください。',
                needsMigration: true 
              });
            }
            
            res.json({ 
              success: true, 
              message: `テーブル ${table_id} の注文を処理しました（マイグレーションを推奨）`,
              warning: 'データベースの更新を推奨します'
            });
          } catch (fallbackError) {
            console.error('フォールバック処理失敗:', fallbackError);
            return res.status(500).json({ 
              error: 'データベースの更新が必要です。マイグレーションを実行してください。',
              needsMigration: true 
            });
          }
        } else {
          throw error;
        }
      }
    } else {
      // ローカル開発用：メモリ内データを更新
      const updatedCount = orders
        .filter(order => order.table_id === table_id && !order.paid)
        .map(order => {
          order.paid = true;
          order.paid_at = new Date().toISOString();
          return order;
        }).length;

      res.json({ 
        success: true, 
        message: `テーブル ${table_id} の${updatedCount}件の注文を会計済みにしました` 
      });
    }
  } catch (error) {
    console.error('会計処理エラー:', error);
    res.status(500).json({ error: '会計処理に失敗しました' });
  }
});

// 管理画面用：注文の提供状態を切り替え
app.post('/api/admin/toggle-served', async (req, res) => {
  try {
    const { order_id, served } = req.body;
    
    if (!order_id || typeof served !== 'boolean') {
      return res.status(400).json({ error: '注文IDと提供状態が必要です' });
    }

    if (supabase) {
      // Supabaseを使用：提供状態を更新
      try {
        const updateData = {
          served: served,
          served_at: served ? new Date().toISOString() : null
        };

        const { error } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order_id);

        if (error) throw error;
        
        res.json({ 
          success: true, 
          message: `注文の提供状態を${served ? '完了' : '未完了'}に変更しました`,
          served: served
        });
      } catch (error) {
        // servedカラムが存在しない場合のフォールバック
        if (error.code === '42703' || error.code === 'PGRST204') {
          console.warn('Supabaseテーブルにservedカラムが存在しません。フォールバック処理:', error.message);
          return res.status(500).json({ 
            error: 'データベースの更新が必要です。マイグレーションを実行してください。',
            needsMigration: true 
          });
        } else {
          throw error;
        }
      }
    } else {
      // ローカル開発用：メモリ内データを更新
      const order = orders.find(o => o.id === order_id);
      if (order) {
        order.served = served;
        order.served_at = served ? new Date().toISOString() : null;
        
        res.json({ 
          success: true, 
          message: `注文の提供状態を${served ? '完了' : '未完了'}に変更しました`,
          served: served
        });
      } else {
        res.status(404).json({ error: '注文が見つかりません' });
      }
    }
  } catch (error) {
    console.error('提供状態変更エラー:', error);
    res.status(500).json({ error: '提供状態の変更に失敗しました' });
  }
});

// 全注文履歴を取得（開発者用）
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