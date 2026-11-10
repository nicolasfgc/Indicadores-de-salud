"""
Quejas y reclamos contra las EPS y el sistema de salud (Supersalud, PQRD).

Fuente: gestor documental de la Supersalud, Protección al Usuario.
  - "RQ-PQRD y solicitudes de información <mes> <año>": cada mes, el acumulado del año, mes a mes, por tipo,
    por departamento, por motivo y por EPS (con el promedio de afiliados del año para calcular la tasa).
    Se usa el último archivo de cada año.
  - "RM-Informe ejecutivo <mes> <año>": cada mes, el número de afiliados y de reclamos de cada EPS en ese mes.

Desde 2025 la Supersalud cambió la clasificación de los motivos ("Barreras en el acceso" reemplazó a "Restricción
en el acceso") y habla de "reclamos en salud" en vez de "PQRD". Los totales se pueden seguir en el tiempo; los motivos
se comparan dentro de cada clasificación.

Salida (datos/quejas/):
  mensual.csv   anio | mes | tabla | categoria | valor      (tabla = tipo, depto, macromotivo, motivo, eps_c, eps_s, eps_i)
  afiliados_anio.csv  anio | tabla | categoria | afiliados  (promedio de afiliados del año usado por la Supersalud)
  eps_mes.csv   fecha | regimen | eps | afiliados | reclamos (del informe ejecutivo)
Uso:  python scripts/quejas.py
"""
import io
import re
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import DATOS, MESES, MESES_LARGOS, bajar, carpeta_supersalud, eps_corta, guardar, llave  # noqa: E402

CARPETA = DATOS / "quejas"


def mes_anio(nombre):
    """Mes y año que cubre un archivo, por su nombre ('...enero - diciembre 2019', '... Agosto 2026', '2014 Ene - Jul')."""
    t = llave(nombre.replace(".xlsx", "").replace(".xls", ""))
    a = re.findall(r"(20\d\d)", t)
    if not a:
        return None
    anio = int(a[-1])
    t2 = t.replace(a[-1], " ")
    pos = []
    for k, m in MESES_LARGOS.items():
        for x in re.finditer(k, t2):
            pos.append((x.start(), m))
    if not pos:
        for k, m in MESES.items():
            for x in re.finditer(k, t2):
                pos.append((x.start(), m))
    if not pos:
        return None
    return anio, max(pos)[1]   # el último mes que aparece en el nombre (en "enero - julio" es julio)


def filas(d):
    return [[None if (isinstance(v, float) and pd.isna(v)) else v for v in d.iloc[i].tolist()] for i in range(len(d))]


def es_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def tipo_tabla(titulo):
    t = llave(titulo)
    if "TOTALNACIONALPORTIPO" in t:
        return "tipo"
    if "PORDEPARTAMENTO" in t:
        return "depto"
    if "MACROMOTIVO" in t:
        return "macromotivo"
    if "MOTIVOSESPEC" in t or "PORMOTIVOS" in t:
        return "motivo"
    if "PORESP" in t or "POREPS" in t or "PORENTIDAD" in t:
        if "INDIGENA" in t:
            return "eps_i"
        if "CONTRIBUTIVO" in t:
            return "eps_c"
        if "SUBSIDIADO" in t:
            return "eps_s"
    return None


def leer_rq(contenido):
    """Tablas mes a mes de un archivo 'RQ-PQRD y solicitudes de información'."""
    x = pd.ExcelFile(io.BytesIO(contenido), engine="calamine")
    d = pd.read_excel(x, sheet_name=x.sheet_names[0], header=None)
    F = filas(d)
    out, afil = [], []
    for i, f in enumerate(F):
        cel = [llave(v) if isinstance(v, str) else "" for v in f]
        if "ENE" not in cel or "DIC" not in cel:
            continue
        # título: las líneas de texto justo encima del encabezado (sin las notas al pie de la tabla anterior)
        previas = []
        for g in reversed(F[max(0, i - 6):i]):
            t = " ".join(str(v) for v in g if isinstance(v, str)).strip()
            if not t:
                continue
            if re.match(r"^(TABLA|FUENTE|\*|NOTA)", llave(t[:6]) if not t.startswith("*") else "*"):
                break
            previas.append(t)
            if len(previas) == 2:
                break
        titulo = " ".join(reversed(previas))
        tabla = tipo_tabla(titulo)
        if not tabla:
            continue
        cols = {MESES[c]: j for j, c in enumerate(cel) if c in MESES}
        j_af = next((j for j, c in enumerate(cel) if "AFILIADOS" in c), None)
        for g in F[i + 1:]:
            textos = [v for v in g[:min(cols.values())] if isinstance(v, str) and v.strip() and not re.fullmatch(r"[\d\s-]+", v.strip())]
            if not textos:
                if all(v is None for v in g):
                    break
                continue
            etq = textos[-1].strip()
            if llave(etq).startswith("TOTAL"):
                break
            for m, j in cols.items():
                v = g[j] if j < len(g) else None
                if es_num(v):
                    out.append({"mes": m, "tabla": tabla, "categoria": etq, "valor": float(v)})
            if j_af is not None and j_af < len(g) and es_num(g[j_af]):
                afil.append({"tabla": tabla, "categoria": etq, "afiliados": float(g[j_af])})
    return pd.DataFrame(out), pd.DataFrame(afil)


