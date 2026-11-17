import { useEffect, useRef, useState } from 'react'
import { api, ErrorApi, type ConsultaLotes, type Lote, type Opciones, type PaginaLotes } from './api'
import FormLote from './FormLote'
import { n0, n1 } from './formato'

const INICIAL: ConsultaLotes = { buscar: '', municipio: '', cultivo: '', riego: '', origen: '', orden: 'recientes', pagina: 1, por_pagina: 20 }
const RIEGO: Record<string, string> = { No: 'Sin riego', Goteo: 'Goteo', 'Aspersión': 'Aspersión', 'Sí': 'Sin especificar' }
const fecha = (f: string) => { const [a, m, d] = f.split('-'); return `${d}/${m}/${a}` }

export default function Lotes({ opciones, version, onCambio }: {
  opciones: Opciones; version: number; onCambio: (mensaje: string) => void
}) {
  const [q, setQ] = useState<ConsultaLotes>(INICIAL)
  const [texto, setTexto] = useState('')
  const [datos, setDatos] = useState<PaginaLotes | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<{ abierto: boolean; lote: Lote | null }>({ abierto: false, lote: null })
  const [aBorrar, setABorrar] = useState<Lote | null>(null)
  const [resaltado, setResaltado] = useState<number | null>(null)

  // búsqueda con una pequeña espera para no consultar en cada tecla
  useEffect(() => {
    const t = setTimeout(() => setQ(p => (p.buscar === texto ? p : { ...p, buscar: texto, pagina: 1 })), 300)
    return () => clearTimeout(t)
  }, [texto])

  useEffect(() => {
    const ctl = new AbortController()
    setCargando(true)
    api.lotes(q, ctl.signal)
      .then(d => { setDatos(d); setError(null) })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message) })
      .finally(() => { if (!ctl.signal.aborted) setCargando(false) })
    return () => ctl.abort()
  }, [q, version])

  // si se borró el último lote de la última página, volver a la página anterior
  useEffect(() => {
    if (datos && datos.items.length === 0 && datos.total > 0 && q.pagina > 1)
      setQ(p => ({ ...p, pagina: Math.ceil(datos.total / datos.por_pagina) }))
  }, [datos, q.pagina])

  const poner = (k: keyof ConsultaLotes) => (e: React.ChangeEvent<HTMLSelectElement>) => setQ(p => ({ ...p, [k]: e.target.value, pagina: 1 }))
  const hayFiltros = q.buscar || q.municipio || q.cultivo || q.riego || q.origen
  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1
  const desde = datos && datos.total ? (datos.pagina - 1) * datos.por_pagina + 1 : 0
  const hasta = datos ? Math.min(datos.total, datos.pagina * datos.por_pagina) : 0

  function guardado(l: Lote, nuevo: boolean) {
    setForm({ abierto: false, lote: null })
    setResaltado(l.id)
    if (nuevo) { setTexto(''); setQ({ ...INICIAL }) }
    onCambio(nuevo ? `Lote #${l.id} registrado` : `Lote #${l.id} actualizado`)
  }

  return (
    <main>
      <section aria-labelledby="t-lotes">
        <div className="cabeza-fila">
          <div className="cabeza"><span className="rotulo">Gestión de lotes</span>
            <h2 id="t-lotes">Lotes y terrenos de AgroAndes</h2>
            <p className="entrada">Registra lotes nuevos, corrige los existentes o bórralos. Cada cambio se guarda en la base de datos y actualiza los gráficos del análisis.</p></div>
          <button type="button" className="primario grande" onClick={() => setForm({ abierto: true, lote: null })}>+ Registrar lote</button>
        </div>

        <div className="herramienta">
          <div className="filtros">
            <label className="rotulo busqueda" htmlFor="lBuscar">Buscar
              <input id="lBuscar" type="search" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Nombre del terreno o número (#123)" />
            </label>
            <label className="rotulo" htmlFor="lMun">Municipio
              <select id="lMun" value={q.municipio} onChange={poner('municipio')}><option value="">Todos</option>{opciones.municipios.map(m => <option key={m}>{m}</option>)}</select>
            </label>
            <label className="rotulo" htmlFor="lCul">Cultivo
              <select id="lCul" value={q.cultivo} onChange={poner('cultivo')}><option value="">Todos</option>{opciones.cultivos.map(m => <option key={m}>{m}</option>)}</select>
            </label>
            <label className="rotulo" htmlFor="lRie">Riego
              <select id="lRie" value={q.riego} onChange={poner('riego')}><option value="">Todos</option>{opciones.riegos.map(r => <option key={r.valor} value={r.valor}>{r.nombre}</option>)}</select>
            </label>
            <label className="rotulo" htmlFor="lOri">Origen
              <select id="lOri" value={q.origen} onChange={poner('origen')}>
                <option value="">Todos</option><option value="registrado">Registrados en la página</option><option value="historico">Archivo histórico</option>
              </select>
            </label>
            <label className="rotulo" htmlFor="lOrd">Ordenar por
              <select id="lOrd" value={q.orden} onChange={poner('orden')}>
                <option value="recientes">Más recientes</option>
                <option value="fecha_desc">Cosecha más reciente</option>
                <option value="fecha_asc">Cosecha más antigua</option>
                <option value="rendimiento_desc">Mayor rendimiento</option>
                <option value="rendimiento_asc">Menor rendimiento</option>
                <option value="area_desc">Mayor área</option>
              </select>
            </label>
            {hayFiltros && <button type="button" onClick={() => { setTexto(''); setQ({ ...INICIAL, orden: q.orden }) }}>Quitar filtros</button>}
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          <div className={cargando ? 'tabla atenuado' : 'tabla'}>
            <table className="tabla-lotes">
              <thead><tr>
                <th>#</th><th>Terreno</th><th>Municipio</th><th>Cultivo</th><th>Riego</th><th>Cosecha</th>
                <th className="d">Área (ha)</th><th className="d">Rend. (ton/ha)</th><th className="d">Temp. (°C)</th><th className="d">pH</th><th>Origen</th><th><span className="oculto">Acciones</span></th>
              </tr></thead>
              <tbody>
                {datos?.items.map(l => (
                  <tr key={l.id} className={l.id === resaltado ? 'resaltada' : undefined}>
                    <td className="num">{l.id}</td>
                    <td>{l.nombre ?? <span className="peq">Sin nombre</span>}</td>
                    <td>{l.municipio}</td><td>{l.cultivo}</td><td>{RIEGO[l.sistema_riego] ?? l.sistema_riego}</td>
                    <td className="num">{fecha(l.fecha_cosecha)}</td>
                    <td className="d num">{n1(l.area_ha)}</td><td className="d num">{n1(l.rendimiento_ton_ha)}</td>
                    <td className="d num">{n1(l.temperatura_c)}</td><td className="d num">{n1(l.ph_suelo)}</td>
                    <td><span className={l.origen === 'registrado' ? 'pastilla alta' : 'pastilla baja'}>{l.origen === 'registrado' ? 'Registrado' : 'Histórico'}</span></td>
                    <td className="acciones-fila">
                      <button type="button" className="mini" onClick={() => setForm({ abierto: true, lote: l })} aria-label={`Editar lote ${l.id}`}>Editar</button>
                      <button type="button" className="mini peligro" onClick={() => setABorrar(l)} aria-label={`Borrar lote ${l.id}`}>Borrar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {datos && datos.total === 0 && (
              <div className="vacio-lotes">
                <p>No hay lotes que coincidan con la búsqueda.</p>
                {hayFiltros ? <button type="button" onClick={() => { setTexto(''); setQ(INICIAL) }}>Quitar filtros</button>
                  : <button type="button" className="primario" onClick={() => setForm({ abierto: true, lote: null })}>Registrar el primer lote</button>}
              </div>
            )}
          </div>

          {datos && datos.total > 0 && (
            <nav className="paginacion" aria-label="Páginas de lotes">
              <span className="peq">Mostrando {n0(desde)}–{n0(hasta)} de {n0(datos.total)} lotes</span>
              <div className="pag-botones">
                <button type="button" disabled={q.pagina <= 1} onClick={() => setQ(p => ({ ...p, pagina: 1 }))} aria-label="Primera página">«</button>
                <button type="button" disabled={q.pagina <= 1} onClick={() => setQ(p => ({ ...p, pagina: p.pagina - 1 }))}>Anterior</button>
                <span className="pag-actual">Página {n0(q.pagina)} de {n0(paginas)}</span>
                <button type="button" disabled={q.pagina >= paginas} onClick={() => setQ(p => ({ ...p, pagina: p.pagina + 1 }))}>Siguiente</button>
                <button type="button" disabled={q.pagina >= paginas} onClick={() => setQ(p => ({ ...p, pagina: paginas }))} aria-label="Última página">»</button>
              </div>
            </nav>
          )}
        </div>
      </section>

      <FormLote abierto={form.abierto} lote={form.lote} opciones={opciones}
        onCerrar={() => setForm({ abierto: false, lote: null })} onGuardado={guardado} />
      <ConfirmarBorrado lote={aBorrar} onCerrar={() => setABorrar(null)}
        onBorrado={l => { setABorrar(null); onCambio(`Lote #${l.id} borrado`) }} />
    </main>
  )
}

function ConfirmarBorrado({ lote, onCerrar, onBorrado }: { lote: Lote | null; onCerrar: () => void; onBorrado: (l: Lote) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current!
    if (lote) { setError(null); if (!d.open) d.showModal() } else if (d.open) d.close()
  }, [lote])

  async function borrar() {
    if (!lote) return
    setBorrando(true)
    try { await api.borrarLote(lote.id); onBorrado(lote) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudo borrar el lote.') }
    finally { setBorrando(false) }
  }

  return (
    <dialog ref={ref} className="modal pequeno" onCancel={e => { e.preventDefault(); onCerrar() }} aria-labelledby="t-borrar">
      {lote && (
        <div className="confirmar">
          <h2 id="t-borrar">¿Borrar el lote #{lote.id}?</h2>
          <p>{lote.nombre ? <b>{lote.nombre}</b> : 'Lote sin nombre'} · {lote.cultivo} en {lote.municipio}, cosecha del {fecha(lote.fecha_cosecha)}.</p>
          <p className="peq">Se elimina de la base de datos y deja de contar en el análisis. Esta acción no se puede deshacer.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <footer className="modal-pie">
            <button type="button" onClick={onCerrar}>Cancelar</button>
            <button type="button" className="peligro-lleno" onClick={borrar} disabled={borrando}>{borrando ? 'Borrando…' : 'Sí, borrar'}</button>
          </footer>
        </div>
      )}
    </dialog>
  )
}
