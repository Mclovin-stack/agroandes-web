import { useEffect, useRef, useState } from 'react'
import { api, ErrorApi, type Clima, type Lote, type LoteDatos, type Opciones } from './api'
import { n1 } from './formato'

type Campos = Record<keyof LoteDatos, string>

const NUMERICOS: { k: keyof LoteDatos; et: string; unidad: string; min?: number; minEx?: number; max: number; oblig?: boolean }[] = [
  { k: 'area_ha', et: 'Área', unidad: 'ha', minEx: 0, max: 1000, oblig: true },
  { k: 'produccion_ton', et: 'Producción', unidad: 'ton', min: 0, max: 100000 },
  { k: 'rendimiento_ton_ha', et: 'Rendimiento', unidad: 'ton/ha', min: 0, max: 20 },
  { k: 'temperatura_c', et: 'Temperatura', unidad: '°C', min: -10, max: 50 },
  { k: 'precipitacion_mm', et: 'Precipitación', unidad: 'mm', min: 0, max: 10000 },
  { k: 'ph_suelo', et: 'pH del suelo', unidad: '', min: 3, max: 10 },
  { k: 'fertilizante_kg', et: 'Fertilizante', unidad: 'kg', min: 0, max: 100000 },
]

const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const aTexto = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v))

function inicial(l: Lote | null): Campos {
  return {
    nombre: aTexto(l?.nombre), municipio: l?.municipio ?? '', cultivo: l?.cultivo ?? '', sistema_riego: l?.sistema_riego ?? '',
    fecha_cosecha: l?.fecha_cosecha ?? hoy(),
    area_ha: aTexto(l?.area_ha), precipitacion_mm: aTexto(l?.precipitacion_mm), temperatura_c: aTexto(l?.temperatura_c),
    ph_suelo: aTexto(l?.ph_suelo), fertilizante_kg: aTexto(l?.fertilizante_kg), produccion_ton: aTexto(l?.produccion_ton),
    rendimiento_ton_ha: aTexto(l?.rendimiento_ton_ha),
  }
}

const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))

function validar(c: Campos): Record<string, string> {
  const e: Record<string, string> = {}
  if (!c.municipio) e.municipio = 'Elige un municipio'
  if (!c.cultivo) e.cultivo = 'Elige un cultivo'
  if (!c.sistema_riego) e.sistema_riego = 'Elige el sistema de riego'
  if (!c.fecha_cosecha) e.fecha_cosecha = 'Indica la fecha de cosecha'
  else if (c.fecha_cosecha < '2000-01-01') e.fecha_cosecha = 'La fecha debe ser del año 2000 en adelante'
  if (c.nombre.length > 80) e.nombre = 'Máximo 80 caracteres'
  for (const f of NUMERICOS) {
    const v = num(c[f.k])
    if (v === null) { if (f.oblig) e[f.k] = 'Es obligatorio'; continue }
    if (Number.isNaN(v)) e[f.k] = 'Debe ser un número'
    else if (f.minEx !== undefined && v <= f.minEx) e[f.k] = `Debe ser mayor que ${f.minEx}`
    else if (f.min !== undefined && v < f.min) e[f.k] = `Debe ser mayor o igual a ${f.min}`
    else if (v > f.max) e[f.k] = `Debe ser menor o igual a ${f.max}`
  }
  return e
}

