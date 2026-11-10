"""
Afiliados al sistema de salud por EPS, régimen y departamento (ADRES, Base de Datos Única de Afiliados - BDUA).

Fuente: datos.gov.co, conjuntos d7a5-cnra (régimen subsidiado) y tq4m-hmg2 (régimen contributivo), publicados por la ADRES.
Cada conjunto trae solo la foto del momento (los afiliados activos hoy), así que el robot guarda una foto cada mes
y la historia se va armando desde noviembre de 2026. La historia anterior por EPS sale de los informes de la Supersalud
(ver quejas.py, archivo eps_mes.csv).

"-CM" en el nombre de la EPS indica afiliados en "movilidad": personas que cambiaron de régimen sin cambiar de EPS
(por ejemplo, alguien del subsidiado que consiguió empleo). Se suman a la EPS y se cuentan en el régimen del conjunto.

Salida: datos/afiliados/bdua.csv   fecha | cod_depto | regimen | eps | afiliados
        datos/afiliados/bdua_municipios.csv (solo la foto más reciente) cod_depto | municipio | regimen | afiliados
Uso:  python scripts/afiliados.py
"""
import sys
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import DATOS, cod_depto, eps_corta, guardar, soql  # noqa: E402

CONJUNTOS = {"subsidiado": "d7a5-cnra", "contributivo": "tq4m-hmg2"}


def main():
    print("Afiliados (ADRES, BDUA):")
    hoy = date.today().replace(day=1).isoformat()
    partes, munis = [], []
    for reg, cid in CONJUNTOS.items():
        d = soql(cid, select="dpr_nombre, ent_nombre, sum(cantidad::number) as n", group="dpr_nombre, ent_nombre")
        d["n"] = pd.to_numeric(d.n)
        d["cod_depto"] = d.dpr_nombre.map(cod_depto)
        d["eps"] = d.ent_nombre.map(eps_corta)
        sin = d[d.cod_depto.isna()].n.sum()
        if sin > 0.01 * d.n.sum():
            raise RuntimeError(f"{reg}: muchos afiliados sin departamento reconocido ({sin:,.0f})")
        d = d.dropna(subset=["cod_depto"]).groupby(["cod_depto", "eps"], as_index=False).n.sum()
        partes.append(d.assign(regimen=reg, fecha=hoy).rename(columns={"n": "afiliados"}))
        print(f"  {reg}: {d.n.sum():,.0f} afiliados")
        m = soql(cid, select="dpr_nombre, mnc_nombre, sum(cantidad::number) as n", group="dpr_nombre, mnc_nombre")
        m["n"] = pd.to_numeric(m.n)
        m["cod_depto"] = m.dpr_nombre.map(cod_depto)
        munis.append(m.dropna(subset=["cod_depto"]).assign(regimen=reg).rename(columns={"mnc_nombre": "municipio", "n": "afiliados"}))
    nuevo = pd.concat(partes, ignore_index=True)
    ruta = DATOS / "afiliados" / "bdua.csv"
    if ruta.exists():
        viejo = pd.read_csv(ruta, dtype={"cod_depto": str})
        nuevo = pd.concat([viejo[viejo.fecha != hoy], nuevo], ignore_index=True)
    guardar(nuevo[["fecha", "cod_depto", "regimen", "eps", "afiliados"]], "afiliados", "bdua.csv", ["fecha", "cod_depto", "regimen", "eps"])
    m = pd.concat(munis, ignore_index=True).groupby(["cod_depto", "municipio", "regimen"], as_index=False).afiliados.sum()
    guardar(m, "afiliados", "bdua_municipios.csv", ["cod_depto", "municipio", "regimen"])


if __name__ == "__main__":
    main()
