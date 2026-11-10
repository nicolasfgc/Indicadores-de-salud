"""
Estados financieros de las EPS y de la medicina prepagada (Supersalud).

Fuente: portal de datos abiertos de la Supersalud (catálogos de información financiera, archivo tipo FT001).
  - EPS de los regímenes contributivo y subsidiado: trimestral de 2021 a 2024 y mensual desde enero de 2025.
  - Entidades de medicina prepagada (EMP) y ambulancia prepagada (SAP): trimestral desde 2021.

Se guardan solo las cuentas de primer y segundo nivel (activos, pasivos, patrimonio, ingresos, gastos, costos y sus grupos),
que bastan para medir el tamaño de las deudas, el patrimonio, las pérdidas y cuánto se va en atender pacientes.
Los valores están en pesos; los ingresos, gastos y costos son acumulados en lo corrido del año hasta el corte.

Salida: datos/finanzas/eps.csv y datos/finanzas/prepagada.csv
  corte | nit | entidad | catalogo | codigo | denominacion | valor

Cada vez se revisa la lista de archivos publicados y se bajan solo los cortes nuevos (y los dos últimos, por si los corrigen).
Uso:  python scripts/finanzas.py
"""
import io
import re
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import DATOS, MESES_LARGOS, arcgis_archivo, arcgis_supersalud, guardar  # noqa: E402

TRIM = {"PRIMER": 3, "SEGUNDO": 6, "TERCER": 9, "CUARTO": 12}


def corte_de(titulo):
    t = titulo.upper().replace("_", " ")
    a = re.search(r"(20\d\d)", t)
    if not a:
        return None
    for k, m in TRIM.items():
        if f"{k} TRIMESTRE" in t:
            return f"{a.group(1)}-{m:02d}"
    if "PRIMER SEMESTRE" in t:
        return f"{a.group(1)}-06"
    for k, m in MESES_LARGOS.items():
        if k in t:
            return f"{a.group(1)}-{m:02d}"
    return None


def leer(contenido):
    txt = contenido.decode("utf-8-sig", errors="replace")
    d = pd.read_csv(io.StringIO(txt), sep=";", dtype=str)
    cols = {c: re.sub(r"[^a-z]", "", c.lower().replace("ó", "o").replace("á", "a")) for c in d.columns}
    d = d.rename(columns=cols)
    pick = lambda *ops: next(c for c in d.columns if any(c.startswith(o) for o in ops))  # noqa: E731
    out = pd.DataFrame({"nit": d[pick("nit")].str.strip(), "entidad": d[pick("razon")].str.strip(),
                        "codigo": d[pick("codigo")].str.strip().str.replace(r"[,.]0+$", "", regex=True), "denominacion": d[pick("denominacion")].str.strip(),
                        "catalogo": d[pick("catalogo")].str.strip(),
                        "valor": pd.to_numeric(d[pick("valor")].str.replace(",", ".", regex=False), errors="coerce")})
    return out[out.codigo.str.len() <= 2]


def serie(prefijo, salida):
    items = [x for x in arcgis_supersalud(f'title:"{prefijo}" AND type:CSV') if x["title"].upper().startswith(prefijo)]
    cortes = {}
    for x in items:
        c = corte_de(x["title"])
        if c and (c not in cortes or x["modified"] > cortes[c]["modified"]):
            cortes[c] = x
    print(f"  {prefijo}: {len(cortes)} cortes publicados ({min(cortes)} a {max(cortes)})")
    ruta = DATOS / "finanzas" / salida
    viejo = pd.read_csv(ruta, dtype={"nit": str, "codigo": str, "corte": str}) if ruta.exists() else pd.DataFrame(columns=["corte"])
    tengo = set(viejo.corte)
    rehacer = set(sorted(cortes)[-2:])
    partes = [viejo[~viejo.corte.isin(rehacer)]] if len(viejo) else []
    for c in sorted(cortes):
        if c in tengo and c not in rehacer:
            continue
        try:
            d = leer(arcgis_archivo(cortes[c]["id"]))
        except Exception as e:  # noqa: BLE001
            print(f"    {c}: no se pudo leer ({e})")
            if c in tengo:
                partes.append(viejo[viejo.corte == c])
            continue
        partes.append(d.assign(corte=c))
        print(f"    {c}: {d.nit.nunique()} entidades")
        time.sleep(1)
    df = pd.concat(partes, ignore_index=True)
    df = df.groupby(["corte", "nit", "codigo"], as_index=False).agg(
        entidad=("entidad", "last"), catalogo=("catalogo", "last"), denominacion=("denominacion", "last"), valor=("valor", "sum"))
    guardar(df[["corte", "nit", "entidad", "catalogo", "codigo", "denominacion", "valor"]], "finanzas", salida, ["corte", "nit", "codigo"])


def main():
    print("Estados financieros (Supersalud):")
    serie("FT001_EPS", "eps.csv")
    serie("FT001_SAP_EMP", "prepagada.csv")


if __name__ == "__main__":
    main()