export default function FormLote({ abierto, lote, opciones, onCerrar, onGuardado }: {
  abierto: boolean; lote: Lote | null; opciones: Opciones
  onCerrar: () => void; onGuardado: (l: Lote, nuevo: boolean) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [c, setC] = useState<Campos>(inicial(lote))
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [clima, setClima] = useState<Clima | null>(null)
  const editando = lote !== null

  useEffect(() => {
    const d = ref.current!
    if (abierto) {
      setC(inicial(lote)); setErrores({}); setGeneral(null)
      if (!d.open) d.showModal()
      api.clima().then(setClima).catch(() => setClima(null))
    } else if (d.open) d.close()
  }, [abierto, lote])

  const poner = (k: keyof LoteDatos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.value
    setC(prev => ({ ...prev, [k]: v }))
    setGeneral(null)
    if (errores[k]) setErrores(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  const area = num(c.area_ha), prod = num(c.produccion_ton)
  const rendCalc = area && prod !== null && area > 0 && !Number.isNaN(prod) ? Math.round((prod / area) * 100) / 100 : null
  const climaMun = clima?.municipios.find(m => m.municipio === c.municipio)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const errs = validar(c)
    setErrores(errs); setGeneral(null)
    if (Object.keys(errs).length) {
      setGeneral('Hay campos por corregir.')
      ref.current?.querySelector<HTMLElement>(`[name="${Object.keys(errs)[0]}"]`)?.focus()
      return
    }
    const datos: LoteDatos = {
      nombre: c.nombre.trim() || null, municipio: c.municipio, cultivo: c.cultivo, sistema_riego: c.sistema_riego,
      fecha_cosecha: c.fecha_cosecha,
      ...Object.fromEntries(NUMERICOS.map(f => [f.k, num(c[f.k])])) as Pick<LoteDatos, 'area_ha'>,
    } as LoteDatos
    setGuardando(true)
    try {
      const l = editando ? await api.editarLote(lote!.id, datos) : await api.crearLote(datos)
      onGuardado(l, !editando)
    } catch (err) {
      if (err instanceof ErrorApi) { setErrores(err.errores); setGeneral(err.message) }
      else setGeneral('No se pudo guardar el lote. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const err = (k: string) => errores[k] && <span className="campo-error" id={`e-${k}`}>{errores[k]}</span>
  const aria = (k: string) => ({ 'aria-invalid': !!errores[k] || undefined, 'aria-describedby': errores[k] ? `e-${k}` : undefined })

  return (
    <dialog ref={ref} className="modal" onCancel={e => { e.preventDefault(); onCerrar() }} aria-labelledby="t-form">
      <form onSubmit={guardar} noValidate>
        <header className="modal-cab">
          <h2 id="t-form">{editando ? `Editar lote #${lote!.id}` : 'Registrar un lote'}</h2>
          <button type="button" className="cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        </header>
        {editando && lote!.origen === 'historico' && <p className="peq">Este lote viene del archivo histórico. Los cambios se guardan en la base de datos y se reflejan en el análisis.</p>}

        <div className="form-grid">
          <label className="campo ancho2"><span>Nombre del terreno <span className="opc">· opcional</span></span>
            <input name="nombre" value={c.nombre} onChange={poner('nombre')} placeholder="Ej.: Finca La Esperanza, lote 3" maxLength={80} {...aria('nombre')} />{err('nombre')}
          </label>
          <label className="campo">Municipio
            <select name="municipio" value={c.municipio} onChange={poner('municipio')} {...aria('municipio')}>
              <option value="">Elige…</option>{opciones.municipios.map(m => <option key={m}>{m}</option>)}
            </select>{err('municipio')}
          </label>
          <label className="campo">Cultivo
            <select name="cultivo" value={c.cultivo} onChange={poner('cultivo')} {...aria('cultivo')}>
              <option value="">Elige…</option>{opciones.cultivos.map(m => <option key={m}>{m}</option>)}
            </select>{err('cultivo')}
          </label>
          <label className="campo">Sistema de riego
            <select name="sistema_riego" value={c.sistema_riego} onChange={poner('sistema_riego')} {...aria('sistema_riego')}>
              <option value="">Elige…</option>{opciones.riegos.map(r => <option key={r.valor} value={r.valor}>{r.nombre}</option>)}
            </select>{err('sistema_riego')}
          </label>
          <label className="campo">Fecha de cosecha
            <input type="date" name="fecha_cosecha" value={c.fecha_cosecha} onChange={poner('fecha_cosecha')} min="2000-01-01" {...aria('fecha_cosecha')} />{err('fecha_cosecha')}
          </label>

          {NUMERICOS.map(f => (
            <label className="campo" key={f.k}>
              <span>{f.et}{f.unidad && <span className="opc"> {f.unidad}</span>}{!f.oblig && <span className="opc"> · opcional</span>}</span>
              <input name={f.k} type="number" inputMode="decimal" step="any" value={c[f.k] ?? ''} onChange={poner(f.k)}
                min={f.minEx ?? f.min} max={f.max} {...aria(f.k)} />
              {err(f.k)}
              {f.k === 'rendimiento_ton_ha' && rendCalc !== null && String(rendCalc) !== c.rendimiento_ton_ha && (
                <button type="button" className="sugerencia" onClick={() => setC(p => ({ ...p, rendimiento_ton_ha: String(rendCalc) }))}>
                  Usar {n1(rendCalc)} ton/ha (producción ÷ área)
                </button>
              )}
              {f.k === 'temperatura_c' && climaMun && (
                <button type="button" className="sugerencia" onClick={() => setC(p => ({ ...p, temperatura_c: String(climaMun.actual.temperatura) }))}>
                  Usar la de hoy en {climaMun.municipio}: {n1(climaMun.actual.temperatura)} °C
                </button>
              )}
            </label>
          ))}
        </div>

        {general && <p className="error" role="alert">{general}</p>}
        <footer className="modal-pie">
          <button type="button" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="primario" disabled={guardando}>{guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar lote'}</button>
        </footer>
      </form>
    </dialog>
  )
}
