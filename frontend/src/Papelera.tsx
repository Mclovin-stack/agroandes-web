import { useEffect, useState } from 'react'
import { api, ErrorApi, type Lote, type PaginaLotes } from './api'
import Confirmar from './Confirmar'
import { n0, n1 } from './formato'

const fecha = (f: string) => { const [a, m, d] = f.split('-'); return `${d}/${m}/${a}` }
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })

export default function Papelera({ esAdmin, version, onCambio, pedirIngreso }: {
  esAdmin: boolean; version: number; onCambio: (mensaje: string) => void; pedirIngreso: () => void
}) {
  const [pagina, setPagina] = useState(1)
  const [datos, setDatos] = useState<PaginaLotes | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [aEliminar, setAEliminar] = useState<Lote | null>(null)
  const [vaciar, setVaciar] = useState(false)

  useEffect(() => {
    if (!esAdmin) return
    const ctl = new AbortController()
    setCargando(true)
    api.papelera(pagina, ctl.signal)
      .then(d => { setDatos(d); setError(null) })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message) })
      .finally(() => { if (!ctl.signal.aborted) setCargando(false) })
    return () => ctl.abort()
  }, [pagina, version, esAdmin])

  // si se vació la última página, volver a la anterior
  useEffect(() => {
    if (datos && datos.items.length === 0 && datos.total > 0 && pagina > 1) setPagina(Math.ceil(datos.total / datos.por_pagina))
  }, [datos, pagina])

  async function recuperar(l: Lote) {
    setOcupado(l.id)
    try { await api.recuperar(l.id); onCambio(`Lote #${l.id} recuperado`) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudo recuperar el lote.') }
    finally { setOcupado(null) }
  }

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1

  return (
    <main>
      <section aria-labelledby="t-papelera">
        <div className="cabeza-fila">
          <div className="cabeza"><span className="rotulo">Papelera · solo administrador</span>
            <h2 id="t-papelera">Lotes borrados</h2>
            <p className="entrada">Los lotes borrados quedan aquí y no cuentan en la tabla ni en los gráficos. Puedes recuperarlos o eliminarlos para siempre.</p></div>
          <div className="acciones">
            <a className="boton-enlace" href="#lotes">← Volver a lotes</a>
            {esAdmin && datos && datos.total > 0 &&
              <button type="button" className="grande peligro" onClick={() => setVaciar(true)}>Vaciar papelera</button>}
          </div>
        </div>

        {!esAdmin ? (
          <div className="herramienta vacio-lotes">
            <p>La papelera solo la puede ver el administrador.</p>
            <button type="button" className="primario" onClick={pedirIngreso}>Iniciar sesión</button>
          </div>
        ) : (
          <div className="herramienta">
            {error && <p className="error" role="alert">{error}</p>}
            {datos && datos.total === 0 ? (
              <div className="vacio-lotes"><p>La papelera está vacía.</p><a className="boton-enlace" href="#lotes">Ir a los lotes</a></div>
            ) : (
              <div className={cargando ? 'tabla atenuado' : 'tabla'}>
                <table className="tabla-lotes">
                  <thead><tr>
                    <th>#</th><th>Terreno</th><th>Municipio</th><th>Cultivo</th><th>Cosecha</th>
                    <th className="d">Rend. (ton/ha)</th><th>Origen</th><th>Borrado el</th><th><span className="oculto">Acciones</span></th>
                  </tr></thead>
                  <tbody>
                    {datos?.items.map(l => (
                      <tr key={l.id}>
                        <td className="num">{l.id}</td>
                        <td>{l.nombre ?? <span className="peq">Sin nombre</span>}</td>
                        <td>{l.municipio}</td><td>{l.cultivo}</td>
                        <td className="num">{fecha(l.fecha_cosecha)}</td>
                        <td className="d num">{n1(l.rendimiento_ton_ha)}</td>
                        <td><span className={l.origen === 'registrado' ? 'pastilla alta' : 'pastilla baja'}>{l.origen === 'registrado' ? 'Registrado' : 'Histórico'}</span></td>
                        <td className="num">{l.borrado ? fechaHora(l.borrado) : '–'}</td>
                        <td className="acciones-fila">
                          <button type="button" className="mini" disabled={ocupado === l.id} onClick={() => recuperar(l)} aria-label={`Recuperar lote ${l.id}`}>{ocupado === l.id ? 'Recuperando…' : 'Recuperar'}</button>
                          <button type="button" className="mini peligro" onClick={() => setAEliminar(l)} aria-label={`Eliminar definitivamente el lote ${l.id}`}>Eliminar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {datos && datos.total > 0 && (
              <nav className="paginacion" aria-label="Páginas de la papelera">
                <span className="peq">{n0(datos.total)} {datos.total === 1 ? 'lote' : 'lotes'} en la papelera</span>
                {paginas > 1 && (
                  <div className="pag-botones">
                    <button type="button" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
                    <span className="pag-actual">Página {n0(pagina)} de {n0(paginas)}</span>
                    <button type="button" disabled={pagina >= paginas} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
                  </div>
                )}
              </nav>
            )}
          </div>
        )}
      </section>

      <Confirmar abierto={aEliminar !== null} titulo={`¿Eliminar el lote #${aEliminar?.id} para siempre?`} boton="Sí, eliminar"
        accion={() => api.eliminarDefinitivo(aEliminar!.id)} onCerrar={() => setAEliminar(null)}
        onHecho={() => { const id = aEliminar?.id; setAEliminar(null); onCambio(`Lote #${id} eliminado definitivamente`) }}>
        <p>{aEliminar?.nombre ? <b>{aEliminar.nombre}</b> : 'Lote sin nombre'} · {aEliminar?.cultivo} en {aEliminar?.municipio}.</p>
        <p className="peq">Sale de la papelera y de la base de datos. Esta acción no se puede deshacer.</p>
      </Confirmar>
      <Confirmar abierto={vaciar} titulo="¿Vaciar la papelera?" boton="Sí, vaciar"
        accion={() => api.vaciarPapelera()} onCerrar={() => setVaciar(false)}
        onHecho={() => { setVaciar(false); setPagina(1); onCambio('Papelera vaciada') }}>
        <p>Se eliminan para siempre los {n0(datos?.total ?? 0)} lotes de la papelera.</p>
        <p className="peq">Esta acción no se puede deshacer.</p>
      </Confirmar>
    </main>
  )
}
