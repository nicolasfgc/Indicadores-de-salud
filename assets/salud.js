// Utilidades propias del explorador de salud (se cargan después de comun.js)

// Plata en miles de millones de pesos -> texto corto ("$18,7 billones", "$394 mil millones")
function pesos(mm, d = 1) {
  if (mm == null || isNaN(mm)) return "–";
  const a = Math.abs(mm), s = mm < 0 ? "−" : "";
  if (a >= 1000) return `${s}$${fmt(a / 1000, d)} billones`;
  if (a >= 1) return `${s}$${fmt(a, 0)} mil millones`;
  return `${s}$${fmt(a * 1000, 0)} millones`;
}
// Plata en billones -> texto
const billones = (b, d = 2) => b == null || isNaN(b) ? "–" : `$${fmt(b, d)} billones`;
// Personas -> "48,8 millones", "540.000"
function personas(n, d = 1) {
  if (n == null || isNaN(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1e6) return `${fmt(n / 1e6, d)} millones`;
  if (a >= 1e4) return `${fmt(Math.round(n / 1000) * 1000, 0)}`;
  return fmt(n, 0);
}
const pct1 = x => x == null || isNaN(x) ? "–" : fmt(x, 1) + "%";
// "2026-06" o "2026-06-01" -> "jun 2026"
const etqCorte = c => c ? etqMes(c.length === 7 ? c + "-01" : c) : "";
const mesLargo = c => c ? etqMesLargo(c.length === 7 ? c + "-01" : c) : "";
// ¿estaba intervenida en la fecha f ("AAAA-MM...")? iv = [desde, hasta|null]
const intervenidaEn = (iv, f) => !!iv && f.slice(0, 7) >= iv[0] && (!iv[1] || f.slice(0, 7) < iv[1]);
const ultimoValido = arr => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i; return -1; };
const sumaArr = arr => arr.reduce((a, b) => a + (b || 0), 0);
// pasa una serie en fechas dispersas (cortes trimestrales y luego mensuales) a todos los meses, con huecos
function aMeses(cortes, valores) {
  const F = cortes.map(c => c.length === 7 ? c + "-01" : c), M = mesesCompletos(F);
  const idx = Object.fromEntries(F.map((f, i) => [f, i]));
  return {meses: M, v: M.map(m => idx[m] != null ? valores[idx[m]] : null)};
}
const COL_INTERV = () => css("--s8"), COL_NORMAL = () => css("--grafica");
const CODIGOS = {"05": "Antioquia", "08": "Atlántico", "11": "Bogotá", "13": "Bolívar", "15": "Boyacá", "17": "Caldas", "18": "Caquetá", "19": "Cauca",
  "20": "Cesar", "23": "Córdoba", "25": "Cundinamarca", "27": "Chocó", "41": "Huila", "44": "La Guajira", "47": "Magdalena", "50": "Meta", "52": "Nariño",
  "54": "Norte de Santander", "63": "Quindío", "66": "Risaralda", "68": "Santander", "70": "Sucre", "73": "Tolima", "76": "Valle del Cauca", "81": "Arauca",
  "85": "Casanare", "86": "Putumayo", "88": "San Andrés", "91": "Amazonas", "94": "Guainía", "95": "Guaviare", "97": "Vaupés", "99": "Vichada"};
// Motivos de reclamo de la Supersalud en palabras sencillas
const MOTIVO_CORTO = m => {
  const t = m.toLowerCase();
  if (t.startsWith("negación en la asignación de citas")) return "Le negaron la cita";
  if (t.startsWith("falta de oportunidad en las citas")) return "Demora en darle la cita";
  if (t.startsWith("negación para la entrega de tecnologías")) return "Le negaron medicamentos o tratamientos ya autorizados";
  if (t.startsWith("falta de oportunidad en la entrega")) return "Demora o entrega incompleta de medicamentos o tratamientos";
  if (t.startsWith("falta de oportunidad en la atención en otros")) return "Demora en otros servicios (terapias, exámenes…)";
  if (t.startsWith("negación en la atención en otros")) return "Le negaron otros servicios";
  if (t.startsWith("falta de oportunidad en la autorización de citas")) return "Demora en autorizar citas";
  if (t.startsWith("falta de oportunidad en la autorización de otros")) return "Demora en autorizar otros servicios";
  if (t.startsWith("falta de oportunidad en la autorización de tecnologías")) return "Demora en autorizar medicamentos o tratamientos";
  if (t.startsWith("falta de oportunidad en el proceso de referencia")) return "Demora en remitirlo a otro hospital";
  return m.length > 60 ? m.slice(0, 58) + "…" : m;
};
const esMedicamento = m => /tecnolog/i.test(m) && /entrega/i.test(m);
const esCita = m => /citas/i.test(m);
