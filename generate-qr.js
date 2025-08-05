const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// QRコードを生成する関数
async function generateQRCode(text, filename) {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(text, {
      width: 300,
      margin: 2,
      color: {
        dark: '#2c3e50',
        light: '#ffffff'
      }
    });
    
    // Data URLをファイルに保存
    const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filename, base64Data, 'base64');
    
    console.log(`✅ QRコード生成完了: ${filename}`);
    console.log(`📱 URL: ${text}`);
  } catch (error) {
    console.error(`❌ QRコード生成エラー: ${error.message}`);
  }
}

// QRコードディレクトリを作成
const qrDir = path.join(__dirname, 'qr-codes');
if (!fs.existsSync(qrDir)) {
  fs.mkdirSync(qrDir);
}

// デプロイ後のURL（実際のURLに変更してください）
const baseURL = 'https://tearoom-murex.vercel.app';

// 各テーブルのQRコードを生成
const tables = [
  { id: 'table1', name: 'テーブル1' },
  { id: 'table2', name: 'テーブル2' },
  { id: 'table3', name: 'テーブル3' },
  { id: 'table4', name: 'テーブル4' },
  { id: 'table5', name: 'テーブル5' }
];

async function generateAllQRCodes() {
  console.log('🚀 QRコード生成を開始します...\n');
  
  for (const table of tables) {
    const url = `${baseURL}?id=${table.id}`;
    const filename = path.join(qrDir, `${table.id}.png`);
    
    console.log(`📋 ${table.name} (${table.id}) のQRコードを生成中...`);
    await generateQRCode(url, filename);
    console.log('');
  }
  
  console.log('🎉 すべてのQRコード生成が完了しました！');
  console.log(`📁 QRコードは ${qrDir} ディレクトリに保存されています。`);
  console.log('\n📝 使用方法:');
  console.log('1. 生成されたPNGファイルを印刷');
  console.log('2. 各テーブルに設置');
  console.log('3. お客様がスマホでスキャンして注文');
}

// スクリプト実行
generateAllQRCodes().catch(console.error); 