// Pestaña: Plata del Estado — UPC reconocida y giro directo (ADRES) y si alcanza (Supersalud)
registrar("plata", (() => {
  let P = null, F = null;
  async function iniciar() { [P, F] = await Promise.all([json("web/adres.json"), json("web/finanzas.json")]); }

  function upc() {
    const M = P.meses, t = P.upc_total.map((v, i) => v ?? (P.upc_subsidiado[i] != null && P.upc_contributivo[i] != null ? P.upc_subsidiado[i] + P.upc_contributivo[i] : null));
    serie("pla-upc", M, [{label: "Régimen subsidiado", data: P.upc_subsidiado, color: css("--s2"), ancho: 2}, {label: "Régimen contributivo", data: P.upc_contributivo, color: css("--s3"), ancho: 2},
      {label: "Total", data: t, color: css("--grafica"), ancho: 3}], {agregar: "suma", inicio: 0, fmtValor: v => billones(v), eje0: true, despues: (i0, i1) => {
        let k = i1; while (k > i0 && t[k] == null) k--;
        const y = M[k].slice(0, 4), k12 = M.indexOf(`${+y - 1}${M[k].slice(4)}`);
        $("pla-upc-txt").innerHTML = `En <strong>${etqMesLargo(M[k])}</strong> la ADRES le reconoció a las EPS <strong>${billones(t[k])}</strong> por sus afiliados` +
          (P.upc_subsidiado[k] != null ? `: ${billones(P.upc_subsidiado[k])} del subsidiado y ${billones(P.upc_contributivo[k])} del contributivo` : "") + `. ` +
          (k12 >= 0 && t[k12] ? `Un año antes eran ${billones(t[k12])} (${t[k] >= t[k12] ? "+" : "−"}${fmt(Math.abs(t[k] / t[k12] - 1) * 100, 1)}%). ` : "") +
          `El valor de la UPC por afiliado lo fija el Ministerio de Salud cada año; las EPS y los gremios dicen que no alcanza para lo que cuesta atender a la gente. Algunos meses no tienen dato porque el boletín de ese mes no lo trae en el mismo formato.`;
      }});
  }

  function giro() {
    const M = P.meses;
    serie("pla-gd", M, [{label: "Régimen contributivo", data: P.pct_giro_directo_contributivo, color: css("--s3"), ancho: 2.5}, {label: "Régimen subsidiado", data: P.pct_giro_directo_subsidiado, color: css("--s2"), ancho: 2.5}],
      {inicio: 0, fmtValor: v => fmt(v, 1) + "%", referencias: [{y: 90, t: "Mínimo de 90% para EPS que no cumplen (Decreto 930 de 2026)"}], despues: (i0, i1) => {
        const c = P.pct_giro_directo_contributivo, s = P.pct_giro_directo_subsidiado; let k = i1; while (k > i0 && c[k] == null) k--;
        let j = M.indexOf(`${+M[k].slice(0, 4) - 1}${M[k].slice(4)}`); if (j < 0 || c[j] == null) j = c.findIndex((v, i) => v != null && i > 0);
        $("pla-gd-txt").innerHTML = `En <strong>${etqMesLargo(M[k])}</strong>, la ADRES pagó directamente a hospitales y proveedores <strong>${fmt(c[k], 1)}%</strong> de la UPC del régimen contributivo y ${fmt(s[k], 1)}% del subsidiado. ` +
          `Un año antes, en ${etqMesLargo(M[j])}, eran ${fmt(c[j], 1)}% y ${fmt(s[j], 1)}%. ` +
          `El Gobierno amplió el giro directo para que la plata llegue a quien atiende sin pasar por EPS endeudadas, y en 2026 subió del 80% al 90% el mínimo para las EPS que no cumplen con el patrimonio exigido (que hoy son todas). ` +
          `La otra cara: la EPS queda con poca plata en caja y sigue siendo la que decide a quién se le paga.`;
      }});
  }

  function alcanza() {
    const C = F.cortes, T = F.total;
    const anios = [...new Set(C.map(c => c.slice(0, 4)))], idx = anios.map(y => C.filter(c => c.startsWith(y)).map(c => C.indexOf(c)).at(-1));
    const etq = anios.map((y, k) => C[idx[k]].endsWith("-12") ? y : `${y} (hasta ${MESES[+C[idx[k]].slice(5) - 1]})`);
    serie("pla-alc", etq, [{label: "Ingresos de las EPS", data: idx.map(i => T.ingresos[i]), color: css("--s4"), tipo: "bar"}, {label: "Costo de atender pacientes", data: idx.map(i => T.costo[i]), color: css("--s7"), tipo: "bar"}],
      {fmtValor: pesos, eje0: true, gobiernos: false, fmtX: x => x, despues: () => {
        const r = idx.map(i => T.costo[i] / T.ingresos[i] * 100), n = anios.length - 1;
        $("pla-alc-txt").innerHTML = `En ${anios[n]}${C[idx[n]].endsWith("-12") ? "" : ` (hasta ${MESES_L[+C[idx[n]].slice(5) - 1]})`} las EPS que reportan recibieron ${pesos(T.ingresos[idx[n]])} y gastaron ${pesos(T.costo[idx[n]])} en atender pacientes: <strong>$${fmt(r[n], 1)} de cada $100</strong>. ` +
          `Por año: ${anios.map((y, k) => `${y}, $${fmt(r[k], 1)}`).join("; ")}. ` +
          `Cuando pasa de 100, la plata que llega por afiliado no cubre lo que cuesta atenderlo, y la diferencia se vuelve deuda con hospitales. No incluye a Nueva EPS, que no reporta sus cuentas desde 2024.`;
      }});
  }

  function render() {
    const M = P.meses, k = ultimoValido(P.upc_total), y = M[k].slice(0, 4);
    $("pla-ultima").textContent = `ADRES hasta ${etqMesLargo(M[k])}`;
    $("pla-k1").textContent = billones(P.upc_total[k]); $("pla-k1d").textContent = etqMesLargo(M[k]);
    const gd = (P.giro_directo_contributivo[k] || 0) + (P.giro_directo_subsidiado[k] || 0);
    $("pla-k2").textContent = billones(gd); $("pla-k2d").textContent = `${fmt(gd / P.upc_total[k] * 100, 0)} de cada $100 de la UPC del mes`;
    const anio = M.map((m, i) => m.startsWith(y) ? P.upc_total[i] : null), nm = anio.filter(v => v != null).length;
    $("pla-k3").textContent = billones(sumaArr(anio), 1); $("pla-k3d").textContent = `${nm} meses de ${y} con dato`;
    const T = F.total, n = F.cortes.length - 1;
    $("pla-k4").textContent = `$${fmt(T.costo[n] / T.ingresos[n] * 100, 1)} de $100`; $("pla-k4d").textContent = `gastan en salud por cada $100 que reciben (${etqCorte(F.cortes[n])})`;
    upc(); giro(); alcanza();
  }
  return {iniciar, render};
})());
