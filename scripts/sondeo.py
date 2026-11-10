"""Sondeo temporal: revisa qué páginas de fuentes de salud se dejan bajar y qué archivos enlazan."""
import re, sys, json, urllib.request, urllib.parse, time
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
SEMILLAS = [
 "https://www.supersalud.gov.co/es-co", "https://www.supersalud.gov.co/es-co/nuestra-entidad/cifras-y-estadisticas",
 "https://www.supersalud.gov.co/es-co/delegada-supervision-riesgos", "https://docs.supersalud.gov.co/",
 "https://www.adres.gov.co/", "https://www.adres.gov.co/datos-abiertos", "https://www.adres.gov.co/eps/giro-directo",
 "https://www.minsalud.gov.co/proteccionsocial/Paginas/cifras-aseguramiento-salud.aspx",
 "https://www.minsalud.gov.co/proteccionsocial/Paginas/aseguramiento-al-sistema-general-de-salud.aspx",
 "https://www.invima.gov.co/", "https://www.invima.gov.co/medicamentos-y-productos-biologicos/desabastecimiento",
 "https://www.sispro.gov.co/", "https://portalsivigila.ins.gov.co/",
]
CLAVE = re.compile(r"(financ|estad|cifra|pqr|queja|giro|upc|afilia|desabast|datos|indicador|eps|medicin|prepag|informe|reporte|boletin)", re.I)
ARCH = re.compile(r"\.(xlsx?|csv|zip|xlsb)(\?|$)", re.I)
def bajar(u):
    r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "es-CO,es"}), timeout=40)
    return r.status, r.geturl(), r.read(3_000_000).decode("utf-8", "replace")
vistos, out = set(), []
cola = [(u, 0) for u in SEMILLAS]
while cola and len(vistos) < 120:
    u, d = cola.pop(0)
    if u in vistos: continue
    vistos.add(u)
    try:
        st, fin, h = bajar(u)
    except Exception as e:
        out.append({"url": u, "error": str(e)[:150]}); continue
    links = set()
    for m in re.finditer(r'href=["\']([^"\'#]+)["\'][^>]*>([^<]{0,120})', h):
        l = urllib.parse.urljoin(fin, m.group(1).strip()); links.add((l, " ".join(m.group(2).split())))
    arch = sorted([l for l in links if ARCH.search(l[0])])
    pdfs = sorted([l for l in links if l[0].lower().endswith(".pdf") and CLAVE.search(l[0] + l[1])])[:40]
    pags = sorted([l for l in links if CLAVE.search(l[0] + " " + l[1]) and not ARCH.search(l[0]) and not l[0].lower().endswith(".pdf")])
    titulo = re.search(r"<title>([^<]*)", h)
    out.append({"url": u, "estado": st, "final": fin, "tam": len(h), "titulo": titulo.group(1).strip()[:100] if titulo else "",
                "bloqueo": bool(re.search(r"(captcha|radware|access denied|cloudflare|perfdrive)", h[:20000], re.I)),
                "archivos": arch[:80], "pdfs": pdfs, "paginas": pags[:80]})
    if d < 2:
        dom = urllib.parse.urlparse(u).netloc
        for l, t in pags:
            if urllib.parse.urlparse(l).netloc.endswith(dom.replace("www.", "")) and l not in vistos: cola.append((l, d + 1))
    time.sleep(1)
json.dump(out, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
