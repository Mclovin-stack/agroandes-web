"""API de AgroAndes.

Ejecutar en desarrollo (desde la carpeta backend):
    uvicorn app.main:app --reload
"""
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

import httpx
import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from pydantic import BaseModel, Field

from . import analisis, clima, db, seguridad
from .esquemas import CAMPOS, CULTIVOS, MUNICIPIOS, RIEGOS, LoteEntrada, LoteSalida, PaginaLotes, mensaje
from .limpieza import cargar

BASE = Path(__file__).resolve().parent
FRONT_DIST = BASE.parent.parent / "frontend" / "dist"


@lru_cache
def csv_original():
    return cargar()


@asynccontextmanager
async def ciclo(_: FastAPI):
    _, limpio = csv_original()
    db.iniciar(limpio)
    yield


app = FastAPI(title="API AgroAndes", version="2.0.0", lifespan=ciclo,
              description="Gestión de lotes, análisis de rendimiento y clima de AgroAndes (Santander).")

# En desarrollo el frontend corre en otro puerto (Vite, 5173)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["*"])


@app.exception_handler(RequestValidationError)
async def errores_validacion(_: Request, exc: RequestValidationError):
    """Devuelve los errores por campo y en español, para mostrarlos en el formulario."""
    errores: dict[str, str] = {}
    for e in exc.errors():
        campo = str(e["loc"][-1]) if e.get("loc") else "general"
        errores.setdefault(campo, mensaje(e))
    resumen = "; ".join(f"{CAMPOS.get(k, k)}: {v}" for k, v in errores.items())
    return JSONResponse(status_code=422, content={"detail": f"Revisa los datos. {resumen}", "errores": errores})


Sesion = Annotated[Session, Depends(db.sesion)]
Admin = Depends(seguridad.requiere_admin)


@app.get("/api/salud")
def salud(s: Sesion):
    return {"estado": "ok", "lotes": s.scalar(select(func.count(db.Lote.id)).where(db.ACTIVO)),
            "base": db.engine.dialect.name}


# ---------------------------------------------------------------- administrador
class Ingreso(BaseModel):
    contrasena: str = Field(min_length=1, max_length=200)


@app.get("/api/admin/estado")
def estado_admin():
    return {"configurado": seguridad.contrasena() is not None}


@app.post("/api/admin/ingresar")
def ingresar(datos: Ingreso, request: Request):
    seguridad.comprobar_contrasena(request, datos.contrasena)
    token, vence = seguridad.crear_token(seguridad.contrasena())
    return {"token": token, "vence": vence}


@app.get("/api/admin/verificar", dependencies=[Admin])
def verificar():
    return {"valido": True}


@app.post("/api/admin/restaurar", dependencies=[Admin])
def restaurar(s: Sesion):
    _, limpio = csv_original()
    return {"lotes": db.restaurar(s, limpio)}


# ---------------------------------------------------------------- análisis
@app.get("/api/opciones")
def opciones(s: Sesion):
    df = db.dataframe(s)
    anios = sorted(int(a) for a in df["anio"].dropna().unique())
    return {
        "municipios": MUNICIPIOS,
        "cultivos": CULTIVOS,
        "riegos": [{"valor": v, "nombre": analisis.RIEGO[v]} for v in RIEGOS],
        "anios": anios,
        "variables": [{"clave": k, "nombre": v["nombre"], "unidad": v["unidad"]} for k, v in analisis.VARIABLES.items()],
    }


@app.get("/api/resumen")
def resumen(s: Sesion):
    df = db.dataframe(s)
    periodo = None
    if len(df):
        periodo = {"desde": df["fecha_cosecha"].min().strftime("%Y-%m"), "hasta": df["fecha_cosecha"].max().strftime("%Y-%m")}
    return {
        "indicadores": analisis.indicadores(df),
        "histograma": analisis.histograma(df),
        "periodo": periodo,
        "origen": {k: int(v) for k, v in s.execute(select(db.Lote.origen, func.count()).where(db.ACTIVO).group_by(db.Lote.origen)).all()},
    }


