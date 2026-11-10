// Pestaña: Quejas y reclamos ante la Supersalud
registrar("quejas", (() => {
  let Q = null;
  const st = {anio: null, mes: null, mper: null, manio: null};
  const tasa = (r, a) => r != null && a ? r / a * 1e4 : null;

  async function iniciar() {
    Q = await json("web/quejas.json");
    const M = Q.eps.meses, u = M.at(-1);
    st.anio = u.slice(0, 4); st.mes = u;
    const anios = [...new Set(M.map(m => m.slice(0, 4)))].reverse();
    opciones($("que-anio"), anios.map(a => [a, a]), st.anio);
    const llenarMes = () => { const ms = M.filter(m => m.startsWith(st.anio)); if (!ms.includes(st.mes)) st.mes = ms.at(-1); opciones($("que-mes"), ms.map(m => [m, MESES_L[+m.slice(5, 7) - 1]]), st.mes); };
    llenarMes();
    $("que-anio").onchange = () => { st.anio = $("que-anio").value; llenarMes(); eps(); };
    $("que-mes").onchange = () => { st.mes = $("que-mes").value; eps(); };
    // motivos: año corrido y años completos desde 2024
    const mm = Q.motivos.meses, ua = mm.at(-1).slice(0, 4), um = +mm.at(-1).slice(5, 7);
    const per = [...new Set(mm.map(m => m.slice(0, 4)))].reverse().map(a => [a, a === ua && um < 12 ? `${a} (enero a ${MESES_L[um - 1]})` : a]);
    st.mper = per[0][0];
    opciones($("que-mper"), per, st.mper);
    $("que-mper").onchange = () => { st.mper = $("que-mper").value; motivos(); };
    const D = Q.deptos; st.manio = String(D.anios.at(-1));
    opciones($("que-manio"), D.anios.slice().reverse().map((a, k) => [a, D.hasta_mes[D.anios.length - 1 - k] < 12 ? `${a} (hasta ${MESES_L[D.hasta_mes[D.anios.length - 1 - k] - 1]})` : a]), st.manio);
    $("que-manio").onchange = () => { st.manio = $("que-manio").value; mapaDeptos(); };
  }

  // reclamos y afiliados de enero al mes m del año y
  function corrido(arr, meses, y, m) { return sumaArr(meses.map((f, i) => f.slice(0, 4) === String(y) && +f.slice(5, 7) <= m ? arr[i] : null)); }

  function total() {
    const M = Q.meses, r = Q.reclamos;
    serie("que-total", M, [{label: "Reclamos de los pacientes", data: r, color: css("--grafica"), ancho: 2.5, tipo: "bar"}], {agregar: "suma", fmtValor: v => fmt(v, 0), eje0: true, despues: (i0, i1) => {
      let k = i1; while (k > i0 && r[k] == null) k--;
      const f = M[k], y = +f.slice(0, 4), m = +f.slice(5, 7), a = corrido(r, M, y, m), b = corrido(r, M, y - 1, m);
      const k12 = M.indexOf(`${y - 1}-${f.slice(5)}`), c19 = corrido(r, M, 2019, 12), c25 = corrido(r, M, y - 1, 12);
      let t = `En <strong>${etqMesLargo(f)}</strong> hubo <strong>${fmt(r[k], 0)} reclamos</strong>` + (k12 >= 0 && r[k12] ? ` (un año antes, ${fmt(r[k12], 0)})` : "") + `. ` +
        `De enero a ${MESES_L[m - 1]} de ${y} van ${fmt(a, 0)}, ${a >= b ? "un" : "un"} <strong>${fmt(Math.abs(a / b - 1) * 100, 1)}% ${a >= b ? "más" : "menos"}</strong> que en el mismo periodo de ${y - 1}. `;
      if (c19 && c25) t += `En todo ${y - 1} fueron ${fmt(c25, 0)}: <strong>${fmt(c25 / c19, 1)} veces</strong> los de 2019 (${fmt(c19, 0)}), mientras el número de afiliados casi no cambió. `;
      t += `Ojo: la Supersalud ha cambiado sus canales y la forma de contar (por ejemplo, desde 2023 habla de “reclamos en salud”), así que parte del aumento también puede ser que más gente sabe cómo quejarse.`;
      $("que-total-txt").innerHTML = t;
    }});
  }

  function eps() {
    const E = Q.eps.eps, M = Q.eps.meses, i = M.indexOf(st.mes);
    const items = Object.entries(E).filter(([, e]) => e.afiliados[i] > 100000 && e.reclamos[i] != null)
      .map(([k, e]) => ({id: k, n: k + (intervenidaEn(e.interv, st.mes) ? " (intervenida)" : ""), v: tasa(e.reclamos[i], e.afiliados[i]), e})).sort((a, b) => b.v - a.v);
    $("que-eps-t").textContent = `Reclamos por cada 10.000 afiliados, ${etqMesLargo(st.mes)}`;
    barras("que-eps", items, {fmtValor: v => fmt(v, 1), alto: 24, colores: x => intervenidaEn(x.e.interv, st.mes) ? COL_INTERV() : COL_NORMAL(),
      alClic: x => {
        const t = M.map((m, k) => tasa(x.e.reclamos[k], x.e.afiliados[k])), tt = M.map((m, k) => tasa(sumaArr(Object.values(E).map(e => e.afiliados[k] > 100000 ? e.reclamos[k] : null)), sumaArr(Object.values(E).map(e => e.afiliados[k] > 100000 && e.reclamos[k] != null ? e.afiliados[k] : null))));
        enElTiempo("que-eps-tiempo", `${x.id}: reclamos por cada 10.000 afiliados`, M, [{label: "Todas las EPS", data: tt, color: css("--muted"), ancho: 1.6, agregar: "promedio"}, {label: x.id, data: t, color: css("--grafica"), ancho: 2.5, agregar: "promedio"}],
          {agregar: "promedio", inicio: 0, fmtValor: v => fmt(v, 1), eje0: true,
           nota: x.e.interv ? `Intervenida desde ${mesLargo(x.e.interv[0])}${x.e.interv[1] ? ` hasta ${mesLargo(x.e.interv[1])}` : ""}. Toca otra EPS para cambiarla.` : "Toca otra EPS para cambiarla.",
           texto: (i0, i1) => { let k = i1; while (k > i0 && t[k] == null) k--; let j = i0; while (j < k && t[j] == null) j++;
             return t[k] != null && t[j] != null ? `En ${etqMesLargo(M[k])}, ${x.id} tuvo ${fmt(t[k], 1)} reclamos por cada 10.000 afiliados (el promedio de las EPS fue ${fmt(tt[k], 1)}); en ${etqMesLargo(M[j])} tenía ${fmt(t[j], 1)}.` : ""; }});
      }});
    if (!items.length) { $("que-eps-txt").textContent = ""; return; }
    const prom = tasa(sumaArr(items.map(x => x.e.reclamos[i])), sumaArr(items.map(x => x.e.afiliados[i])));
    const iv = items.filter(x => intervenidaEn(x.e.interv, st.mes)), arriba = iv.filter(x => x.v > prom);
    $("que-eps-txt").innerHTML = `La EPS con más reclamos para su tamaño fue <strong>${items[0].id}</strong> (${fmt(items[0].v, 1)} por cada 10.000 afiliados), seguida de ${items[1].id} (${fmt(items[1].v, 1)}). ` +
      `La de menos fue ${items.at(-1).id} (${fmt(items.at(-1).v, 1)}). El promedio fue ${fmt(prom, 1)}. ` +
      (iv.length ? `De las ${iv.length} EPS intervenidas en ese momento, ${arriba.length} estaban por encima del promedio. ` : "") +
      `Las EPS del régimen contributivo suelen tener más reclamos por afiliado: sus afiliados usan más los servicios y conocen mejor los canales para quejarse.`;
  }

  function motivos() {
    const MM = Q.motivos, S = MM.series, mm = MM.meses;
    const sel = mm.map((m, i) => m.startsWith(st.mper) ? i : -1).filter(i => i >= 0);
    const items = Object.entries(S).map(([k, v]) => ({id: k, n: MOTIVO_CORTO(k), v: sumaArr(sel.map(i => v[i])), serie: v})).sort((a, b) => b.v - a.v);
    barras("que-mot", items, {fmtValor: v => fmt(v, 0), alto: 30, colores: x => esMedicamento(x.id) ? css("--s2") : esCita(x.id) ? css("--s3") : COL_NORMAL(),
      alClic: x => enElTiempo("que-mot-tiempo", x.n, mm, [{label: x.n, data: x.serie, color: css("--grafica"), ancho: 2.5}], {agregar: "suma", inicio: 0, fmtValor: v => fmt(v, 0), eje0: true, nota: x.id})});
    const tot = sumaArr(Object.values(Q.macromotivos).map(v => sumaArr(sel.map(i => v[i]))));
    const med = sumaArr(items.filter(x => esMedicamento(x.id)).map(x => x.v)), cit = sumaArr(items.filter(x => esCita(x.id)).map(x => x.v));
    $("que-mot-txt").innerHTML = `El motivo más común es <strong>“${items[0].n.toLowerCase()}”</strong> (${fmt(items[0].v, 0)} reclamos). ` +
      `Sumando, los reclamos por <strong>citas</strong> (negadas, demoradas o sin autorizar) fueron ${fmt(cit, 0)}, ${fmt(cit / tot * 100, 0)} de cada 100, ` +
      `y los de <strong>medicamentos y tratamientos</strong> negados, demorados o entregados incompletos, ${fmt(med, 0)}, ${fmt(med / tot * 100, 0)} de cada 100. ` +
      `En naranja, medicamentos y tratamientos; en morado, citas.`;
  }

  function mapaDeptos() {
    const D = Q.deptos, k = D.anios.indexOf(+st.manio), hm = D.hasta_mes[k];
    const val = {}; for (const c in D.reclamos) { const r = D.reclamos[c][k], a = D.afiliados[c][k]; if (r != null && a) val[c] = r / a * 1e4; }
    const rt = sumaArr(Object.keys(val).map(c => D.reclamos[c][k])), at = sumaArr(Object.keys(val).map(c => D.afiliados[c][k]));
    $("que-mapa-t").textContent = `Reclamos por cada 10.000 afiliados en cada departamento, ${st.manio}${hm < 12 ? ` (enero a ${MESES_L[hm - 1]})` : ""}`;
    mapa("que-mapa", val, CODIGOS, {fmtValor: v => fmt(v, 0), nacional: {n: "Total del país", v: rt / at * 1e4}, extra: c => `${fmt(D.reclamos[c][k], 0)} reclamos`});
    const o = Object.entries(val).sort((a, b) => b[1] - a[1]);
    if (!o.length) { $("que-mapa-txt").textContent = ""; return; }
    $("que-mapa-txt").innerHTML = `Donde más se quejan para su número de afiliados es en <strong>${CODIGOS[o[0][0]]}</strong> (${fmt(o[0][1], 0)} por cada 10.000) y ${CODIGOS[o[1][0]]} (${fmt(o[1][1], 0)}); donde menos, en ${CODIGOS[o.at(-1)[0]]} (${fmt(o.at(-1)[1], 0)}). ` +
      `Que un departamento tenga pocos reclamos no siempre significa buen servicio: en zonas apartadas mucha gente no tiene cómo ni dónde quejarse.`;
  }

  function render() {
    const M = Q.meses, r = Q.reclamos, k = ultimoValido(r), f = M[k], y = +f.slice(0, 4), m = +f.slice(5, 7);
    const a = corrido(r, M, y, m), b = corrido(r, M, y - 1, m);
    $("que-ultima").textContent = `Datos hasta ${etqMesLargo(f)}`;
    $("que-k1").textContent = fmt(a, 0); $("que-k1d").innerHTML = `ene–${MESES[m - 1]} ${y} · <span class="${clsSigno(a - b)}">${a >= b ? "▲" : "▼"} ${fmt(Math.abs(a / b - 1) * 100, 1)}%</span> vs ${y - 1}`;
    const E = Q.eps, ta = corrido(E.total_afiliados, E.meses, y, m) / m;
    const rEps = sumaArr(Object.values(E.eps).map(e => corrido(e.reclamos, E.meses, y, m)));
    $("que-k2").textContent = fmt(rEps / ta * 1e4, 0); $("que-k2d").textContent = `reclamos contra EPS en lo corrido de ${y}`;
    const mm = Q.motivos.meses, sel = mm.map((x, i) => x.startsWith(String(y)) ? i : -1).filter(i => i >= 0);
    const tot = sumaArr(Object.values(Q.macromotivos).map(v => sumaArr(sel.map(i => v[i]))));
    const med = sumaArr(Object.entries(Q.motivos.series).filter(([x]) => esMedicamento(x)).map(([, v]) => sumaArr(sel.map(i => v[i]))));
    const cit = sumaArr(Object.entries(Q.motivos.series).filter(([x]) => esCita(x)).map(([, v]) => sumaArr(sel.map(i => v[i]))));
    $("que-k3").textContent = fmt(med, 0); $("que-k3d").textContent = `${fmt(med / tot * 100, 0)} de cada 100 reclamos en ${y}`;
    $("que-k4").textContent = fmt(cit, 0); $("que-k4d").textContent = `${fmt(cit / tot * 100, 0)} de cada 100 reclamos en ${y}`;
    total(); eps(); motivos(); mapaDeptos();
  }
  return {iniciar, render};
})());
