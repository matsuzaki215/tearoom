import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [menuData, setMenuData] = useState([])
  const [qrId, setQrId] = useState('')
  const [orders, setOrders] = useState([])
  const [showOrderDialog, setShowOrderDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [activeTab, setActiveTab] = useState('')
  const [isValidAccess, setIsValidAccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showOrderHistory, setShowOrderHistory] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)

  // 開発環境かどうかを判定
  const isDevelopment = process.env.NODE_ENV === 'development' || 
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1'

  // URLパラメータからQR IDを取得
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const id = urlParams.get('id')
    
    // 開発環境ではQR IDがなくてもアクセス可能
    if (!id && !isDevelopment) {
      setIsValidAccess(false)
      setIsLoading(false)
      return
    }
    
    // 開発環境でQR IDがない場合はデフォルト値を設定
    const finalQrId = id || (isDevelopment ? 'table1' : '')
    setQrId(finalQrId)
    setIsValidAccess(true)
    setIsLoading(false)
  }, [isDevelopment])

  // メニューデータを読み込み
  useEffect(() => {
    if (!isValidAccess) return

    // APIエンドポイントのベースURLを設定
    const apiBase = isDevelopment ? '' : window.location.origin

    fetch(`${apiBase}/api/menu`)
      .then(response => response.json())
      .then(data => {
        setMenuData(data)
        // 最初のタブを設定
        if (data.length > 0) {
          setActiveTab(data[0].category)
        }
      })
      .catch(error => {
        console.error('メニューの読み込みに失敗しました:', error)
        // フォールバック用のサンプルデータ
        const fallbackData = [
          { category: 'Drinks', subcategory: 'コーヒー', name_ja: 'ブレンドコーヒー', name_en: 'Blend Coffee', price: 350, recommended: 1, new: 0, stock: 1, image_path: 'drinks/coffee-blend.png' },
          { category: 'Drinks', subcategory: 'コーヒー', name_ja: 'カフェラテ', name_en: 'Cafe Latte', price: 450, recommended: 1, new: 0, stock: 1, image_path: 'drinks/coffee-latte.png' },
          { category: 'Specials', subcategory: 'チョコレート', name_ja: 'チョコレートケーキ', name_en: 'Chocolate Cake', price: 500, recommended: 1, new: 0, stock: 1, image_path: 'sweets/cake-chocolate.png' },
        ]
        setMenuData(fallbackData)
        setActiveTab('Drinks')
      })
  }, [isValidAccess, isDevelopment])

  // 注文履歴を取得
  useEffect(() => {
    if (qrId && isValidAccess) {
      // APIエンドポイントのベースURLを設定
      const apiBase = isDevelopment ? '' : window.location.origin
      
      fetch(`${apiBase}/api/orders/${qrId}`)
        .then(response => response.json())
        .then(data => setOrders(data))
        .catch(error => console.error('注文履歴の取得に失敗しました:', error))
    }
  }, [qrId, isValidAccess, isDevelopment])

  // メニューをジャンル別にグループ化
  const groupedMenu = menuData.reduce((acc, item) => {
    // 空のカテゴリをスキップ
    if (!item.category || !item.category.trim()) {
      return acc
    }
    
    if (!acc[item.category]) {
      acc[item.category] = {}
    }
    if (!acc[item.category][item.subcategory]) {
      acc[item.category][item.subcategory] = []
    }
    acc[item.category][item.subcategory].push(item)
    return acc
  }, {})

  // 大ジャンルのリストを取得（undefinedを除外）
  const categories = Object.keys(groupedMenu).filter(cat => cat !== 'undefined')

  // 注文処理
  const handleOrder = (item) => {
    setSelectedItem(item)
    setShowOrderDialog(true)
  }

  const confirmOrder = async () => {
    if (!selectedItem) return

    try {
      // APIエンドポイントのベースURLを設定
      const apiBase = isDevelopment ? '' : window.location.origin
      
      const response = await fetch(`${apiBase}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qr_id: qrId,
          menu_id: selectedItem.name_ja,
        }),
      })

      if (response.ok) {
        // 注文履歴を更新
        const newOrder = await response.json()
        setOrders(prev => [newOrder, ...prev])
        setShowOrderDialog(false)
        setSelectedItem(null)
        
        // 注文成功の表示
        setOrderSuccess(true)
        setTimeout(() => setOrderSuccess(false), 2000)
      } else {
        console.error('注文の送信に失敗しました')
      }
    } catch (error) {
      console.error('注文の送信に失敗しました:', error)
    }
  }

  const cancelOrder = () => {
    setShowOrderDialog(false)
    setSelectedItem(null)
  }

  // 画像の読み込みエラー時のフォールバック
  const handleImageError = (e) => {
    e.target.style.display = 'none'
  }

  // ローディング画面
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>読み込み中...</p>
      </div>
    )
  }

  // アクセス拒否画面（本番環境のみ）
  if (!isValidAccess && !isDevelopment) {
    return (
      <div className="access-denied">
        <div className="access-denied-content">
          <h1>🔒 アクセス制限</h1>
          <p>このページはQRコード経由でのみアクセスできます。</p>
          <p>テーブルに設置されたQRコードをスキャンしてください。</p>
          <div className="qr-example">
            <div className="qr-placeholder">
              <span>📱</span>
              <p>QRコードをスキャン</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>ぱのあ亭</h1>
          <p>テーブルID: {qrId}</p>
          <button 
            className="order-history-button"
            onClick={() => setShowOrderHistory(!showOrderHistory)}
          >
            📋 注文履歴 ({orders.length})
          </button>
        </div>
        {isDevelopment && (
          <div className="dev-badge">
            <span>🔧 開発モード</span>
            <p>ローカル開発環境ではQRコード不要でアクセス可能です</p>
          </div>
        )}
      </header>

      <main className="main">
        {/* タブナビゲーション */}
        <div className="tab-navigation">
          {categories.map((category) => (
            <button
              key={category}
              className={`tab-button ${activeTab === category ? 'active' : ''}`}
              onClick={() => setActiveTab(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {/* 注文成功メッセージ */}
        {orderSuccess && (
          <div className="order-success">
            <span>✅ 注文を受け付けました！</span>
          </div>
        )}

        {/* メニューコンテナ */}
        <div className="menu-container">
          {activeTab && groupedMenu[activeTab] && (
            <div className="category">
              <h2 className="category-title">{activeTab}</h2>
              {Object.entries(groupedMenu[activeTab]).map(([subcategory, items]) => (
                <div key={subcategory} className="subcategory">
                  <h3 className="subcategory-title">{subcategory}</h3>
                  <div className="menu-grid">
                    {items.map((item, index) => (
                      <div key={index} className={`menu-item ${item.new === 1 ? 'new' : ''} ${!item.image_path || !item.image_path.trim() ? 'no-image' : ''}`}>
                        {item.image_path && item.image_path.trim() && (
                          <div className="menu-item-image">
                            <img
                              src={`/data/imgs/${item.image_path}`}
                              alt={item.name_ja}
                              onError={handleImageError}
                              className="menu-image"
                            />
                            {item.recommended === 1 && (
                              <span className="recommend-badge-overlay">おすすめ</span>
                            )}
                          </div>
                        )}
                        <div className="menu-item-content">
                          <div className="menu-item-header">
                            <h4 className="menu-item-name">{item.name_ja}</h4>
                            {item.recommended === 1 && (!item.image_path || !item.image_path.trim()) && (
                              <span className="recommend-badge">おすすめ</span>
                            )}
                          </div>
                          <p className="menu-item-english">{item.name_en}</p>
                          {/* 価格を一時的に非表示 */}
                          {/* <p className="menu-item-price">¥{item.price}</p> */}
                          {item.stock === 0 && (
                            <span className="out-of-stock">売り切れ</span>
                          )}
                          {item.stock === 1 && (
                            <button
                              className="order-button"
                              onClick={() => handleOrder(item)}
                            >
                              注文する
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 注文履歴ダイアログ */}
        {showOrderHistory && (
          <div className="dialog-overlay">
            <div className="dialog order-history-dialog">
              <div className="dialog-header">
                <h3>注文履歴</h3>
                <button className="close-button" onClick={() => setShowOrderHistory(false)}>
                  ✕
                </button>
              </div>
              <div className="dialog-content">
                {orders.length === 0 ? (
                  <p className="no-orders">まだ注文がありません</p>
                ) : (
                  <ul className="order-list">
                    {orders.map((order) => (
                      <li key={order.id} className="order-item">
                        <span className="order-menu">{order.menu_id}</span>
                        <span className="order-time">
                          {new Date(order.timestamp).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 注文確認ダイアログ */}
      {showOrderDialog && selectedItem && (
        <div className="dialog-overlay">
          <div className="dialog">
            {selectedItem.image_path && selectedItem.image_path.trim() && (
              <div className="dialog-image">
                <img
                  src={`/data/imgs/${selectedItem.image_path}`}
                  alt={selectedItem.name_ja}
                  onError={handleImageError}
                  className="dialog-menu-image"
                />
              </div>
            )}
            <h3>注文確認</h3>
            <p>
              <strong>{selectedItem.name_ja}</strong> を注文しますか？
            </p>
            <p className="price">¥{selectedItem.price}</p>
            <div className="dialog-buttons">
              <button className="confirm-button" onClick={confirmOrder}>
                はい
              </button>
              <button className="cancel-button" onClick={cancelOrder}>
                いいえ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
