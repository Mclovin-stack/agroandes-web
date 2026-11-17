"""Base de datos de lotes.

En local usa SQLite (archivo backend/agroandes.db). En Render usa PostgreSQL
a través de la variable DATABASE_URL. Al arrancar con la tabla vacía, carga
los 5.000 lotes del CSV ya limpios.
"""
import math
import os
from datetime import date, datetime
from pathlib import Path

import pandas as pd
from sqlalchemy import Date, DateTime, Float, String, create_engine, func, inspect, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

BACKEND = Path(__file__).resolve().parent.parent


def _url() -> str:
    url = os.getenv("DATABASE_URL") or f"sqlite:///{(BACKEND / 'agroandes.db').as_posix()}"
    for prefijo in ("postgres://", "postgresql://"):
        if url.startswith(prefijo):
            return "postgresql+psycopg://" + url[len(prefijo):]
    return url


engine = create_engine(_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Lote(Base):
    __tablename__ = "lotes"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str | None] = mapped_column(String(80))
    municipio: Mapped[str] = mapped_column(String(40), index=True)
    cultivo: Mapped[str] = mapped_column(String(40), index=True)
    sistema_riego: Mapped[str] = mapped_column(String(20))
    fecha_cosecha: Mapped[date] = mapped_column(Date, index=True)
    area_ha: Mapped[float | None] = mapped_column(Float)
    precipitacion_mm: Mapped[float | None] = mapped_column(Float)
    temperatura_c: Mapped[float | None] = mapped_column(Float)
    ph_suelo: Mapped[float | None] = mapped_column(Float)
    fertilizante_kg: Mapped[float | None] = mapped_column(Float)
    produccion_ton: Mapped[float | None] = mapped_column(Float)
    rendimiento_ton_ha: Mapped[float | None] = mapped_column(Float)
    origen: Mapped[str] = mapped_column(String(12), default="registrado", index=True)  # historico | registrado
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    # papelera: con fecha = borrado (no cuenta en ningún cálculo); vacío = activo
    borrado: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)


ACTIVO = Lote.borrado.is_(None)
EN_PAPELERA = Lote.borrado.is_not(None)


def _migrar() -> None:
    """Agrega columnas nuevas a una tabla creada por una versión anterior, sin perder datos."""
    columnas = {c["name"] for c in inspect(engine).get_columns("lotes")}
    if "borrado" not in columnas:
        tipo = "TIMESTAMP WITH TIME ZONE" if engine.dialect.name == "postgresql" else "DATETIME"
        with engine.begin() as con:
            con.execute(text(f"ALTER TABLE lotes ADD COLUMN borrado {tipo}"))
            con.execute(text("CREATE INDEX IF NOT EXISTS ix_lotes_borrado ON lotes (borrado)"))


CAMPOS_NUM = ["area_ha", "precipitacion_mm", "temperatura_c", "ph_suelo", "fertilizante_kg",
              "produccion_ton", "rendimiento_ton_ha"]


def _limpio(v):
    if v is None:
        return None
    v = float(v)
    return None if math.isnan(v) else round(v, 2)


def _cargar_csv(s: Session, limpio: pd.DataFrame) -> int:
    filas = [
        {"municipio": r.municipio, "cultivo": r.cultivo, "sistema_riego": r.sistema_riego,
         "fecha_cosecha": r.fecha_cosecha.date(), "origen": "historico",
         **{c: _limpio(getattr(r, c)) for c in CAMPOS_NUM}}
        for r in limpio.sort_values("id_lote").itertuples()
    ]
    s.execute(Lote.__table__.insert(), filas)
    return len(filas)


def iniciar(limpio: pd.DataFrame) -> None:
    """Crea la tabla y, si está vacía, la llena con los lotes del CSV."""
    Base.metadata.create_all(engine)
    _migrar()
    with SessionLocal() as s:
        if s.scalar(select(func.count(Lote.id))):
            return
        _cargar_csv(s, limpio)
        s.commit()


def restaurar(s: Session, limpio: pd.DataFrame) -> int:
    """Borra todos los lotes y vuelve a cargar los del CSV, con su numeración original (1 a 5.000)."""
    if engine.dialect.name == "postgresql":
        s.execute(text("TRUNCATE TABLE lotes RESTART IDENTITY"))
    else:
        s.execute(Lote.__table__.delete())   # en SQLite el id vuelve a empezar en 1 con la tabla vacía
    n = _cargar_csv(s, limpio)
    s.commit()
    marcar_cambio()
    return n


def sesion():
    with SessionLocal() as s:
        yield s


# --- datos para el análisis, recalculados solo cuando cambian los lotes ---
_cache: dict = {"version": -1, "df": None}
_version = 0


def marcar_cambio() -> None:
    global _version
    _version += 1


def dataframe(s: Session) -> pd.DataFrame:
    if _cache["version"] == _version and _cache["df"] is not None:
        return _cache["df"]
    cols = [Lote.id, Lote.municipio, Lote.cultivo, Lote.sistema_riego, Lote.fecha_cosecha,
            *[getattr(Lote, c) for c in CAMPOS_NUM]]
    filas = s.execute(select(*cols).where(ACTIVO)).all()   # los lotes en la papelera no cuentan
    df = pd.DataFrame(filas, columns=[c.key for c in cols])
    for c in CAMPOS_NUM:
        df[c] = pd.to_numeric(df[c], errors="coerce").astype(float)
    df["fecha_cosecha"] = pd.to_datetime(df["fecha_cosecha"])
    df["anio"] = df["fecha_cosecha"].dt.year
    df["mes"] = df["fecha_cosecha"].dt.month
    _cache.update(version=_version, df=df)
    return df
