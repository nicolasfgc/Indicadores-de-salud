"""
Utilidades compartidas por los programas que descargan los datos.

- bajar(): descarga con reintentos; si el servidor pide esperar (error 429), espera lo que indique.
- soql(): consulta a datos.gov.co (Socrata) y devuelve un DataFrame.
- carpeta_supersalud(): lista los archivos de una carpeta pública del gestor documental de la Supersalud.
- arcgis_supersalud(): busca archivos en el portal de datos abiertos de la Supersalud (ArcGIS).
- guardar(): escribe un CSV en formato largo, ordenado y sin duplicados.
- eps_corta(): nombre corto y estable de cada EPS, venga como venga escrito.
"""
import io
import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
DATOS = RAIZ / "datos"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) indicadores-salud"}
DOCS = "https://docs.supersalud.gov.co"
ARCGIS = "https://mapas.supersalud.gov.co/arcgisportal/sharing/rest"


def bajar(url, intentos=5, timeout=180, cabeceras=None):
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers={**UA, **(cabeceras or {})})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if i == intentos - 1 or (isinstance(e, urllib.error.HTTPError) and e.code in (403, 404)):
                raise RuntimeError(f"No se pudo descargar {url}: {e}") from e
            espera = 10 * (i + 1)
            if isinstance(e, urllib.error.HTTPError) and e.code == 429:
                try:
                    espera = max(int(e.headers.get("Retry-After", 0)), 30 * (i + 1))
                except ValueError:
                    espera = 30 * (i + 1)
            print(f"  reintento {i + 1} en {espera}s ({e})")
            time.sleep(espera)


def soql(conjunto, **params):
    """Consulta un conjunto de datos de datos.gov.co. params = select, where, group, order, limit (sin el $)."""
    params.setdefault("limit", 500000)
    q = urllib.parse.urlencode({f"${k}": v for k, v in params.items()})
    return pd.read_csv(io.BytesIO(bajar(f"https://www.datos.gov.co/resource/{conjunto}.csv?{q}", timeout=300)), dtype=str)


def carpeta_supersalud(sitio, carpeta):
    """Archivos de una biblioteca pública de docs.supersalud.gov.co: lista de dicts con nombre, url y fecha."""
    ruta = f"/PortalWeb/{sitio}/{carpeta}"
    u = (f"{DOCS}/PortalWeb/{sitio}/_api/web/GetFolderByServerRelativeUrl('{urllib.parse.quote(ruta)}')/Files"
         "?$select=Name,ServerRelativeUrl,TimeLastModified&$top=5000")
    d = json.loads(bajar(u, cabeceras={"Accept": "application/json;odata=nometadata"}))
    return [{"nombre": f["Name"], "url": DOCS + urllib.parse.quote(f["ServerRelativeUrl"]), "fecha": f["TimeLastModified"]}
            for f in d.get("value", [])]


def arcgis_supersalud(consulta):
    """Elementos del portal de datos abiertos de la Supersalud que coinciden con la consulta."""
    items, inicio = [], 1
    while 0 < inicio < 5000:
        q = urllib.parse.quote(consulta)
        d = json.loads(bajar(f"{ARCGIS}/search?q={q}&f=json&num=100&start={inicio}"))
        items += d.get("results", [])
        inicio = d.get("nextStart", -1)
    vistos = {}
    for x in items:
        vistos[x["id"]] = x
    return list(vistos.values())


def arcgis_archivo(item_id):
    return bajar(f"{ARCGIS}/content/items/{item_id}/data", timeout=300)


def guardar(df, carpeta, nombre, claves):
    carpeta = DATOS / carpeta
    carpeta.mkdir(parents=True, exist_ok=True)
    if df.duplicated(claves).any():
        raise RuntimeError(f"{carpeta.name}/{nombre}: filas repetidas en {claves}")
    df.sort_values(claves).to_csv(carpeta / nombre, index=False, encoding="utf-8", float_format="%.12g")
    print(f"  {carpeta.name}/{nombre}: {len(df):,} filas")


def llave(x):
    return re.sub(r"[^A-Z0-9]", "", unicodedata.normalize("NFKD", str(x).upper()).encode("ascii", "ignore").decode())


