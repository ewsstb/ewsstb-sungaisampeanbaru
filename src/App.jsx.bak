import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { DataProvider, useData } from './context/DataContext';
import NotificationListener from './components/NotificationListener';
import { publishAllRelays, connectMqtt, syncESP32Time } from './services/mqtt';
import { getCombinedStatus } from './utils/thresholds';
import { auth } from './services/firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import './App.css';

// Komponen lain
import HistoryTable from './components/HistoryTable';
import WaterLevelChart from './components/WaterLevelChart';
import WaterPresenceChart from './components/WaterPresenceChart';
import RainChart from './components/RainChart';
import EnvironmentChart from './components/EnvironmentChart';
import Clock from './components/Clock';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ============================================
// 1. LOGIN
// ============================================
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <i className="fas fa-cloud-sun-rain" style={{ fontSize: 48, color: '#0077be' }}></i>
          <h1>Air & Environment</h1>
          <p>Monitoring System</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="masukkan email" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="masukkan password" required />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={loading}>{loading ? 'Memuat...' : 'Masuk'}</button>
        </form>
        <div className="login-footer">© 2026 Air & Environment</div>
      </div>
    </div>
  );
}

// ============================================
// 2. DASHBOARD PAGE (tanpa humidity)
// ============================================
function DashboardPage() {
  const { current, history, loading, error, thresholds, getStatus } = useData();
  const [chartTab, setChartTab] = useState(0);

  const [relay1, setRelay1] = useState(false);
  const [relay2, setRelay2] = useState(false);
  const [relay3, setRelay3] = useState(false);
  const [relay4, setRelay4] = useState(false);

  const [mode, setMode] = useState('auto');
  const [combinedStatus, setCombinedStatus] = useState({ label: 'Aman', color: 'green', level: 1 });

  useEffect(() => {
    connectMqtt();
  }, []);

  useEffect(() => {
    if (mode !== 'auto' || !current) return;

    const data = {
      water_level: current.water_level || 0,
      water_presence: current.water_presence || false,
      temperature: current.temperature || 0,
      rain_detected: current.rain_detected || false,
    };
    const status = getCombinedStatus(data, thresholds);
    setCombinedStatus(status);

    let r1 = false, r2 = false, r3 = false, r4 = false;
    if (status.level === 1) { // Aman
      r1 = true;
    } else if (status.level === 2) { // Siaga
      r2 = true;
    } else if (status.level === 3) { // Waspada (50-100cm)
      r3 = true;
    } else if (status.level === 4) { // Bahaya (<50cm)
      r3 = true;
      r4 = true;
    }
    setRelay1(r1);
    setRelay2(r2);
    setRelay3(r3);
    setRelay4(r4);
    publishAllRelays(r1, r2, r3, r4);
  }, [current, thresholds, mode]);

  const handleManualToggle = (relay) => {
    if (mode === 'auto') return;
    let r1 = relay1, r2 = relay2, r3 = relay3, r4 = relay4;
    if (relay === 1) { r1 = !r1; setRelay1(r1); }
    else if (relay === 2) { r2 = !r2; setRelay2(r2); }
    else if (relay === 3) { r3 = !r3; setRelay3(r3); }
    else if (relay === 4) { r4 = !r4; setRelay4(r4); }
    publishAllRelays(r1, r2, r3, r4);
  };

  const toggleMode = () => {
    const newMode = mode === 'auto' ? 'manual' : 'auto';
    setMode(newMode);
    if (newMode === 'auto') {
      setRelay1(false); setRelay2(false); setRelay3(false); setRelay4(false);
    }
  };

  const handleSyncTime = () => {
    syncESP32Time();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Memuat data...</p></div>;
  }

  if (error || !current) {
    return (
      <div className="flex items-center justify-center h-64 flex-col">
        <p className="text-red-500 text-lg font-semibold">⚠️ Gagal memuat data dari Firebase</p>
        <p className="text-gray-500 mt-2">{error || "Dokumen 'current' tidak ditemukan di koleksi 'realtime'."}</p>
        <p className="text-sm text-gray-400 mt-4">Pastikan ESP32 sudah mengirim data atau buat dokumen manual di Firebase Console.</p>
      </div>
    );
  }

  const waterLevel = current.water_level || 0;
  const temperature = current.temperature || 0;
  const status = getStatus(waterLevel);
  const statusLabel = status?.label || 'Aman';
  const statusColor = status?.color || 'green';

  const historyData = history || [];
  const labels = historyData.map(d => {
    const ts = d.timestamp?.toDate ? d.timestamp.toDate() : (d.timestamp ? new Date(d.timestamp * 1000) : new Date());
    return ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  });
  const waterHistory = historyData.map(d => d.water_level || 0);
  const tempHistory = historyData.map(d => d.temperature || 0);

  const finalLabels = labels.length > 0 ? labels : ['Tidak ada data'];
  const finalWater = waterHistory.length > 0 ? waterHistory : [0];
  const finalTemp = tempHistory.length > 0 ? tempHistory : [0];

  const chartData = {
    labels: finalLabels,
    datasets: [
      {
        label: 'Tinggi Air (cm)',
        data: finalWater,
        borderColor: '#0077be',
        backgroundColor: 'rgba(0,119,190,0.05)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        borderWidth: 2,
        hidden: chartTab !== 0,
      },
      {
        label: 'Suhu (°C)',
        data: finalTemp,
        borderColor: '#f39c12',
        backgroundColor: 'rgba(243,156,18,0.05)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        borderWidth: 2,
        hidden: chartTab !== 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 15, font: { size: 11 } } },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: '#f0f3f8' } },
      x: { grid: { display: false } },
    },
  };

  const statusClass = statusColor === 'green' ? 'aman' : statusColor === 'yellow' ? 'warning' : 'danger';

  return (
    <>
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h2>Ringkasan Kondisi Saat Ini</h2>
          <p className="subtitle">Pantau kondisi lingkungan dan perangkat secara real-time</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Clock />
          <button onClick={handleSyncTime} className="sync-btn" title="Sinkronkan waktu ke ESP32">
            <i className="fas fa-sync-alt"></i> Sync
          </button>
        </div>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="label"><span>Tinggi Permukaan Air</span><div className="icon-bg"><i className="fas fa-water"></i></div></div>
          <div className="value">{waterLevel.toFixed(1)} <small style={{ fontSize: '18px', fontWeight: 500 }}>cm</small></div>
          <span className={`status ${statusClass}`}>{statusLabel}</span>
          <div className="range">Rentang Aman: 0 - 100 cm</div>
        </div>
        <div className="card">
          <div className="label"><span>Status Gabungan</span><div className="icon-bg"><i className="fas fa-shield-alt"></i></div></div>
          <div className="value" style={{ fontSize: 24, color: combinedStatus.color === 'green' ? '#0b7a4a' : combinedStatus.color === 'yellow' ? '#9e6d0b' : '#b33a3a' }}>{combinedStatus.label}</div>
          <span className={`status ${combinedStatus.color === 'green' ? 'aman' : combinedStatus.color === 'yellow' ? 'warning' : 'danger'}`}>Mode: {mode.toUpperCase()}</span>
          <div className="range">Relay: {relay1?'1 ':' '}{relay2?'2 ':' '}{relay3?'3 ':' '}{relay4?'4':''}</div>
        </div>
        <div className="card">
          <div className="label"><span>Hujan</span><div className="icon-bg"><i className="fas fa-cloud-rain"></i></div></div>
          <div className="value" style={{ fontSize: 28 }}>{current.rain_detected ? 'Ya' : 'Tidak'}</div>
          <span className={`status ${current.rain_detected ? 'warning' : 'normal'}`}>{current.rain_detected ? 'Hujan' : 'Cerah'}</span>
          <div className="range">Status: {current.rain_detected ? 'Hujan terdeteksi' : 'Tidak hujan'}</div>
        </div>
        <div className="card">
          <div className="label">
            <span>Keberadaan Air</span>
            <div className="icon-bg"><i className="fas fa-water"></i></div>
          </div>
          <div className="value" style={{ fontSize: 28 }}>
            {current.water_presence ? '✅ Ada' : '❌ Tidak Ada'}
          </div>
          <span className={`status ${current.water_presence ? 'warning' : 'normal'}`}>
            {current.water_presence ? 'Terdeteksi' : 'Tidak Terdeteksi'}
          </span>
          <div className="range">Status: {current.water_presence ? 'Ada air' : 'Tidak ada air'}</div>
        </div>
        <div className="card">
          <div className="label"><span>Suhu Udara</span><div className="icon-bg"><i className="fas fa-thermometer-half"></i></div></div>
          <div className="value">{temperature.toFixed(1)} <small style={{ fontSize: '18px', fontWeight: 500 }}>°C</small></div>
          <span className={`status ${temperature > 35 ? 'danger' : temperature < 20 ? 'warning' : 'normal'}`}>
            {temperature > 35 ? 'Panas' : temperature < 20 ? 'Dingin' : 'Normal'}
          </span>
          <div className="range">Rentang Normal: 20 - 35 °C</div>
        </div>
      </div>

      <div className="row-2">
        <div className="chart-box">
          <h4><i className="fas fa-chart-bar" style={{ marginRight: 8, color: '#0077be' }}></i> Grafik Historis</h4>
          <div className="chart-tabs">
            <span className={chartTab === 0 ? 'active' : ''} onClick={() => setChartTab(0)}>Tinggi Air (cm)</span>
            <span className={chartTab === 1 ? 'active' : ''} onClick={() => setChartTab(1)}>Suhu (°C)</span>
          </div>
          <Line data={chartData} options={chartOptions} height={100} />
        </div>

        <div className="device-status">
          <h4><i className="fas fa-server" style={{ marginRight: 8, color: '#0077be' }}></i> Status Perangkat</h4>
          <div className="device-item"><span>Sensor Ultrasonik (Tinggi Air)</span> <span className="badge">Online</span></div>
          <div className="device-item"><span>Sensor DS18B20 (Suhu)</span> <span className="badge">Online</span></div>
          <div className="device-item"><span>Sensor Hujan</span> <span className="badge">Online</span></div>
          <div className="device-item"><span>Water Presence (Trigger)</span> <span className="badge">{current.water_presence ? 'ON' : 'OFF'}</span></div>
          <div className="device-item"><span>Relay 1 (Aman)</span> <span className={`badge ${relay1 ? '' : 'off'}`}>{relay1 ? 'ON' : 'OFF'}</span></div>
          <div className="device-item"><span>Relay 2 (Siaga)</span> <span className={`badge ${relay2 ? '' : 'off'}`}>{relay2 ? 'ON' : 'OFF'}</span></div>
          <div className="device-item"><span>Relay 3 & 4 (Bahaya)</span> <span className={`badge ${(relay3 || relay4) ? '' : 'off'}`}>{relay3 && relay4 ? 'ON' : 'OFF'}</span></div>
        </div>
      </div>

      <div className="row-3">
        <div className="notif-box">
          <h4><i className="fas fa-bell" style={{ marginRight: 8, color: '#0077be' }}></i> Notifikasi Terbaru <a href="#" style={{ fontSize: 12, fontWeight: 500, color: '#0077be' }}>Lihat semua</a></h4>
          <div className="notif-item"><div className="dot green"></div><div><span className="text"><strong>Kondisi aman</strong></span><div className="time">Semua parameter dalam kondisi normal</div></div></div>
          <div className="notif-item"><div className="dot green"></div><div><span className="text"><strong>Tinggi air normal</strong></span><div className="time">Tinggi air: {waterLevel.toFixed(1)} cm</div></div></div>
          <div className="notif-item"><div className="dot" style={{ background: '#f5a623' }}></div><div><span className="text"><strong>Status gabungan</strong></span><div className="time">Status: {combinedStatus.label}</div></div></div>
        </div>

        <div className="env-box">
          <h4><i className="fas fa-leaf" style={{ marginRight: 8, color: '#0077be' }}></i> Informasi Lingkungan</h4>
          <div className="env-item"><span className="label-env">Suhu Udara</span> <span className="value-env">{temperature.toFixed(1)} °C</span></div>
          <div className="env-item"><span className="label-env">Tekanan Udara</span> <span className="value-env">1008 hPa</span></div>
          <div className="env-item"><span className="label-env">Kualitas Udara (AQI)</span> <span className="value-env">42 Baik</span></div>
        </div>

        <div className="quick-box">
          <h4><i className="fas fa-bolt" style={{ marginRight: 8, color: '#0077be' }}></i> Kontrol Cepat</h4>
          <div className="toggle-control">
            <span><i className="fas fa-exchange-alt" style={{ marginRight: 6 }}></i> Mode</span>
            <div className={`toggle-btn ${mode === 'auto' ? 'active' : ''}`} onClick={toggleMode}>
              <div className="circle"></div>
              <span style={{ fontSize: '10px', position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '50%', transform: 'translate(-50%, -50%)', color: mode === 'auto' ? '#fff' : '#333' }}>
                {mode === 'auto' ? 'Auto' : 'Manual'}
              </span>
            </div>
          </div>
          <div className="toggle-control">
            <span><i className="fas fa-1" style={{ marginRight: 6 }}></i> Relay 1 (Aman)</span>
            <div className={`toggle-btn ${relay1 ? 'active' : ''}`} onClick={() => handleManualToggle(1)}>
              <div className="circle"></div>
            </div>
          </div>
          <div className="toggle-control">
            <span><i className="fas fa-2" style={{ marginRight: 6 }}></i> Relay 2 (Siaga)</span>
            <div className={`toggle-btn ${relay2 ? 'active' : ''}`} onClick={() => handleManualToggle(2)}>
              <div className="circle"></div>
            </div>
          </div>
          <div className="toggle-control">
            <span><i className="fas fa-3" style={{ marginRight: 6 }}></i> Relay 3 (Bahaya)</span>
            <div className={`toggle-btn ${relay3 ? 'active' : ''}`} onClick={() => handleManualToggle(3)}>
              <div className="circle"></div>
            </div>
          </div>
          <div className="toggle-control">
            <span><i className="fas fa-4" style={{ marginRight: 6 }}></i> Relay 4 (Bahaya)</span>
            <div className={`toggle-btn ${relay4 ? 'active' : ''}`} onClick={() => handleManualToggle(4)}>
              <div className="circle"></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================
// 3. HALAMAN LAIN
// ============================================
function HistoryPage() {
  return (
    <div>
      <h2>Riwayat Data</h2>
      <p className="subtitle">Lihat data historis dari sensor</p>
      <HistoryTable />
    </div>
  );
}

function GraphPage() {
  return (
    <div>
      <h2>Grafik Historis</h2>
      <p className="subtitle">Visualisasi data dalam bentuk grafik</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WaterLevelChart />
        <WaterPresenceChart />
        <RainChart />
        <EnvironmentChart />
      </div>
    </div>
  );
}

function NotificationPage() {
  return (
    <div>
      <h2>Notifikasi</h2>
      <p className="subtitle">Daftar semua notifikasi sistem</p>
      <div className="notif-box" style={{ width: '100%' }}>
        <div className="notif-item"><div className="dot green"></div><div><span className="text"><strong>Kondisi aman</strong></span><div className="time">Semua parameter dalam kondisi normal</div></div></div>
        <div className="notif-item"><div className="dot green"></div><div><span className="text"><strong>Tinggi air normal</strong></span><div className="time">Tinggi air: 46 cm (Aman)</div></div></div>
        <div className="notif-item"><div className="dot" style={{ background: '#f5a623' }}></div><div><span className="text"><strong>Status meningkat</strong></span><div className="time">Level air naik ke SIAGA</div></div></div>
      </div>
    </div>
  );
}

function DevicePage() {
  return (
    <div>
      <h2>Perangkat</h2>
      <p className="subtitle">Daftar perangkat dan statusnya</p>
      <div className="device-status" style={{ width: '100%' }}>
        <div className="device-item"><span>Sensor Ultrasonik (Tinggi Air)</span> <span className="badge">Online</span></div>
        <div className="device-item"><span>Sensor DS18B20 (Suhu)</span> <span className="badge">Online</span></div>
        <div className="device-item"><span>Sensor Hujan</span> <span className="badge">Online</span></div>
        <div className="device-item"><span>Water Presence (Trigger)</span> <span className="badge">Online</span></div>
        <div className="device-item"><span>Relay 1 (Aman)</span> <span className="badge">ON</span></div>
        <div className="device-item"><span>Relay 2 (Siaga)</span> <span className="badge off">OFF</span></div>
        <div className="device-item"><span>Relay 3 & 4 (Bahaya)</span> <span className="badge off">OFF</span></div>
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div>
      <h2>Pengaturan</h2>
      <p className="subtitle">Konfigurasi sistem dan threshold</p>
      <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e9edf4' }}>
        <p className="text-gray-500">Halaman pengaturan akan segera hadir.</p>
        <p className="text-sm text-gray-400">Anda dapat mengatur batas ambang (threshold) di sini.</p>
      </div>
    </div>
  );
}

function UsersPage() {
  return (
    <div>
      <h2>Pengguna</h2>
      <p className="subtitle">Manajemen pengguna sistem</p>
      <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e9edf4' }}>
        <p className="text-gray-500">Daftar pengguna akan ditampilkan di sini.</p>
        <p className="text-sm text-gray-400">Fitur manajemen pengguna (tambah, edit, hapus) tersedia untuk admin.</p>
      </div>
    </div>
  );
}

function AboutPage() {
  return (
    <div>
      <h2>Tentang</h2>
      <p className="subtitle">Informasi tentang sistem monitoring</p>
      <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e9edf4' }}>
        <p><strong>Air & Environment Monitoring System</strong></p>
        <p>Versi 1.0.0</p>
        <p>Dibangun dengan React, Firebase, dan MQTT.</p>
        <p>© 2026 - Semua hak dilindungi.</p>
      </div>
    </div>
  );
}

// ============================================
// 4. LAYOUT DASHBOARD
// ============================================
function DashboardLayout({ onLogout }) {
  const [page, setPage] = useState('dashboard');

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'history': return <HistoryPage />;
      case 'graphs': return <GraphPage />;
      case 'notifications': return <NotificationPage />;
      case 'devices': return <DevicePage />;
      case 'settings': return <SettingsPage />;
      case 'users': return <UsersPage />;
      case 'about': return <AboutPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo"><i className="fas fa-cloud-sun-rain"></i><span>Air & Env</span></div>
        <div className="menu-label">Menu</div>
        <a href="#" className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}><i className="fas fa-chart-pie"></i> <span>Dashboard</span></a>
        <a href="#" className={page === 'history' ? 'active' : ''} onClick={() => setPage('history')}><i className="fas fa-history"></i> <span>Riwayat Data</span></a>
        <a href="#" className={page === 'graphs' ? 'active' : ''} onClick={() => setPage('graphs')}><i className="fas fa-chart-line"></i> <span>Grafik</span></a>
        <a href="#" className={page === 'notifications' ? 'active' : ''} onClick={() => setPage('notifications')}><i className="fas fa-bell"></i> <span>Notifikasi</span></a>
        <a href="#" className={page === 'devices' ? 'active' : ''} onClick={() => setPage('devices')}><i className="fas fa-microchip"></i> <span>Perangkat</span></a>
        <a href="#" className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}><i className="fas fa-cog"></i> <span>Pengaturan</span></a>
        <a href="#" className={page === 'users' ? 'active' : ''} onClick={() => setPage('users')}><i className="fas fa-users"></i> <span>Pengguna</span></a>
        <a href="#" className={page === 'about' ? 'active' : ''} onClick={() => setPage('about')}><i className="fas fa-info-circle"></i> <span>Tentang</span></a>

        <div className="sidebar-footer">
          <a href="#" onClick={onLogout} style={{ color: '#e74c3c' }}><i className="fas fa-sign-out-alt"></i> <span>Logout</span></a>
        </div>
        <div className="footer-copyright">© 2026</div>
      </aside>

      <main className="main-content">
        {renderPage()}
        <footer className="main-footer">© 2026 EWS Sampean Baru</footer>
      </main>
    </div>
  );
}

// ============================================
// 5. APP UTAMA
// ============================================
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><p className="text-gray-500">Memuat...</p></div>;
  }

  if (!user) {
    return <LoginPage onLogin={() => {}} />;
  }

  return (
    <DataProvider>
      <NotificationListener />
      <Toaster position="top-right" />
      <DashboardLayout onLogout={() => signOut(auth)} />
    </DataProvider>
  );
}
