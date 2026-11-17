from fastapi.testclient import TestClient

from app.main import app

cliente = TestClient(app)


def test_limpieza_coincide_con_informe():
    r = cliente.get("/api/resumen").json()
    cal = r["calidad"]
    assert cal["filas"] == 5100
    assert cal["duplicadas"] == 100
    assert cal["lotes_unicos"] == 5000
    ind = r["indicadores"]
    assert ind["lotes"] == 5000
    assert ind["lotes_con_rendimiento"] == 4782
    assert round(ind["rendimiento_medio"], 2) == 9.27
    assert sum(b["lotes"] for b in r["histograma"]) == 4782


def test_opciones():
    op = cliente.get("/api/opciones").json()
    assert len(op["municipios"]) == 6
    assert op["cultivos"] == ["Cacao", "Café", "Caña Panelera", "Fríjol", "Maíz", "Yuca"]


def test_exploracion_con_filtros():
    r = cliente.get("/api/exploracion", params={"cultivo": "Café", "anio": 2024, "variable": "ph"})
    assert r.status_code == 200
    d = r.json()
    assert 0 < d["indicadores"]["lotes"] < 5000
    assert [g["nombre"] for g in d["por_cultivo"]] == ["Café"]
    assert d["por_variable"]["clave"] == "ph"
    assert len(d["por_variable"]["tramos"]) == 8


def test_exploracion_sin_resultados_no_falla():
    r = cliente.get("/api/exploracion", params={"anio": 2030})
    assert r.status_code == 200
    assert r.json()["indicadores"]["lotes"] == 0


def test_valores_invalidos():
    assert cliente.get("/api/exploracion", params={"cultivo": "Arroz"}).status_code == 422
    assert cliente.get("/api/exploracion", params={"variable": "altitud"}).status_code == 422


def test_modelos():
    m = cliente.get("/api/modelos").json()
    assert m["regresion"]["resultados"][0]["rmse"] == 5.07
    assert len(m["kmeans"]["grupos"]) == 4
