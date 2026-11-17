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
  periodo: { desde: string; hasta: string }
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

async function pedir<T>(ruta: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(ruta, { signal })
  if (!r.ok) throw new Error(`El servidor respondió ${r.status} en ${ruta}`)
  return r.json() as Promise<T>
}

export const api = {
  opciones: (s?: AbortSignal) => pedir<Opciones>('/api/opciones', s),
  resumen: (s?: AbortSignal) => pedir<Resumen>('/api/resumen', s),
  modelos: (s?: AbortSignal) => pedir<Modelos>('/api/modelos', s),
  exploracion: (f: Filtros, variable: ClaveVariable, s?: AbortSignal) => {
    const q = new URLSearchParams({ variable })
    for (const [k, v] of Object.entries(f)) if (v) q.set(k, v)
    return pedir<Exploracion>(`/api/exploracion?${q}`, s)
  },
}
