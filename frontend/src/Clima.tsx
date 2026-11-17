import { useCallback, useEffect, useState } from 'react'
import { api, type Clima as C, type ClimaMunicipio } from './api'
import { IconoClima } from './Iconos'
import { n0, n1 } from './formato'

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const diaCorto = (f: string, i: number) => i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `${DIAS[new Date(f + 'T12:00').getDay()]} ${Number(f.slice(8))}`
const hora = (h: string) => h?.slice(11, 16)

export default function Clima() {
  const [datos, setDatos] = useState<C | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [sel, setSel] = useState('San Gil')

  const cargar = useCallback((refrescar = false) => {
    setCargando(true)
    api.clima(refrescar)
      .then(d => { setDatos(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setCargando(false))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const m = datos?.municipios.find(x => x.municipio === sel) ?? datos?.municipios[0]

  return (
    <main>
      <section aria-labelledby="t-clima">
        <div className="cabeza-fila">
          <div className="cabeza"><span className="rotulo">Clima en vivo</span>
            <h2 id="t-clima">El tiempo hoy en los municipios de AgroAndes</h2>
            <p className="entrada">Temperatura, humedad, lluvia y viento actuales, con el pronóstico de los próximos 7 días para planear siembras y cosechas.</p></div>
          <button type="button" onClick={() => cargar(true)} disabled={cargando}>{cargando ? 'Actualizando…' : 'Actualizar'}</button>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        {!datos && !error && <p className="cargando">Consultando el clima…</p>}

        {datos && (
          <>
            <div className="climas" role="list">
              {datos.municipios.map(x => (
                <button type="button" role="listitem" key={x.municipio} className="clima-tarjeta" aria-pressed={x.municipio === m?.municipio} onClick={() => setSel(x.municipio)}>
                  <span className="clima-mun">{x.municipio}</span>
                  <span className="clima-fila">
                    <IconoClima tipo={x.actual.icono} dia={x.actual.es_dia} />
                    <span className="clima-temp">{n0(x.actual.temperatura)}°</span>
                  </span>
                  <span className="clima-desc">{x.actual.descripcion}</span>
                  <span className="clima-mini">Humedad {n0(x.actual.humedad)} % · Viento {n0(x.actual.viento_kmh)} km/h</span>
                </button>
              ))}
            </div>
            {m && <Detalle m={m} />}
            <p className="peq">Fuente: {datos.fuente} (open-meteo.com). Datos de la hora {hora(m?.actual.hora ?? '')}, hora de Colombia. Se actualizan cada 15 minutos.</p>
          </>
        )}
      </section>
    </main>
  )
}

function Detalle({ m }: { m: ClimaMunicipio }) {
  const a = m.actual
  const tMin = Math.floor(Math.min(...m.diario.map(d => d.minima)) - 1)
  const tMax = Math.ceil(Math.max(...m.diario.map(d => d.maxima)) + 1)
  const pos = (t: number) => ((t - tMin) / (tMax - tMin)) * 100
  const lluviosos = m.diario.filter(d => (d.prob_lluvia ?? 0) >= 60).length
  const lluviaSemana = m.diario.reduce((s, d) => s + (d.lluvia_mm ?? 0), 0)
  const ref = m.lotes.temperatura_media
  const dif = ref !== null ? a.temperatura - ref : null

  return (
    <div className="col2 clima-detalle">
      <div className="caja">
        <span className="rotulo">Ahora en {m.municipio}</span>
        <div className="clima-grande">
          <IconoClima tipo={a.icono} dia={a.es_dia} tam={72} />
          <div><div className="clima-temp-g">{n1(a.temperatura)} °C</div><p>{a.descripcion} · sensación de {n0(a.sensacion)} °C</p></div>
        </div>
        <dl className="datos-clima">
          <div><dt>Humedad</dt><dd>{n0(a.humedad)} %</dd></div>
          <div><dt>Lluvia ahora</dt><dd>{n1(a.lluvia_mm)} mm</dd></div>
          <div><dt>Viento</dt><dd>{n0(a.viento_kmh)} km/h</dd></div>
          <div><dt>Coordenadas</dt><dd>{m.lat.toFixed(2)}, {m.lon.toFixed(2)}</dd></div>
        </dl>
        <div className="comparacion">
          <span className="rotulo">Comparado con los lotes</span>
          {ref !== null && dif !== null ? (
            <p>La temperatura media registrada en los lotes de {m.municipio} es <b>{n1(ref)} °C</b>. Hoy está {Math.abs(dif) < 0.5 ? 'igual' : <><b>{n1(Math.abs(dif))} °C {dif > 0 ? 'más caliente' : 'más fresco'}</b></>}.</p>
          ) : <p>Aún no hay lotes con temperatura registrada en {m.municipio}.</p>}
          {m.lotes.precipitacion_media !== null && <p className="peq">Precipitación media registrada por lote: {n0(m.lotes.precipitacion_media)} mm.</p>}
        </div>
      </div>

      <div className="caja">
        <span className="rotulo">Próximos 7 días</span>
        <p className="peq">{lluviosos === 0 ? 'Ningún día con lluvia probable' : `${lluviosos} ${lluviosos === 1 ? 'día' : 'días'} con lluvia probable (60 % o más)`} · {n1(lluviaSemana)} mm esperados en la semana.</p>
        <ul className="pronostico">
          {m.diario.map((d, i) => (
            <li key={d.fecha} data-tip={`${d.descripcion}: ${n1(d.minima)} a ${n1(d.maxima)} °C, ${n1(d.lluvia_mm)} mm (${n0(d.prob_lluvia)} %)`}>
              <span className="p-dia">{diaCorto(d.fecha, i)}</span>
              <IconoClima tipo={d.icono} tam={28} />
              <span className="p-min">{n0(d.minima)}°</span>
              <span className="p-rango" aria-hidden="true"><i style={{ left: `${pos(d.minima)}%`, right: `${100 - pos(d.maxima)}%` }} /></span>
              <span className="p-max">{n0(d.maxima)}°</span>
              <span className={(d.prob_lluvia ?? 0) >= 60 ? 'p-lluvia alta' : 'p-lluvia'}>{n0(d.prob_lluvia)} %</span>
            </li>
          ))}
        </ul>
        <p className="peq">La barra va de la mínima a la máxima del día. A la derecha, la probabilidad de lluvia.</p>
      </div>
    </div>
  )
}
