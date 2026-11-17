import type { Modelos as M, Opciones, Resumen } from './api'
import { Histograma } from './graficos'
import Explorador from './Explorador'
import Modelos from './Modelos'
import { n0, n1, n2 } from './formato'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const mesAnio = (s: string) => { const [a, m] = s.split('-'); return `${MESES[Number(m) - 1]} de ${a}` }

export default function Analisis({ op, res, mod, version, irA }: {
  op: Opciones; res: Resumen; mod: M; version: number; irA: (vista: string) => void
}) {
  const cal = res.calidad, ind = res.indicadores
  const corrs = res.correlaciones.map(c => c.r).filter((r): r is number => r !== null)
  const nulos = Object.values(cal.nulos)
  const registrados = res.origen.registrado ?? 0

  return (
    <main>
      <section id="inicio" className="portada-bloque">
        <div className="portada">
          <div className="portada-txt">
            <span className="caso">Caso 2 · AgroData · Santander</span>
            <h1>¿Qué hace que un lote rinda más?</h1>
            <p className="entrada">Analizamos {n0(cal.lotes_unicos)} lotes de pequeños y medianos productores de AgroAndes para encontrar los factores asociados a la productividad y apoyar la planificación de futuras cosechas.</p>
            <div className="acciones">
              <button type="button" className="primario" onClick={() => irA('lotes')}>Registrar un lote</button>
              <button type="button" onClick={() => irA('clima')}>Ver el clima de hoy</button>
            </div>
            <p className="autores">Yohiner · Carlos Manuel · Manuel</p>
          </div>
          <figure className="portada-fig">
            <span className="rotulo">Rendimiento de {n0(ind.lotes_con_rendimiento)} lotes</span>
            <Histograma tramos={res.histograma} promedio={ind.rendimiento_medio} />
            <figcaption className="peq">Cada barra cuenta los lotes con ese rendimiento (ton/ha). La línea marca el promedio. La variación entre lotes es grande, y la pregunta es qué la explica.</figcaption>
          </figure>
        </div>
        <div className="cifras">
          <div className="cifra"><div className="n">{n0(ind.lotes)}</div><p>lotes en la base de datos{registrados > 0 && `, ${n0(registrados)} ${registrados === 1 ? 'registrado' : 'registrados'} desde la página`}</p></div>
          <div className="cifra"><div className="n">{n2(ind.rendimiento_medio)}<small>ton/ha</small></div><p>rendimiento promedio</p></div>
          <div className="cifra"><div className="n">5</div><p>tipos de modelo probados</p></div>
          <div className="cifra"><div className="n">0</div><p>modelos que superan con claridad al promedio</p></div>
        </div>
      </section>

      <section id="contexto" aria-labelledby="t-ctx">
        <div className="cabeza"><span className="rotulo">Contexto</span>
          <h2 id="t-ctx">Hay información histórica, pero no se sabe qué factores importan</h2></div>
        <div className="col3">
          <div className="caja"><h3>Quiénes son</h3><p>AgroAndes es una organización ficticia que agrupa a pequeños y medianos productores agrícolas de Santander, con varios cultivos.</p></div>
          <div className="caja"><h3>El problema</h3><p>Ya registran producción, clima, terreno, fertilizantes y rendimiento, pero les cuesta identificar qué factores se relacionan con mejores cosechas.</p></div>
          <div className="caja"><h3>El objetivo</h3><p>Usar Ciencia de Datos para analizar esa información y crear herramientas que apoyen la planificación de futuras cosechas.</p></div>
        </div>
      </section>

      <section id="datos" aria-labelledby="t-dat">
        <div className="cabeza"><span className="rotulo">Los datos</span>
          <h2 id="t-dat">{op.municipios.length} municipios, {op.cultivos.length} cultivos y cosechas de {op.anios[0]} a {op.anios[op.anios.length - 1]}</h2>
          <p className="entrada">El archivo <span className="mono">02_AgroData_Productividad_Agricola.csv</span> tiene {n0(cal.filas)} filas. Quitando {n0(cal.duplicadas)} duplicadas quedan {n0(cal.lotes_unicos)} lotes{res.periodo && <>, cosechados entre {mesAnio(res.periodo.desde)} y {mesAnio(res.periodo.hasta)}</>}.</p></div>
        <div className="col2">
          <div className="caja">
            <h3>Dónde y qué</h3>
            <span className="rotulo">Municipios</span>
            <div className="chips">{op.municipios.map(m => <span className="chip" key={m}>{m}</span>)}</div>
            <span className="rotulo">Cultivos</span>
            <div className="chips">{op.cultivos.map(c => <span className="chip" key={c}>{c}</span>)}</div>
            <span className="rotulo">Sistema de riego</span>
            <div className="chips">{op.riegos.map(r => <span className="chip" key={r.valor}>{r.nombre}</span>)}</div>
          </div>
          <div className="caja">
            <h3>Variables de cada lote</h3>
            <div className="tabla"><table>
              <thead><tr><th>Variable</th><th className="d">Mínimo</th><th className="d">Máximo</th><th className="d">Promedio</th></tr></thead>
              <tbody>{res.rangos.map(r => (
                <tr key={r.nombre}>
                  <td>{r.nombre === 'Rendimiento' ? <b>Rendimiento (objetivo)</b> : r.nombre}{r.unidad && <span className="peq"> {r.unidad}</span>}</td>
                  <td className="d num">{n1(r.min)}</td><td className="d num">{n1(r.max)}</td><td className="d num">{n1(r.media)}</td>
                </tr>))}
              </tbody>
            </table></div>
            <p className="peq">Valores tras la limpieza. La producción (ton) no se usó para predecir, porque solo se conoce después de cosechar.</p>
          </div>
          <div className="caja ancha">
            <h3>Limpieza: los errores que traía el archivo</h3>
            <div className="tabla"><table>
              <thead><tr><th>Problema</th><th className="d">Casos</th><th>Tratamiento</th></tr></thead>
              <tbody>
                <tr><td>Filas duplicadas</td><td className="d num">{n0(cal.duplicadas)}</td><td>Se eliminan</td></tr>
                <tr><td>Cultivo escrito de {cal.variantes_cultivo} formas distintas ({cal.ejemplos_cultivo.filter(c => /caf|ma[ií]z/i.test(c)).map(c => `"${c}"`).join(', ')})</td><td className="d num">{cal.variantes_cultivo} → {op.cultivos.length}</td><td>Se normaliza a {op.cultivos.length} cultivos</td></tr>
                <tr><td>Fertilizante guardado como texto, algunos con "kg"</td><td className="d num">{n0(cal.fertilizante_con_kg)}</td><td>Se convierte a número</td></tr>
                <tr><td>Áreas menores o iguales a 0</td><td className="d num">{n0(cal.areas_no_positivas)}</td><td>Se tratan como nulos</td></tr>
                <tr><td>pH fuera del rango 3 a 10 (había valores entre {n0(cal.ph_min)} y {n0(cal.ph_max)})</td><td className="d num">{n0(cal.ph_fuera_de_rango)}</td><td>Se tratan como nulos</td></tr>
                <tr><td>Rendimientos imposibles (hasta {n1(cal.rendimiento_max)} ton/ha)</td><td className="d num">{n0(cal.rendimientos_mayores_20)}</td><td>Los mayores a 20 ton/ha se tratan como nulos</td></tr>
                <tr><td>Celdas vacías en área, precipitación, temperatura, fertilizante y rendimiento</td><td className="d num">{n0(Math.min(...nulos))}–{n0(Math.max(...nulos))} c/u</td><td>Se imputan con la mediana del entrenamiento</td></tr>
              </tbody>
            </table></div>
            <p className="peq">La misma función de limpieza se aplica en los tres notebooks y en este servidor. Los lotes nuevos se validan con estas mismas reglas antes de guardarse.</p>
          </div>
        </div>
      </section>

      <section id="explorar" aria-labelledby="t-exp">
        <div className="cabeza"><span className="rotulo">Explorar</span>
          <h2 id="t-exp">Busca tú mismo un factor que cambie el rendimiento</h2>
          <p className="entrada">Filtra los lotes y elige una variable. El servidor recalcula todo, incluidos los lotes que registres en la página.</p></div>
        <Explorador opciones={op} version={version} />
        {corrs.length > 0 && <p className="peq">Si una variable importara, la línea subiría o bajaría al moverse a la derecha. En todos los casos se queda plana cerca del promedio. Con todos los lotes, la correlación de cada variable con el rendimiento está entre {n2(Math.min(...corrs))} y {n2(Math.max(...corrs))}.</p>}
      </section>

      <section id="modelos" aria-labelledby="t-mod">
        <div className="cabeza"><span className="rotulo">Modelos</span>
          <h2 id="t-mod">Tres notebooks, tres preguntas, la misma respuesta</h2>
          <p className="entrada">Cada modelo se compara contra una línea base que siempre predice el promedio. Si no la supera, no aporta información para planificar.</p></div>
        <Modelos m={mod} />
      </section>

      <section id="hallazgo" className="hallazgo" aria-labelledby="t-hal">
        <span className="rotulo">Hallazgo clave</span>
        <h2 id="t-hal">Con las variables registradas, el rendimiento no es predecible</h2>
        <p>Regresión lineal, árbol, Random Forest, red neuronal y XGBoost fallan de la misma forma: ninguno supera con claridad a predecir siempre el promedio. Cuando modelos tan distintos coinciden, el límite está en los datos y no en los modelos.</p>
        <p className="sello">No es un error de código: es lo que muestran los datos.</p>
      </section>

      <section id="recomendaciones" aria-labelledby="t-rec">
        <div className="cabeza"><span className="rotulo">Recomendaciones</span>
          <h2 id="t-rec">Qué debería hacer AgroAndes con estos resultados</h2></div>
        <div className="col3 recs">
          <div className="caja"><h3>Registrar más datos</h3><p>Variedad sembrada, fecha de siembra, plagas y enfermedades, manejo del suelo y altitud del lote.</p></div>
          <div className="caja"><h3>Mejorar la calidad del registro</h3><p>Validar al ingresar: áreas positivas, pH entre 3 y 10, una lista cerrada de cultivos y fertilizante numérico. El formulario de lotes de esta página ya lo hace.</p></div>
          <div className="caja"><h3>Repetir el análisis</h3><p>Con las nuevas variables, volver a ejecutar los notebooks. Esta página ya recalcula los gráficos con cada lote nuevo.</p></div>
        </div>
        <div className="col2">
          <div className="caja">
            <span className="rotulo">Conclusión</span>
            <h3>Datos limpios, modelos listos y una pregunta abierta</h3>
            <p>Los datos quedaron depurados con una función de limpieza reutilizable. Por ahora no se recomienda usar estos modelos para decidir qué sembrar o cuánto fertilizar. Con más variables de campo, AgroAndes podrá volver a medir si la productividad es predecible.</p>
          </div>
          <div className="caja">
            <span className="rotulo">Material entregado</span>
            <ul className="entregas">
              <li><span>Regresión y redes neuronales</span><span>1_Regresion_Redes_Neuronales_AgroData.ipynb</span></li>
              <li><span>Agrupación K-Means</span><span>2_KMeans_AgroData.ipynb</span></li>
              <li><span>XGBoost y Random Forest</span><span>3_XGBoost_RandomForest_AgroData.ipynb</span></li>
              <li><span>Informe escrito</span><span>Informe_AgroAndes_Productividad_Agricola.docx</span></li>
              <li><span>Presentación</span><span>AgroAndes – Productividad Agrícola.pdf</span></li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
