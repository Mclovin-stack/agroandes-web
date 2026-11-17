import { useEffect, useState } from 'react'
import { api, type ClaveVariable, type Exploracion, type Filtros, type Opciones } from './api'
import { Barras, Linea } from './graficos'
import { n0, n1, n2 } from './formato'

const SIN_FILTROS: Filtros = { municipio: '', cultivo: '', riego: '', anio: '' }

export default function Explorador({ opciones }: { opciones: Opciones }) {
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)
  const [variable, setVariable] = useState<ClaveVariable>('fertilizante')
  const [datos, setDatos] = useState<Exploracion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ctl = new AbortController()
    setCargando(true)
    api.exploracion(filtros, variable, ctl.signal)
      .then(d => { setDatos(d); setError(null) })
      .catch(e => { if (e.name !== 'AbortError') setError('No se pudieron cargar los datos del explorador. Revisa que el backend esté encendido.') })
      .finally(() => { if (!ctl.signal.aborted) setCargando(false) })
    return () => ctl.abort()
  }, [filtros, variable])

  const cambiar = (k: keyof Filtros) => (e: React.ChangeEvent<HTMLSelectElement>) => setFiltros(f => ({ ...f, [k]: e.target.value }))
  const hayFiltros = Object.values(filtros).some(Boolean)
  const ind = datos?.indicadores
  const prom = ind?.rendimiento_medio ?? null
  const grupos = (g: Exploracion['por_cultivo']) => g.map(x => ({ nombre: x.nombre, valor: x.rendimiento, lotes: x.lotes }))
  const pv = datos?.por_variable
  const fmtTramo = (n: number) => (pv?.clave === 'ph' ? n1(n) : n0(n))

  return (
    <div className="herramienta" aria-busy={cargando}>
      <div className="filtros">
        <label className="rotulo" htmlFor="fMun">Municipio
          <select id="fMun" value={filtros.municipio} onChange={cambiar('municipio')}>
            <option value="">Todos</option>
            {opciones.municipios.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="rotulo" htmlFor="fCul">Cultivo
          <select id="fCul" value={filtros.cultivo} onChange={cambiar('cultivo')}>
            <option value="">Todos</option>
            {opciones.cultivos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="rotulo" htmlFor="fRie">Riego
          <select id="fRie" value={filtros.riego} onChange={cambiar('riego')}>
            <option value="">Todos</option>
            {opciones.riegos.map(r => <option key={r.valor} value={r.valor}>{r.nombre}</option>)}
          </select>
        </label>
        <label className="rotulo" htmlFor="fAnio">Año
          <select id="fAnio" value={filtros.anio} onChange={cambiar('anio')}>
            <option value="">Todos</option>
            {opciones.anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setFiltros(SIN_FILTROS)} disabled={!hayFiltros}>Quitar filtros</button>
        <span className="estado" aria-live="polite">{cargando ? 'Calculando…' : ''}</span>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {datos && (
        <div className={cargando ? 'contenido atenuado' : 'contenido'}>
          <div className="kpis" aria-live="polite">
            <div className="kpi"><span className="rotulo">Lotes</span><div className="v">{n0(ind!.lotes)}</div></div>
            <div className="kpi"><span className="rotulo">Rendimiento medio</span><div className="v">{n2(prom)}<small>ton/ha</small></div></div>
            <div className="kpi"><span className="rotulo">Área total</span><div className="v">{n0(ind!.area_total)}<small>ha</small></div></div>
            <div className="kpi"><span className="rotulo">Producción</span><div className="v">{n0(ind!.produccion_total)}<small>ton</small></div></div>
            <div className="kpi"><span className="rotulo">Fertilizante medio</span><div className="v">{n0(ind!.fertilizante_medio)}<small>kg</small></div></div>
          </div>

          <div className="graficos3">
            {([['Por cultivo', datos.por_cultivo], ['Por municipio', datos.por_municipio], ['Por sistema de riego', datos.por_riego]] as const).map(([t, g]) => (
              <div className="grafico" key={t}>
                <h3>{t}</h3>
                <p className="nota-graf">Rendimiento medio, ton/ha. Línea punteada: promedio del filtro.</p>
                <Barras datos={grupos(g)} dominio={12} formato={n1} unidad="ton/ha" referencia={prom} />
              </div>
            ))}
          </div>

          <div className="graficos2">
            <div className="grafico">
              <h3>Rendimiento según una variable</h3>
              <div className="selector" role="group" aria-label="Variable del eje horizontal">
                {opciones.variables.map(v => (
                  <button type="button" key={v.clave} aria-pressed={v.clave === variable} onClick={() => setVariable(v.clave)}>{v.nombre}</button>
                ))}
              </div>
              {pv && (
                <>
                  <Linea minLotes={10} promedio={prom} descripcion={`Rendimiento medio según ${pv.nombre}`}
                    puntos={pv.tramos.map(t => ({
                      etiqueta: fmtTramo(t.desde),
                      detalle: `${pv.nombre} ${fmtTramo(t.desde)} a ${fmtTramo(t.hasta)}${pv.unidad ? ' ' + pv.unidad : ''}`,
                      valor: t.rendimiento, lotes: t.lotes,
                    }))} />
                  <p className="nota-r">
                    Eje horizontal: {pv.nombre}{pv.unidad && ` (${pv.unidad})`}. Correlación con el rendimiento:{' '}
                    <b>{n2(pv.correlacion)}</b>{pv.correlacion !== null && Math.abs(pv.correlacion) < 0.1 && ' (prácticamente nula)'}.
                  </p>
                </>
              )}
            </div>
            <div className="grafico">
              <h3>Rendimiento por trimestre de cosecha</h3>
              <p className="nota-graf">Rendimiento medio, ton/ha. Trimestres con al menos 5 lotes.</p>
              <Linea promedio={prom} descripcion="Rendimiento medio por trimestre de cosecha"
                puntos={datos.por_trimestre.map(t => ({
                  etiqueta: `${t.trimestre}T ${String(t.anio).slice(2)}`,
                  detalle: `${t.anio}, trimestre ${t.trimestre}`,
                  valor: t.rendimiento, lotes: t.lotes,
                }))} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
