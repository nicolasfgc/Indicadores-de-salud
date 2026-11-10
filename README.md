# Salud en Colombia en datos

👉 **Explorador:** https://nicolasfgc.github.io/Indicadores-de-salud/ — cómo están las EPS, cuántos afiliados tienen, de qué se quejan los pacientes, qué pasó con las EPS intervenidas, cuánta plata gira el Estado y cómo le va a la medicina prepagada.

Por **Nicolás González** · nicolasfgcht@gmail.com · [LinkedIn](https://www.linkedin.com/in/nicolas-gonzalezc/)

Todos los datos son oficiales y públicos. Una tarea automática de GitHub los descarga todos los días a las 10 de la mañana (hora Colombia) y guarda los cambios cuando hay datos nuevos, así que el explorador siempre muestra lo último.

## Qué hay hoy

| Tema | Detalle | Desde | Fuente |
|---|---|---|---|
| Cuentas de las EPS | Activos, deudas (pasivos), patrimonio, ingresos, costo de atender pacientes y ganancia o pérdida de cada EPS | Diciembre 2021 (trimestral hasta 2024, mensual desde 2025) | Supersalud, portal de datos abiertos (FT001) |
| Patrimonio adecuado | Qué EPS cumplen cada mes con el patrimonio mínimo que exige la ley | 2023 | Supersalud |
| Medicina y ambulancia prepagada | Las mismas cuentas para cada empresa | Diciembre 2021, trimestral | Supersalud (FT001) |
| Quejas y reclamos | Reclamos de los pacientes cada mes: total, por EPS (con tasa por 10.000 afiliados), por motivo y por departamento | 2017 | Supersalud, reportes PQRD |
| Afiliados por EPS | Afiliados de cada EPS por régimen, cada mes | Septiembre 2018 | Supersalud, informes ejecutivos |
| Afiliados por departamento | Contributivo y subsidiado por departamento, municipio y EPS | Noviembre 2026 (una foto por mes desde entonces) | ADRES, BDUA en datos.gov.co |
| UPC y giro directo | Plata reconocida a las EPS cada mes y parte que se paga directo a hospitales y clínicas | Octubre 2024 | ADRES, boletines “Lupa al giro” |

## Cómo están organizados los datos (`datos/`)

- `finanzas/eps.csv` y `finanzas/prepagada.csv`: `corte | nit | entidad | catalogo | codigo | denominacion | valor` (pesos). Solo cuentas de primer y segundo nivel del plan de cuentas. Ingresos, gastos y costos son acumulados desde enero hasta el corte.
- `finanzas/patrimonio_adecuado.csv`: `mes | eps | cumple`.
- `quejas/mensual.csv`: `anio | mes | tabla | categoria | valor`, con `tabla` = `tipo`, `depto`, `macromotivo`, `motivo`, `eps_c`, `eps_s`, `eps_i`.
- `quejas/eps_mes.csv`: `fecha | regimen | eps | afiliados | reclamos`.
- `afiliados/bdua.csv`: `fecha | cod_depto | regimen | eps | afiliados`.
- `adres/upc_mensual.csv`: UPC reconocida y giro directo por régimen, en billones de pesos.

## Notas

- **Nueva EPS** no le reporta sus estados financieros a la Supersalud desde marzo de 2024. Los totales de las cuentas la excluyen en todos los cortes para que se puedan comparar en el tiempo.
- **Planes de cuentas:** las EPS privadas usan el catálogo de la Supersalud (cuenta 6 = costos de atender pacientes; el resultado está en la cuenta de cierre 56). Las públicas (Savia Salud, Capital Salud, Capresoca, EPS indígenas) usan el de la Contaduría General (costos en las cuentas 56 y 53 —incluye reservas técnicas— y resultado en la 59).
- **Quejas:** hasta 2022 la Supersalud las llamaba PQRD; desde 2023, “reclamos en salud”. En 2024 cambió la clasificación de motivos. Un aumento puede ser peor servicio o más gente que conoce el canal.
- **ADRES:** las cifras salen del texto de cada boletín; si la redacción cambia, ese mes queda vacío.
- **Intervenciones:** fechas de toma de posesión y devolución en `scripts/comun.py` (`INTERVENIDAS`).
- Lo que no está: atenciones, consultas o cirugías por EPS (RIPS del Ministerio de Salud), que solo se consultan en tableros interactivos.

## Fuentes

- Superintendencia Nacional de Salud: [portal de datos abiertos](https://mapas.supersalud.gov.co/arcgisportal/apps/sites/#/datos-abiertos), [información financiera de las EPS](https://www.supersalud.gov.co/es-co/Paginas/Delegada%20Supervision%20de%20Riesgos/informacion-financiera-EPS-EMP-SAP-regimenes-de-excepcion-y-especiales.aspx), [reportes de PQRD](https://www.supersalud.gov.co/es-co/Paginas/Protecci%C3%B3n%20al%20Usuario/reportes-de-peticiones-quejas-reclamos-o-denuncias.aspx)
- ADRES: [Lupa al giro](https://www.adres.gov.co/lupa-al-giro); BDUA en datos.gov.co ([subsidiado](https://www.datos.gov.co/d/d7a5-cnra), [contributivo](https://www.datos.gov.co/d/tq4m-hmg2))

Proyectos hermanos: [Economía](https://github.com/nicolasfgc/Indicadores-economia-colombiana) · [Educación](https://github.com/nicolasfgc/Indicadores-educativos) · [Seguridad](https://github.com/nicolasfgc/Indicadores-seguridad)
