"""Sondeo temporal 3: catálogo del portal de datos abiertos de la Supersalud (ArcGIS) y carpetas de docs."""
import sys, json, urllib.request, urllib.parse, pathlib, time
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
def get(u, t=60):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=t).read()
P = "https://mapas.supersalud.gov.co/arcgisportal/sharing/rest"
items, start = [], 1
try:
    while start > 0 and len(items) < 3000:
        d = json.loads(get(f"{P}/search?q=" + urllib.parse.quote("NOT type:\"Code Attachment\"") + f"&f=json&num=100&start={start}&sortField=modified&sortOrder=desc"))
        items += [{k: x.get(k) for k in ("id", "title", "type", "modified", "snippet", "owner", "url", "size", "tags")} for x in d.get("results", [])]
        start = d.get("nextStart", -1); time.sleep(0.5)
except Exception as e:
    print("ERR search", e)
json.dump(items, open(OUT / "arcgis_items.json", "w"), ensure_ascii=False, indent=0)
print("items", len(items))
for f, u in {"docs_pqrd.html": "https://docs.supersalud.gov.co/PortalWeb/ProteccionUsuario/EstadisticasPQRD/",
             "docs_pqrd_mensual.html": "https://docs.supersalud.gov.co/PortalWeb/ProteccionUsuario/Informe%20PQRD%20Mensual/",
             "docs_fin_contrib.html": "https://docs.supersalud.gov.co/PortalWeb/SupervisionRiesgos/EstadisticasEPSRegimenContributivo/",
             "docs_prepagada.html": "https://docs.supersalud.gov.co/PortalWeb/SupervisionRiesgos/Estadisticas%20Entidades%20de%20medicina%20prepagada/",
             "docs_afil.html": "https://docs.supersalud.gov.co/PortalWeb/SupervisionInstitucional/IndicadoresAfiliacion/",
             "item_fin.json": f"{P}/content/items/788a7d8601c74c748ade2151c59e2ad0?f=json"}.items():
    try: (OUT / f).write_bytes(get(u)); print("ok", f)
    except Exception as e: print("ERR", f, e)
