"""Carga y limpieza del CSV de AgroAndes.

La función `limpiar_agrodata` es la misma que usan los tres notebooks,
para que la página muestre exactamente los datos con los que se modeló.
"""
from pathlib import Path

import numpy as np
import pandas as pd

RUTA_CSV = Path(__file__).resolve().parent.parent / "data" / "02_AgroData_Productividad_Agricola.csv"


def limpiar_agrodata(d: pd.DataFrame) -> pd.DataFrame:
    d = d.copy()
    d = d.drop_duplicates()

    # Cultivo normalizado
    d["cultivo"] = (d["cultivo"].str.strip().str.lower()
                    .replace({"maiz": "maíz", "cafe": "café"}).str.title())

    # Fertilizante a numérico
    d["fertilizante_kg"] = pd.to_numeric(
        d["fertilizante_kg"].astype(str).str.replace("kg", "", regex=False).str.strip(),
        errors="coerce")

    # Valores imposibles -> NaN
    d.loc[d["area_ha"] <= 0, "area_ha"] = np.nan
    d.loc[(d["ph_suelo"] < 3) | (d["ph_suelo"] > 10), "ph_suelo"] = np.nan
    d.loc[d["rendimiento_ton_ha"] > 20, "rendimiento_ton_ha"] = np.nan   # atípicos extremos

    # Fecha -> año y mes
    d["fecha_cosecha"] = pd.to_datetime(d["fecha_cosecha"])
    d["anio"] = d["fecha_cosecha"].dt.year
    d["mes"] = d["fecha_cosecha"].dt.month
    return d


def cargar(ruta: Path = RUTA_CSV) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Devuelve (datos originales, datos limpios). Los limpios se cargan en la base de datos."""
    crudo = pd.read_csv(ruta, encoding="utf-8-sig")
    return crudo, limpiar_agrodata(crudo)