MESES = {"ENE": 1, "FEB": 2, "MAR": 3, "ABR": 4, "MAY": 5, "JUN": 6, "JUL": 7, "AGO": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DIC": 12}
MESES_LARGOS = {"ENERO": 1, "FEBRERO": 2, "MARZO": 3, "ABRIL": 4, "MAYO": 5, "JUNIO": 6, "JULIO": 7, "AGOSTO": 8,
                "SEPTIEMBRE": 9, "SETIEMBRE": 9, "OCTUBRE": 10, "NOVIEMBRE": 11, "DICIEMBRE": 12}


# ---------------------------------------------------------------- EPS: nombre corto
# Cada fuente escribe distinto el nombre de la EPS ("ENTIDAD PROMOTORA DE SALUD SANITAS S.A.S. -CM", "SANITAS", NIT 800251440...).
# Se reconocen por pedazos del nombre; el orden importa (lo más específico primero).
EPS_PATRONES = [
    ("NUEVAEPS", "Nueva EPS"), ("NUEVAEMPRESAPROMOTORA", "Nueva EPS"), ("NARI", "Comfamiliar Nariño"), ("SANITAS", "Sanitas"), ("SURA", "Sura"), ("SALUDTOTAL", "Salud Total"),
    ("ECOOPSOS", "Ecoopsos"), ("FAMISANAR", "Famisanar"), ("COMPENSAR", "Compensar"), ("OCCIDENTAL", "SOS"), ("SOS", "SOS"),
    ("COOSALUD", "Coosalud"), ("MUTUALSER", "Mutual Ser"), ("EMSSANAR", "Emssanar"), ("SAVIA", "Savia Salud"),
    ("ASMET", "Asmet Salud"), ("CAJACOPI", "Cajacopi"), ("PROTEGER", "Cajacopi"), ("CAPITALSALUD", "Capital Salud"),
    ("CAPRESOCA", "Capresoca"), ("COMFENALCOVALLE", "Comfenalco Valle"), ("COMFENALCO", "Comfenalco Valle"),
    ("ALIANSALUD", "Aliansalud"), ("COLMEDICA", "Aliansalud"), ("SALUDMIA", "Salud Mía"),
    ("FAMILIARDECOLOMBIA", "Familiar de Colombia"), ("CCFDESUCRE", "Familiar de Colombia"), ("COMFASUCRE", "Familiar de Colombia"),
    ("COMFAORIENTE", "Comfaoriente"), ("ORIENTE", "Comfaoriente"), ("COMFACHOCO", "Comfachocó"), ("CONMFACHOCO", "Comfachocó"),
    ("CHOCO", "Comfachocó"), ("MALLAMAS", "Mallamas"), ("PIJAOS", "Pijaos Salud"), ("DUSAKAWI", "Dusakawi"),
    ("ANASWAYUU", "Anas Wayuu"), ("ASOCIACIONINDIGENADELCAUCA", "AIC"), ("AIC", "AIC"),
    ("MEDIMAS", "Medimás"), ("COOMEVA", "Coomeva"), ("COMFAMILIARHUILA", "Comfamiliar Huila"), ("AMBUQ", "Ambuq"),
    ("COMPARTA", "Comparta"), ("CRUZBLANCA", "Cruz Blanca"), ("COMFACUNDI", "Comfacundi"),
    ("COMFAMILIARCARTAGENA", "Comfamiliar Cartagena"), ("CONFAMILIARCARTAGENA", "Comfamiliar Cartagena"),
    ("COMFACOR", "Comfacor"), ("GUAJIRA", "CCF La Guajira"), 
    ("CONVIDA", "Convida"), ("SALUDVIDA", "Saludvida"), ("CAFESALUD", "Cafesalud"), ("SALUDCOOP", "Saludcoop"),
    ("SERVICIOOCCIDENTAL", "SOS"), ("COMFAMILIARATLANTICO", "Cajacopi"), ("CAJACOPIATLANTICO", "Cajacopi"),
]

# Intervención forzosa administrativa de la Supersalud (fecha de toma de posesión y, si aplica, de devolución).
# Fuentes: resoluciones de la Supersalud y prensa (Así Vamos en Salud, El Tiempo).
INTERVENIDAS = {
    "Asmet Salud": ("2023-05", None), "Emssanar": ("2023-06", None), "Savia Salud": ("2023-06", "2026-04"),
    "Famisanar": ("2023-09", None), "Nueva EPS": ("2024-04", None), "Sanitas": ("2024-04", "2025-09"),
    "SOS": ("2024-04", None), "Capresoca": ("2024-10", None), "Coosalud": ("2024-11", "2026-04"),
}


def eps_corta(nombre):
    k = llave(nombre)
    for patron, corto in EPS_PATRONES:
        if patron in k:
            return corto
    return str(nombre).strip().title()[:40]
# ---------------------------------------------------------------- departamentos
# Códigos DANE de los departamentos y una función que reconoce sus nombres escritos de cualquier forma
# (con o sin tildes, "Bogotá D.C.", "Archipiélago de San Andrés Prov. y SC", "Distrito Capital"...).
CODIGOS_DEPTO = {"05": "Antioquia", "08": "Atlántico", "11": "Bogotá", "13": "Bolívar", "15": "Boyacá", "17": "Caldas",
                 "18": "Caquetá", "19": "Cauca", "20": "Cesar", "23": "Córdoba", "25": "Cundinamarca", "27": "Chocó",
                 "41": "Huila", "44": "La Guajira", "47": "Magdalena", "50": "Meta", "52": "Nariño", "54": "Norte de Santander",
                 "63": "Quindío", "66": "Risaralda", "68": "Santander", "70": "Sucre", "73": "Tolima", "76": "Valle del Cauca",
                 "81": "Arauca", "85": "Casanare", "86": "Putumayo", "88": "San Andrés", "91": "Amazonas", "94": "Guainía",
                 "95": "Guaviare", "97": "Vaupés", "99": "Vichada"}


def _llave(x):  # noqa: E302
    import re
    import unicodedata
    return re.sub(r"[^A-Z]", "", unicodedata.normalize("NFKD", str(x).upper()).encode("ascii", "ignore").decode())


_POR_NOMBRE = {_llave(v): k for k, v in CODIGOS_DEPTO.items()}


def cod_depto(nombre):
    k = _llave(nombre)
    if k in _POR_NOMBRE:
        return _POR_NOMBRE[k]
    if k.startswith("BOGOTA") or k.startswith("DISTRITOCAPITAL"):
        return "11"
    if "SANANDRES" in k:
        return "88"
    if k == "GUAJIRA":
        return "44"
    if k == "VALLE":
        return "76"
    if k in ("NORTESANTANDER", "NSANTANDER"):
        return "54"
    return None
