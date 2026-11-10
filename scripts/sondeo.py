"""Sondeo temporal 5: muestras de FT001 (EPS y prepagada) y PQRD de varios años."""
import sys, json, urllib.request, urllib.parse, pathlib, time, re
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
def get(u, t=180):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=t).read()
P = "https://mapas.supersalud.gov.co/arcgisportal/sharing/rest/content/items"
for n, i in {"eps_2026_06.csv": "f2028f663c96483c984c2be293d35a31", "eps_2022_q4.csv": "a1d8277468e947f28142a4e61d39e05c",
             "eps_2025_01.csv": "373695c6ddcd484185c94020b1da0356", "emp_2026_q2.csv": "9366c84edc2347139a106b153401aa30",
             "emp_2021_q4.csv": "c1a554a31d3b4a128e878b595ba7c8fa"}.items():
    try: (OUT / n).write_bytes(get(f"{P}/{i}/data")); print("ok", n)
    except Exception as e: print("ERR", n, e)
D = "https://docs.supersalud.gov.co"
for sitio, carpeta, pat in [("ProteccionUsuario", "EstadisticasPQRD", r"diciembre"), ("ProteccionUsuario", "Informe PQRD Mensual", r"diciembre")]:
    ruta = f"/PortalWeb/{sitio}/{carpeta}"
    d = json.loads(urllib.request.urlopen(urllib.request.Request(f"{D}/PortalWeb/{sitio}/_api/web/GetFolderByServerRelativeUrl('{urllib.parse.quote(ruta)}')/Files?$select=Name,ServerRelativeUrl&$top=5000",
        headers={"User-Agent": UA, "Accept": "application/json;odata=nometadata"}), timeout=60).read())
    for f in d["value"]:
        if re.search(pat, f["Name"], re.I) and re.search(r"20(17|18|19|20|21|22|23|24|25)", f["Name"]):
            try: (OUT / ("pq_" + carpeta[:8].replace(" ", "") + "_" + f["Name"].replace(" ", "_"))).write_bytes(get(D + urllib.parse.quote(f["ServerRelativeUrl"]))); print("ok", f["Name"])
            except Exception as e: print("ERR", f["Name"], e)
            time.sleep(0.5)
