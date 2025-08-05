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

    fetch('/api/menu')
      .then(response => response.json())
      .then(data => {
        setMenuData(data)
        // 最初のタブを設定
        if (data.length > 0) {
          setActiveTab(data[0].大ジャンル)
        }
      })
      .catch(error => {
        console.error('メニューの読み込みに失敗しました:', error)
        // フォールバック用のサンプルデータ
        const fallbackData = [
          { 大ジャンル: 'ドリンク', 小ジャンル: 'コーヒー', 日本語名: 'ブレンドコーヒー', 英語名: 'Blend Coffee', 金額: 350, おすすめ: 1, 在庫: 1, 画像パス: 'drinks/coffee-blend.png' },
          { 大ジャンル: 'ドリンク', 小ジャンル: 'コーヒー', 日本語名: 'カフェラテ', 英語名: 'Cafe Latte', 金額: 450, おすすめ: 1, 在庫: 1, 画像パス: 'drinks/coffee-latte.png' },
          { 大ジャンル: 'ケーキ', 小ジャンル: 'チョコレート', 日本語名: 'チョコレートケーキ', 英語名: 'Chocolate Cake', 金額: 500, おすすめ: 1, 在庫: 1, 画像パス: 'sweets/cake-chocolate.png' },
        ]
        setMenuData(fallbackData)
        setActiveTab('ドリンク')
      })
  }, [isValidAccess])

  // 注文履歴を取得
  useEffect(() => {
    if (qrId && isValidAccess) {
      fetch(`/api/orders/${qrId}`)
        .then(response => response.json())
        .then(data => setOrders(data))
        .catch(error => console.error('注文履歴の取得に失敗しました:', error))
    }
  }, [qrId, isValidAccess])

  // メニューをジャンル別にグループ化
  const groupedMenu = menuData.reduce((acc, item) => {
    if (!acc[item.大ジャンル]) {
      acc[item.大ジャンル] = {}
    }
    if (!acc[item.大ジャンル][item.小ジャンル]) {
      acc[item.大ジャンル][item.小ジャンル] = []
    }
    acc[item.大ジャンル][item.小ジャンル].push(item)
    return acc
  }, {})

  // 大ジャンルのリストを取得
  const categories = Object.keys(groupedMenu)

  // 注文処理
  const handleOrder = (item) => {
    setSelectedItem(item)
    setShowOrderDialog(true)
  }

  const confirmOrder = async () => {
    if (!selectedItem) return

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qr_id: qrId,
          menu_id: selectedItem.日本語名,
        }),
      })

      if (response.ok) {
        // 注文履歴を更新
        const newOrder = {
          id: Date.now(),
          qr_id: qrId,
          menu_id: selectedItem.日本語名,
          timestamp: new Date().toISOString(),
        }
        setOrders([...orders, newOrder])
        setShowOrderDialog(false)
        setSelectedItem(null)
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
        <h1>QRメニュー</h1>
        <p>テーブルID: {qrId}</p>
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

        {/* メニューコンテナ */}
        <div className="menu-container">
          {activeTab && groupedMenu[activeTab] && (
            <div className="category">
              <h2 className="category-title">{activeTab}</h2>
              {Object.entries(groupedMenu[activeTab]).map(([小ジャンル, items]) => (
                <div key={小ジャンル} className="subcategory">
                  <h3 className="subcategory-title">{小ジャンル}</h3>
                  <div className="menu-grid">
                    {items.map((item, index) => (
                      <div key={index} className={`menu-item ${item.おすすめ === 1 ? 'new' : ''}`}>
                        <div className="menu-item-image">
                          <img
                            src={`/data/imgs/${item.画像パス}`}
                            alt={item.日本語名}
                            onError={handleImageError}
                            className="menu-image"
                          />
                        </div>
                        <div className="menu-item-content">
                          <div className="menu-item-header">
                            <h4 className="menu-item-name">{item.日本語名}</h4>
                            {item.おすすめ === 1 && (
                              <span className="recommend-badge">おすすめ</span>
                            )}
                          </div>
                          <p className="menu-item-english">{item.英語名}</p>
                          <p className="menu-item-price">¥{item.金額}</p>
                          {item.在庫 === 0 && (
                            <span className="out-of-stock">売り切れ</span>
                          )}
                          {item.在庫 === 1 && (
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

        <div className="order-history">
          <h2>注文履歴</h2>
          {orders.length === 0 ? (
            <p>まだ注文がありません</p>
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
      </main>

      {/* 注文確認ダイアログ */}
      {showOrderDialog && selectedItem && (
        <div className="dialog-overlay">
          <div className="dialog">
            <div className="dialog-image">
              <img
                src={`/data/imgs/${selectedItem.画像パス}`}
                alt={selectedItem.日本語名}
                onError={handleImageError}
                className="dialog-menu-image"
              />
            </div>
            <h3>注文確認</h3>
            <p>
              <strong>{selectedItem.日本語名}</strong> を注文しますか？
            </p>
            <p className="price">¥{selectedItem.金額}</p>
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
