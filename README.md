# Página web AgroAndes · Caso 2 AgroData

Aplicación web del análisis de productividad agrícola de AgroAndes (Santander).
Autores: Yohiner, Carlos Manuel y Manuel.

## Tecnologías

| Parte | Tecnología | Para qué |
|---|---|---|
| Backend | Python 3.13, **FastAPI**, **pandas**, Uvicorn | Lee el CSV, aplica la misma limpieza de los notebooks y calcula los datos de los gráficos |
| Frontend | **React 19**, **TypeScript**, **Vite** | Interfaz con filtros, gráficos SVG propios y diseño adaptable a celular |
| Pruebas | pytest | Verifican que la API devuelve las cifras del informe (5.000 lotes, 4.782 con rendimiento, 9,27 ton/ha) |

## Estructura

```
pagina-web/
├── backend/
│   ├── app/
│   │   ├── main.py         # API (rutas /api/...) y entrega del frontend compilado
│   │   ├── limpieza.py     # función limpiar_agrodata (igual a los notebooks)
│   │   ├── analisis.py     # indicadores, agrupaciones, histograma, correlaciones
│   │   └── modelos.json    # resultados de los modelos (tomados del informe)
│   ├── data/02_AgroData_Productividad_Agricola.csv
│   ├── tests/test_api.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # secciones de la página
│   │   ├── Explorador.tsx  # filtros y gráficos que consultan la API
│   │   ├── Modelos.tsx     # resultados de los tres notebooks
│   │   ├── graficos.tsx    # barras, línea, histograma y tooltip
│   │   ├── api.ts          # tipos y llamadas al backend
│   │   └── estilos.css     # diseño, modo claro y oscuro
│   └── package.json
└── iniciar.bat             # arranca todo en Windows con doble clic
```

## API

| Ruta | Devuelve |
|---|---|
| `GET /api/salud` | Estado del servidor |
| `GET /api/opciones` | Municipios, cultivos, riegos, años y variables para los filtros |
| `GET /api/resumen` | Problemas de calidad del CSV, rangos, correlaciones e histograma |
| `GET /api/exploracion?municipio=&cultivo=&riego=&anio=&variable=` | Indicadores y gráficos según los filtros |
| `GET /api/modelos` | Resultados de regresión, XGBoost, clasificación y K-Means |

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

En el plan gratuito el servicio se duerme tras 15 minutos sin visitas; la primera visita después tarda cerca de un minuto en despertar.

## Notas

- Los resultados de los modelos vienen del informe escrito, porque los notebooks se ejecutaron en Colab y no guardaron sus salidas.
- Para analizar datos nuevos, reemplazar `backend/data/02_AgroData_Productividad_Agricola.csv` por otro con las mismas columnas y reiniciar el servidor.
