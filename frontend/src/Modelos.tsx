import type { Modelos as M } from './api'
import { Barras } from './graficos'
import { n0, n1, n2 } from './formato'

export default function Modelos({ m }: { m: M }) {
  const reg = m.regresion, bo = m.boosting, km = m.kmeans
  return (
    <>
      <div className="col3">
        <div className="caja"><span className="rotulo">Notebook 1 · Regresión</span><h3>¿Cuánto rendirá un lote?</h3>
          <p>Regresión lineal, árbol de regresión, Random Forest y red neuronal. {reg.particion}, variables categóricas con one-hot.</p></div>
        <div className="caja"><span className="rotulo">Notebook 2 · K-Means</span><h3>¿Qué tipos de lote existen?</h3>
          <p>Agrupación por área, precipitación, temperatura, pH, fertilizante y rendimiento, con variables estandarizadas. k elegido con codo y silueta.</p></div>
        <div className="caja"><span className="rotulo">Notebook 3 · XGBoost</span><h3>¿Se puede predecir mejor?</h3>
          <p>Boosting contra Random Forest, con validación, parada anticipada y validación cruzada de 5 pliegues. También clasificación Baja, Media y Alta.</p></div>
      </div>

      <div className="col2">
        <div className="caja">
          <span className="chip-nb rotulo">Notebook 1</span>
          <h3>Ningún modelo predice mejor que el promedio</h3>
          <p className="peq">Error de predicción (RMSE) en {n0(reg.lotes_prueba)} lotes de prueba. Menor es mejor.</p>
          <div className="leyenda"><span><i className="c-maiz" />Línea base</span><span><i className="c-hoja" />Modelos</span></div>
          <Barras dominio={6} formato={n2} unidad="ton/ha de error" anchoEtiqueta={130}
            datos={reg.resultados.map(r => ({ nombre: r.modelo.replace(' (promedio)', ''), valor: r.rmse, resaltar: r.base }))} />
          <div className="tabla"><table>
            <thead><tr><th>Modelo</th><th className="d">R²</th><th className="d">RMSE</th><th className="d">MAE</th></tr></thead>
            <tbody>{reg.resultados.map(r => (
              <tr key={r.modelo} className={r.base ? 'base' : undefined}>
                <td>{r.modelo}</td><td className="d num">{n2(r.r2)}</td><td className="d num">{n2(r.rmse)}</td><td className="d num">{n2(r.mae)}</td>
              </tr>))}
            </tbody>
          </table></div>
          <p className="peq">Un R² negativo significa que el modelo explica menos que el promedio.</p>
        </div>

        <div className="caja">
          <span className="chip-nb rotulo">Notebook 3</span>
          <h3>El boosting tampoco encuentra señal</h3>
          <p className="peq">Regresión con otra partición: {bo.particion}.</p>
          <div className="tabla"><table>
            <thead><tr><th>Modelo</th><th className="d">RMSE</th><th className="d">R²</th></tr></thead>
            <tbody>{bo.regresion.map(r => (
              <tr key={r.modelo} className={r.base ? 'base' : undefined}>
                <td>{r.modelo}</td><td className="d num">{n2(r.rmse)}</td><td className="d num">{n2(r.r2)}</td>
              </tr>))}
            </tbody>
          </table></div>
          <p className="peq">{bo.nota_cv}</p>
          <h3 className="sub-h">Clasificar en Baja, Media o Alta acierta casi como el azar</h3>
          <p className="peq">Exactitud (%) con tres niveles definidos por terciles del rendimiento.</p>
          <Barras dominio={100} formato={n1} unidad="% de exactitud" anchoEtiqueta={130}
            datos={bo.clasificacion.map(c => ({ nombre: c.modelo, valor: c.exactitud, resaltar: c.base }))} />
        </div>

        <div className="caja ancha">
          <span className="chip-nb rotulo">Notebook 2</span>
          <h3>K-Means encuentra {km.k} perfiles de lote, pero se traslapan</h3>
          <p className="peq">Centroides en unidades originales. La silueta quedó {km.silueta_rango}.</p>
          <div className="tabla"><table>
            <thead><tr><th>Grupo</th><th className="d">Fertilizante (kg)</th><th className="d">pH</th><th className="d">Precipitación (mm)</th><th className="d">Rendimiento (ton/ha)</th><th>Lectura</th></tr></thead>
            <tbody>{km.grupos.map(g => (
              <tr key={g.grupo}>
                <td>{g.grupo}</td><td className="d num">{n0(g.fertilizante)}</td><td className="d num">{n1(g.ph)}</td>
                <td className="d num">{n0(g.precipitacion)}</td><td className="d num">{n1(g.rendimiento)}</td>
                <td><span className={g.lectura === 'Alto' ? 'pastilla alta' : 'pastilla baja'}>{g.lectura}</span></td>
              </tr>))}
            </tbody>
          </table></div>
          <p className="peq">El grupo 0 rinde 13,2 ton/ha con poco fertilizante y el grupo 1 rinde 6,4 con mucho. Con una silueta de {n2(km.silueta)}, los lotes forman un continuo más que perfiles claramente distintos.</p>
        </div>
      </div>
      <p className="peq">Fuente de los resultados: {m.fuente}.</p>
    </>
  )
}
