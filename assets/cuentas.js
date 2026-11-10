// Pestaña: Cuentas de las EPS (Supersalud, estados financieros y patrimonio adecuado)
registrar("cuentas", (() => {
  let F = null;
  const st = {tot: "deuda", ind: "patrimonio", corte: null};
  const IND = {patrimonio: "Patrimonio", pasivos: "Deudas (pasivos)", resultado: "Ganancia o pérdida en lo corrido del año", sin: "De cada $100 que recibe, cuánto gasta en atender pacientes"};
  const sin = (e, i) => e.ingresos[i] > 0 && e.costo[i] != null ? e.costo[i] / e.ingresos[i] * 100 : null;
  const valor = (e, i, ind) => ind === "sin" ? sin(e, i) : e[ind][i];
  const fInd = ind => ind === "sin" ? (x => x == null ? "–" : `$${fmt(x, 1)}`) : pesos;

  async function iniciar() {
    F = await json("web/finanzas.json");
    st.corte = F.cortes.at(-1);
    seg("cue-tot", x => { st.tot = x; total(); });
    seg("cue-ind", x => { st.ind = x; ranking(); });
    opciones($("cue-corte"), F.cortes.slice().reverse().map(c => [c, etqCorte(c)]), st.corte);
    $("cue-corte").onchange = () => { st.corte = $("cue-corte").value; ranking(); };
  }

  function total() {
    const T = F.total, C = F.cortes, n = C.length - 1;
    const iNueva = F.entidades.find(e => e.n === "Nueva EPS");
    if (st.tot === "deuda") {
      $("cue-tot-h").textContent = "Suma de todas las EPS que reportan sus cuentas (sin Nueva EPS, que no reporta desde 2024). Deudas (pasivos): lo que deben, sobre todo a hospitales, clínicas y proveedores de medicamentos. Patrimonio: lo que tienen menos lo que deben; si es negativo, deben más de lo que tienen.";
      const a = aMeses(C, T.pasivos), b = aMeses(C, T.patrimonio), c = aMeses(C, T.activos);
      serie("cue-total", a.meses, [{label: "Deudas (pasivos)", data: a.v, color: css("--s7"), ancho: 2.5},
        {label: "Lo que tienen (activos)", data: c.v, color: css("--s4"), ancho: 2},
        {label: "Patrimonio", data: b.v, color: css("--grafica"), ancho: 3}],
        {agregar: "fin", inicio: 0, fmtValor: pesos, eje0: true, referencias: [{y: 0, t: ""}], despues: () => {
          const k = C.indexOf("2024-03"), j = C.indexOf("2024-06");
          let t = `A ${mesLargo(C[n])}, las ${T.reportan[n]} EPS que reportan cuentas debían <strong>${pesos(T.pasivos[n])}</strong> y tenían ${pesos(T.activos[n])}: ` +
            `su patrimonio sumado es <strong>${pesos(T.patrimonio[n])}</strong>. Por cada $100 que tienen, deben $${fmt(T.pasivos[n] / T.activos[n] * 100, 0)}. `;
          const n12 = C.indexOf(String(+C[n].slice(0, 4) - 1) + C[n].slice(4));
          if (n12 >= 0) t += `Un año antes el patrimonio era ${pesos(T.patrimonio[n12])} y las deudas ${pesos(T.pasivos[n12])}. `;
          t += `A finales de 2021 el patrimonio de todas las EPS era ${pesos(T.patrimonio[0])}. `;
          if (iNueva && k >= 0) t += `<strong>Ojo:</strong> los totales no incluyen a Nueva EPS en ningún momento, para poder compararlos en el tiempo. En su último reporte, de marzo de 2024, Nueva EPS tenía un patrimonio de ${pesos(iNueva.patrimonio[k])} y deudas por ${pesos(iNueva.pasivos[k])}: la situación real del sistema es peor que la que muestra la gráfica.`;
          $("cue-total-txt").innerHTML = t;
        }});
    } else {
      $("cue-tot-h").textContent = "De cada $100 que las EPS reciben por sus afiliados (sobre todo la UPC que les paga el Estado), cuántos gastan en atender pacientes, en lo corrido de cada año. Por encima de 100, pierden plata antes de pagar sus propios gastos de administración.";
      const r = T.ingresos.map((x, i) => x > 0 ? T.costo[i] / x * 100 : null), a = aMeses(C, r);
      serie("cue-total", a.meses, [{label: "Gasto en salud por cada $100 recibidos", data: a.v, color: css("--grafica"), ancho: 3, puntos: true}],
        {agregar: "fin", inicio: 0, fmtValor: x => `$${fmt(x, 1)}`, referencias: [{y: 100, t: "Gasta todo lo que recibe"}], despues: () => {
          const dic = C.map((c, i) => [c, r[i]]).filter(([c]) => c.endsWith("-12"));
          $("cue-total-txt").innerHTML = `En lo que va de ${C[n].slice(0, 4)} (hasta ${MESES_L[+C[n].slice(5) - 1]}), de cada $100 que recibieron las EPS, <strong>$${fmt(r[n], 1)} se fueron en atender pacientes</strong>. ` +
            `Al cierre de cada año: ${dic.map(([c, v]) => `${c.slice(0, 4)}, $${fmt(v, 1)}`).join("; ")}. ` +
            (r[n] > 100 ? `Al estar por encima de 100, el sistema pierde plata con cada afiliado incluso antes de pagar nóminas, sedes y demás gastos. Es la base de la discusión sobre si la UPC alcanza o si el problema es cómo se administra.` :
              `Por debajo de 100 queda un margen para los gastos de administración, que la ley limita.`);
        }});
    }
  }

  function ranking() {
    const i = F.cortes.indexOf(st.corte), ind = st.ind, f = fInd(ind);
    const items = F.entidades.filter(e => valor(e, i, ind) != null && e.activos[i] != null && (ind !== "sin" || e.ingresos[i] > 20))
      .map(e => ({id: e.id, n: e.n + (intervenidaEn(e.interv, st.corte) ? " (intervenida)" : ""), v: valor(e, i, ind), e}))
      .sort((a, b) => ind === "pasivos" ? b.v - a.v : a.v - b.v);
    $("cue-rank-t").textContent = `${IND[ind]}, ${mesLargo(st.corte)}`;
    $("cue-rank-h").textContent = ind === "sin" ? "Por encima de $100 la EPS gasta en atender pacientes más de lo que recibe. Solo EPS con ingresos mayores a $20 mil millones en el periodo. Toca una EPS para verla en el tiempo."
      : ind === "resultado" ? "Ganancia (positivo) o pérdida (negativo) acumulada desde enero hasta el corte. Toca una EPS para verla en el tiempo."
      : "En miles de millones o billones de pesos. Las barras oscuras son EPS intervenidas por el Gobierno. Toca una EPS para verla en el tiempo.";
    barras("cue-rank", items, {fmtValor: f, alto: 24, etiqueta: ind === "sin" ? "Pesos gastados en salud por cada $100 recibidos" : "Miles de millones de pesos", colores: x => intervenidaEn(x.e.interv, st.corte) ? COL_INTERV() : (x.v < 0 && ind !== "sin" ? css("--s6") : COL_NORMAL()),
      alClic: x => {
        const a = aMeses(F.cortes, F.cortes.map((c, k) => valor(x.e, k, ind)));
        enElTiempo("cue-rank-tiempo", `${x.e.n}: ${IND[ind].toLowerCase()}`, a.meses, [{label: x.e.n, data: a.v, color: css("--grafica"), ancho: 2.5}],
          {inicio: 0, fmtValor: f, eje0: ind !== "sin", referencias: ind === "sin" ? [{y: 100, t: ""}] : [{y: 0, t: ""}],
           nota: x.e.interv ? `Intervenida desde ${mesLargo(x.e.interv[0])}${x.e.interv[1] ? ` hasta ${mesLargo(x.e.interv[1])}` : ""}. Toca otra EPS para cambiarla.` : "Toca otra EPS para cambiarla."});
      }});
    if (!items.length) { $("cue-rank-txt").textContent = ""; return; }
    let t = "";
    if (ind === "patrimonio") {
      const neg = items.filter(x => x.v < 0);
      t = `<strong>${neg.length} de ${items.length} EPS</strong> tenían patrimonio negativo: deben más de lo que tienen. La peor es <strong>${items[0].e.n}</strong> (${f(items[0].v)})` +
        (items.length > 1 ? `, seguida de ${items[1].e.n} (${f(items[1].v)})` : "") + `. ` +
        `${neg.filter(x => intervenidaEn(x.e.interv, st.corte)).length} de las que están en rojo estaban intervenidas por el Gobierno.`;
    } else if (ind === "pasivos") {
      const tot = sumaArr(items.map(x => x.v));
      t = `Entre todas debían ${pesos(tot)}. Las que más deben son <strong>${items[0].e.n}</strong> (${f(items[0].v)}) y ${items[1].e.n} (${f(items[1].v)}). ` +
        `La mayor parte de esas deudas son cuentas pendientes con hospitales, clínicas y proveedores de medicamentos.`;
    } else if (ind === "resultado") {
      const per = items.filter(x => x.v < 0);
      t = `${per.length} de ${items.length} EPS perdían plata en lo corrido del año. La mayor pérdida es la de <strong>${items[0].e.n}</strong> (${f(items[0].v)}); ` +
        `la mayor ganancia, la de ${items.at(-1).e.n} (${f(items.at(-1).v)}). Entre todas: ${pesos(sumaArr(items.map(x => x.v)))}.`;
    } else {
      const sobre = items.filter(x => x.v > 100);
      t = `<strong>${sobre.length} de ${items.length} EPS</strong> gastaban en atender pacientes más de lo que recibían. ` +
        `La más alta es ${items.at(-1).e.n} ($${fmt(items.at(-1).v, 1)} por cada $100) y la más baja ${items[0].e.n} ($${fmt(items[0].v, 1)}).`;
    }
    const nueva = F.entidades.find(e => e.n === "Nueva EPS");
    if (nueva && nueva.ultimo < st.corte) t += ` Nueva EPS, la más grande del país, no aparece porque no reporta sus cuentas desde ${mesLargo(nueva.ultimo)}.`;
    $("cue-rank-txt").innerHTML = t;
  }

  function patrimonio() {
    const P = F.patrimonio_adecuado, M = P.meses.map(m => m + "-01"), MC = mesesCompletos(M);
    const idx = Object.fromEntries(M.map((m, i) => [m, i])), at = arr => MC.map(m => idx[m] != null ? arr[idx[m]] : null);
    const noc = P.evaluadas.map((e, i) => e - P.cumplen[i]);
    serie("cue-pa", MC, [{label: "Cumplen", data: at(P.cumplen), color: css("--verde"), ancho: 3}, {label: "No cumplen", data: at(noc), color: css("--s7"), ancho: 3}],
      {inicio: 0, fmtValor: x => fmt(x, 0) + " EPS", eje0: true, despues: () => {
        const n = P.meses.length - 1, mx = Math.max(...P.cumplen), k = P.cumplen.indexOf(mx);
        const cero = P.cumplen.findIndex((v, i) => i > k && v === 0);
        const siempreCero = P.cumplen.slice(cero).every(v => v === 0);
        $("cue-pa-txt").innerHTML = `En <strong>${mesLargo(P.meses[n])}</strong>, <strong>${P.cumplen[n]} de ${P.evaluadas[n]} EPS</strong> cumplían con el patrimonio mínimo. ` +
          `En ${mesLargo(P.meses[k])} lo cumplían ${mx} de ${P.evaluadas[k]}. ` +
          (cero >= 0 && siempreCero ? `Desde ${mesLargo(P.meses[cero])} ninguna lo cumple. ` : "") +
          `Las reglas se ajustaron en 2022 y 2024 (Decretos 647 y 489) y la Supersalud evalúa con lo que cada EPS reporta; a la que no reporta (como Nueva EPS) la cuenta como incumplida.`;
      }});
  }

  function render() {
    const T = F.total, C = F.cortes, n = C.length - 1, P = F.patrimonio_adecuado, m = P.meses.length - 1;
    $("cue-ultima").textContent = `Cuentas a ${mesLargo(C[n])}`;
    $("cue-k1").textContent = pesos(T.pasivos[n]); $("cue-k1d").textContent = `${T.reportan[n]} EPS que reportan (sin Nueva EPS), ${etqCorte(C[n])}`;
    $("cue-k2").textContent = pesos(T.patrimonio[n]); $("cue-k2d").textContent = `a finales de 2021: ${pesos(T.patrimonio[0])}`;
    $("cue-k3").textContent = `${T.negativo[n]} de ${T.reportan[n]}`; $("cue-k3d").textContent = "deben más de lo que tienen";
    $("cue-k4").textContent = `${P.cumplen[m]} de ${P.evaluadas[m]}`; $("cue-k4d").textContent = `en ${mesLargo(P.meses[m])}`;
    const nueva = F.entidades.find(e => e.n === "Nueva EPS");
    $("cue-aviso").innerHTML = nueva && nueva.ultimo < C[n] ? `<strong>Falta la EPS más grande.</strong> Nueva EPS, con unos 11 millones de afiliados y en manos del Gobierno desde abril de 2024, no le reporta sus estados financieros a la Supersalud desde ${mesLargo(nueva.ultimo)}. Las cifras de esta pestaña no la incluyen después de esa fecha.` : "";
    $("cue-aviso").hidden = !$("cue-aviso").innerHTML;
    total(); ranking(); patrimonio();
  }
  return {iniciar, render};
})());
