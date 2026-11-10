// Pestaña: EPS intervenidas por el Gobierno — antes y después
registrar("intervenidas", (() => {
  let Q = null, F = null, A = null;
  const tasa = (r, a) => r != null && a ? r / a * 1e4 : null;

  async function iniciar() { [Q, F, A] = await Promise.all([json("web/quejas.json"), json("web/finanzas.json"), json("web/afiliados.json")]); }

  // tasa de reclamos de una EPS sumando los meses [i0, i1]
  function tasaTramo(e, i0, i1) {
    let r = 0, a = 0, n = 0;
    for (let i = Math.max(0, i0); i <= i1; i++) if (e.reclamos[i] != null && e.afiliados[i]) { r += e.reclamos[i]; a += e.afiliados[i]; n++; }
    return n >= 6 ? r / (a / n) * 1e4 / n : null;   // reclamos por 10.000 afiliados al mes, en promedio
  }

  function antesDespues() {
    const E = Q.eps.eps, M = Q.eps.meses;
    const filas = Object.entries(E).filter(([, e]) => e.interv).map(([k, e]) => {
      const i0 = M.indexOf(e.interv[0] + "-01"), fin = e.interv[1] ? M.indexOf(e.interv[1] + "-01") - 1 : ultimoValido(e.reclamos);
      return {k, e, antes: tasaTramo(e, i0 - 12, i0 - 1), despues: tasaTramo(e, fin - 11, fin), fin: M[fin], i0};
    }).filter(x => x.antes != null && x.despues != null).sort((a, b) => b.despues / b.antes - a.despues / a.antes);
    const box = $("int-antes").parentElement; box.style.height = Math.max(200, filas.length * 46 + 70) + "px";
    dibujar("int-antes", {type: "bar", data: {labels: filas.map(x => x.k + (x.e.interv[1] ? " (devuelta)" : "")),
      datasets: [{label: "12 meses antes de la intervención", data: filas.map(x => x.antes), backgroundColor: css("--muted"), borderRadius: 5, barThickness: 14},
                 {label: "Últimos 12 meses intervenida", data: filas.map(x => x.despues), backgroundColor: COL_INTERV(), borderRadius: 5, barThickness: 14}]},
      options: {indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: {legend: leyendaRecordada("int-antes"), gobiernos: {activo: false},
        tooltip: {callbacks: {label: c => `${c.dataset.label}: ${fmt(c.raw, 1)} por cada 10.000 afiliados al mes`, footer: () => "Toca para ver su historia"}}},
        scales: {x: {grid: {color: css("--line")}, ticks: {color: css("--muted")}, title: {display: true, text: "Reclamos por cada 10.000 afiliados, promedio mensual", color: css("--muted")}}, y: {grid: {display: false}, ticks: {color: css("--ink")}}},
        onClick: (ev, el) => { if (el.length) historia(filas[el[0].index]); }, onHover: (ev, el) => { ev.native.target.style.cursor = el.length ? "pointer" : "default"; }}}, {nueva: true});
    const peor = filas.filter(x => x.despues > x.antes * 1.1), mejor = filas.filter(x => x.despues < x.antes * 0.9);
    $("int-antes-txt").innerHTML = `De ${filas.length} EPS intervenidas con datos suficientes, en <strong>${peor.length} los reclamos por afiliado subieron</strong> más de 10% después de la intervención` +
      (peor.length ? ` (el mayor aumento, ${filas[0].k}: de ${fmt(filas[0].antes, 1)} a ${fmt(filas[0].despues, 1)} al mes por cada 10.000 afiliados)` : "") + `, ` +
      `y en ${mejor.length} bajaron más de 10%${mejor.length ? ` (${listaY(mejor.map(x => x.k))})` : ""}. ` +
      `Hay que leerlo con cuidado: los reclamos subieron en casi todo el sistema en estos años (ver la siguiente gráfica), y muchas EPS ya venían en crisis cuando las intervinieron. Lo justo es comparar cada una con lo que pasó en las EPS no intervenidas en el mismo periodo.`;
  }

  function historia(x) {
    const M = Q.eps.meses, e = x.e, t = M.map((m, k) => tasa(e.reclamos[k], e.afiliados[k]));
    const antes = t.map((v, k) => k < x.i0 ? v : null), desp = t.map((v, k) => k >= x.i0 - 1 && intervenidaEn(e.interv, M[k]) || k === x.i0 - 1 ? v : null), luego = t.map((v, k) => e.interv[1] && M[k] >= e.interv[1] + "-01" ? v : null);
    enElTiempo("int-antes-tiempo", `${x.k}: reclamos por cada 10.000 afiliados`, M, [{label: "Antes de la intervención", data: antes, color: css("--muted"), ancho: 2},
      {label: "Intervenida", data: desp, color: COL_INTERV(), ancho: 2.5}, ...(e.interv[1] ? [{label: "Devuelta a sus dueños", data: luego, color: css("--verde"), ancho: 2}] : [])],
      {inicio: 0, fmtValor: v => fmt(v, 1), eje0: true, nota: `Intervenida desde ${mesLargo(e.interv[0])}${e.interv[1] ? ` hasta ${mesLargo(e.interv[1])}` : ""}. Toca otra EPS para cambiarla.`});
  }

  function comparacion() {
    const E = Q.eps.eps, M = Q.eps.meses;
    const grupo = (cond) => M.map((m, k) => { let r = 0, a = 0; for (const e of Object.values(E)) if (e.reclamos[k] != null && e.afiliados[k] && cond(e, m)) { r += e.reclamos[k]; a += e.afiliados[k]; } return a ? r / a * 1e4 : null; });
    const iv = grupo((e, m) => intervenidaEn(e.interv, m)), no = grupo((e, m) => !intervenidaEn(e.interv, m));
    const ivp = iv.map((v, k) => M[k] >= "2023-05-01" ? v : null);
    serie("int-comp", M, [{label: "EPS intervenidas en ese momento", data: ivp, color: COL_INTERV(), ancho: 2.5, agregar: "promedio"}, {label: "Las demás EPS", data: no, color: css("--grafica"), ancho: 2.5, agregar: "promedio"}],
      {agregar: "promedio", inicio: 0, fmtValor: v => fmt(v, 1), eje0: true, despues: (i0, i1) => {
        let k = i1; while (k > i0 && (iv[k] == null || no[k] == null)) k--;
        const prom = (arr, a, b) => { const v = arr.slice(a, b + 1).filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
        const ivu = prom(iv, k - 11, k), nou = prom(no, k - 11, k), j = M.indexOf("2023-05-01"), no0 = prom(no, j - 12, j - 1);
        $("int-comp-txt").innerHTML = `En los 12 meses hasta ${etqMesLargo(M[k])}, las EPS intervenidas tuvieron en promedio <strong>${fmt(ivu, 1)} reclamos al mes por cada 10.000 afiliados</strong>, frente a ${fmt(nou, 1)} en las demás. ` +
          `Antes de las primeras intervenciones (mayo de 2023), las demás EPS tenían ${fmt(no0, 1)}: los reclamos subieron en todo el sistema, también en las EPS que nunca fueron intervenidas. ` +
          (Math.abs(ivu / nou - 1) < 0.1 ? `Hoy las dos líneas van casi juntas: las quejas por afiliado subieron parejo en todo el sistema, y las EPS intervenidas no se separaron del resto, ni para mejor ni para peor. `
            : ivu > nou ? `Las intervenidas están ${fmt((ivu / nou - 1) * 100, 0)}% por encima de las demás. ` : `Las intervenidas están ${fmt((1 - ivu / nou) * 100, 0)}% por debajo de las demás. `) +
          `Comparar las dos líneas es lo que más se acerca a medir el efecto de la intervención, aunque las EPS intervenidas eran desde antes las que estaban en peor situación.`;
      }});
    $("int-k3").textContent = fmt(iv.filter(x => x != null).slice(-12).reduce((a, b) => a + b, 0) / 12, 1); $("int-k3d").textContent = "al mes, promedio de los últimos 12 meses";
    $("int-k4").textContent = fmt(no.filter(x => x != null).slice(-12).reduce((a, b) => a + b, 0) / 12, 1); $("int-k4d").textContent = "al mes, promedio de los últimos 12 meses";
  }

  function patrimonio() {
    const C = F.cortes, filas = F.entidades.filter(e => e.interv).map(e => {
      const ia = C.map((c, k) => c < e.interv[0] && e.patrimonio[k] != null ? k : -1).filter(k => k >= 0).at(-1);
      const iu = ultimoValido(e.patrimonio);
      return {e, ia, iu, antes: ia != null ? e.patrimonio[ia] : null, despues: iu > (ia ?? -1) ? e.patrimonio[iu] : null};
    }).filter(x => x.antes != null).sort((a, b) => (a.despues ?? a.antes) - (b.despues ?? b.antes));
    $("int-pat-h").textContent = "Patrimonio (lo que tienen menos lo que deben) en el último reporte antes de la intervención y en el último reporte disponible. Negativo: deben más de lo que tienen.";
    const box = $("int-pat").parentElement; box.style.height = Math.max(200, filas.length * 46 + 70) + "px";
    dibujar("int-pat", {type: "bar", data: {labels: filas.map(x => x.e.n),
      datasets: [{label: "Antes de la intervención", data: filas.map(x => x.antes), backgroundColor: css("--muted"), borderRadius: 5, barThickness: 14},
                 {label: "Último dato", data: filas.map(x => x.despues), backgroundColor: COL_INTERV(), borderRadius: 5, barThickness: 14}]},
      options: {indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: {legend: leyendaRecordada("int-pat"), gobiernos: {activo: false},
        tooltip: {callbacks: {label: c => { const x = filas[c.dataIndex], k = c.datasetIndex ? x.iu : x.ia; return `${c.dataset.label} (${etqCorte(C[k])}): ${pesos(c.raw)}`; }}}},
        scales: {x: {grid: {color: css("--line")}, ticks: {color: css("--muted"), callback: v => pesos(v)}}, y: {grid: {display: false}, ticks: {color: css("--ink")}}}}}, {nueva: true});
    const emp = filas.filter(x => x.despues != null && x.despues < x.antes), sum0 = sumaArr(filas.filter(x => x.despues != null).map(x => x.antes)), sum1 = sumaArr(filas.map(x => x.despues));
    const nueva = filas.find(x => x.e.n === "Nueva EPS");
    $("int-pat-txt").innerHTML = `En <strong>${emp.length} de ${filas.filter(x => x.despues != null).length}</strong> EPS intervenidas con datos, el patrimonio empeoró después de la intervención. ` +
      `Sumadas, pasaron de ${pesos(sum0)} a <strong>${pesos(sum1)}</strong>. ` +
      (nueva ? `Nueva EPS no tiene dato después: dejó de reportar sus cuentas a la Supersalud justo al ser intervenida (su último reporte, de ${mesLargo(C[nueva.ia])}, ya mostraba un patrimonio de ${pesos(nueva.antes)}). ` : "") +
      `La Contraloría llegó a una conclusión parecida al revisar las cuentas de 2025.`;
  }

  function render() {
    const E = A.eps, hoy = A.fecha, iv = Object.entries(E).filter(([, e]) => intervenidaEn(e.interv, hoy));
    const tot = sumaArr(Object.values(E).map(e => e.contributivo + e.subsidiado)), siv = sumaArr(iv.map(([, e]) => e.contributivo + e.subsidiado));
    $("int-ultima").textContent = `Reclamos hasta ${etqMesLargo(Q.eps.meses.at(-1))}`;
    $("int-k1").textContent = String(iv.length); $("int-k1d").textContent = listaY(iv.map(([k]) => k));
    $("int-k2").textContent = personas(siv, 1); $("int-k2d").textContent = `${fmt(siv / tot * 100, 0)} de cada 100 afiliados del país`;
    antesDespues(); comparacion(); patrimonio();
  }
  return {iniciar, render};
})());
