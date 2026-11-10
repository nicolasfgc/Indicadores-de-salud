"""Sondeo temporal 4: listados completos (SharePoint REST y ArcGIS) y archivos de muestra de la Supersalud."""
import sys, json, urllib.request, urllib.parse, pathlib, time
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
def get(u, t=90, acc=None):
    h = {"User-Agent": UA}
    if acc: h["Accept"] = acc
    return urllib.request.urlopen(urllib.request.Request(u, headers=h), timeout=t).read()
D = "https://docs.supersalud.gov.co"
CARPETAS = {"pqrd": ("ProteccionUsuario", "EstadisticasPQRD"), "pqrd_mensual": ("ProteccionUsuario", "Informe PQRD Mensual"),
            "pqrd_informe": ("ProteccionUsuario", "Informe PQRD"),
            "fin_contrib": ("SupervisionRiesgos", "EstadisticasEPSRegimenContributivo"), "fin_subs": ("SupervisionRiesgos", "EstadisticasEPSRegimenSubsidiado"),
            "fin_prepagada": ("SupervisionRiesgos", "Estadisticas Entidades de medicina prepagada"),
            "afil": ("SupervisionInstitucional", "IndicadoresAfiliacion"), "calidad": ("SupervisionInstitucional", "IndicadoresCalidadEAPB")}
listas = {}
for k, (sitio, carpeta) in CARPETAS.items():
    ruta = f"/PortalWeb/{sitio}/{carpeta}"
    u = f"{D}/PortalWeb/{sitio}/_api/web/GetFolderByServerRelativeUrl('{urllib.parse.quote(ruta)}')/Files?$select=Name,ServerRelativeUrl,TimeLastModified,Length&$top=5000"
    try:
        d = json.loads(get(u, acc="application/json;odata=nometadata"))
        listas[k] = sorted([(f["TimeLastModified"], f["Name"], f["ServerRelativeUrl"], f.get("Length")) for f in d.get("value", [])])
        print("ok", k, len(listas[k]))
    except Exception as e:
        listas[k] = str(e); print("ERR", k, e)
json.dump(listas, open(OUT / "listas.json", "w"), ensure_ascii=False, indent=0)
P = "https://mapas.supersalud.gov.co/arcgisportal/sharing/rest"
items = []
for q in ["owner:Supersalud", "financiera", "PQRD", "afiliados", "EPS", "prepagada", "type:\"Microsoft Excel\"", "type:CSV"]:
    start = 1
    try:
        while start > 0 and start < 2000:
            d = json.loads(get(f"{P}/search?q={urllib.parse.quote(q)}&f=json&num=100&start={start}"))
            items += [{k: x.get(k) for k in ("id", "title", "type", "modified", "owner", "name", "size")} for x in d.get("results", [])]
            print("arcgis", q, d.get("total"), d.get("error")); start = d.get("nextStart", -1); time.sleep(0.5)
    except Exception as e:
        print("ERR arcgis", q, e)
json.dump(items, open(OUT / "arcgis_items.json", "w"), ensure_ascii=False, indent=0)
# muestras: lo más reciente de cada carpeta
for k in ["pqrd", "pqrd_mensual", "fin_contrib", "fin_subs", "fin_prepagada", "pqrd_informe"]:
    L = listas.get(k)
    if not isinstance(L, list) or not L: continue
    for t, n, ruta, _ in L[-2:]:
        try:
            (OUT / f"m_{k}_{n.replace(' ', '_')}").write_bytes(get(D + urllib.parse.quote(ruta))); print("bajado", k, n)
        except Exception as e: print("ERR bajar", n, e)
try:
    (OUT / "arc_788.xls").write_bytes(get(f"{P}/content/items/788a7d8601c74c748ade2151c59e2ad0/data")); print("ok arc 788")
except Exception as e: print("ERR arc", e)
