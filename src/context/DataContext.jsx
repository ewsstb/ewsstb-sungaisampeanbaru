import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, collection, query, orderBy, limit, getDoc, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { getStatus } from "../utils/thresholds";

const DataContext = createContext();
export const useData = () => useContext(DataContext);

// Fungsi untuk mengelompokkan data per hari dan menghitung rata-rata
function groupByDay(data) {
  const groups = {};
  data.forEach(item => {
    let ts = item.timestamp;
    if (ts?.toDate) ts = ts.toDate();
    else if (typeof ts === 'number') ts = new Date(ts * 1000);
    else if (typeof ts === 'string') ts = new Date(ts);
    if (!(ts instanceof Date) || isNaN(ts)) return;

    const key = ts.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!groups[key]) {
      groups[key] = {
        date: key,
        count: 0,
        total_water: 0,
        total_temp: 0,
        water_presence: [],
        rain_detected: [],
      };
    }
    groups[key].count++;
    groups[key].total_water += item.water_level || 0;
    groups[key].total_temp += item.temperature || 0;
    groups[key].water_presence.push(item.water_presence);
    groups[key].rain_detected.push(item.rain_detected);
  });

  // Hitung rata-rata dan konversi ke format Firestore
  return Object.values(groups).map(g => {
    const avgWater = g.total_water / g.count;
    const avgTemp = g.total_temp / g.count;
    const waterPresence = g.water_presence.filter(Boolean).length > g.count / 2;
    const rainDetected = g.rain_detected.filter(Boolean).length > g.count / 2;
    return {
      timestamp: new Date(g.date),
      water_level: Math.round(avgWater * 10) / 10,
      temperature: Math.round(avgTemp * 10) / 10,
      water_presence: waterPresence,
      rain_detected: rainDetected,
    };
  });
}

export const DataProvider = ({ children }) => {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [thresholds, setThresholds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyFilter, setHistoryFilter] = useState('24h');

  // Ambil thresholds
  useEffect(() => {
    const loadThresholds = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "thresholds"));
        if (snap.exists()) {
          setThresholds(snap.data());
          console.log("✅ Thresholds loaded:", snap.data());
        } else {
          console.warn("⚠️ Thresholds not found, using defaults (Normal 0-50, Siaga 50-250, Bahaya >250)");
          setThresholds({ normal_max: 50, siaga_max: 250 });
        }
      } catch (e) {
        console.error("❌ Error loading thresholds:", e);
        setThresholds({ normal_max: 50, siaga_max: 250 });
      }
    };
    loadThresholds();
  }, []);

  // Realtime current
  useEffect(() => {
    let unsub = () => {};

    const setupListener = () => {
      console.log("🔍 Setting up listener for realtime/current...");
      unsub = onSnapshot(
        doc(db, "realtime", "current"),
        (docSnap) => {
          console.log("📡 Snapshot received for current.");
          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() };
            console.log("✅ Current data:", data);
            setCurrent(data);
            setError(null);
          } else {
            console.warn("⚠️ Document realtime/current does not exist.");
            setCurrent(null);
            setError("Dokumen current tidak ditemukan di Firebase.");
          }
          setLoading(false);
        },
        (err) => {
          console.error("❌ Listener error (current):", err);
          setError(err.message);
          setCurrent(null);
          setLoading(false);
        }
      );
    };

    setupListener();

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // History dengan filter dan agregasi
  useEffect(() => {
    console.log("🔍 Setting up listener for history with filter:", historyFilter);
    
    const now = new Date();
    let startDate = new Date();
    let limitCount = 1000;
    switch(historyFilter) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        limitCount = 200; // cukup untuk 24 jam data 15 menit (96 data)
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        limitCount = 1000; // ambil banyak lalu diagregasi
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        limitCount = 1000;
        break;
      default:
        startDate.setHours(now.getHours() - 24);
        limitCount = 200;
    }

    const q = query(
      collection(db, "history"),
      where("timestamp", ">=", startDate),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );
    
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const hist = [];
        snapshot.forEach((d) => {
          const data = { id: d.id, ...d.data() };
          hist.push(data);
        });
        // Urutkan ascending (agar grouping per hari berurutan)
        hist.sort((a, b) => {
          let ta = a.timestamp, tb = b.timestamp;
          if (ta?.toDate) ta = ta.toDate();
          else if (typeof ta === 'number') ta = new Date(ta * 1000);
          else if (typeof ta === 'string') ta = new Date(ta);
          if (tb?.toDate) tb = tb.toDate();
          else if (typeof tb === 'number') tb = new Date(tb * 1000);
          else if (typeof tb === 'string') tb = new Date(tb);
          return ta - tb;
        });

        let processedData = hist;
        if (historyFilter === '24h') {
          // Tampilkan semua data mentah (maks 200)
          processedData = hist.slice(-200);
        } else if (historyFilter === '7d' || historyFilter === '30d') {
          // Agregasi per hari
          processedData = groupByDay(hist);
        }

        console.log(`📜 History data count: ${processedData.length} (filter: ${historyFilter})`);
        setHistory(processedData);
      },
      (err) => {
        console.error("❌ Listener error (history):", err);
        setHistory([]);
      }
    );
    return () => unsub();
  }, [historyFilter]);

  const getStatusFn = useCallback((level) => getStatus(level, thresholds), [thresholds]);

  return (
    <DataContext.Provider value={{ 
      current, 
      history, 
      thresholds, 
      loading, 
      error, 
      getStatus: getStatusFn,
      historyFilter,
      setHistoryFilter
    }}>
      {children}
    </DataContext.Provider>
  );
};
