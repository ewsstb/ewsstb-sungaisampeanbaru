import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ============================================================
// KONFIGURASI
// ============================================================
const INTERVAL_MINUTES = 15;
const HOURS_24 = 24;
const DAYS_7 = 7;

const TOTAL_DATA_24H = (HOURS_24 * 60) / INTERVAL_MINUTES; // 96
const TOTAL_DATA_7D = (DAYS_7 * 24 * 60) / INTERVAL_MINUTES; // 672
const TOTAL_BULK = TOTAL_DATA_24H + TOTAL_DATA_7D; // 768

const THRESHOLD = {
  NORMAL_MAX: 50,
  SIAGA_MAX: 250,
};

// ============================================================
// FUNGSI BANTU
// ============================================================
function randomInRange(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function getStatus(waterLevel) {
  if (waterLevel > THRESHOLD.SIAGA_MAX) return { label: 'Bahaya', level: 3 };
  if (waterLevel > THRESHOLD.NORMAL_MAX) return { label: 'Siaga', level: 2 };
  return { label: 'Normal', level: 1 };
}

// ============================================================
// UPDATE REALTIME/CURRENT
// ============================================================
async function updateRealtime(data) {
  try {
    await db.collection('realtime').doc('current').set({
      water_level: data.water_level,
      temperature: data.temperature,
      water_presence: data.water_presence,
      rain_detected: data.rain_detected,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`   🔄 Realtime updated: ${data.water_level} cm → ${data.status_label}`);
  } catch (err) {
    console.error('❌ Gagal update realtime:', err.message);
  }
}

// ============================================================
// HAPUS SEMUA HISTORY (opsional)
// ============================================================
async function clearHistory() {
  console.log('🧹 Menghapus semua data history lama...');
  const snapshot = await db.collection('history').get();
  if (snapshot.empty) {
    console.log('⚠️ Tidak ada data history.');
    return;
  }
  const batch = db.batch();
  let count = 0;
  snapshot.forEach(doc => {
    batch.delete(doc.ref);
    count++;
    if (count % 500 === 0) {
      batch.commit();
    }
  });
  if (count % 500 !== 0) {
    await batch.commit();
  }
  console.log(`✅ ${count} data dihapus.`);
}

// ============================================================
// GENERATE BULK DATA (24 jam + 7 hari) dengan interval 15 menit
// ============================================================
function generateBulkData(totalData, startDate) {
  const data = [];
  const now = new Date(startDate);

  for (let i = 0; i < totalData; i++) {
    const timestamp = new Date(now.getTime() - i * INTERVAL_MINUTES * 60000);
    const hour = timestamp.getHours();

    let waterLevel;
    if (hour >= 0 && hour < 6) {
      waterLevel = randomInRange(10, 45);
    } else if (hour >= 6 && hour < 10) {
      waterLevel = randomInRange(60, 240);
    } else if (hour >= 10 && hour < 14) {
      waterLevel = randomInRange(260, 490);
    } else if (hour >= 14 && hour < 18) {
      waterLevel = randomInRange(60, 240);
    } else {
      waterLevel = randomInRange(10, 45);
    }
    waterLevel += (Math.random() - 0.5) * 8;
    waterLevel = Math.round(Math.max(5, Math.min(500, waterLevel)) * 10) / 10;

    const status = getStatus(waterLevel);
    data.push({
      water_level: waterLevel,
      temperature: Math.round((24 + Math.random() * 6) * 10) / 10,
      water_presence: waterLevel < 200,
      rain_detected: (waterLevel > 200 && waterLevel < 350 && Math.random() > 0.6),
      timestamp: admin.firestore.Timestamp.fromDate(timestamp),
      status_label: status.label,
      status_level: status.level
    });
  }
  return data;
}

// ============================================================
// EKSEKUSI UTAMA
// ============================================================
async function seed() {
  console.log('🚀 Mulai seeding data history & realtime...\n');

  console.log('⚠️  Data history akan dihapus dan diganti dengan data baru.');
  console.log('   (Jika tidak mau, hentikan sekarang dengan Ctrl+C)\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 1. Hapus history lama
  await clearHistory();

  // 2. Buat 3 data pertama dengan timestamp sekarang (selisih 5 detik)
  const now = new Date();
  const firstThree = [
    { water_level: randomInRange(10, 45), label: 'Normal' },
    { water_level: randomInRange(60, 240), label: 'Siaga' },
    { water_level: randomInRange(260, 490), label: 'Bahaya' }
  ];

  console.log('\n📸 Menulis 3 data pertama (history + realtime):');
  let lastData = null;
  for (let i = 0; i < 3; i++) {
    const ts = new Date(now.getTime() + i * 5000);
    const wl = firstThree[i].water_level;
    const status = getStatus(wl);
    const data = {
      water_level: wl,
      temperature: Math.round((24 + Math.random() * 6) * 10) / 10,
      water_presence: wl < 200,
      rain_detected: (wl > 200 && wl < 350 && Math.random() > 0.6),
      timestamp: admin.firestore.Timestamp.fromDate(ts),
      status_label: status.label,
      status_level: status.level
    };

    // Tulis ke history
    const docId = `history_${Date.now()}_${i}`;
    await db.collection('history').doc(docId).set(data);
    console.log(`   ✅ History ${i+1}: ${wl} cm → ${status.label}`);

    // Tulis ke realtime/current (overwrite)
    await updateRealtime(data);
    lastData = data;

    if (i < 2) {
      console.log('   ⏳ Tunggu 5 detik...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // 3. Generate bulk data: 24 jam + 7 hari, interval 15 menit, mundur dari 1 menit lalu
  const startBulk = new Date(now.getTime() - 60000);
  const bulkData = generateBulkData(TOTAL_BULK, startBulk);
  console.log(`\n📊 Bulk data (24 jam + 7 hari): ${bulkData.length} data siap ditulis.`);

  // 4. Tulis bulk data tanpa delay
  console.log('📤 Menulis bulk data ke Firestore...');
  let count = 3;
  for (const data of bulkData) {
    const docId = `history_${Date.now()}_${count}`;
    await db.collection('history').doc(docId).set(data);
    count++;
    if (count % 100 === 0) {
      console.log(`   ... ${count} data tertulis`);
    }
  }

  // 5. Update realtime/current dengan data terakhir yang paling baru (data ketiga)
  // Data ketiga adalah yang paling baru, sudah di-set di loop pertama.
  // Tapi kita set ulang untuk memastikan realtime = data ketiga.
  if (lastData) {
    await updateRealtime(lastData);
    console.log(`\n✅ Realtime/current di-set ke data terakhir (${lastData.water_level} cm → ${lastData.status_label})`);
  }

  console.log(`\n✅ Berhasil menulis ${count} data ke Firestore.`);
  console.log(`   (3 data pertama + ${bulkData.length} data bulk)`);

  console.log('\n📈 Distribusi status:');
  const statusCount = { Normal: 0, Siaga: 0, Bahaya: 0 };
  bulkData.forEach(d => statusCount[d.status_label]++);
  // Tambahkan 3 data pertama
  const firstThreeLabels = firstThree.map(d => getStatus(d.water_level).label);
  firstThreeLabels.forEach(label => statusCount[label]++);
  console.log(`   Normal  : ${statusCount.Normal} data`);
  console.log(`   Siaga   : ${statusCount.Siaga} data`);
  console.log(`   Bahaya  : ${statusCount.Bahaya} data`);

  console.log('\n🎉 Selesai!');
  console.log('📌 3 data pertama memiliki timestamp sekarang dengan selisih 5 detik:');
  console.log(`   1. Normal  : ${firstThree[0].water_level} cm`);
  console.log(`   2. Siaga   : ${firstThree[1].water_level} cm`);
  console.log(`   3. Bahaya  : ${firstThree[2].water_level} cm`);
  console.log('✅ Realtime/current sudah diisi dengan data terakhir (data #3).');
  console.log('   Buka dashboard → lihat kartu real-time → sudah terupdate!');
}

// ============================================================
// JALANKAN
// ============================================================
seed().catch(console.error);
