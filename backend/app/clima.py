"""Clima actual y pronóstico de 7 días para los municipios, desde Open-Meteo (gratis, sin clave)."""
import asyncio
import time

import httpx

URL = "https://api.open-meteo.com/v1/forecast"
DURACION_CACHE = 15 * 60  # segundos

COORDENADAS = {
    "Barichara": (6.6357, -73.2232),
    "Charalá": (6.2875, -73.1471),
    "Mogotes": (6.4754, -72.9707),
    "Oiba": (6.2647, -73.2987),
    "San Gil": (6.5550, -73.1336),
    "Socorro": (6.4681, -73.2601),
}

# Códigos WMO que usa Open-Meteo -> (descripción, categoría del ícono)
CODIGOS = {
    0: ("Despejado", "sol"), 1: ("Mayormente despejado", "sol"), 2: ("Parcialmente nublado", "nubes-sol"),
    3: ("Nublado", "nubes"), 45: ("Niebla", "niebla"), 48: ("Niebla con escarcha", "niebla"),
    51: ("Llovizna ligera", "lluvia"), 53: ("Llovizna", "lluvia"), 55: ("Llovizna intensa", "lluvia"),
    56: ("Llovizna helada", "lluvia"), 57: ("Llovizna helada intensa", "lluvia"),
    61: ("Lluvia ligera", "lluvia"), 63: ("Lluvia", "lluvia"), 65: ("Lluvia fuerte", "lluvia"),
    66: ("Lluvia helada", "lluvia"), 67: ("Lluvia helada fuerte", "lluvia"),
    71: ("Nieve ligera", "nubes"), 73: ("Nieve", "nubes"), 75: ("Nieve fuerte", "nubes"), 77: ("Granizo fino", "nubes"),
    80: ("Chubascos ligeros", "lluvia"), 81: ("Chubascos", "lluvia"), 82: ("Chubascos fuertes", "lluvia"),
    85: ("Chubascos de nieve", "nubes"), 86: ("Chubascos de nieve fuertes", "nubes"),
    95: ("Tormenta", "tormenta"), 96: ("Tormenta con granizo", "tormenta"), 99: ("Tormenta fuerte con granizo", "tormenta"),
}


def describir(codigo: int | None) -> tuple[str, str]:
    return CODIGOS.get(int(codigo) if codigo is not None else -1, ("Sin dato", "nubes"))


def convertir(municipio: str, d: dict) -> dict:
    """Pasa la respuesta de Open-Meteo de un municipio a un formato sencillo en español."""
    a = d["current"]
    desc, icono = describir(a.get("weather_code"))
    dia = d["daily"]
    diario = []
    for i, fecha in enumerate(dia["time"]):
        dd, di = describir(dia["weather_code"][i])
        diario.append({"fecha": fecha, "maxima": dia["temperature_2m_max"][i], "minima": dia["temperature_2m_min"][i],
                       "lluvia_mm": dia["precipitation_sum"][i], "prob_lluvia": dia["precipitation_probability_max"][i],
                       "descripcion": dd, "icono": di})
    lat, lon = COORDENADAS[municipio]
    return {
        "municipio": municipio, "lat": lat, "lon": lon,
        "actual": {"hora": a.get("time"), "temperatura": a.get("temperature_2m"), "sensacion": a.get("apparent_temperature"),
                   "humedad": a.get("relative_humidity_2m"), "lluvia_mm": a.get("precipitation"),
                   "viento_kmh": a.get("wind_speed_10m"), "es_dia": bool(a.get("is_day", 1)),
                   "descripcion": desc, "icono": icono},
        "diario": diario,
    }


def parametros() -> dict:
    """Consulta a Open-Meteo para todos los municipios a la vez (la usa también el navegador como respaldo)."""
    nombres = list(COORDENADAS)
    return {
        "latitude": ",".join(str(COORDENADAS[n][0]) for n in nombres),
        "longitude": ",".join(str(COORDENADAS[n][1]) for n in nombres),
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code",
        "timezone": "America/Bogota",
        "forecast_days": 7,
    }


_cache: dict = {"t": 0.0, "datos": None}
_candado = asyncio.Lock()


async def consultar() -> dict:
    async with _candado:
        if _cache["datos"] and time.time() - _cache["t"] < DURACION_CACHE:
            return _cache["datos"]
        nombres = list(COORDENADAS)
        params = parametros()
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(URL, params=params)
            r.raise_for_status()
            crudo = r.json()
        lista = crudo if isinstance(crudo, list) else [crudo]
        datos = {"fuente": "Open-Meteo", "consultado": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                 "municipios": [convertir(n, d) for n, d in zip(nombres, lista)]}
        _cache.update(t=time.time(), datos=datos)
        return datos
