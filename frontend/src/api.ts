// Tipos de las respuestas del backend y funciones para pedirlas

export interface Grupo { nombre: string; rendimiento: number | null; lotes: number }
export interface Indicadores {
  lotes: number; lotes_con_rendimiento: number; rendimiento_medio: number | null
  area_total: number | null; produccion_total: number | null; fertilizante_medio: number | null
}
export interface Tramo { desde: number; hasta: number; rendimiento: number | null; lotes: number }
export interface Opciones {
  municipios: string[]; cultivos: string[]
  riegos: { valor: string; nombre: string }[]
  anios: number[]
  variables: { clave: ClaveVariable; nombre: string; unidad: string }[]
}
export type ClaveVariable = 'fertilizante' | 'precipitacion' | 'temperatura' | 'ph' | 'area'

export interface Resumen {
  calidad: {
    filas: number; duplicadas: number; lotes_unicos: number; variantes_cultivo: number; ejemplos_cultivo: string[]
    fertilizante_con_kg: number; areas_no_positivas: number; ph_fuera_de_rango: number; ph_min: number; ph_max: number
    rendimientos_mayores_20: number; rendimiento_max: number; nulos: Record<string, number>
  }
  indicadores: Indicadores
  rangos: { nombre: string; unidad: string; min: number; max: number; media: number }[]
  correlaciones: { clave: string; nombre: string; r: number }[]
  histograma: { desde: number; hasta: number; lotes: number }[]
  periodo: { desde: string; hasta: string } | null
  origen: Record<string, number>
}

export interface Exploracion {
  indicadores: Indicadores
  por_cultivo: Grupo[]; por_municipio: Grupo[]; por_riego: Grupo[]
  por_trimestre: { anio: number; trimestre: number; rendimiento: number | null; lotes: number }[]
  por_variable: { clave: ClaveVariable; nombre: string; unidad: string; tramos: Tramo[]; correlacion: number | null }
}

export interface Modelos {
  fuente: string
  regresion: { notebook: string; lotes_prueba: number; particion: string
    resultados: { modelo: string; r2: number; rmse: number; mae: number; base?: boolean }[] }
  boosting: { notebook: string; particion: string; nota_cv: string
    regresion: { modelo: string; rmse: number; r2: number; base?: boolean }[]
    clasificacion: { modelo: string; exactitud: number; base?: boolean }[] }
  kmeans: { notebook: string; k: number; silueta: number; silueta_rango: string
    grupos: { grupo: number; fertilizante: number; ph: number; precipitacion: number; rendimiento: number; lectura: string }[] }
}

export interface Filtros { municipio: string; cultivo: string; riego: string; anio: string }

// ---- lotes
export interface LoteDatos {
  nombre: string | null; municipio: string; cultivo: string; sistema_riego: string; fecha_cosecha: string
  area_ha: number | null; precipitacion_mm: number | null; temperatura_c: number | null; ph_suelo: number | null
  fertilizante_kg: number | null; produccion_ton: number | null; rendimiento_ton_ha: number | null
}
export interface Lote extends LoteDatos {
  id: number; origen: 'historico' | 'registrado'; creado: string | null; actualizado: string | null
}
export interface PaginaLotes { total: number; pagina: number; por_pagina: number; items: Lote[] }
export interface ConsultaLotes {
  buscar: string; municipio: string; cultivo: string; riego: string; origen: string
  orden: string; pagina: number; por_pagina: number
}

// ---- clima
export interface DiaClima { fecha: string; maxima: number; minima: number; lluvia_mm: number; prob_lluvia: number | null; descripcion: string; icono: string }
export interface ClimaMunicipio {
  municipio: string; lat: number; lon: number
  actual: { hora: string; temperatura: number; sensacion: number; humedad: number; lluvia_mm: number; viento_kmh: number; es_dia: boolean; descripcion: string; icono: string }
  diario: DiaClima[]
  lotes: { temperatura_media: number | null; precipitacion_media: number | null }
}
export interface Clima { fuente: string; consultado: string; municipios: ClimaMunicipio[] }

