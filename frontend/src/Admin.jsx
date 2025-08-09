import { useState, useEffect } from 'react'
import './Admin.css'
import NotificationService from './NotificationService.js'

function Admin() {
  const [tableOrders, setTableOrders] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTable, setSelectedTable] = useState('')
  const [authKey, setAuthKey] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [notificationEnabled, setNotificationEnabled] = useState(false)
  const [lastOrderCount, setLastOrderCount] = useState(0)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 開発環境かどうかを判定
  const isDevelopment = process.env.NODE_ENV === 'development' || 
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1'

  // 管理画面認証
  const handleAuth = async () => {
    // 簡単な認証（実際の運用では適切な認証システムを使用）
    if (authKey === '3104' || isDevelopment) {
      setIsAuthenticated(true)
      
      // 通知許可を要求
      const permitted = await NotificationService.requestPermission()
      setNotificationEnabled(permitted)
      if (!permitted) {
        alert('通知を有効にするには、ブラウザの設定で通知を許可してください')
      }
      
      loadTableOrders()
    } else {
      alert('認証キーが正しくありません')
    }
  }

  // テーブル別注文履歴を取得
  const loadTableOrders = async () => {
    try {
      setIsLoading(true)
      const apiBase = isDevelopment ? '' : window.location.origin
      const response = await fetch(`${apiBase}/api/admin/orders`)
      
      if (!response.ok) {
        throw new Error('注文履歴の取得に失敗しました')
      }
      
      const orders = await response.json()
      
      // テーブル別にグループ化
      const groupedOrders = orders.reduce((acc, order) => {
        // table_idが不正な場合はqr_idを使用
        const tableId = order.table_id || order.qr_id || 'unknown'
        if (!acc[tableId]) {
          acc[tableId] = []
        }
        // 価格がNaNの場合は0に補正
        const correctedOrder = {
          ...order,
          price: isNaN(order.price) ? 0 : (order.price || 0)
        }
        acc[tableId].push(correctedOrder)
        return acc
      }, {})
      
      setTableOrders(groupedOrders)
      
      // 新しい注文があるかチェック
      const currentOrderCount = orders.length
      if (lastOrderCount > 0 && currentOrderCount > lastOrderCount && notificationEnabled) {
        // 新しい注文を通知
        const newOrders = orders.slice(0, currentOrderCount - lastOrderCount)
        newOrders.forEach(order => {
          NotificationService.notifyWithSound('🔔 新しい注文!', {
            body: `テーブル ${order.table_id || order.qr_id}: ${order.menu_id}`,
            tag: `order-${order.id}`
          })
        })
      }
      setLastOrderCount(currentOrderCount)
      
    } catch (error) {
      console.error('注文履歴の読み込みエラー:', error)
      alert('注文履歴の読み込みに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  // テーブルの会計処理
  // 自動更新の設定
  useEffect(() => {
    if (!isAuthenticated || !autoRefresh) return

    const interval = setInterval(() => {
      loadTableOrders()
    }, 10000) // 10秒ごとに更新

    return () => clearInterval(interval)
  }, [isAuthenticated, autoRefresh])

  const handleCheckout = async (tableId) => {
    if (!confirm(`テーブル ${tableId} の注文を会計済みにしますか？`)) {
      return
    }

    try {
      const apiBase = isDevelopment ? '' : window.location.origin
      const response = await fetch(`${apiBase}/api/admin/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ table_id: tableId }),
      })

      const result = await response.json()
      
      if (!response.ok) {
        if (result.needsMigration) {
          alert(`エラー: ${result.error}\n\nSupabaseのマイグレーションが必要です。SUPABASE_SETUP.mdを参照してください。`)
        } else {
          alert(`エラー: ${result.error || '会計処理に失敗しました'}`)
        }
        return
      }

      // 成功時のメッセージ表示
      if (result.warning) {
        alert(`${result.message}\n\n注意: ${result.warning}`)
      } else {
        alert(result.message || `テーブル ${tableId} の会計が完了しました`)
      }
      
      loadTableOrders() // 再読み込み
    } catch (error) {
      console.error('会計処理エラー:', error)
      alert('ネットワークエラーまたはサーバーエラーが発生しました')
    }
  }

  // 認証されていない場合の認証画面
  if (!isAuthenticated) {
    return (
      <div className="admin-auth">
        <div className="auth-container">
          <h1>🍃 tearoom 管理画面</h1>
          <div className="auth-form">
            <input
              type="password"
              placeholder="認証キーを入力してください"
              value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
            />
            <button onClick={handleAuth}>ログイン</button>
          </div>
          {isDevelopment && (
            <p className="dev-note">開発環境では任意の文字でログインできます</p>
          )}
        </div>
      </div>
    )
  }

  // ローディング画面
  if (isLoading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>注文履歴を読み込んでいます...</p>
      </div>
    )
  }

  const tableIds = Object.keys(tableOrders).sort()

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>🍃 tearoom 管理画面</h1>
        <div className="admin-actions">
          <div className="notification-status">
            {notificationEnabled ? '🔔' : '🔕'} 
            <span>{notificationEnabled ? '通知ON' : '通知OFF'}</span>
          </div>
          <button 
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`auto-refresh-button ${autoRefresh ? 'active' : ''}`}
          >
            {autoRefresh ? '⏸️ 自動更新停止' : '▶️ 自動更新開始'}
          </button>
          <button onClick={loadTableOrders} className="refresh-button">
            🔄 更新
          </button>
          <button onClick={() => setIsAuthenticated(false)} className="logout-button">
            ログアウト
          </button>
        </div>
      </header>

      <main className="admin-main">
        {tableIds.length === 0 ? (
          <div className="no-orders">
            <p>現在、未会計の注文はありません</p>
          </div>
        ) : (
          <div className="tables-grid">
            {tableIds.map((tableId) => {
              const orders = tableOrders[tableId]
              const totalAmount = orders.reduce((sum, order) => sum + order.price, 0)
              
              return (
                <div key={tableId} className="table-card">
                  <div className="table-header">
                    <h2>テーブル {tableId}</h2>
                    <span className="order-count">{orders.length}件</span>
                  </div>
                  
                  <div className="table-orders">
                    {orders.map((order, index) => (
                      <div key={order.id || index} className="order-item">
                        <div className="order-details">
                          <span className="order-menu">{order.menu_id}</span>
                          <span className="order-price">¥{order.price}</span>
                        </div>
                        <div className="order-time">
                          {new Date(order.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="table-footer">
                    <div className="total-amount">
                      合計: ¥{totalAmount}
                    </div>
                    <button 
                      onClick={() => handleCheckout(tableId)}
                      className="checkout-button"
                    >
                      会計済みにする
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default Admin 