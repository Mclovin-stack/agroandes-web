"""Acceso de administrador.

La contraseña se lee de la variable de entorno ADMIN_PASSWORD (en Render se
configura en Environment, nunca en el código). En el computador local, si no
está definida, se usa la contraseña de desarrollo "agroandes".

Al iniciar sesión el servidor entrega un token firmado con HMAC que vence en
8 horas; cambiar la contraseña invalida todos los tokens.
"""
import base64
import hashlib
import hmac
import os
import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException, Request

DURACION_TOKEN = 8 * 3600          # segundos
INTENTOS_MAX = 5                    # intentos fallidos permitidos...
VENTANA_INTENTOS = 5 * 60           # ...en esta ventana de tiempo (segundos)
CLAVE_LOCAL = "agroandes"


def contrasena() -> str | None:
    clave = os.getenv("ADMIN_PASSWORD")
    if clave:
        return clave
    # En Render (variable RENDER definida) no hay contraseña por defecto: hay que configurarla
    return None if os.getenv("RENDER") else CLAVE_LOCAL


def _secreto(clave: str) -> bytes:
    return hashlib.sha256(("agroandes-token:" + clave).encode()).digest()


def crear_token(clave: str) -> tuple[str, int]:
    vence = int(time.time()) + DURACION_TOKEN
    firma = hmac.new(_secreto(clave), str(vence).encode(), hashlib.sha256).hexdigest()
    token = base64.urlsafe_b64encode(f"{vence}.{firma}".encode()).decode()
    return token, vence


def token_valido(token: str) -> bool:
    clave = contrasena()
    if not clave or not token:
        return False
    try:
        vence_txt, firma = base64.urlsafe_b64decode(token.encode()).decode().split(".", 1)
        vence = int(vence_txt)
    except (ValueError, UnicodeDecodeError):
        return False
    esperada = hmac.new(_secreto(clave), vence_txt.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(firma, esperada) and vence > time.time()


# Límite de intentos fallidos por dirección IP, para frenar a quien pruebe contraseñas al azar
_fallos: dict[str, deque] = defaultdict(deque)


def _ip(request: Request) -> str:
    reenviada = request.headers.get("x-forwarded-for", "")
    return reenviada.split(",")[0].strip() or (request.client.host if request.client else "desconocida")


def comprobar_contrasena(request: Request, intento: str) -> None:
    clave = contrasena()
    if not clave:
        raise HTTPException(503, "El administrador no está configurado: define ADMIN_PASSWORD en el servidor.")
    ip, ahora = _ip(request), time.time()
    fallos = _fallos[ip]
    while fallos and ahora - fallos[0] > VENTANA_INTENTOS:
        fallos.popleft()
    if len(fallos) >= INTENTOS_MAX:
        espera = int(VENTANA_INTENTOS - (ahora - fallos[0])) // 60 + 1
        raise HTTPException(429, f"Demasiados intentos fallidos. Espera {espera} min e intenta de nuevo.")
    if not hmac.compare_digest(intento.encode(), clave.encode()):
        fallos.append(ahora)
        raise HTTPException(401, "Contraseña incorrecta.")
    fallos.clear()


def requiere_admin(authorization: str | None = Header(None)) -> None:
    """Dependencia de FastAPI para las rutas que solo puede usar el administrador."""
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not token_valido(token):
        raise HTTPException(401, "Necesitas iniciar sesión como administrador para hacer esto.")
