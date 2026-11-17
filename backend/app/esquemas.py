"""Validación de los lotes que se crean o editan desde la página.

Las reglas son las mismas de la limpieza de datos: área positiva,
pH entre 3 y 10 y rendimiento de máximo 20 ton/ha.
"""
from datetime import date, datetime, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

MUNICIPIOS = ["Barichara", "Charalá", "Mogotes", "Oiba", "San Gil", "Socorro"]
CULTIVOS = ["Cacao", "Café", "Caña Panelera", "Fríjol", "Maíz", "Yuca"]
RIEGOS = ["No", "Goteo", "Aspersión", "Sí"]

Municipio = Literal["Barichara", "Charalá", "Mogotes", "Oiba", "San Gil", "Socorro"]
Cultivo = Literal["Cacao", "Café", "Caña Panelera", "Fríjol", "Maíz", "Yuca"]
Riego = Literal["No", "Goteo", "Aspersión", "Sí"]


class LoteEntrada(BaseModel):
    nombre: str | None = Field(None, max_length=80)
    municipio: Municipio
    cultivo: Cultivo
    sistema_riego: Riego
    fecha_cosecha: date
    area_ha: float = Field(gt=0, le=1000)
    precipitacion_mm: float | None = Field(None, ge=0, le=10000)
    temperatura_c: float | None = Field(None, ge=-10, le=50)
    ph_suelo: float | None = Field(None, ge=3, le=10)
    fertilizante_kg: float | None = Field(None, ge=0, le=100000)
    produccion_ton: float | None = Field(None, ge=0, le=100000)
    rendimiento_ton_ha: float | None = Field(None, ge=0, le=20)

    @field_validator("nombre")
    @classmethod
    def nombre_limpio(cls, v: str | None):
        v = (v or "").strip()
        return v or None

    @field_validator("fecha_cosecha")
    @classmethod
    def fecha_razonable(cls, v: date):
        if v < date(2000, 1, 1) or v > date.today() + timedelta(days=366):
            raise ValueError("La fecha debe estar entre el año 2000 y el próximo año")
        return v


class LoteSalida(BaseModel):
    """Lote tal como está guardado (los históricos pueden tener campos nulos tras la limpieza)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str | None = None
    municipio: str
    cultivo: str
    sistema_riego: str
    fecha_cosecha: date
    area_ha: float | None = None
    precipitacion_mm: float | None = None
    temperatura_c: float | None = None
    ph_suelo: float | None = None
    fertilizante_kg: float | None = None
    produccion_ton: float | None = None
    rendimiento_ton_ha: float | None = None
    origen: str
    creado: datetime | None = None
    actualizado: datetime | None = None
    borrado: datetime | None = None


class PaginaLotes(BaseModel):
    total: int
    pagina: int
    por_pagina: int
    items: list[LoteSalida]


# Mensajes en español para los errores de validación más comunes
CAMPOS = {
    "nombre": "Nombre", "municipio": "Municipio", "cultivo": "Cultivo", "sistema_riego": "Sistema de riego",
    "fecha_cosecha": "Fecha de cosecha", "area_ha": "Área", "precipitacion_mm": "Precipitación",
    "temperatura_c": "Temperatura", "ph_suelo": "pH del suelo", "fertilizante_kg": "Fertilizante",
    "produccion_ton": "Producción", "rendimiento_ton_ha": "Rendimiento",
}


def _n(v) -> str:
    """Límite numérico legible: 0.0 -> 0, 10.5 -> 10,5."""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).replace(".", ",")


def mensaje(err: dict) -> str:
    t, ctx = err.get("type", ""), {k: (_n(v) if isinstance(v, (int, float)) else v) for k, v in (err.get("ctx") or {}).items()}
    if t == "missing":
        return "Es obligatorio"
    if t == "greater_than":
        return f"Debe ser mayor que {ctx.get('gt')}"
    if t == "greater_than_equal":
        return f"Debe ser mayor o igual a {ctx.get('ge')}"
    if t == "less_than_equal":
        return f"Debe ser menor o igual a {ctx.get('le')}"
    if t == "less_than":
        return f"Debe ser menor que {ctx.get('lt')}"
    if t == "literal_error":
        return "No es una opción válida"
    if t in ("float_parsing", "float_type", "int_parsing"):
        return "Debe ser un número"
    if t.startswith("date"):
        return "Fecha no válida"
    if t == "string_too_long":
        return f"Máximo {ctx.get('max_length')} caracteres"
    if t == "value_error":
        return str(ctx.get("error", err.get("msg", "Valor no válido")))
    return err.get("msg", "Valor no válido")
