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
  const [menuLoading, setMenuLoading] = useState(true)
  const [showOrderHistory, setShowOrderHistory] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [imageLoadingStates, setImageLoadingStates] = useState({})
  const [currentTabImages, setCurrentTabImages] = useState(new Set())

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
      setMenuLoading(false)
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
        // 画像読み込み状態を初期化
        const initialImageStates = {}
        data.forEach(item => {
          if (item.image_path && item.image_path.trim()) {
            initialImageStates[item.image_path] = null // null = 未開始
          }
        })
        setImageLoadingStates(initialImageStates)
        // 最初のタブを設定とプリロード
        if (data.length > 0) {
          const firstCategory = data[0].category
          setActiveTab(firstCategory)
          
          // 最初のタブの画像をプリロード
          setTimeout(() => {
            const firstTabItems = data.filter(item => item.category === firstCategory)
            firstTabItems.forEach(item => {
              if (item.image_path && item.image_path.trim()) {
                preloadImage(item.image_path)
              }
            })
          }, 500) // メニュー表示後にプリロード開始
        }
        // メニューデータの読み込み完了
        setMenuLoading(false)
        setIsLoading(false)
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
        // フォールバックデータでも画像読み込み状態を初期化
        const initialImageStates = {}
        fallbackData.forEach(item => {
          if (item.image_path && item.image_path.trim()) {
            initialImageStates[item.image_path] = null
          }
        })
        setImageLoadingStates(initialImageStates)
        setActiveTab('Drinks')
        
        // フォールバックデータの画像をプリロード
        setTimeout(() => {
          fallbackData.forEach(item => {
            if (item.image_path && item.image_path.trim()) {
              preloadImage(item.image_path)
            }
          })
        }, 500)
        
        // フォールバックデータの読み込み完了
        setMenuLoading(false)
        setIsLoading(false)
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

  // 画像の読み込み開始
  const handleImageLoadStart = (imagePath) => {
    setImageLoadingStates(prev => ({
      ...prev,
      [imagePath]: 'loading'
    }))
  }

  // 画像の読み込み完了
  const handleImageLoad = (imagePath) => {
    setImageLoadingStates(prev => ({
      ...prev,
      [imagePath]: 'loaded'
    }))
  }

  // 画像の読み込みエラー時のフォールバック
  const handleImageError = (e, imagePath) => {
    setImageLoadingStates(prev => ({
      ...prev,
      [imagePath]: 'error'
    }))
    e.target.style.display = 'none'
  }

  // 画像のプリロード
  const preloadImage = (imagePath) => {
    if (!imagePath || imageLoadingStates[imagePath] === 'loaded' || imageLoadingStates[imagePath] === 'loading') {
      return
    }
    
    const img = new Image()
    img.onload = () => handleImageLoad(imagePath)
    img.onerror = () => setImageLoadingStates(prev => ({
      ...prev,
      [imagePath]: 'error'
    }))
    
    handleImageLoadStart(imagePath)
    img.src = `/data/imgs/${imagePath}`
  }

  // タブ切り替え時に画像をプリロード
  const handleTabChange = (tabName) => {
    setActiveTab(tabName)
    
    // タブの画像をプリロード
    const tabItems = groupedMenu[tabName]
    if (tabItems) {
      Object.values(tabItems).flat().forEach(item => {
        if (item.image_path && item.image_path.trim()) {
          setTimeout(() => preloadImage(item.image_path), 100) // 少し遅延してプリロード
        }
      })
    }
  }

  // ローディング画面
  if (isLoading || menuLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>🍃 tearoom</h2>
          <p>{menuLoading ? 'メニューを読み込んでいます...' : '初期化中...'}</p>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
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
              onClick={() => handleTabChange(category)}
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
                          <div className={`menu-item-image ${imageLoadingStates[item.image_path] === 'loading' ? 'loading' : ''} ${imageLoadingStates[item.image_path] === 'loaded' ? 'loaded' : ''}`}>
                            {/* スケルトンローダー */}
                            {(!imageLoadingStates[item.image_path] || imageLoadingStates[item.image_path] === 'loading') && (
                              <div className="image-skeleton"></div>
                            )}
                            <img
                              src={`/data/imgs/${item.image_path}`}
                              alt={item.name_ja}
                              onLoadStart={() => handleImageLoadStart(item.image_path)}
                              onLoad={() => handleImageLoad(item.image_path)}
                              onError={(e) => handleImageError(e, item.image_path)}
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
              <div className={`dialog-image ${imageLoadingStates[selectedItem.image_path] === 'loading' ? 'loading' : ''} ${imageLoadingStates[selectedItem.image_path] === 'loaded' ? 'loaded' : ''}`}>
                {/* スケルトンローダー */}
                {(!imageLoadingStates[selectedItem.image_path] || imageLoadingStates[selectedItem.image_path] === 'loading') && (
                  <div className="image-skeleton"></div>
                )}
                <img
                  src={`/data/imgs/${selectedItem.image_path}`}
                  alt={selectedItem.name_ja}
                  onLoadStart={() => handleImageLoadStart(selectedItem.image_path)}
                  onLoad={() => handleImageLoad(selectedItem.image_path)}
                  onError={(e) => handleImageError(e, selectedItem.image_path)}
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
