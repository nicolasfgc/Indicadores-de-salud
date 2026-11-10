"""Sondeo temporal 2: guarda HTML crudo de páginas clave y baja archivos de muestra."""
import sys, urllib.request, pathlib, time, re
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
S = "https://www.supersalud.gov.co/es-co/Paginas/"
COSAS = {
 "sup_financiera.html": S + "Delegada%20Supervision%20de%20Riesgos/informacion-financiera-EPS-EMP-SAP-regimenes-de-excepcion-y-especiales.aspx",
 "sup_pqrd.html": S + "Protecci%C3%B3n%20al%20Usuario/reportes-de-peticiones-quejas-reclamos-o-denuncias.aspx",
 "sup_afil.html": S + "Delegada%20Supervisi%C3%B3n%20Institucional/Indicadores-de-Afiliaciones.aspx",
 "sup_calidad.html": S + "Delegada%20Supervisi%C3%B3n%20Institucional/Indicadores-de-Calidad-EPS.aspx",
 "sup_alerta.html": S + "Delegada%20Supervisi%C3%B3n%20Institucional/Indicadores-de-Alerta-Temprana.aspx",
 "sispro_afil.html": "https://www.sispro.gov.co/Pages/Consulta-predefinidia-afiliaciones.aspx",
 "adres_upc.html": "https://www.adres.gov.co/eps/reconocimientos-upc",
 "adres_bdua_rep.html": "https://www.adres.gov.co/eps/procesos/bdua/reportes",
 "adres_lma.html": "https://www.adres.gov.co/eps/procesos/regimen-subsidiado/resumen-lma",
 "adres_gdh.html": "https://www.adres.gov.co/eps/giro-directo/regimen-subsidiado/giro-directo-historico",
 "invima_home.html": "https://www.invima.gov.co/",
 "gd_rs_ago2026.xlsx": "https://www.adres.gov.co/api/media/file/RS-Agosto_2026.xlsx",
 "gd_tipo_jun2026.xlsx": "https://www.adres.gov.co/api/media/file/gd-giro-tipo-contratacion-giro-directo-discriminado-capita-y-evento-junio-2026.xlsx",
 "lupa_ago2026.pdf": "https://www.adres.gov.co/api/media/file/Boletin_lupa_al_giro_UPC_Agosto_2026.pdf",
}
for nombre, u in COSAS.items():
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=60)
        (OUT / nombre).write_bytes(r.read()); print("ok", nombre)
    except Exception as e:
        print("ERR", nombre, e)
    time.sleep(1)
