# Página web AgroAndes

Aplicación web del análisis de productividad agrícola de AgroAndes (Santander).
Autores: Yohiner, Carlos Manuel y Manuel.

## Tecnologías

| Parte | Tecnología | Para qué |
|---|---|---|
| Backend | Python 3.13, **FastAPI**, **pandas**, Uvicorn | Guarda los lotes, valida los datos, calcula los gráficos y consulta el clima |
| Frontend | **React 19**, **TypeScript**, **Vite** | Interfaz con filtros, gráficos SVG propios y diseño adaptable a celular |
| Pruebas | pytest | Verifican la carga de datos, el registro, edición y borrado de lotes, la validación y el clima |

## Estructura

```
pagina-web/
├── backend/
│   ├── app/
│   │   ├── main.py         # API (rutas /api/...) y entrega del frontend compilado
│   │   ├── db.py           # base de datos de lotes (SQLite local, PostgreSQL en Render)
│   │   ├── esquemas.py     # validación de lotes y mensajes en español
│   │   ├── clima.py        # clima en vivo desde Open-Meteo
│   │   ├── limpieza.py     # limpieza del CSV antes de cargarlo en la base de datos
│   │   ├── analisis.py     # indicadores, agrupaciones, histograma, correlaciones
│   ├── data/02_AgroData_Productividad_Agricola.csv
│   ├── tests/test_api.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # navegación entre Panel, Lotes y Clima
│   │   ├── Panel.tsx       # cifras generales y explorador de rendimiento
│   │   ├── Lotes.tsx       # tabla de lotes y confirmación de borrado
│   │   ├── FormLote.tsx    # formulario para crear y editar lotes
│   │   ├── Clima.tsx       # clima actual y pronóstico
│   │   ├── Explorador.tsx  # filtros y gráficos que consultan la API
│   │   ├── graficos.tsx    # barras, línea, histograma y tooltip
│   │   ├── api.ts          # tipos y llamadas al backend
│   │   └── estilos.css     # diseño, modo claro y oscuro
│   └── package.json
└── iniciar.bat             # arranca todo en Windows con doble clic
```

## Qué se puede hacer en la página

- **Panel**: cifras generales de los lotes y explorador de rendimiento con filtros por municipio, cultivo, riego y año. Los gráficos se recalculan con cada lote nuevo, editado o borrado.
- **Lotes**: registrar terrenos nuevos, editarlos y borrarlos (con confirmación). Tabla con búsqueda por nombre o número, filtros, orden y paginación. El formulario valida con las mismas reglas de la limpieza (área positiva, pH entre 3 y 10, rendimiento hasta 20 ton/ha), calcula el rendimiento a partir de producción y área, y puede llenar la temperatura con la del día.
- **Clima**: temperatura, humedad, lluvia y viento actuales de los 6 municipios, pronóstico de 7 días y comparación con la temperatura media registrada en los lotes. Fuente: Open-Meteo.

## Base de datos

Los 5.000 lotes del CSV se cargan limpios en la base de datos la primera vez que arranca el servidor. En local se usa SQLite (`backend/agroandes.db`); en Render, PostgreSQL mediante la variable `DATABASE_URL`. Para volver a los datos originales en local, basta con borrar `backend/agroandes.db` y reiniciar.

## API

| Ruta | Devuelve |
|---|---|
| `GET /api/salud` | Estado del servidor y número de lotes |
| `GET /api/opciones` | Municipios, cultivos, riegos, años y variables para los filtros |
| `GET /api/resumen` | Indicadores generales e histograma del rendimiento |
| `GET /api/exploracion?municipio=&cultivo=&riego=&anio=&variable=` | Indicadores y gráficos según los filtros |
| `GET /api/lotes?buscar=&municipio=&cultivo=&riego=&origen=&orden=&pagina=&por_pagina=` | Lista paginada de lotes |
| `GET /api/lotes/{id}` | Un lote |
| `POST /api/lotes` | Crea un lote (errores de validación en español, por campo) |
| `PUT /api/lotes/{id}` | Edita un lote |
| `DELETE /api/lotes/{id}` | Borra un lote |
| `GET /api/clima` | Clima actual y pronóstico de 7 días por municipio |

Con el servidor encendido, la documentación interactiva está en http://localhost:8000/docs

## Cómo ejecutarla

Requisitos: Python 3.11 o superior y Node.js 20 o superior.

### Opción rápida (Windows)

Doble clic en `iniciar.bat`. La primera vez instala todo (tarda unos minutos). Luego abre http://localhost:8000

### Paso a paso

```bash
# 1. Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # en Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt

# 2. Frontend (compilarlo una vez)
cd ../frontend
npm install
npm run build

# 3. Encender el servidor (sirve la API y la página)
cd ../backend
uvicorn app.main:app --port 8000
```

Abrir http://localhost:8000

### Modo desarrollo (cambios en vivo)

En dos terminales:

```bash
cd backend  && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev        # abre http://localhost:5173
```

### Pruebas

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

## Publicación en Render

El proyecto incluye `Dockerfile` y `render.yaml`. Render compila el frontend, instala el backend y sirve todo desde un solo servicio web gratuito.

1. Subir esta carpeta a un repositorio de GitHub.
2. En https://dashboard.render.com elegir **New → Blueprint**, conectar el repositorio y pulsar **Apply**.
3. Cuando termine, la página queda en `https://agroandes-XXXX.onrender.com`. Cada `git push` la vuelve a publicar.

`render.yaml` también crea una base PostgreSQL gratuita (`agroandes-db`) y se la pasa al servidor en `DATABASE_URL`, para que los lotes registrados no se pierdan cuando el servidor se reinicia.

En el plan gratuito el servicio se duerme tras 15 minutos sin visitas; la primera visita después tarda cerca de un minuto en despertar. La base de datos gratuita de Render tiene fecha de vencimiento: revísala en el panel de la base de datos.

## Notas

- Para analizar datos nuevos, reemplazar `backend/data/02_AgroData_Productividad_Agricola.csv` por otro con las mismas columnas y reiniciar el servidor.
