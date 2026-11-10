"""
¿Qué EPS cumplen con el patrimonio mínimo que exige la ley? (Supersalud, indicador de patrimonio adecuado)

El patrimonio adecuado es el colchón de plata propia que una EPS debe tener para responder por sus deudas con hospitales
y clínicas (Decretos 2702 de 2014, 647 de 2022 y 489 de 2024). La Supersalud publica cada mes un informe con las EPS que
lo cumplen ("SI") o no ("NO"); cada informe trae los tres últimos meses.

Fuente: gestor documental de la Supersalud, Supervisión de Riesgos (carpetas de EPS del régimen contributivo y subsidiado).
Salida: datos/finanzas/patrimonio_adecuado.csv   mes | eps | cumple (1 sí, 0 no)
Uso:  python scripts/patrimonio.py
"""
import io
import re
import sys
import time
from pathlib import Path

import pandas as pd
from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import DATOS, MESES, bajar, carpeta_supersalud, eps_corta, guardar, llave  # noqa: E402

CARPETAS = [("SupervisionRiesgos", "EstadisticasEPSRegimenContributivo"), ("SupervisionRiesgos", "EstadisticasEPSRegimenSubsidiado")]


def leer(contenido):
    t = "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(contenido)).pages)
    out = []
    meses = None
    for linea in t.splitlines():
        cab = re.findall(r"\b([A-Za-z]{3})\.?\s?-?(\d{2})\b", linea)
        cab = [(MESES.get(llave(m)[:3]), a) for m, a in cab if llave(m)[:3] in MESES]
        if len(cab) >= 2 and not re.search(r"\b(SI|NO)\b", linea):
            meses = [f"20{a}-{m:02d}" for m, a in cab]
            continue
        v = re.findall(r"\b(SI|SÍ|NO)\b", linea.upper())
        if meses and len(v) == len(meses):
            nombre = re.split(r"\s+\b(?:SI|SÍ|NO)\b", linea.upper())[0].strip(" *")
            if len(nombre) < 3 or llave(nombre).startswith(("ENTIDAD", "EPS")) and len(llave(nombre)) < 5:
                continue
            for mes, x in zip(meses, v):
                out.append({"mes": mes, "eps": eps_corta(nombre), "cumple": 0 if x == "NO" else 1})
    return pd.DataFrame(out)


def main():
    print("Patrimonio adecuado de las EPS (Supersalud):")
    archivos = {}
    for s, c in CARPETAS:
        for f in carpeta_supersalud(s, c):
            n = llave(f["nombre"])
            if f["nombre"].lower().endswith(".pdf") and ("PATRIMONIOADECUADO" in n or n.startswith("DECRETO647")):
                archivos[f["nombre"]] = f
    ruta = DATOS / "finanzas" / "patrimonio_adecuado.csv"
    viejo = pd.read_csv(ruta) if ruta.exists() else pd.DataFrame(columns=["mes", "eps", "cumple", "archivo"])
    hechos = set(viejo.get("archivo", pd.Series(dtype=str)))
    partes = [viejo] if len(viejo) else []
    for n, f in sorted(archivos.items(), key=lambda x: x[1]["fecha"]):
        if n in hechos:
            continue
        try:
            d = leer(bajar(f["url"]))
        except Exception as e:  # noqa: BLE001
            print(f"  {n}: no se pudo leer ({e})")
            continue
        if len(d):
            partes.append(d.assign(archivo=n, publicado=f["fecha"][:10]))
        print(f"  {n}: {len(d)} datos")
        time.sleep(0.5)
    df = pd.concat(partes, ignore_index=True)
    # si un mes aparece en varios informes, vale el publicado más reciente
    df = df.sort_values("publicado").drop_duplicates(["mes", "eps"], keep="last")
    guardar(df[["mes", "eps", "cumple", "archivo", "publicado"]], "finanzas", "patrimonio_adecuado.csv", ["mes", "eps"])


if __name__ == "__main__":
    main()
