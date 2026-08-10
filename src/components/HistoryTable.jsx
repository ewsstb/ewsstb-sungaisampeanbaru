import { useData } from "../context/DataContext";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default function HistoryTable() {
  const { history, historyFilter, getStatus } = useData();
  const last10 = history.slice(-10).reverse();

  const formatTime = (ts) => {
    if (!ts) return "-";
    try {
      let date;
      if (ts.toDate) {
        date = ts.toDate();
      } else if (typeof ts === "number") {
        date = new Date(ts * 1000);
      } else if (typeof ts === "string") {
        date = new Date(ts);
      } else if (ts instanceof Date) {
        date = ts;
      } else {
        return "-";
      }
      if (isNaN(date.getTime())) return "-";

      if (historyFilter === '7d' || historyFilter === '30d') {
        return format(date, "dd MMM yyyy", { locale: id });
      } else {
        return format(date, "dd MMM HH:mm", { locale: id });
      }
    } catch (e) {
      console.warn("Error formatting timestamp:", ts, e);
      return "-";
    }
  };

  const getSafeValue = (value, fallback = "-") => {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "number") return value.toFixed(1);
    return value;
  };

  // Fungsi untuk mendapatkan status dari water_level
  const getStatusLabel = (waterLevel) => {
    if (waterLevel === undefined || waterLevel === null) return "-";
    const status = getStatus(waterLevel);
    return status?.label || "-";
  };

  // Warna status
  const getStatusColor = (waterLevel) => {
    if (waterLevel === undefined || waterLevel === null) return "#6b7d98";
    const status = getStatus(waterLevel);
    if (!status) return "#6b7d98";
    switch (status.color) {
      case 'green': return '#0b7a4a';
      case 'yellow': return '#9e6d0b';
      case 'red': return '#b33a3a';
      default: return '#6b7d98';
    }
  };

  const isAggregated = historyFilter === '7d' || historyFilter === '30d';

  return (
    <div className="p-4 bg-white rounded-2xl shadow overflow-auto max-h-96">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 className="text-lg font-semibold">Riwayat 10 Data Terakhir</h3>
        {isAggregated && (
          <span style={{ fontSize: '12px', color: '#8a9bb5' }}>⚠️ Data rata-rata harian</span>
        )}
      </div>
      {last10.length === 0 ? (
        <p className="text-gray-400 text-center py-4">Belum ada data history.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1 pr-2">Waktu</th>
              <th className="py-1 pr-2">Air (cm)</th>
              <th className="py-1 pr-2">Kondisi</th>
              <th className="py-1 pr-2">Keberadaan Air</th>
              <th className="py-1 pr-2">Hujan</th>
              <th className="py-1">Suhu (°C)</th>
            </tr>
          </thead>
          <tbody>
            {last10.map((item, index) => {
              const waterLevel = item.water_level;
              const statusLabel = getStatusLabel(waterLevel);
              const statusColor = getStatusColor(waterLevel);
              return (
                <tr key={item.id || index} className="border-b last:border-0">
                  <td className="py-1 pr-2 whitespace-nowrap">{formatTime(item.timestamp)}</td>
                  <td className="py-1 pr-2">{getSafeValue(waterLevel)}</td>
                  <td className="py-1 pr-2">
                    <span style={{ color: statusColor, fontWeight: '600' }}>
                      {statusLabel}
                    </span>
                  </td>
                  <td className="py-1 pr-2">{item.water_presence ? "Ada" : "Tidak"}</td>
                  <td className="py-1 pr-2">{item.rain_detected ? "Hujan" : "Tidak"}</td>
                  <td className="py-1">{getSafeValue(item.temperature)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
