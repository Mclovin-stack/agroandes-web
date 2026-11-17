from app import clima

NUEVO = {
    "nombre": "Finca La Esperanza", "municipio": "San Gil", "cultivo": "Café", "sistema_riego": "Goteo",
    "fecha_cosecha": "2026-03-15", "area_ha": 4.5, "precipitacion_mm": 1400, "temperatura_c": 22.5,
    "ph_suelo": 6.2, "fertilizante_kg": 900, "produccion_ton": 45, "rendimiento_ton_ha": 10,
}


def test_resumen_con_datos_limpios(cliente):
    r = cliente.get("/api/resumen").json()
    assert "calidad" not in r
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


def test_modelos_ya_no_existe(cliente):
    assert cliente.get("/api/modelos").status_code == 404


def test_listado_paginado_y_filtros(cliente):
    d = cliente.get("/api/lotes", params={"municipio": "Oiba", "por_pagina": 10, "orden": "rendimiento_desc"}).json()
    assert d["total"] > 0 and len(d["items"]) == 10
    assert all(x["municipio"] == "Oiba" for x in d["items"])
    rend = [x["rendimiento_ton_ha"] for x in d["items"] if x["rendimiento_ton_ha"] is not None]
    assert rend == sorted(rend, reverse=True)
    assert cliente.get("/api/lotes", params={"buscar": "#1"}).json()["items"][0]["id"] == 1


def test_crear_editar_borrar(cliente, admin):
    r = cliente.post("/api/lotes", json=NUEVO)
    assert r.status_code == 201
    lote = r.json()
    assert lote["origen"] == "registrado" and lote["nombre"] == "Finca La Esperanza"

    # el análisis lo incluye
    assert cliente.get("/api/resumen").json()["indicadores"]["lotes"] == 5001
    assert cliente.get("/api/lotes", params={"buscar": "esperanza"}).json()["total"] == 1

    # editar
    r = cliente.put(f"/api/lotes/{lote['id']}", json={**NUEVO, "cultivo": "Cacao", "rendimiento_ton_ha": 12.5}, headers=admin)
    assert r.status_code == 200
    assert r.json()["cultivo"] == "Cacao"
    assert cliente.get(f"/api/lotes/{lote['id']}").json()["rendimiento_ton_ha"] == 12.5

    # borrar
    assert cliente.delete(f"/api/lotes/{lote['id']}", headers=admin).status_code == 204
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


def test_borrar_inexistente(cliente, admin):
    assert cliente.delete("/api/lotes/999999", headers=admin).status_code == 404


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


# ---------------------------------------------------------------- administrador
def test_editar_y_borrar_exigen_admin(cliente, admin):
    lote = cliente.post("/api/lotes", json=NUEVO).json()          # registrar sigue abierto
    url = f"/api/lotes/{lote['id']}"
    assert cliente.put(url, json=NUEVO).status_code == 401
    assert cliente.delete(url).status_code == 401
    assert cliente.delete(url, headers={"Authorization": "Bearer inventado"}).status_code == 401
    assert cliente.get(url).status_code == 200                      # sigue ahí
    assert cliente.delete(url, headers=admin).status_code == 204


def test_ingreso_y_limite_de_intentos(cliente):
    assert cliente.get("/api/admin/estado").json() == {"configurado": True}
    r = cliente.post("/api/admin/ingresar", json={"contrasena": "otra"})
    assert r.status_code == 401 and r.json()["detail"] == "Contraseña incorrecta."
    for _ in range(4):
        cliente.post("/api/admin/ingresar", json={"contrasena": "otra"})
    r = cliente.post("/api/admin/ingresar", json={"contrasena": "clave-pruebas"})
    assert r.status_code == 429                                     # bloqueado tras 5 fallos
    from app import seguridad
    seguridad._fallos.clear()
    r = cliente.post("/api/admin/ingresar", json={"contrasena": "clave-pruebas"})
    assert r.status_code == 200
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    assert cliente.get("/api/admin/verificar", headers=h).json() == {"valido": True}


