import type { Opciones, Resumen } from './api'
import { Histograma } from './graficos'
import Explorador from './Explorador'
import { n0, n2 } from './formato'

export default function Panel({ op, res, version, irA }: {
  op: Opciones; res: Resumen; version: number; irA: (vista: string) => void
}) {
  const ind = res.indicadores
  const registrados = res.origen.registrado ?? 0

  return (
    <main>
      <section id="inicio" className="portada-bloque">
        <div className="portada">
          <div className="portada-txt">
            <span className="caso">Santander · {op.municipios.length} municipios · {op.cultivos.length} cultivos</span>
            <h1>Panel de lotes de AgroAndes</h1>
            <p className="entrada">Registra tus lotes, consulta cómo rinden según el municipio, el cultivo o el riego, y revisa el clima antes de planear la próxima cosecha.</p>
            <div className="acciones">
              <button type="button" className="primario" onClick={() => irA('lotes')}>Registrar un lote</button>
              <button type="button" onClick={() => irA('clima')}>Ver el clima de hoy</button>
            </div>
          </div>
          <figure className="portada-fig">
            <span className="rotulo">Rendimiento de {n0(ind.lotes_con_rendimiento)} lotes</span>
            <Histograma tramos={res.histograma} promedio={ind.rendimiento_medio} />
            <figcaption className="peq">Cada barra cuenta los lotes con ese rendimiento (ton/ha). La línea marca el promedio.</figcaption>
          </figure>
        </div>
        <div className="cifras">
          <div className="cifra"><div className="n">{n0(ind.lotes)}</div><p>lotes en total</p></div>
          <div className="cifra"><div className="n">{n0(registrados)}</div><p>{registrados === 1 ? 'lote registrado' : 'lotes registrados'} desde la página</p></div>
          <div className="cifra"><div className="n">{n2(ind.rendimiento_medio)}<small>ton/ha</small></div><p>rendimiento promedio</p></div>
          <div className="cifra"><div className="n">{n0(ind.produccion_total)}<small>ton</small></div><p>producción total</p></div>
        </div>
      </section>

      <section id="explorar" aria-labelledby="t-exp">
        <div className="cabeza"><span className="rotulo">Explorar</span>
          <h2 id="t-exp">Rendimiento de los lotes</h2>
          <p className="entrada">Filtra por municipio, cultivo, riego o año. Los gráficos incluyen los lotes que registres en la página.</p></div>
        <Explorador opciones={op} version={version} />
      </section>
    </main>
  )
}