@app.get("/api/exploracion")
def exploracion(
    s: Sesion,
    municipio: Literal["Barichara", "Charalá", "Mogotes", "Oiba", "San Gil", "Socorro"] | None = None,
    cultivo: Literal["Cacao", "Café", "Caña Panelera", "Fríjol", "Maíz", "Yuca"] | None = None,
    riego: Literal["No", "Goteo", "Aspersión", "Sí"] | None = None,
    anio: int | None = Query(None, ge=2000, le=2100),
    variable: Literal["fertilizante", "precipitacion", "temperatura", "ph", "area"] = "fertilizante",
):
    df = analisis.filtrar(db.dataframe(s), municipio, cultivo, riego, anio)
    return {
        "indicadores": analisis.indicadores(df),
        "por_cultivo": analisis.por_grupo(df, "cultivo"),
        "por_municipio": analisis.por_grupo(df, "municipio"),
        "por_riego": analisis.por_grupo(df, "sistema_riego", analisis.RIEGO),
        "por_trimestre": analisis.por_trimestre(df),
        "por_variable": analisis.por_variable(df, variable),
    }


# ---------------------------------------------------------------- lotes (CRUD)
ORDENES = {
    "recientes": [db.Lote.id.desc()],
    "fecha_desc": [db.Lote.fecha_cosecha.desc(), db.Lote.id.desc()],
    "fecha_asc": [db.Lote.fecha_cosecha.asc(), db.Lote.id.asc()],
    "rendimiento_desc": [db.Lote.rendimiento_ton_ha.desc().nulls_last(), db.Lote.id.desc()],
    "rendimiento_asc": [db.Lote.rendimiento_ton_ha.asc().nulls_last(), db.Lote.id.desc()],
    "area_desc": [db.Lote.area_ha.desc().nulls_last(), db.Lote.id.desc()],
}


@app.get("/api/lotes", response_model=PaginaLotes)
def listar_lotes(
    s: Sesion,
    buscar: str | None = Query(None, max_length=80),
    municipio: str | None = None,
    cultivo: str | None = None,
    riego: str | None = None,
    origen: Literal["historico", "registrado"] | None = None,
    orden: Literal["recientes", "fecha_desc", "fecha_asc", "rendimiento_desc", "rendimiento_asc", "area_desc"] = "recientes",
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, ge=5, le=100),
):
    q = select(db.Lote).where(db.ACTIVO)
    if buscar and buscar.strip():
        b = buscar.strip()
        cond = [db.Lote.nombre.ilike(f"%{b}%")]
        if b.lstrip("#").isdigit():
            cond.append(db.Lote.id == int(b.lstrip("#")))
        q = q.where(or_(*cond))
    if municipio:
        q = q.where(db.Lote.municipio == municipio)
    if cultivo:
        q = q.where(db.Lote.cultivo == cultivo)
    if riego:
        q = q.where(db.Lote.sistema_riego == riego)
    if origen:
        q = q.where(db.Lote.origen == origen)
    total = s.scalar(select(func.count()).select_from(q.subquery()))
    items = s.scalars(q.order_by(*ORDENES[orden]).offset((pagina - 1) * por_pagina).limit(por_pagina)).all()
    return {"total": total, "pagina": pagina, "por_pagina": por_pagina, "items": items}


def _buscar(s: Session, lote_id: int, papelera: bool = False) -> db.Lote:
    """Un lote activo o, con papelera=True, uno que esté en la papelera."""
    lote = s.get(db.Lote, lote_id)
    if not lote or (lote.borrado is not None) != papelera:
        raise HTTPException(404, f"No existe el lote {lote_id}" + (" en la papelera" if papelera else ""))
    return lote


@app.get("/api/lotes/{lote_id}", response_model=LoteSalida)
def ver_lote(lote_id: int, s: Sesion):
    return _buscar(s, lote_id)


@app.post("/api/lotes", response_model=LoteSalida, status_code=201)
def crear_lote(datos: LoteEntrada, s: Sesion):
    lote = db.Lote(**datos.model_dump(), origen="registrado")
    s.add(lote)
    s.commit()
    s.refresh(lote)
    db.marcar_cambio()
    return lote