def test_token_vencido_o_alterado():
    from app import seguridad
    token, _ = seguridad.crear_token("clave-pruebas")
    assert seguridad.token_valido(token)
    raw = __import__("base64").urlsafe_b64decode(token).decode()
    vence, firma = raw.split(".", 1)
    alterado = __import__("base64").urlsafe_b64encode(f"{int(vence) + 99999}.{firma}".encode()).decode()
    assert not seguridad.token_valido(alterado)


def test_restaurar_datos_originales(cliente, admin):
    nuevo = cliente.post("/api/lotes", json=NUEVO).json()
    cliente.delete("/api/lotes/1", headers=admin)
    assert cliente.post("/api/admin/restaurar").status_code == 401
    r = cliente.post("/api/admin/restaurar", headers=admin)
    assert r.json() == {"lotes": 5000}
    assert cliente.get("/api/resumen").json()["origen"] == {"historico": 5000}
    assert cliente.get("/api/lotes/1").status_code == 200
    assert cliente.get(f"/api/lotes/{nuevo['id']}").status_code in (200, 404)
    ids = [x["id"] for x in cliente.get("/api/lotes", params={"orden": "recientes", "por_pagina": 5}).json()["items"]]
    assert ids[0] == 5000


# ---------------------------------------------------------------- papelera
def test_papelera_borrar_recuperar_y_eliminar(cliente, admin):
    lote = cliente.post("/api/lotes", json={**NUEVO, "nombre": "Para la papelera"}).json()
    url = f"/api/lotes/{lote['id']}"
    total = cliente.get("/api/resumen").json()["indicadores"]["lotes"]

    # borrar = a la papelera: desaparece de todo
    assert cliente.delete(url, headers=admin).status_code == 204
    assert cliente.get(url).status_code == 404
    assert cliente.put(url, json=NUEVO, headers=admin).status_code == 404
    assert cliente.get("/api/resumen").json()["indicadores"]["lotes"] == total - 1
    assert cliente.get("/api/lotes", params={"buscar": "Para la papelera"}).json()["total"] == 0
    assert cliente.get("/api/salud").json()["lotes"] == total - 1

    # está en la papelera, con su fecha de borrado
    pap = cliente.get("/api/papelera", headers=admin).json()
    assert pap["items"][0]["id"] == lote["id"] and pap["items"][0]["borrado"]

    # recuperar
    r = cliente.post(f"/api/papelera/{lote['id']}/recuperar", headers=admin)
    assert r.status_code == 200 and r.json()["borrado"] is None
    assert cliente.get(url).status_code == 200
    assert cliente.get("/api/resumen").json()["indicadores"]["lotes"] == total
    assert cliente.post(f"/api/papelera/{lote['id']}/recuperar", headers=admin).status_code == 404

    # eliminar definitivamente solo funciona desde la papelera
    assert cliente.delete(f"/api/papelera/{lote['id']}", headers=admin).status_code == 404
    cliente.delete(url, headers=admin)
    assert cliente.delete(f"/api/papelera/{lote['id']}", headers=admin).status_code == 204
    assert cliente.post(f"/api/papelera/{lote['id']}/recuperar", headers=admin).status_code == 404


def test_vaciar_papelera(cliente, admin):
    ids = [cliente.post("/api/lotes", json=NUEVO).json()["id"] for _ in range(3)]
    for i in ids:
        cliente.delete(f"/api/lotes/{i}", headers=admin)
    assert cliente.get("/api/papelera", headers=admin).json()["total"] >= 3
    assert cliente.delete("/api/papelera", headers=admin).json()["eliminados"] >= 3
    assert cliente.get("/api/papelera", headers=admin).json()["total"] == 0


def test_papelera_exige_admin(cliente):
    assert cliente.get("/api/papelera").status_code == 401
    assert cliente.post("/api/papelera/1/recuperar").status_code == 401
    assert cliente.delete("/api/papelera/1").status_code == 401
    assert cliente.delete("/api/papelera").status_code == 401
