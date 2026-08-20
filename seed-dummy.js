import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Load service account key
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ============================================================
// KONFIGURASI
// ============================================================
const INTERVAL_MINUTES = 15;
const DAYS = 30;
const TOTAL_DATA = (DAYS * 24 * 60) / INTERVAL_MINUTES; // 2880 data

// Threshold (cm): Normal 0-50, Siaga 50-250, Bahaya >250
function randomInRange(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function getStatus(waterLevel) {
  if (waterLevel > 250) return 'Bahaya';
  if (waterLevel > 50) return 'Siaga';
  return 'Normal';
}

// ============================================================
// GENERATE DATA
// ============================================================
function generateHistoryData() {
  const data = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0); // mulai dari awal hari ini

  for (let i = 0; i < TOTAL_DATA; i++) {
    // Timestamp mundur dari sekarang
    const timestamp = new Date(now.getTime() - i * INTERVAL_MINUTES * 60000);
    const hour = timestamp.getHours();

    let waterLevel;
    // Pola harian: Normal pagi, Siaga siang, Bahaya sore, kembali Normal malam
    if (hour >= 0 && hour < 6) {
      waterLevel = randomInRange(10, 45); // Normal
    } else if (hour >= 6 && hour < 10) {
      waterLevel = randomInRange(60, 240); // Siaga
    } else if (hour >= 10 && hour < 14) {
      waterLevel = randomInRange(260, 490); // Bahaya
    } else if (hour >= 14 && hour < 18) {
      waterLevel = randomInRange(60, 240); // Siaga
    } else {
      waterLevel = randomInRange(10, 45); // Normal
    }
    // Tambahkan noise
    waterLevel += (Math.random() - 0.5) * 8;
    waterLevel = Math.round(Math.max(5, Math.min(500, waterLevel)) * 10) / 10;

    const status = getStatus(waterLevel);
    data.push({
      water_level: waterLevel,
      temperature: Math.round((24 + Math.random() * 6) * 10) / 10,
      water_presence: waterLevel < 200,
      rain_detected: (waterLevel > 200 && waterLevel < 350 && Math.random() > 0.6),
      timestamp: admin.firestore.Timestamp.fromDate(timestamp),
      status_label: status,
      status_level: status === 'Normal' ? 1 : (status === 'Siaga' ? 2 : 3)
    });
  }
  return data;
}

// ============================================================
// HAPUS DATA HISTORY (dengan batch yang benar)
// ============================================================
async function clearHistory() {
  console.log('🧹 Menghapus semua data history lama...');
  const snapshot = await db.collection('history').get();
  if (snapshot.empty) {
    console.log('⚠️ Tidak ada data history untuk dihapus.');
    return;
  }

  let batch = db.batch();
  let count = 0;
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    batchCount++;
    if (batchCount === 500) {
      await batch.commit();
      console.log(`   ... ${count} data terhapus`);
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) {
    await batch.commit();
  }
  console.log(`✅ ${count} data history dihapus.\n`);
}

// ============================================================
// EKSEKUSI
// ============================================================
async function seed() {
  console.log('🚀 Memulai seeding dummy data...');
  console.log(`📊 Menghasilkan ${TOTAL_DATA} data untuk ${DAYS} hari terakhir (interval ${INTERVAL_MINUTES} menit)\n`);

  // 1. Hapus data history lama
  await clearHistory();

  // 2. Generate data
  const historyData = generateHistoryData();
  console.log(`📤 Menulis ${historyData.length} data ke Firestore...`);

  let count = 0;
  for (const data of historyData) {
    const docId = `history_${Date.now()}_${count}`;
    await db.collection('history').doc(docId).set(data);
    count++;
    if (count % 500 === 0) {
      console.log(`   ... ${count} data tertulis`);
    }
  }
  console.log(`✅ ${count} data history berhasil ditulis.\n`);

  // 3. Tulis ke realtime/current (data terbaru)
  const latest = historyData[0]; // data terbaru (timestamp paling dekat)
  await db.collection('realtime').doc('current').set({
    water_level: latest.water_level,
    temperature: latest.temperature,
    water_presence: latest.water_presence,
    rain_detected: latest.rain_detected,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('✅ realtime/current diupdate dengan data terbaru.\n');

  // 4. Statistik
  const statusCount = { Normal: 0, Siaga: 0, Bahaya: 0 };
  historyData.forEach(d => statusCount[d.status_label]++);
  console.log('📈 Distribusi status:');
  console.log(`   Normal  : ${statusCount.Normal}`);
  console.log(`   Siaga   : ${statusCount.Siaga}`);
  console.log(`   Bahaya  : ${statusCount.Bahaya}`);

  console.log('\n🎉 Seeding selesai! Buka dashboard dan cek Riwayat Data dengan filter 24 jam, 1 minggu, 1 bulan.');
}

seed().catch(console.error);
