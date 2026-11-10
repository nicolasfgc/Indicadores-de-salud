// Pestaña: Afiliados por EPS (Supersalud, informes mensuales) y por departamento (ADRES, BDUA)
registrar("afiliados", (() => {
  let Q = null, A = null;
  const st = {ind: "nivel", desde: null, mind: "sub"};

  async function iniciar() {
    [Q, A] = await Promise.all([json("web/quejas.json"), json("web/afiliados.json")]);
    const M = Q.eps.meses, n = M.length - 1;
    st.desde = M[Math.max(0, n - 24)];
    seg("afi-ind", x => { st.ind = x; ranking(); });
    seg("afi-mind", x => { st.mind = x; mapaDeptos(); });
    opciones($("afi-desde"), M.slice(0, -1).reverse().map(m => [m, etqMes(m)]), st.desde);
    $("afi-desde").onchange = () => { st.desde = $("afi-desde").value; ranking(); };
  }

  function ranking() {
    const E = Q.eps.eps, M = Q.eps.meses, n = M.length - 1, d = M.indexOf(st.desde);
    $("afi-desde").parentElement.querySelectorAll("label.lbl, #afi-desde").forEach(x => x.hidden = st.ind !== "cambio");
    const items = Object.entries(E).filter(([, e]) => e.afiliados[n] != null && e.afiliados[n] > 30000).map(([k, e]) => {
      const v = st.ind === "nivel" ? e.afiliados[n] : (e.afiliados[d] != null ? e.afiliados[n] - e.afiliados[d] : null);
      return {id: k, n: k + (intervenidaEn(e.interv, M[n]) ? " (intervenida)" : ""), v, e};
    }).filter(x => x.v != null).sort((a, b) => b.v - a.v);
    $("afi-rank-t").textContent = st.ind === "nivel" ? `Afiliados de cada EPS, ${etqMesLargo(M[n])}` : `Cuántos afiliados ganó o perdió cada EPS entre ${etqMesLargo(M[d])} y ${etqMesLargo(M[n])}`;
    $("afi-rank-h").textContent = st.ind === "nivel" ? "Contributivo y subsidiado sumados. Las barras oscuras son EPS intervenidas por el Gobierno. Toca una EPS para ver cómo ha cambiado."
      : "Positivo: ganó afiliados; negativo: los perdió (porque la gente se cambió de EPS, por cierres o por traslados ordenados por el Gobierno). Toca una EPS para verla en el tiempo.";
    const f = v => (st.ind === "cambio" && v > 0 ? "+" : "") + personas(v, 2);
    barras("afi-rank", items, {fmtValor: f, alto: 24, colores: x => intervenidaEn(x.e.interv, M[n]) ? COL_INTERV() : (x.v < 0 ? css("--s6") : COL_NORMAL()),
      alClic: x => enElTiempo("afi-rank-tiempo", `${x.id}: afiliados`, M, [{label: "Régimen contributivo", data: x.e.contributivo, color: css("--s3"), ancho: 2},
        {label: "Régimen subsidiado", data: x.e.subsidiado, color: css("--s2"), ancho: 2}, {label: "Total", data: x.e.afiliados, color: css("--grafica"), ancho: 3}],
        {agregar: "fin", inicio: 0, fmtValor: v => personas(v, 2), nota: x.e.interv ? `Intervenida desde ${mesLargo(x.e.interv[0])}${x.e.interv[1] ? ` hasta ${mesLargo(x.e.interv[1])}` : ""}. Toca otra EPS para cambiarla.` : "Toca otra EPS para cambiarla.",
         texto: (i0, i1) => { const a = x.e.afiliados; let k = i1; while (k > i0 && a[k] == null) k--; let j = i0; while (j < k && a[j] == null) j++;
           return a[k] != null && a[j] != null ? `Entre ${etqMesLargo(M[j])} y ${etqMesLargo(M[k])}, ${x.id} pasó de ${personas(a[j], 2)} a <strong>${personas(a[k], 2)} afiliados</strong> (${a[k] >= a[j] ? "ganó" : "perdió"} ${personas(Math.abs(a[k] - a[j]), 2)}).` : ""; }})});
    const tot = sumaArr(Object.values(A.deptos).map(d => d.contributivo + d.subsidiado));
    if (st.ind === "nivel") {
      const top3 = items.slice(0, 3), s3 = sumaArr(top3.map(x => x.v));
      $("afi-rank-txt").innerHTML = `<strong>${items[0].id}</strong> es la EPS más grande, con ${personas(items[0].v, 2)} afiliados: más de ${fmt(Math.floor(items[0].v / tot * 100), 0)} de cada 100 colombianos afiliados. ` +
        `Las tres más grandes (${listaY(top3.map(x => x.id))}) suman ${personas(s3, 1)}, ${fmt(s3 / tot * 100, 0)} de cada 100. ` +
        `Que tanta gente dependa de tan pocas EPS hace que la crisis de una sola afecte a millones de personas.`;
    } else {
      const g = items.filter(x => x.v > 0), p = items.filter(x => x.v < 0).reverse();
      $("afi-rank-txt").innerHTML = (g.length ? `La que más afiliados ganó fue <strong>${g[0].id}</strong> (+${personas(g[0].v, 2)})${g[1] ? `, seguida de ${g[1].id} (+${personas(g[1].v, 2)})` : ""}. ` : "") +
        (p.length ? `La que más perdió fue <strong>${p[0].id}</strong> (${personas(p[0].v, 2)})${p[1] ? ` y luego ${p[1].id} (${personas(p[1].v, 2)})` : ""}. ` : "") +
        `Los grandes movimientos suelen venir de EPS que se liquidan o que dejan de operar en algunos departamentos y cuyos afiliados son trasladados a otras.`;
    }
  }

  function mapaDeptos() {
    const D = A.deptos, sub = st.mind === "sub";
    const val = Object.fromEntries(Object.entries(D).map(([k, d]) => [k, sub ? d.subsidiado / (d.subsidiado + d.contributivo) * 100 : d.subsidiado + d.contributivo]));
    const tc = sumaArr(Object.values(D).map(d => d.contributivo)), ts = sumaArr(Object.values(D).map(d => d.subsidiado));
    $("afi-mapa-t").textContent = sub ? "¿Qué tanta gente depende del régimen subsidiado?" : "Afiliados al sistema de salud por departamento";
    $("afi-mapa-h").textContent = sub ? "De cada 100 afiliados en el departamento, cuántos están en el régimen subsidiado (el Estado paga su afiliación)." : "Personas afiliadas, contributivo y subsidiado sumados.";
    mapa("afi-mapa", val, CODIGOS, {fmtValor: sub ? (v => fmt(v, 1) + "%") : (v => personas(v, 2)), log: !sub, nacional: {n: "Total del país", v: sub ? ts / (ts + tc) * 100 : ts + tc},
      extra: k => `EPS más grandes: ${D[k].top.slice(0, 3).map(([e, v]) => `${e} (${personas(v, 1)})`).join(", ")}`});
    const orden = Object.entries(val).sort((a, b) => b[1] - a[1]);
    $("afi-mapa-txt").innerHTML = sub ? `En el país, <strong>${fmt(ts / (ts + tc) * 100, 0)} de cada 100 afiliados</strong> están en el régimen subsidiado. ` +
      `Donde más pesa es en ${CODIGOS[orden[0][0]]} (${fmt(orden[0][1], 0)}%) y ${CODIGOS[orden[1][0]]} (${fmt(orden[1][1], 0)}%); donde menos, en ${CODIGOS[orden.at(-1)[0]]} (${fmt(orden.at(-1)[1], 0)}%), donde hay más empleo formal. ` +
      `Esas regiones dependen casi por completo de la plata que gira el Estado.`
      : `${CODIGOS[orden[0][0]]} tiene ${personas(orden[0][1], 1)} de afiliados y ${CODIGOS[orden[1][0]]} ${personas(orden[1][1], 1)}. Pasa el mouse sobre un departamento para ver sus EPS más grandes.`;
  }

  function render() {
    const M = Q.eps.meses, n = M.length - 1, D = A.deptos, E = A.eps;
    const tc = sumaArr(Object.values(D).map(d => d.contributivo)), ts = sumaArr(Object.values(D).map(d => d.subsidiado)), tot = tc + ts;
    $("afi-ultima").textContent = `Afiliados a ${etqMesLargo(A.fecha)}`;
    $("afi-k1").textContent = personas(tot, 1); $("afi-k1d").textContent = `contributivo ${personas(tc, 1)} · subsidiado ${personas(ts, 1)}`;
    $("afi-k2").textContent = fmt(ts / tot * 100, 1) + "%"; $("afi-k2d").textContent = "el Estado les paga la afiliación";
    const big = Object.entries(E).map(([k, e]) => [k, e.contributivo + e.subsidiado]).sort((a, b) => b[1] - a[1]);
    $("afi-k3").textContent = big[0][0]; $("afi-k3d").textContent = `${personas(big[0][1], 1)} de afiliados (${fmt(big[0][1] / tot * 100, 0)}%)`;
    const iv = Object.entries(E).filter(([, e]) => intervenidaEn(e.interv, A.fecha)), siv = sumaArr(iv.map(([, e]) => e.contributivo + e.subsidiado));
    $("afi-k4").textContent = personas(siv, 1); $("afi-k4d").textContent = `${fmt(siv / tot * 100, 0)} de cada 100 afiliados, en ${iv.length} EPS`;
    ranking(); mapaDeptos();
  }
  return {iniciar, render};
})());
