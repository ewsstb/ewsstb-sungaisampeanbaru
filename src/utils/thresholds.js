// ============================================================
// THRESHOLD KETINGGIAN AIR (cm)
// Aman:     0 - 100 cm   (0 - 1 meter)
// Siaga:    100 - 300 cm  (1 - 3 meter)
// Waspada:  300 - 400 cm  (3 - 4 meter)
// Bahaya:   400 - 500 cm  (4 - 5 meter)
// ============================================================
export const getStatus = (level, thresholds) => {
  if (!thresholds) {
    if (level >= 400) return { label: 'Bahaya', color: 'red', level: 4 };
    if (level >= 300) return { label: 'Waspada', color: 'orange', level: 3 };
    if (level >= 100) return { label: 'Siaga', color: 'yellow', level: 2 };
    return { label: 'Aman', color: 'green', level: 1 };
  }
  const { water_max_aman = 100, water_max_siaga = 300, water_max_waspada = 400 } = thresholds;
  if (level >= water_max_waspada) return { label: 'Bahaya', color: 'red', level: 4 };
  if (level >= water_max_siaga) return { label: 'Waspada', color: 'orange', level: 3 };
  if (level >= water_max_aman) return { label: 'Siaga', color: 'yellow', level: 2 };
  return { label: 'Aman', color: 'green', level: 1 };
};

// ============================================================
// STATUS GABUNGAN (hanya berdasarkan water_level)
// water_presence dan rain_detected tidak mengubah status
// ============================================================
export const getCombinedStatus = (data, thresholds) => {
  const { water_level } = data;

  const t = thresholds || {};
  const waterAman = t.water_max_aman || 100;
  const waterSiaga = t.water_max_siaga || 300;
  const waterWaspada = t.water_max_waspada || 400;

  let status = { label: 'Aman', color: 'green', level: 1 };

  if (water_level >= waterWaspada) {
    status = { label: 'Bahaya', color: 'red', level: 4 };
  } else if (water_level >= waterSiaga) {
    status = { label: 'Waspada', color: 'orange', level: 3 };
  } else if (water_level >= waterAman) {
    status = { label: 'Siaga', color: 'yellow', level: 2 };
  }

  return status;
};
