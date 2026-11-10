// Pestaña: Medicina prepagada y ambulancia prepagada (Supersalud, estados financieros)
registrar("prepagada", (() => {
  let P = null, F = null;
  const st = {ind: "ingresos", rind: "ingresos"};
  async function iniciar() {
    [P, F] = await Promise.all([json("web/prepagada.json"), json("web/finanzas.json")]);
    seg("pre-ind", x => { st.ind = x; anual(); });
    seg("pre-rind", x => { st.rind = x; ranking(); });
  }
  // el último corte de cada año (diciembre, o el último trimestre publicado del año en curso)
  const cortesAnuales = () => { const C = P.cortes, A = [...new Set(C.map(c => c.slice(0, 4)))]; return A.map(y => C.indexOf(C.filter(c => c.startsWith(y)).at(-1))); };
  const ultimoCompleto = () => { const C = P.cortes; return C.map((c, i) => c.endsWith("-12") ? i : -1).filter(i => i >= 0).at(-1); };

  function anual() {
    const C = P.cortes, idx = cortesAnuales(), v = idx.map(i => P.total[st.ind][i]);
    const etq = idx.map(i => C[i].endsWith("-12") ? C[i].slice(0, 4) : `${C[i].slice(0, 4)} (hasta ${MESES[+C[i].slice(5) - 1]})`);
    serie("pre-anual", etq, [{label: st.ind === "ingresos" ? "Ingresos" : "Ganancias", data: v, color: st.ind === "ingresos" ? css("--grafica") : css("--verde"), tipo: "bar",
      colores: idx.map(i => C[i].endsWith("-12") ? (st.ind === "ingresos" ? css("--grafica") : css("--verde")) : aclarar(st.ind === "ingresos" ? css("--grafica") : css("--verde")))}],
      {fmtValor: pesos, eje0: true, gobiernos: false, fmtX: x => x, despues: () => {
        const comp = idx.filter(i => C[i].endsWith("-12")), a = comp[0], b = comp.at(-1), u = idx.at(-1);
        const ya = C[a].slice(0, 4), yb = C[b].slice(0, 4);
        const mismo = C.indexOf(`${+C[u].slice(0, 4) - 1}${C[u].slice(4)}`);
        let t = `En ${yb} la medicina y ambulancia prepagada ${st.ind === "ingresos" ? "facturaron" : "ganaron"} <strong>${pesos(P.total[st.ind][b])}</strong>; en ${ya}, ${pesos(P.total[st.ind][a])} ` +
          `(${P.total[st.ind][b] >= P.total[st.ind][a] ? "+" : "−"}${fmt(Math.abs(P.total[st.ind][b] / P.total[st.ind][a] - 1) * 100, 0)}%). `;
        if (!C[u].endsWith("-12") && mismo >= 0) t += `En ${C[u].slice(0, 4)} van ${pesos(P.total[st.ind][u])} hasta ${MESES_L[+C[u].slice(5) - 1]}, frente a ${pesos(P.total[st.ind][mismo])} en el mismo periodo del año anterior (${P.total[st.ind][u] >= P.total[st.ind][mismo] ? "+" : "−"}${fmt(Math.abs(P.total[st.ind][u] / P.total[st.ind][mismo] - 1) * 100, 1)}%). `;
        if (st.ind === "ingresos") {
          const ie = F.cortes.indexOf(C[b]), ie0 = F.cortes.indexOf(C[a]);
          const gp = P.total.ingresos[b] / P.total.ingresos[a] - 1, ge = ie >= 0 && ie0 >= 0 ? F.total.ingresos[ie] / F.total.ingresos[ie0] - 1 : null;
          if (ge != null) t += `Para comparar: los ingresos de las EPS que reportan (sin Nueva EPS) crecieron ${fmt(ge * 100, 0)}% en el mismo periodo. `;
          t += ge != null && gp > ge + 0.1 ? `Que la prepagada crezca más rápido que las EPS sugiere que quienes pueden pagar buscan una salida a las demoras de su EPS.`
            : `Los ingresos de la prepagada crecen a un ritmo parecido a los de las EPS; la gran diferencia está en el resultado: la prepagada gana plata y las EPS la pierden.`;
        } else t += `A diferencia de las EPS, que en conjunto pierden plata, la medicina prepagada es rentable: cobra según el riesgo de cada cliente y no atiende a toda la población.`;
        $("pre-anual-txt").innerHTML = t;
      }});
  }

  function ranking() {
    const b = ultimoCompleto(), y = P.cortes[b].slice(0, 4), ind = st.rind;
    const items = P.entidades.filter(e => e[ind][b] != null && (e.ingresos[b] || 0) > 1).map(e => ({id: e.id, n: e.n + (e.tipo === "ambulancia" ? " (ambulancias)" : ""), v: e[ind][b], e})).sort((a, b2) => b2.v - a.v);
    $("pre-rank-t").textContent = `${{ingresos: "Ingresos", resultado: "Ganancias", patrimonio: "Patrimonio"}[ind]} de cada empresa, ${y}`;
    barras("pre-rank", items, {fmtValor: pesos, alto: 26, colores: x => x.e.tipo === "ambulancia" ? css("--s2") : COL_NORMAL()});
    const tot = sumaArr(items.map(x => x.v)), san = sumaArr(items.filter(x => /sanitas/i.test(x.e.n)).map(x => x.v));
    $("pre-rank-txt").innerHTML = `<strong>${items[0].e.n}</strong> es la más grande (${pesos(items[0].v)}), seguida de ${items[1].e.n} (${pesos(items[1].v)}) y ${items[2].e.n} (${pesos(items[2].v)}). ` +
      (san ? `Las dos empresas del grupo Keralty (Colsanitas y Medisanitas), dueño también de la EPS Sanitas, suman ${fmt(san / tot * 100, 0)} de cada 100 pesos. ` : "") +
      `En naranja, los servicios de ambulancia prepagada.`;
  }

  function render() {
    const C = P.cortes, b = ultimoCompleto(), y = C[b].slice(0, 4), T = P.total;
    const a = C.indexOf(`${+y - 1}-12`);
    $("pre-ultima").textContent = `Cuentas a ${mesLargo(C.at(-1))}`;
    $("pre-k1").textContent = pesos(T.ingresos[b]); $("pre-k1d").textContent = a >= 0 ? `${y} · ${T.ingresos[b] >= T.ingresos[a] ? "+" : "−"}${fmt(Math.abs(T.ingresos[b] / T.ingresos[a] - 1) * 100, 1)}% frente a ${+y - 1}` : y;
    $("pre-k2").textContent = pesos(T.resultado[b]); { const re = F.total.resultado[F.cortes.indexOf(C[b])]; $("pre-k2d").textContent = re < 0 ? `${y} · las EPS, en cambio, perdieron ${pesos(-re)}` : `${y}`; }
    const big = P.entidades.slice().sort((x, z) => (z.ingresos[b] || 0) - (x.ingresos[b] || 0))[0];
    $("pre-k3").textContent = big.n; $("pre-k3d").textContent = `${pesos(big.ingresos[b])} en ingresos en ${y}`;
    $("pre-k4").textContent = `$${fmt(T.costo[b] / T.ingresos[b] * 100, 1)}`; $("pre-k4d").textContent = `en las EPS: $${fmt(F.total.costo[F.cortes.indexOf(C[b])] / F.total.ingresos[F.cortes.indexOf(C[b])] * 100, 1)} (${y})`;
    anual(); ranking();
  }
  return {iniciar, render};
})());
