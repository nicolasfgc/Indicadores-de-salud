// Pestaña: Resumen — el dato clave de cada tema y qué significa
registrar("resumen", (() => {
  let F = null, Q = null, A = null, P = null, PR = null;
  const TARJ = [["cue", "Cuentas de las EPS", "cuentas"], ["pa", "Patrimonio mínimo que exige la ley", "cuentas"], ["que", "Reclamos de los pacientes", "quejas"],
                ["med", "Medicamentos y tratamientos", "quejas"], ["int", "EPS intervenidas", "intervenidas"], ["afi", "Afiliados", "afiliados"],
                ["pla", "Plata que gira el Estado", "plata"], ["pre", "Medicina prepagada", "prepagada"]];
  async function iniciar() {
    [F, Q, A, P, PR] = await Promise.all(["finanzas", "quejas", "afiliados", "adres", "prepagada"].map(x => json(`web/${x}.json`)));
    $("tab-resumen").querySelector(".tarjetas").innerHTML = TARJ.map(([k, t, tab]) => `<div class="tarjeta"><div class="tt"><h3>${t}</h3></div><div class="num" id="r-${k}-num"></div>
      <div class="cambio" id="r-${k}-cam"></div><div class="mini"><canvas id="r-${k}-g"></canvas></div><p id="r-${k}-txt"></p><a class="mas" href="#${tab}">Ver más ›</a></div>`).join("");
  }
  function mini(id, X, v, color, tipo = "line") {
    dibujar(id, {type: tipo, data: {labels: X, datasets: [{data: v, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 0, tension: .3, fill: false, spanGaps: true, borderRadius: 2}]},
      options: {responsive: true, maintainAspectRatio: false, animation: false, plugins: {legend: {display: false}, tooltip: {enabled: false}, gobiernos: {activo: false}},
        scales: {x: {display: false}, y: {grid: {color: css("--line")}, ticks: {color: css("--muted"), maxTicksLimit: 3, font: {size: 10},
          callback: v => Math.abs(v) >= 1e6 ? fmt(v / 1e6, 1) + " M" : Math.abs(v) >= 1e3 ? fmt(v / 1e3, 0) + " mil" : fmt(v, v < 10 && v > -10 ? 1 : 0)}}}}});
  }
  function render() {
    // cuentas
    const T = F.total, C = F.cortes, n = C.length - 1;
    $("r-cue-num").textContent = pesos(T.patrimonio[n]); $("r-cue-cam").textContent = `patrimonio de las EPS que reportan, ${etqCorte(C[n])}`;
    $("r-cue-txt").innerHTML = `Las EPS deben <strong>${pesos(T.pasivos[n])}</strong>, sobre todo a hospitales y clínicas, y tienen ${pesos(T.activos[n])}. ${T.negativo[n]} de ${T.reportan[n]} tienen patrimonio negativo. Y falta Nueva EPS, la más grande, que no reporta sus cuentas desde 2024.`;
    const a = aMeses(C, T.patrimonio.map(v => v / 1000)); mini("r-cue-g", a.meses, a.v, css("--s1"));
    // patrimonio adecuado
    const PA = F.patrimonio_adecuado, m = PA.meses.length - 1, mx = Math.max(...PA.cumplen), km = PA.cumplen.indexOf(mx);
    $("r-pa-num").textContent = `${PA.cumplen[m]} de ${PA.evaluadas[m]}`; $("r-pa-cam").textContent = `EPS cumplen, ${mesLargo(PA.meses[m])}`;
    $("r-pa-txt").innerHTML = `La ley les exige a las EPS un colchón de plata propia para responder por sus deudas. En ${mesLargo(PA.meses[km])} lo cumplían ${mx} de ${PA.evaluadas[km]}; hoy <strong>${PA.cumplen[m] === 0 ? "ninguna" : PA.cumplen[m]}</strong>.`;
    mini("r-pa-g", PA.meses, PA.cumplen, css("--s4"));
    // quejas
    const M = Q.meses, r = Q.reclamos, k = ultimoValido(r), y = +M[k].slice(0, 4), mm = +M[k].slice(5, 7);
    const cor = yy => sumaArr(M.map((f, i) => f.slice(0, 4) === String(yy) && +f.slice(5, 7) <= mm ? r[i] : null)), c1 = cor(y), c0 = cor(y - 1);
    $("r-que-num").textContent = fmt(c1, 0); $("r-que-cam").textContent = `reclamos de enero a ${MESES_L[mm - 1]} de ${y}`;
    const c19 = sumaArr(M.map((f, i) => f.startsWith("2019") ? r[i] : null)), cy = sumaArr(M.map((f, i) => f.startsWith(String(y - 1)) ? r[i] : null));
    $("r-que-txt").innerHTML = `${c1 >= c0 ? "Un" : "Un"} ${fmt(Math.abs(c1 / c0 - 1) * 100, 1)}% ${c1 >= c0 ? "más" : "menos"} que en el mismo periodo de ${y - 1}. En todo ${y - 1} hubo <strong>${fmt(cy / c19, 1)} veces</strong> los reclamos de 2019.`;
    const s12 = M.map((f, i) => i >= 11 && i <= k ? sumaArr(r.slice(i - 11, i + 1)) : null); mini("r-que-g", M.slice(11, k + 1), s12.slice(11, k + 1), css("--s2"));
    // medicamentos
    const MS = Q.motivos.series, mo = Q.motivos.meses, med = mo.map((f, i) => sumaArr(Object.entries(MS).filter(([x]) => esMedicamento(x)).map(([, v]) => v[i])));
    const sel = mo.map((f, i) => f.startsWith(String(y)) ? i : -1).filter(i => i >= 0), totm = sumaArr(Object.values(Q.macromotivos).map(v => sumaArr(sel.map(i => v[i]))));
    const medy = sumaArr(sel.map(i => med[i]));
    $("r-med-num").textContent = fmt(medy, 0); $("r-med-cam").textContent = `reclamos por medicamentos o tratamientos, ${y}`;
    $("r-med-txt").innerHTML = `Medicamentos, exámenes o tratamientos negados, demorados o entregados incompletos: <strong>${fmt(medy / totm * 100, 0)} de cada 100 reclamos</strong> en lo corrido de ${y}.`;
    mini("r-med-g", mo, med, css("--s2"), "bar");
    // intervenidas
    const E = A.eps, iv = Object.entries(E).filter(([, e]) => intervenidaEn(e.interv, A.fecha)), tot = sumaArr(Object.values(E).map(e => e.contributivo + e.subsidiado));
    const siv = sumaArr(iv.map(([, e]) => e.contributivo + e.subsidiado));
    $("r-int-num").textContent = String(iv.length); $("r-int-cam").textContent = `EPS en manos del Gobierno hoy, con ${personas(siv, 1)} de afiliados`;
    $("r-int-txt").innerHTML = `${listaY(iv.map(([x]) => x))}. Son <strong>${fmt(siv / tot * 100, 0)} de cada 100 afiliados</strong> del país. Compara cómo estaban antes y cómo están ahora.`;
    const QE = Q.eps, ivs = QE.meses.map(f => sumaArr(Object.values(QE.eps).map(e => intervenidaEn(e.interv, f) ? e.afiliados[QE.meses.indexOf(f)] : 0)));
    mini("r-int-g", QE.meses, ivs, css("--s8"));
    // afiliados
    const tc = sumaArr(Object.values(A.deptos).map(d => d.contributivo)), ts = sumaArr(Object.values(A.deptos).map(d => d.subsidiado));
    $("r-afi-num").textContent = personas(tc + ts, 1); $("r-afi-cam").textContent = `afiliados, ${mesLargo(A.fecha)}`;
    const big = Object.entries(E).map(([x, e]) => [x, e.contributivo + e.subsidiado]).sort((p, q) => q[1] - p[1]);
    $("r-afi-txt").innerHTML = `${fmt(ts / (tc + ts) * 100, 0)} de cada 100 están en el régimen subsidiado. La EPS más grande es <strong>${big[0][0]}</strong>, con ${personas(big[0][1], 1)}.`;
    mini("r-afi-g", QE.meses, QE.total_afiliados, css("--s3"));
    // plata
    const kp = ultimoValido(P.upc_total), gd = (P.giro_directo_contributivo[kp] || 0) + (P.giro_directo_subsidiado[kp] || 0);
    $("r-pla-num").textContent = billones(P.upc_total[kp]); $("r-pla-cam").textContent = `UPC reconocida a las EPS en ${mesLargo(P.meses[kp])}`;
    $("r-pla-txt").innerHTML = `De esa plata, <strong>${fmt(gd / P.upc_total[kp] * 100, 0)} de cada 100 pesos</strong> la ADRES se los pagó directamente a hospitales y clínicas (giro directo).`;
    mini("r-pla-g", P.meses, P.upc_total, css("--s5"), "bar");
    // prepagada
    const PC = PR.cortes, b = PC.map((c, i) => c.endsWith("-12") ? i : -1).filter(i => i >= 0).at(-1), a0 = PC.indexOf(`${+PC[b].slice(0, 4) - 1}-12`);
    $("r-pre-num").textContent = pesos(PR.total.ingresos[b]); $("r-pre-cam").textContent = `ingresos en ${PC[b].slice(0, 4)}`;
    $("r-pre-txt").innerHTML = `${a0 >= 0 ? `${fmt((PR.total.ingresos[b] / PR.total.ingresos[a0] - 1) * 100, 1)}% más que en ${+PC[b].slice(0, 4) - 1}. ` : ""}Y a diferencia de las EPS, gana plata: <strong>${pesos(PR.total.resultado[b])}</strong> en ${PC[b].slice(0, 4)}.`;
    const dic = PC.map((c, i) => c.endsWith("-12") ? i : -1).filter(i => i >= 0);
    mini("r-pre-g", dic.map(i => PC[i].slice(0, 4)), dic.map(i => PR.total.ingresos[i] / 1000), css("--s6"), "bar");
  }
  return {iniciar, render};
})());