def leer_ejecutivo(contenido):
    """Afiliados y reclamos de cada EPS en el mes, del 'Informe ejecutivo'."""
    x = pd.ExcelFile(io.BytesIO(contenido), engine="calamine")
    out = []
    for hoja in x.sheet_names[:1]:
        F = filas(pd.read_excel(x, sheet_name=hoja, header=None))
        regimen = None
        for i, f in enumerate(F):
            cel = [llave(v) if isinstance(v, str) else "" for v in f]
            txt = "".join(cel)
            if "REGIMENCONTRIBUTIVO" in txt and "AFILIADOS" not in txt:
                regimen = "contributivo"
            elif "REGIMENSUBSIDIADO" in txt and "AFILIADOS" not in txt:
                regimen = "subsidiado"
            j_eps = next((j for j, c in enumerate(cel) if c in ("EPS", "EAPB", "ENTIDAD", "EPSS", "NOMBREEPS", "NOMBREEAPB")), None)
            if not regimen or j_eps is None or not any("AFILIADOS" in c for c in cel):
                continue
            j_af = next(j for j, c in enumerate(cel) if "AFILIADOS" in c)
            j_rec = next((j for j, c in enumerate(cel) if ("RECLAMOS" in c or "PQRD" in c or "QUEJAS" in c) and "CADA" not in c and j != j_af), None)
            for g in F[i + 1:]:
                n = g[j_eps] if j_eps < len(g) else None
                if not isinstance(n, str) or not n.strip():
                    break
                if llave(n).startswith("TOTAL"):
                    break
                af = g[j_af] if j_af < len(g) else None
                rc = g[j_rec] if j_rec is not None and j_rec < len(g) else None
                if es_num(af):
                    out.append({"regimen": regimen, "eps": eps_corta(n), "afiliados": float(af), "reclamos": float(rc) if es_num(rc) else None})
            regimen = None
    # algunos informes repiten la tabla (por ejemplo, con y sin EPS indígenas): vale la primera
    d = pd.DataFrame(out)
    return d.drop_duplicates(["regimen", "eps"], keep="first") if len(d) else d


def main():
    print("Quejas y reclamos (Supersalud):")
    CARPETA.mkdir(parents=True, exist_ok=True)
    # --- acumulado del año, mes a mes: el último archivo de cada año
    archivos = {}
    for f in carpeta_supersalud("ProteccionUsuario", "EstadisticasPQRD"):
        ma = mes_anio(f["nombre"])
        if ma and ma[0] >= 2017 and (ma[0] not in archivos or ma[1] > archivos[ma[0]][0] or (ma[1] == archivos[ma[0]][0] and f["fecha"] > archivos[ma[0]][1]["fecha"])):
            archivos[ma[0]] = (ma[1], f)
    p_m, p_a = CARPETA / "mensual.csv", CARPETA / "afiliados_anio.csv"
    viejo = pd.read_csv(p_m) if p_m.exists() else pd.DataFrame(columns=["anio"])
    viejo_a = pd.read_csv(p_a) if p_a.exists() else pd.DataFrame(columns=["anio"])
    tengo = set(viejo.anio.astype(int)) if len(viejo) else set()
    rehacer = set(sorted(archivos)[-2:])
    partes = [viejo[~viejo.anio.isin(rehacer)]] if len(viejo) else []
    partes_a = [viejo_a[~viejo_a.anio.isin(rehacer)]] if len(viejo_a) else []
    for anio in sorted(archivos):
        if anio in tengo and anio not in rehacer:
            continue
        m, f = archivos[anio]
        try:
            d, a = leer_rq(bajar(f["url"]))
        except Exception as e:  # noqa: BLE001
            print(f"    {anio}: no se pudo leer {f['nombre']} ({e})")
            continue
        print(f"    {anio} (hasta el mes {m}): {len(d):,} datos, tablas {sorted(d.tabla.unique()) if len(d) else []}")
        partes.append(d.assign(anio=anio))
        partes_a.append(a.assign(anio=anio))
        time.sleep(1)
    mens = pd.concat(partes, ignore_index=True)
    mens = mens.groupby(["anio", "mes", "tabla", "categoria"], as_index=False).valor.sum()
    guardar(mens[["anio", "mes", "tabla", "categoria", "valor"]], "quejas", "mensual.csv", ["anio", "mes", "tabla", "categoria"])
    af = pd.concat(partes_a, ignore_index=True).groupby(["anio", "tabla", "categoria"], as_index=False).afiliados.max()
    guardar(af, "quejas", "afiliados_anio.csv", ["anio", "tabla", "categoria"])

    # --- informe ejecutivo de cada mes: afiliados y reclamos por EPS
    meses = {}
    for f in carpeta_supersalud("ProteccionUsuario", "Informe PQRD Mensual"):
        ma = mes_anio(f["nombre"])
        if ma:
            k = f"{ma[0]}-{ma[1]:02d}-01"
            if k not in meses or f["fecha"] > meses[k]["fecha"]:
                meses[k] = f
    p_e = CARPETA / "eps_mes.csv"
    viejo = pd.read_csv(p_e) if p_e.exists() else pd.DataFrame(columns=["fecha"])
    tengo = set(viejo.fecha)
    rehacer = set(sorted(meses)[-2:])
    partes = [viejo[~viejo.fecha.isin(rehacer)]] if len(viejo) else []
    for k in sorted(meses):
        if k in tengo and k not in rehacer:
            continue
        try:
            d = leer_ejecutivo(bajar(meses[k]["url"]))
        except Exception as e:  # noqa: BLE001
            print(f"    {k}: no se pudo leer {meses[k]['nombre']} ({e})")
            continue
        if len(d):
            partes.append(d.assign(fecha=k))
        print(f"    {k}: {len(d)} EPS")
        time.sleep(0.5)
    e = pd.concat(partes, ignore_index=True)
    e = e.groupby(["fecha", "regimen", "eps"], as_index=False).agg(afiliados=("afiliados", "sum"), reclamos=("reclamos", "sum"))
    guardar(e, "quejas", "eps_mes.csv", ["fecha", "regimen", "eps"])


if __name__ == "__main__":
    main()
