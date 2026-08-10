// ============================================================
// THRESHOLD KETINGGIAN AIR (cm) - 3 KONDISI
// Normal:  0 - 50 cm
// Siaga:   50 - 250 cm
// Bahaya:  > 250 cm
// ============================================================
export const getStatus = (level, thresholds) => {
  if (!thresholds) {
    if (level > 250) return { label: 'Bahaya', color: 'red', level: 3 };
    if (level > 50) return { label: 'Siaga', color: 'yellow', level: 2 };
    return { label: 'Normal', color: 'green', level: 1 };
  }
  const { normal_max = 50, siaga_max = 250 } = thresholds;
  if (level > siaga_max) return { label: 'Bahaya', color: 'red', level: 3 };
  if (level > normal_max) return { label: 'Siaga', color: 'yellow', level: 2 };
  return { label: 'Normal', color: 'green', level: 1 };
};

// Status gabungan (hanya berdasarkan water_level, tanpa presence/rain)
export const getCombinedStatus = (data, thresholds) => {
  const { water_level } = data;
  const t = thresholds || {};
  const normalMax = t.normal_max || 50;
  const siagaMax = t.siaga_max || 250;

  if (water_level > siagaMax) return { label: 'Bahaya', color: 'red', level: 3 };
  if (water_level > normalMax) return { label: 'Siaga', color: 'yellow', level: 2 };
  return { label: 'Normal', color: 'green', level: 1 };
};