/** Error de la API con los mensajes por campo (cuando el servidor rechaza un formulario). */
export class ErrorApi extends Error {
  constructor(mensaje: string, public estado: number, public errores: Record<string, string> = {}) { super(mensaje) }
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let r: Response
  try {
    r = await fetch(ruta, { ...opciones, headers: { 'Content-Type': 'application/json', ...opciones.headers } })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ErrorApi('No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.', 0)
  }
  if (r.status === 204) return undefined as T
  const cuerpo = await r.json().catch(() => ({}))
  if (!r.ok) {
    const detalle = typeof cuerpo.detail === 'string' ? cuerpo.detail : `El servidor respondió ${r.status}`
    throw new ErrorApi(detalle, r.status, cuerpo.errores ?? {})
  }
  return cuerpo as T
}

const consulta = (o: Record<string, string | number>) => {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(o)) if (v !== '' && v !== undefined) q.set(k, String(v))
  return q.toString()
}

let climaEnCurso: Promise<Clima> | null = null

interface ReferenciaClima {
  url: string; parametros: Record<string, string | number>
  municipios: { municipio: string; lat: number; lon: number }[]
  codigos: Record<string, [string, string]>
  lotes: Record<string, ClimaMunicipio['lotes']>
}

/** Respaldo: si el servidor no logra consultar el clima, el navegador lo pide directamente a Open-Meteo. */
async function climaDesdeNavegador(): Promise<Clima> {
  const ref = await pedir<ReferenciaClima>('/api/clima/referencia')
  const q = new URLSearchParams(Object.entries(ref.parametros).map(([k, v]) => [k, String(v)]))
  const r = await fetch(`${ref.url}?${q}`)
  if (!r.ok) throw new ErrorApi('El servicio de clima no está disponible en este momento. Intenta de nuevo en unos minutos.', r.status)
  const crudo = await r.json()
  const lista: any[] = Array.isArray(crudo) ? crudo : [crudo]
  const desc = (c: number | null | undefined): [string, string] => ref.codigos[String(c)] ?? ['Sin dato', 'nubes']
  return {
    fuente: 'Open-Meteo',
    consultado: new Date().toISOString(),
    municipios: ref.municipios.map((m, i) => {
      const d = lista[i], a = d.current, dia = d.daily
      const [descripcion, icono] = desc(a.weather_code)
      return {
        ...m,
        actual: { hora: a.time, temperatura: a.temperature_2m, sensacion: a.apparent_temperature, humedad: a.relative_humidity_2m,
          lluvia_mm: a.precipitation, viento_kmh: a.wind_speed_10m, es_dia: Boolean(a.is_day ?? 1), descripcion, icono },
        diario: (dia.time as string[]).map((fecha, j) => {
          const [dd, di] = desc(dia.weather_code[j])
          return { fecha, maxima: dia.temperature_2m_max[j], minima: dia.temperature_2m_min[j], lluvia_mm: dia.precipitation_sum[j],
            prob_lluvia: dia.precipitation_probability_max[j], descripcion: dd, icono: di }
        }),
        lotes: ref.lotes[m.municipio] ?? { temperatura_media: null, precipitacion_media: null },
      }
    }),
  }
}

export const api = {
  opciones: (signal?: AbortSignal) => pedir<Opciones>('/api/opciones', { signal }),
  resumen: (signal?: AbortSignal) => pedir<Resumen>('/api/resumen', { signal }),
  modelos: (signal?: AbortSignal) => pedir<Modelos>('/api/modelos', { signal }),
  exploracion: (f: Filtros, variable: ClaveVariable, signal?: AbortSignal) =>
    pedir<Exploracion>(`/api/exploracion?${consulta({ ...f, variable })}`, { signal }),

  lotes: (c: ConsultaLotes, signal?: AbortSignal) => pedir<PaginaLotes>(`/api/lotes?${consulta({ ...c })}`, { signal }),
  crearLote: (d: LoteDatos) => pedir<Lote>('/api/lotes', { method: 'POST', body: JSON.stringify(d) }),
  editarLote: (id: number, d: LoteDatos) => pedir<Lote>(`/api/lotes/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  borrarLote: (id: number) => pedir<void>(`/api/lotes/${id}`, { method: 'DELETE' }),

  /** El clima se pide una sola vez por visita y se comparte entre la vista Clima y el formulario. */
  clima: (refrescar = false) => {
    if (!climaEnCurso || refrescar) climaEnCurso = pedir<Clima>('/api/clima')
      .catch(e => { if (e instanceof ErrorApi && e.estado === 503) return climaDesdeNavegador(); throw e })
      .catch(e => { climaEnCurso = null; throw e })
    return climaEnCurso
  },
}
