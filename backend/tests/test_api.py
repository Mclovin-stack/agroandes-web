from app import clima

NUEVO = {
    "nombre": "Finca La Esperanza", "municipio": "San Gil", "cultivo": "Café", "sistema_riego": "Goteo",
    "fecha_cosecha": "2026-03-15", "area_ha": 4.5, "precipitacion_mm": 1400, "temperatura_c": 22.5,
    "ph_suelo": 6.2, "fertilizante_kg": 900, "produccion_ton": 45, "rendimiento_ton_ha": 10,
}


def test_limpieza_coincide_con_informe(cliente):
    r = cliente.get("/api/resumen").json()
    cal = r["calidad"]
    assert (cal["filas"], cal["duplicadas"], cal["lotes_unicos"]) == (5100, 100, 5000)
    ind = r["indicadores"]
    assert ind["lotes"] == 5000
    assert ind["lotes_con_rendimiento"] == 4782
    assert round(ind["rendimiento_medio"], 2) == 9.27
    assert sum(b["lotes"] for b in r["histograma"]) == 4782
    assert r["origen"] == {"historico": 5000}


def test_opciones(cliente):
    op = cliente.get("/api/opciones").json()
    assert len(op["municipios"]) == 6
    assert op["cultivos"] == ["Cacao", "Café", "Caña Panelera", "Fríjol", "Maíz", "Yuca"]
    assert op["anios"] == [2023, 2024, 2025, 2026]


def test_exploracion_con_filtros(cliente):
    r = cliente.get("/api/exploracion", params={"cultivo": "Café", "anio": 2024, "variable": "ph"})
    assert r.status_code == 200
    d = r.json()
    assert 0 < d["indicadores"]["lotes"] < 5000
    assert [g["nombre"] for g in d["por_cultivo"]] == ["Café"]
    assert len(d["por_variable"]["tramos"]) == 8


def test_exploracion_sin_resultados_no_falla(cliente):
    r = cliente.get("/api/exploracion", params={"anio": 2030})
    assert r.status_code == 200
    assert r.json()["indicadores"]["lotes"] == 0


def test_valores_invalidos(cliente):
    assert cliente.get("/api/exploracion", params={"cultivo": "Arroz"}).status_code == 422
    assert cliente.get("/api/exploracion", params={"variable": "altitud"}).status_code == 422


def test_modelos(cliente):
    m = cliente.get("/api/modelos").json()
    assert m["regresion"]["resultados"][0]["rmse"] == 5.07
    assert len(m["kmeans"]["grupos"]) == 4


def test_listado_paginado_y_filtros(cliente):
    d = cliente.get("/api/lotes", params={"municipio": "Oiba", "por_pagina": 10, "orden": "rendimiento_desc"}).json()
    assert d["total"] > 0 and len(d["items"]) == 10
    assert all(x["municipio"] == "Oiba" for x in d["items"])
    rend = [x["rendimiento_ton_ha"] for x in d["items"] if x["rendimiento_ton_ha"] is not None]
    assert rend == sorted(rend, reverse=True)
    assert cliente.get("/api/lotes", params={"buscar": "#1"}).json()["items"][0]["id"] == 1


def test_crear_editar_borrar(cliente):
    r = cliente.post("/api/lotes", json=NUEVO)
    assert r.status_code == 201
    lote = r.json()
    assert lote["origen"] == "registrado" and lote["nombre"] == "Finca La Esperanza"

    # el análisis lo incluye
    assert cliente.get("/api/resumen").json()["indicadores"]["lotes"] == 5001
    assert cliente.get("/api/lotes", params={"buscar": "esperanza"}).json()["total"] == 1

    # editar
    r = cliente.put(f"/api/lotes/{lote['id']}", json={**NUEVO, "cultivo": "Cacao", "rendimiento_ton_ha": 12.5})
    assert r.status_code == 200
    assert r.json()["cultivo"] == "Cacao"
    assert cliente.get(f"/api/lotes/{lote['id']}").json()["rendimiento_ton_ha"] == 12.5

    # borrar
    assert cliente.delete(f"/api/lotes/{lote['id']}").status_code == 204
    assert cliente.get(f"/api/lotes/{lote['id']}").status_code == 404
    assert cliente.get("/api/resumen").json()["indicadores"]["lotes"] == 5000


def test_validacion_en_espanol(cliente):
    malo = {**NUEVO, "area_ha": 0, "ph_suelo": 12, "cultivo": "Arroz", "rendimiento_ton_ha": 50}
    r = cliente.post("/api/lotes", json=malo)
    assert r.status_code == 422
    e = r.json()["errores"]
    assert e["area_ha"] == "Debe ser mayor que 0"
    assert e["ph_suelo"] == "Debe ser menor o igual a 10"
    assert e["cultivo"] == "No es una opción válida"
    assert e["rendimiento_ton_ha"] == "Debe ser menor o igual a 20"
    sin_mun = {k: v for k, v in NUEVO.items() if k != "municipio"}
    assert cliente.post("/api/lotes", json=sin_mun).json()["errores"]["municipio"] == "Es obligatorio"


def test_borrar_inexistente(cliente):
    assert cliente.delete("/api/lotes/999999").status_code == 404


def test_clima(cliente, monkeypatch):
    def respuesta(n):
        return {"current": {"time": "2026-11-17T10:00", "temperature_2m": 24.0 + n, "apparent_temperature": 25.0,
                            "relative_humidity_2m": 70, "precipitation": 0.0, "weather_code": 2, "wind_speed_10m": 8.0, "is_day": 1},
                "daily": {"time": ["2026-11-17"], "temperature_2m_max": [28.0], "temperature_2m_min": [17.0],
                          "precipitation_sum": [3.2], "precipitation_probability_max": [60], "weather_code": [61]}}

    async def falso():
        return {"fuente": "Open-Meteo", "consultado": "",
                "municipios": [clima.convertir(m, respuesta(i)) for i, m in enumerate(clima.COORDENADAS)]}

    monkeypatch.setattr(clima, "consultar", falso)
    d = cliente.get("/api/clima").json()
    assert len(d["municipios"]) == 6
    sg = next(m for m in d["municipios"] if m["municipio"] == "San Gil")
    assert sg["actual"]["descripcion"] == "Parcialmente nublado"
    assert sg["diario"][0]["descripcion"] == "Lluvia ligera"
    assert 15 <= sg["lotes"]["temperatura_media"] <= 33


def test_clima_caido(cliente, monkeypatch):
    import httpx

    async def falla():
        raise httpx.ConnectError("sin red")

    monkeypatch.setattr(clima, "consultar", falla)
    assert cliente.get("/api/clima").status_code == 503


def test_referencia_clima(cliente):
    d = cliente.get("/api/clima/referencia").json()
    assert len(d["municipios"]) == 6
    assert d["codigos"]["61"] == ["Lluvia ligera", "lluvia"]
    assert d["parametros"]["forecast_days"] == 7
    assert 15 <= d["lotes"]["San Gil"]["temperatura_media"] <= 33
