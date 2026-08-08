import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, collection, query, orderBy, limit, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { getStatus } from "../utils/thresholds";

const DataContext = createContext();
export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [thresholds, setThresholds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadThresholds = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "thresholds"));
        if (snap.exists()) {
          setThresholds(snap.data());
          console.log("✅ Thresholds loaded:", snap.data());
        } else {
          console.warn("⚠️ Thresholds not found, using defaults (Aman 0-100cm, Siaga 100-300cm, Waspada 300-400cm, Bahaya >400cm)");
          setThresholds({ water_max_aman: 100, water_max_siaga: 300, water_max_waspada: 400 });
        }
      } catch (e) {
        console.error("❌ Error loading thresholds:", e);
        setThresholds({ water_max_aman: 100, water_max_siaga: 300, water_max_waspada: 400 });
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

  // History
  useEffect(() => {
    console.log("🔍 Setting up listener for history...");
    const q = query(collection(db, "history"), orderBy("timestamp", "desc"), limit(100));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const hist = [];
        snapshot.forEach((d) => {
          const data = { id: d.id, ...d.data() };
          hist.push(data);
        });
        hist.reverse();
        console.log(`📜 History data count: ${hist.length}`);
        setHistory(hist);
      },
      (err) => {
        console.error("❌ Listener error (history):", err);
        setHistory([]);
      }
    );
    return () => unsub();
  }, []);

  const getStatusFn = useCallback((level) => getStatus(level, thresholds), [thresholds]);

  return (
    <DataContext.Provider value={{ current, history, thresholds, loading, error, getStatus: getStatusFn }}>
      {children}
    </DataContext.Provider>
  );
};
