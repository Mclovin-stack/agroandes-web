"""API de AgroAndes.

Ejecutar en desarrollo (desde la carpeta backend):
    uvicorn app.main:app --reload
"""
import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import analisis
from .limpieza import cargar, informe_calidad

BASE = Path(__file__).resolve().parent
FRONT_DIST = BASE.parent.parent / "frontend" / "dist"

app = FastAPI(title="API AgroAndes", version="1.0.0",
              description="Datos y resultados del Caso 2 AgroData: productividad agrícola en Santander.")

# En desarrollo el frontend corre en otro puerto (Vite, 5173)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["GET"], allow_headers=["*"])


@lru_cache
def datos():
    crudo, limpio = cargar()
    return crudo, limpio


@app.get("/api/salud")
def salud():
    _, limpio = datos()
    return {"estado": "ok", "lotes": int(len(limpio))}


@app.get("/api/opciones")
def opciones():
    _, limpio = datos()
    return analisis.opciones(limpio)


@app.get("/api/resumen")
def resumen():
    crudo, limpio = datos()
    return {
        "calidad": informe_calidad(crudo),
        "indicadores": analisis.indicadores(limpio),
        "rangos": analisis.rangos(limpio),
        "correlaciones": analisis.correlaciones(limpio),
        "histograma": analisis.histograma(limpio),
        "periodo": {"desde": limpio["fecha_cosecha"].min().strftime("%Y-%m"),
                    "hasta": limpio["fecha_cosecha"].max().strftime("%Y-%m")},
    }


@app.get("/api/exploracion")
def exploracion(
    municipio: str | None = None,
    cultivo: str | None = None,
    riego: str | None = None,
    anio: int | None = Query(None, ge=2000, le=2100),
    variable: Literal["fertilizante", "precipitacion", "temperatura", "ph", "area"] = "fertilizante",
):
    _, limpio = datos()
    op = analisis.opciones(limpio)
    if municipio and municipio not in op["municipios"]:
        raise HTTPException(422, f"Municipio desconocido: {municipio}")
    if cultivo and cultivo not in op["cultivos"]:
        raise HTTPException(422, f"Cultivo desconocido: {cultivo}")
    if riego and riego not in analisis.RIEGO:
        raise HTTPException(422, f"Sistema de riego desconocido: {riego}")

    df = analisis.filtrar(limpio, municipio, cultivo, riego, anio)
    return {
        "indicadores": analisis.indicadores(df),
        "por_cultivo": analisis.por_grupo(df, "cultivo"),
        "por_municipio": analisis.por_grupo(df, "municipio"),
        "por_riego": analisis.por_grupo(df, "sistema_riego", analisis.RIEGO),
        "por_trimestre": analisis.por_trimestre(df),
        "por_variable": analisis.por_variable(df, variable),
    }


@app.get("/api/modelos")
def modelos():
    return json.loads((BASE / "modelos.json").read_text(encoding="utf-8"))


# En producción el mismo servidor entrega el frontend ya compilado
if FRONT_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONT_DIST / "assets"), name="assets")

    @app.get("/{ruta:path}", include_in_schema=False)
    def frontend(ruta: str):
        if ruta.startswith("api/"):
            raise HTTPException(404, "Ruta de la API no encontrada")
        archivo = (FRONT_DIST / ruta).resolve()
        if ruta and archivo.is_file() and FRONT_DIST.resolve() in archivo.parents:
            return FileResponse(archivo)
        return FileResponse(FRONT_DIST / "index.html")