@app.put("/api/lotes/{lote_id}", response_model=LoteSalida, dependencies=[Admin])
def editar_lote(lote_id: int, datos: LoteEntrada, s: Sesion):
    lote = _buscar(s, lote_id)
    for k, v in datos.model_dump().items():
        setattr(lote, k, v)
    s.commit()
    s.refresh(lote)
    db.marcar_cambio()
    return lote


@app.delete("/api/lotes/{lote_id}", status_code=204, dependencies=[Admin])
def borrar_lote(lote_id: int, s: Sesion):
    """Envía el lote a la papelera: deja de contar en todo, pero se puede recuperar."""
    _buscar(s, lote_id).borrado = datetime.now(timezone.utc)
    s.commit()
    db.marcar_cambio()
    return Response(status_code=204)


# ---------------------------------------------------------------- papelera (solo administrador)
@app.get("/api/papelera", response_model=PaginaLotes, dependencies=[Admin])
def ver_papelera(s: Sesion, pagina: int = Query(1, ge=1), por_pagina: int = Query(20, ge=5, le=100)):
    q = select(db.Lote).where(db.EN_PAPELERA)
    total = s.scalar(select(func.count()).select_from(q.subquery()))
    items = s.scalars(q.order_by(db.Lote.borrado.desc(), db.Lote.id.desc())
                      .offset((pagina - 1) * por_pagina).limit(por_pagina)).all()
    return {"total": total, "pagina": pagina, "por_pagina": por_pagina, "items": items}


@app.post("/api/papelera/{lote_id}/recuperar", response_model=LoteSalida, dependencies=[Admin])
def recuperar_lote(lote_id: int, s: Sesion):
    lote = _buscar(s, lote_id, papelera=True)
    lote.borrado = None
    s.commit()
    s.refresh(lote)
    db.marcar_cambio()
    return lote


@app.delete("/api/papelera/{lote_id}", status_code=204, dependencies=[Admin])
def eliminar_definitivo(lote_id: int, s: Sesion):
    s.delete(_buscar(s, lote_id, papelera=True))
    s.commit()
    return Response(status_code=204)


@app.delete("/api/papelera", dependencies=[Admin])
def vaciar_papelera(s: Sesion):
    n = s.execute(delete(db.Lote).where(db.EN_PAPELERA)).rowcount
    s.commit()
    return {"eliminados": n}


# ---------------------------------------------------------------- clima
def promedios_lotes(s: Session) -> dict:
    prom = db.dataframe(s).groupby("municipio")[["temperatura_c", "precipitacion_mm"]].mean()
    out = {}
    for m in clima.COORDENADAS:
        p = prom.loc[m] if m in prom.index else pd.Series(dtype=float)
        out[m] = {"temperatura_media": analisis.num(p.get("temperatura_c"), 1),
                  "precipitacion_media": analisis.num(p.get("precipitacion_mm"), 0)}
    return out


@app.get("/api/clima")
async def ver_clima(s: Sesion):
    try:
        datos = await clima.consultar()
    except (httpx.HTTPError, KeyError, ValueError) as e:
        motivo = f"{type(e).__name__}: {e}"[:300]
        print("Error consultando el clima:", motivo, flush=True)
        return JSONResponse(status_code=503, content={
            "detail": "El servicio de clima no respondió. Intenta de nuevo en unos minutos.", "motivo": motivo})
    prom = promedios_lotes(s)
    return {**datos, "municipios": [{**m, "lotes": prom[m["municipio"]]} for m in datos["municipios"]]}


@app.get("/api/clima/referencia")
def referencia_clima(s: Sesion):
    """Lo necesario para que el navegador consulte Open-Meteo directamente si el servidor no puede."""
    return {
        "url": clima.URL,
        "parametros": clima.parametros(),
        "municipios": [{"municipio": m, "lat": lat, "lon": lon} for m, (lat, lon) in clima.COORDENADAS.items()],
        "codigos": {str(k): v for k, v in clima.CODIGOS.items()},
        "lotes": promedios_lotes(s),
    }


# ---------------------------------------------------------------- frontend compilado
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
