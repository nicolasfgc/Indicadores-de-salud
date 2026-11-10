"""
Plata que la ADRES reconoce y gira cada mes a las EPS y, directamente, a hospitales y clínicas.

Fuente: ADRES, "Lupa al giro" (boletín técnico mensual del reconocimiento de la UPC). La UPC (Unidad de Pago por
Capitación) es lo que el Estado le paga a cada EPS por cada afiliado para que le cubra los servicios del plan de beneficios.
Con el giro directo, la ADRES le paga directamente a los hospitales, clínicas y proveedores la parte que la EPS autoriza,
sin que la plata pase por la EPS.

Los datos salen del texto del boletín; si un mes la redacción cambia y una cifra no se reconoce, queda vacía.
Salida: datos/adres/upc_mensual.csv
  fecha | upc_total | upc_subsidiado | upc_contributivo | giro_directo_subsidiado | giro_directo_contributivo   (billones de pesos)
Uso:  python scripts/adres.py
"""
import io
import re
import sys
import time
import urllib.parse
from pathlib import Path

import pandas as pd
from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import DATOS, MESES_LARGOS, bajar, guardar, llave  # noqa: E402

PAGINAS = ["https://www.adres.gov.co/lupa-al-giro", "https://www.adres.gov.co/ips-y-proveedores/lupa-al-giro"]
NUM = r"\$\s?([\d\.]+,\d+|[\d\.]+)\s*(billones|mil millones)"


def a_billones(v, u):
    x = float(v.replace(".", "").replace(",", "."))
    return x / 1000 if u.startswith("mil") else x


def buscar(pat, t):
    m = re.search(pat, t, re.I)
    return a_billones(m.group(1), m.group(2)) if m else None


def leer(contenido):
    t = re.sub(r"\s+", " ", " ".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(contenido)).pages[:4]))
    return {
        "upc_total": buscar(r"reconoci[óo] por concepto de UPC[^$]{0,160}" + NUM, t),
        "upc_subsidiado": buscar(r"r[ée]gimen subsidiado,? (?:el valor de )?la UPC reconocida (?:fue|correspondi[óo] a) " + NUM, t),
        "upc_contributivo": buscar(r"r[ée]gimen contributivo,? (?:el valor de )?la UPC reconocida (?:fue|correspondi[óo] a) " + NUM, t),
        "giro_directo_subsidiado": buscar(r"(?:De los|de los) \$?[\d,]+ (?:billones )?la ADRES gir[óo] directamente " + NUM, t)
        or buscar(r"subsidiado[^.]{0,200}?gir[óo] directamente " + NUM, t),
        "giro_directo_contributivo": buscar(r"contributivo[^.]{0,200}?(?:se )?gira-? ?ron directamente " + NUM, t),
    }


def main():
    print("Giros de la ADRES (Lupa al giro):")
    enlaces = {}
    for p in PAGINAS:
        try:
            h = bajar(p).decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            print(f"  no se pudo abrir {p}: {e}")
            continue
        for u in re.findall(r'href="([^"]+\.pdf)"', h, re.I):
            u = urllib.parse.urljoin(p, u)
            n = llave(urllib.parse.unquote(u.rsplit("/", 1)[-1]))
            if "LUPA" not in n:
                continue
            a = re.search(r"(20\d\d)", n)
            m = next((v for k, v in MESES_LARGOS.items() if k in n), None)
            if a and m:
                enlaces[f"{a.group(1)}-{m:02d}-01"] = u
    ruta = DATOS / "adres" / "upc_mensual.csv"
    viejo = pd.read_csv(ruta) if ruta.exists() else pd.DataFrame(columns=["fecha"])
    filas = [] if not len(viejo) else viejo.to_dict("records")
    tengo = {r["fecha"] for r in filas}
    for f in sorted(enlaces):
        if f in tengo:
            continue
        try:
            r = leer(bajar(enlaces[f]))
        except Exception as e:  # noqa: BLE001
            print(f"  {f}: no se pudo leer ({e})")
            continue
        print(f"  {f}: {r}")
        filas.append({"fecha": f, **r})
        time.sleep(1)
    if not filas:
        raise RuntimeError("No se encontró ningún boletín de la ADRES")
    guardar(pd.DataFrame(filas), "adres", "upc_mensual.csv", ["fecha"])


if __name__ == "__main__":
    main()
