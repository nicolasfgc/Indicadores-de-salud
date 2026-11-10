"""
Prepara versiones livianas de los datos para el explorador web (carpeta web/).
Uso:  python scripts/web.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import CODIGOS_DEPTO, INTERVENIDAS, cod_depto, eps_corta  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
DATOS = RAIZ / "datos"
WEB = RAIZ / "web"


def guardar(nombre, obj):
    p = WEB / nombre
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(f"  {nombre}: {p.stat().st_size / 1024:,.0f} KB")


def limpiar(v, dec=0):
    return None if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))) else round(float(v), dec)


def lista(s, claves, dec=0):
    return [limpiar(s.get(k), dec) for k in claves]


def meses_entre(a, b):
    return pd.date_range(a, b, freq="MS").strftime("%Y-%m-%d").tolist()


# ---------------------------------------------------------------- estados financieros
def indicadores(ruta):
    """Por entidad y corte: activos, pasivos, patrimonio, ingresos operacionales, costo de atender pacientes y resultado (miles de millones)."""
    d = pd.read_csv(ruta, dtype={"codigo": str, "nit": str})
    d["v"] = d.valor / 1e9
    p = d.pivot_table(index=["corte", "nit", "catalogo"], columns="codigo", values="v", aggfunc="sum").reset_index()
    g = lambda c: p[c].fillna(0) if c in p else pd.Series(0.0, index=p.index)  # noqa: E731
    pub = p.catalogo.eq("FT001-07")   # catálogo de entidades públicas (Contaduría General): otras cuentas
    p["activos"], p["pasivos"], p["patrimonio"] = g("1"), g("2"), g("3")
    # el resultado del periodo está en la cuenta de cierre: 56 en el catálogo privado, 59 en el público
    p["resultado"] = g("56").where(~pub, g("59"))
    p["ingresos"] = g("41").where(~pub, g("43"))
    # costo de atender pacientes: cuenta 6 en el catálogo privado; en el público, servicios de salud (56) y reservas técnicas (53)
    p["costo"] = g("6").where(~pub, g("56") + g("53"))
    nombres = d.sort_values("corte").drop_duplicates("nit", keep="last").set_index("nit").entidad
    p["n"] = p.nit.map(lambda x: eps_corta(nombres[x]))
    return p


def finanzas():
    p = indicadores(DATOS / "finanzas" / "eps.csv")
    cortes = sorted(p.corte.unique())
    ents = []
    for nit, g in p.groupby("nit"):
        s = g.set_index("corte")
        if s.activos.abs().sum() == 0:
            continue
        n = g.n.iloc[0]
        iv = INTERVENIDAS.get(n)
        ents.append({"id": nit, "n": n, "interv": list(iv) if iv else None, "ultimo": s.index.max(),
                     **{k: lista(s[k], cortes, 1) for k in ["activos", "pasivos", "patrimonio", "ingresos", "costo", "resultado"]}})
    ents.sort(key=lambda x: -(max([v for v in x["ingresos"] if v is not None] or [0])))
    # los totales dejan por fuera a Nueva EPS en todos los cortes: dejó de reportar en marzo de 2024 y, si se incluyera
    # solo hasta esa fecha, las cifras darían un salto que no es real
    q = p[p.n != "Nueva EPS"]
    tot = q.groupby("corte")
    neg = q[q.patrimonio < 0].groupby("corte").nit.nunique()
    out = {"cortes": cortes, "entidades": ents,
           "total": {"pasivos": lista(tot.pasivos.sum(), cortes, 1), "patrimonio": lista(tot.patrimonio.sum(), cortes, 1),
                     "activos": lista(tot.activos.sum(), cortes, 1), "ingresos": lista(tot.ingresos.sum(), cortes, 1),
                     "costo": lista(tot.costo.sum(), cortes, 1), "resultado": lista(tot.resultado.sum(), cortes, 1),
                     "reportan": lista(tot.nit.nunique(), cortes), "negativo": lista(neg, cortes)}}
    # patrimonio adecuado: quién cumple cada mes
    pa = pd.read_csv(DATOS / "finanzas" / "patrimonio_adecuado.csv")
    meses = sorted(pa.mes.unique())
    out["patrimonio_adecuado"] = {"meses": meses, "cumplen": lista(pa.groupby("mes").cumple.sum(), meses),
                                  "evaluadas": lista(pa.groupby("mes").eps.nunique(), meses),
                                  "eps": {e: lista(g.set_index("mes").cumple, meses) for e, g in pa.groupby("eps")}}
    guardar("finanzas.json", out)
    return out


def prepagada():
    p = indicadores(DATOS / "finanzas" / "prepagada.csv")
    cortes = sorted(p.corte.unique())
    ents = []
    for nit, g in p.groupby("nit"):
        s = g.set_index("corte")
        ents.append({"id": nit, "n": nombre_prepagada(g.n.iloc[0], nit),
                     "tipo": PREPAGADAS.get(nit, ("", "ambulancia" if "AMBULANCIA" in str(g.n.iloc[0]).upper() else "medicina"))[1], **{k: lista(s[k], cortes, 2) for k in ["activos", "pasivos", "patrimonio", "ingresos", "costo", "resultado"]}})
    ents.sort(key=lambda x: -(x["ingresos"][-1] or 0))
    tot = p.groupby("corte")
    guardar("prepagada.json", {"cortes": cortes, "entidades": ents,
                               "total": {k: lista(tot[k].sum(), cortes, 2) for k in ["ingresos", "costo", "resultado", "patrimonio", "activos", "pasivos"]}})


PREPAGADAS = {  # NIT: (nombre corto, tipo)
    "860078828": ("Colsanitas", "medicina"), "800106339": ("Colmédica", "medicina"), "805009741": ("Coomeva Medicina Prepagada", "medicina"),
    "900178724": ("Medplus", "medicina"), "800153424": ("Medisanitas", "medicina"), "900640334": ("Colpatria Medicina Prepagada", "medicina"),
    "800087461": ("Salud Inmediato", "medicina"), "800142965": ("Merci", "medicina"),
    "811007601": ("EMI", "ambulancia"), "800126785": ("Emermédica", "ambulancia"), "901417124": ("Coomeva Emergencia Médica", "ambulancia"),
    "802002279": ("Asistencia Médica Inmediata", "ambulancia"), "807002007": ("SAMI", "ambulancia"),
    "804007617": ("Asistencia Médica SAS", "ambulancia"), "900632505": ("Red Médica Vital", "ambulancia")}


def nombre_prepagada(n, nit):
    if nit in PREPAGADAS:
        return PREPAGADAS[nit][0]
    return str(n).title()[:34]


# ---------------------------------------------------------------- quejas y afiliados
def quejas():
    m = pd.read_csv(DATOS / "quejas" / "mensual.csv")
    m["fecha"] = pd.to_datetime(dict(year=m.anio, month=m.mes, day=1)).dt.strftime("%Y-%m-%d")
    meses = meses_entre(m.fecha.min(), m.fecha.max())
    t = m[m.tabla == "tipo"].copy()
    t["c"] = np.where(t.categoria.str.upper().str.contains("SOLICITUD"), "solicitudes", "reclamos")
    tt = t.groupby(["c", "fecha"]).valor.sum()
    out = {"meses": meses, "reclamos": lista(tt["reclamos"], meses), "solicitudes": lista(tt["solicitudes"], meses)}
    # motivos: la clasificación vigente (desde 2024)
    mo = m[(m.tabla == "motivo") & (m.anio >= 2024)]
    keep = mo.groupby("categoria").valor.sum().sort_values(ascending=False).index[:10]
    m24 = [x for x in meses if x >= "2024-01-01"]
    out["motivos"] = {"meses": m24, "series": {c.strip().capitalize(): lista(mo[mo.categoria == c].groupby("fecha").valor.sum(), m24) for c in keep}}
    ma = m[(m.tabla == "macromotivo") & (m.anio >= 2024)]
    out["macromotivos"] = {c.strip().capitalize(): lista(ma[ma.categoria == c].groupby("fecha").valor.sum(), m24) for c in ma.categoria.unique()}
    # departamentos: reclamos de cada año y tasa por 10.000 afiliados (con el promedio de afiliados que usa la Supersalud)
    dp = m[m.tabla == "depto"].copy()
    dp["cod"] = dp.categoria.map(cod_depto)
    af = pd.read_csv(DATOS / "quejas" / "afiliados_anio.csv")
    af = af[af.tabla == "depto"].assign(cod=lambda x: x.categoria.map(cod_depto)).groupby(["anio", "cod"]).afiliados.max()
    anios = sorted(dp.anio.unique())
    rec = dp.groupby(["anio", "cod"]).valor.sum()
    mes_max = dp.groupby("anio").mes.max()
    out["deptos"] = {"anios": [int(a) for a in anios], "hasta_mes": [int(mes_max[a]) for a in anios],
                     "reclamos": {c: [limpiar(rec.get((a, c))) for a in anios] for c in CODIGOS_DEPTO},
                     "afiliados": {c: [limpiar(af.get((a, c))) for a in anios] for c in CODIGOS_DEPTO}}
    # por EPS: afiliados y reclamos de cada mes (informe ejecutivo), sumando los dos regímenes
    e = pd.read_csv(DATOS / "quejas" / "eps_mes.csv")
    me = meses_entre(e.fecha.min(), e.fecha.max())
    tot = e.groupby("fecha")[["afiliados"]].sum().afiliados
    eps = {}
    for n, g in e.groupby("eps"):
        s = g.groupby("fecha")[["afiliados", "reclamos"]].sum()
        if s.afiliados.max() < 50000:
            continue
        r = g.pivot_table(index="fecha", columns="regimen", values="afiliados", aggfunc="sum")
        iv = INTERVENIDAS.get(n)
        eps[n] = {"afiliados": lista(s.afiliados, me), "reclamos": lista(s.reclamos.where(s.reclamos > 0), me),
                  "contributivo": lista(r.get("contributivo", pd.Series(dtype=float)), me), "subsidiado": lista(r.get("subsidiado", pd.Series(dtype=float)), me),
                  "interv": list(iv) if iv else None}
    out["eps"] = {"meses": me, "total_afiliados": lista(tot, me), "eps": eps}
    guardar("quejas.json", out)


def afiliados():
    b = pd.read_csv(DATOS / "afiliados" / "bdua.csv", dtype={"cod_depto": str})
    f = b.fecha.max()
    b = b[b.fecha == f]
    reg = b.groupby(["cod_depto", "regimen"]).afiliados.sum().unstack().fillna(0)
    eps = b.groupby(["cod_depto", "eps"]).afiliados.sum()
    top = {c: [[e, int(v)] for e, v in eps[c].sort_values(ascending=False).head(5).items()] for c in reg.index}
    nac = b.groupby(["eps", "regimen"]).afiliados.sum().unstack().fillna(0)
    guardar("afiliados.json", {"fecha": f,
                               "deptos": {c: {"contributivo": int(r.get("contributivo", 0)), "subsidiado": int(r.get("subsidiado", 0)), "top": top[c]} for c, r in reg.iterrows()},
                               "eps": {e: {"contributivo": int(r.get("contributivo", 0)), "subsidiado": int(r.get("subsidiado", 0)),
                                           "interv": list(INTERVENIDAS[e]) if e in INTERVENIDAS else None} for e, r in nac.iterrows()}})


def adres():
    if not (DATOS / "adres" / "upc_mensual.csv").exists():
        return
    a = pd.read_csv(DATOS / "adres" / "upc_mensual.csv").sort_values("fecha")
    me = meses_entre(a.fecha.min(), a.fecha.max())
    s = a.set_index("fecha")
    guardar("adres.json", {"meses": me, **{k: lista(s[k], me, 2) for k in a.columns if k != "fecha"}})


def main():
    print("Preparando datos para la web:")
    finanzas()
    prepagada()
    quejas()
    afiliados()
    adres()


if __name__ == "__main__":
    main()
