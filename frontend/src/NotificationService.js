// Web Push Notification サービス
class NotificationService {
  constructor() {
    this.permission = 'default'
    this.isSupported = 'Notification' in window
  }

  // 通知許可を要求
  async requestPermission() {
    if (!this.isSupported) {
      console.warn('このブラウザは通知をサポートしていません')
      return false
    }

    try {
      this.permission = await Notification.requestPermission()
      return this.permission === 'granted'
    } catch (error) {
      console.error('通知許可の取得に失敗:', error)
      return false
    }
  }

  // 通知を送信
  showNotification(title, options = {}) {
    if (!this.isSupported || this.permission !== 'granted') {
      console.warn('通知が許可されていません')
      return null
    }

    const defaultOptions = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'tearoom-order',
      requireInteraction: true,
      ...options
    }

    return new Notification(title, defaultOptions)
  }

  // 注文通知（専用）
  notifyNewOrder(order) {
    const title = '🔔 新しい注文'
    const options = {
      body: `テーブル ${order.table_id}: ${order.menu_id}`,
      icon: '/favicon.ico',
      tag: 'new-order',
      data: { orderId: order.id, tableId: order.table_id }
    }

    const notification = this.showNotification(title, options)
    
    if (notification) {
      // 通知クリック時の処理
      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      // 10秒後に自動で閉じる
      setTimeout(() => {
        notification.close()
      }, 10000)
    }

    return notification
  }

  // サウンド付き通知
  notifyWithSound(title, options = {}) {
    // 通知表示
    const notification = this.showNotification(title, options)
    
    // サウンド再生
    this.playNotificationSound()
    
    return notification
  }

  // 通知音を再生
  playNotificationSound() {
    try {
      // ブラウザ内蔵音を使用
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBzuS1f/ScS8OJHfH8N2QQAwUXrTp66hVFApGnODyvmwaBjuJ1P/ScTEOJHfH8N2QQAoRYLTq66dVFAhGnt/yvmcaBj+J1P/Sc')
      audio.volume = 0.3
      audio.play().catch(() => {
        // 音声再生に失敗した場合は無視
      })
    } catch (error) {
      // エラーは無視
    }
  }
}

export default new NotificationService() 