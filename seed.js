import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Threshold baru (cm): Aman 0-100, Siaga 100-300, Waspada 300-400, Bahaya 400-500
function randomInRange(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function generateCurrentData() {
  return [
    { water_level: 50, label: '🟢 AMAN (0-100 cm)', rain: false, presence: false },
    { water_level: 200, label: '🟡 SIAGA (100-300 cm)', rain: false, presence: false },
    { water_level: 350, label: '🟠 WASPADA (300-400 cm)', rain: false, presence: false },
    { water_level: 450, label: '🔴 BAHAYA (400-500 cm)', rain: true, presence: true },
    { water_level: 50, label: '🟢 AMAN (kembali)', rain: false, presence: false },
  ];
}

function generateHistoryData() {
  const historyData = [];
  const now = new Date();

  for (let i = 0; i < 24; i++) {
    const hour = now.getTime() - (23 - i) * 3600000;
    const timestamp = new Date(hour);
    let waterLevel, rain = false, presence = false;

    if (i < 4) waterLevel = randomInRange(10, 90); // Aman
    else if (i < 8) waterLevel = randomInRange(150, 280); // Siaga
    else if (i < 12) waterLevel = randomInRange(310, 390); // Waspada
    else if (i < 16) { waterLevel = randomInRange(410, 490); rain = true; presence = true; } // Bahaya
    else if (i < 20) waterLevel = randomInRange(150, 280); // Siaga
    else waterLevel = randomInRange(10, 90); // Aman

    waterLevel = Math.round(Math.max(5, Math.min(500, waterLevel)) * 10) / 10;

    historyData.push({
      water_level: waterLevel,
      water_presence: presence || waterLevel < 200,
      rain_detected: rain || (waterLevel > 300 && waterLevel < 400 && Math.random() > 0.5),
      temperature: Math.round((24 + Math.random() * 6) * 10) / 10,
      timestamp: admin.firestore.Timestamp.fromDate(timestamp)
    });
  }
  return historyData;
}

async function seed() {
  console.log('🚀 Mulai seeding data ke Firestore...\n');
  console.log('Threshold (cm): Aman 0-100, Siaga 100-300, Waspada 300-400, Bahaya 400-500\n');

  const currentData = generateCurrentData();
  for (let i = 0; i < currentData.length; i++) {
    const data = currentData[i];
    const payload = {
      water_level: data.water_level,
      water_presence: data.presence || data.water_level < 200,
      rain_detected: data.rain || (data.water_level > 300 && data.water_level < 400 && Math.random() > 0.5),
      temperature: Math.round((24 + Math.random() * 6) * 10) / 10,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('realtime').doc('current').set(payload);
    console.log(`✅ Current: ${data.water_level} cm → ${data.label}`);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('\n📊 Mengisi history (24 jam)...');
  const historyData = generateHistoryData();
  let count = 0;
  for (const data of historyData) {
    const docId = `history_${Date.now()}_${count}`;
    await db.collection('history').doc(docId).set(data);
    count++;
  }
  console.log(`✅ History: ${count} data tersimpan`);

  console.log('\n✅ Seeding selesai! Cek Firestore dan dashboard.');
}

seed().catch(console.error);
