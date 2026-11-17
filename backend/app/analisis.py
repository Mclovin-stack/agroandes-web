"""Cálculos que alimentan los gráficos de la página."""
import math

import numpy as np
import pandas as pd

RIEGO = {"No": "Sin riego", "Goteo": "Goteo", "Aspersión": "Aspersión", "Sí": "Sin especificar"}

# Variables que se pueden poner en el eje horizontal del explorador
VARIABLES = {
    "fertilizante": {"col": "fertilizante_kg", "nombre": "Fertilizante", "unidad": "kg", "min": 0, "max": 2500, "tramos": 10},
    "precipitacion": {"col": "precipitacion_mm", "nombre": "Precipitación", "unidad": "mm", "min": 400, "max": 2600, "tramos": 11},
    "temperatura": {"col": "temperatura_c", "nombre": "Temperatura", "unidad": "°C", "min": 15, "max": 33, "tramos": 9},
    "ph": {"col": "ph_suelo", "nombre": "pH del suelo", "unidad": "", "min": 4.5, "max": 8.5, "tramos": 8},
    "area": {"col": "area_ha", "nombre": "Área", "unidad": "ha", "min": 0, "max": 20, "tramos": 10},
}

REND = "rendimiento_ton_ha"


def num(x, dec: int = 2):
    """Número listo para JSON: NaN pasa a None."""
    if x is None:
        return None
    x = float(x)
    return None if math.isnan(x) else round(x, dec)


def filtrar(df: pd.DataFrame, municipio=None, cultivo=None, riego=None, anio=None) -> pd.DataFrame:
    m = pd.Series(True, index=df.index)
    if municipio:
        m &= df["municipio"] == municipio
    if cultivo:
        m &= df["cultivo"] == cultivo
    if riego:
        m &= df["sistema_riego"] == riego
    if anio:
        m &= df["anio"] == anio
    return df[m]


def opciones(df: pd.DataFrame) -> dict:
    return {
        "municipios": sorted(df["municipio"].unique().tolist()),
        "cultivos": sorted(df["cultivo"].unique().tolist()),
        "riegos": [{"valor": v, "nombre": RIEGO.get(v, v)} for v in sorted(df["sistema_riego"].unique())],
        "anios": sorted(int(a) for a in df["anio"].unique()),
        "variables": [{"clave": k, "nombre": v["nombre"], "unidad": v["unidad"]} for k, v in VARIABLES.items()],
    }


def indicadores(df: pd.DataFrame) -> dict:
    return {
        "lotes": int(len(df)),
        "lotes_con_rendimiento": int(df[REND].notna().sum()),
        "rendimiento_medio": num(df[REND].mean()),
        "area_total": num(df["area_ha"].sum(), 0),
        "produccion_total": num(df["produccion_ton"].sum(), 0),
        "fertilizante_medio": num(df["fertilizante_kg"].mean(), 0),
    }


def por_grupo(df: pd.DataFrame, col: str, etiquetas: dict | None = None) -> list[dict]:
    g = df.groupby(col)[REND].agg(["mean", "count"]).reset_index()
    g = g.sort_values("mean", ascending=False, na_position="last")
    return [{"nombre": (etiquetas or {}).get(r[col], r[col]), "rendimiento": num(r["mean"]), "lotes": int(r["count"])}
            for _, r in g.iterrows()]


def histograma(df: pd.DataFrame) -> list[dict]:
    y = df[REND].dropna()
    tramo = np.minimum(np.floor(y), 18).astype(int)
    conteo = tramo.value_counts()
    return [{"desde": i, "hasta": i + 1, "lotes": int(conteo.get(i, 0))} for i in range(19)]


def por_trimestre(df: pd.DataFrame) -> list[dict]:
    d = df.assign(t=(df["mes"] - 1) // 3 + 1)
    g = d.groupby(["anio", "t"])[REND].agg(["mean", "count"]).reset_index()
    return [{"anio": int(r["anio"]), "trimestre": int(r["t"]), "rendimiento": num(r["mean"]), "lotes": int(r["count"])}
            for _, r in g.iterrows()]


def por_variable(df: pd.DataFrame, clave: str) -> dict:
    v = VARIABLES[clave]
    col = v["col"]
    paso = (v["max"] - v["min"]) / v["tramos"]
    tramos = []
    for b in range(v["tramos"]):
        lo = v["min"] + b * paso
        hi = lo + paso
        ultimo = b == v["tramos"] - 1
        sel = df[(df[col] >= lo) & ((df[col] <= hi) if ultimo else (df[col] < hi))]
        tramos.append({"desde": num(lo), "hasta": num(hi), "rendimiento": num(sel[REND].mean()),
                       "lotes": int(sel[REND].notna().sum())})
    par = df[[col, REND]].dropna()
    r = par[col].corr(par[REND]) if len(par) >= 10 else None
    return {"clave": clave, "nombre": v["nombre"], "unidad": v["unidad"], "tramos": tramos, "correlacion": num(r, 3)}


def correlaciones(df: pd.DataFrame) -> list[dict]:
    out = []
    for clave, v in VARIABLES.items():
        par = df[[v["col"], REND]].dropna()
        out.append({"clave": clave, "nombre": v["nombre"], "r": num(par[v["col"]].corr(par[REND]), 3)})
    return out


def rangos(df: pd.DataFrame) -> list[dict]:
    filas = [(v["nombre"], v["col"], v["unidad"]) for v in VARIABLES.values()]
    filas.append(("Rendimiento", REND, "ton/ha"))
    return [{"nombre": n, "unidad": u, "min": num(df[c].min()), "max": num(df[c].max()), "media": num(df[c].mean())}
            for n, c, u in filas]
