import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot, collection, query, orderBy, limit, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { getStatus } from "../utils/thresholds";

const DataContext = createContext();
export const useData = () => useContext(DataContext);

// Fungsi untuk mengonversi timestamp ke Date (apapun tipenya)
function toDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate(); // Firestore Timestamp
  if (typeof timestamp === "number") return new Date(timestamp * 1000); // integer Unix
  if (typeof timestamp === "string") return new Date(timestamp);
  if (timestamp instanceof Date) return timestamp;
  return null;
}

// Fungsi untuk mengelompokkan data per hari dan menghitung rata-rata
function groupByDay(data) {
  const groups = {};
  data.forEach(item => {
    const date = toDate(item.timestamp);
    if (!date) return;
    const key = date.toISOString().split('T')[0]; // YYYY-MM-DD
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

  return Object.values(groups).map(g => ({
    timestamp: new Date(g.date),
    water_level: g.total_water / g.count,
    temperature: g.total_temp / g.count,
    water_presence: g.water_presence.filter(Boolean).length > g.count / 2,
    rain_detected: g.rain_detected.filter(Boolean).length > g.count / 2,
  }));
}

export const DataProvider = ({ children }) => {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [thresholds, setThresholds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyFilter, setHistoryFilter] = useState('24h');

  // Refs untuk caching
  const lastRawHashRef = useRef('');
  const lastFilterRef = useRef('');

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

  // History dengan limit dinamis + caching
  useEffect(() => {
    console.log("🔍 Setting up listener for history with filter:", historyFilter);

    // Tentukan limit optimal berdasarkan filter
    let limitCount = 3000; // default untuk 30 hari
    let startDate = new Date();
    const now = new Date();

    switch(historyFilter) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        limitCount = 200; // cukup untuk 96 data + margin
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        limitCount = 800; // cukup untuk 672 data + margin
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        limitCount = 3000; // 2880 data + margin
        break;
      default:
        startDate.setHours(now.getHours() - 24);
        limitCount = 200;
    }

    const q = query(
      collection(db, "history"),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rawData = [];
        snapshot.forEach((d) => {
          rawData.push({ id: d.id, ...d.data() });
        });

        // --- Caching: cek apakah data & filter sama dengan sebelumnya ---
        const currentHash = rawData.map(d => d.id).join(',');
        if (lastFilterRef.current === historyFilter && lastRawHashRef.current === currentHash) {
          // Data sama, skip processing
          console.log("⏩ Cached: data unchanged, skip processing");
          return;
        }
        lastRawHashRef.current = currentHash;
        lastFilterRef.current = historyFilter;

        // Filter manual berdasarkan startDate
        const filtered = rawData.filter(item => {
          const date = toDate(item.timestamp);
          if (!date) return false;
          return date >= startDate;
        });

        // Urutkan ascending untuk agregasi
        filtered.sort((a, b) => {
          const da = toDate(a.timestamp);
          const db = toDate(b.timestamp);
          return da - db;
        });

        let processedData = filtered;
        if (historyFilter === '24h') {
          processedData = filtered.slice(-200);
        } else if (historyFilter === '7d' || historyFilter === '30d') {
          processedData = groupByDay(filtered);
        }

        console.log(`📜 History data count: ${processedData.length} (filter: ${historyFilter}, limit: ${limitCount})`);
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
