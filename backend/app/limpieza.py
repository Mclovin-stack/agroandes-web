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
    """Devuelve (datos originales, datos limpios)."""
    crudo = pd.read_csv(ruta, encoding="utf-8-sig")
    return crudo, limpiar_agrodata(crudo)


def informe_calidad(crudo: pd.DataFrame) -> dict:
    """Cuenta los problemas del archivo original que corrige la limpieza."""
    unicos = crudo.drop_duplicates()
    fert_txt = crudo["fertilizante_kg"].astype(str)
    columnas_nulos = ["area_ha", "precipitacion_mm", "temperatura_c", "fertilizante_kg", "rendimiento_ton_ha"]
    return {
        "filas": int(len(crudo)),
        "duplicadas": int(crudo.duplicated().sum()),
        "lotes_unicos": int(len(unicos)),
        "variantes_cultivo": int(crudo["cultivo"].nunique()),
        "ejemplos_cultivo": sorted(crudo["cultivo"].unique().tolist()),
        "fertilizante_con_kg": int(fert_txt.str.contains("kg", regex=False).sum()),
        "areas_no_positivas": int((unicos["area_ha"] <= 0).sum()),
        "ph_fuera_de_rango": int(((unicos["ph_suelo"] < 3) | (unicos["ph_suelo"] > 10)).sum()),
        "ph_min": float(unicos["ph_suelo"].min()),
        "ph_max": float(unicos["ph_suelo"].max()),
        "rendimientos_mayores_20": int((unicos["rendimiento_ton_ha"] > 20).sum()),
        "rendimiento_max": round(float(unicos["rendimiento_ton_ha"].max()), 1),
        "nulos": {c: int(unicos[c].isna().sum()) for c in columnas_nulos},
    }
