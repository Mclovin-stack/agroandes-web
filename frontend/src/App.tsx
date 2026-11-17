import { useCallback, useEffect, useState } from 'react'
import { api, type Modelos as M, type Opciones, type Resumen } from './api'
import { Tooltip } from './graficos'
import Analisis from './Analisis'
import Lotes from './Lotes'
import Clima from './Clima'

type Vista = 'analisis' | 'lotes' | 'clima'
const vistaDe = (hash: string): Vista => (hash === '#lotes' ? 'lotes' : hash === '#clima' ? 'clima' : 'analisis')

function Hoja() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="hoja">
      <path d="M16 29V13" stroke="var(--hoja)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M16 15c0-6 4-10 11-10 0 7-4 11-11 10z" fill="var(--hoja)" />
      <path d="M16 21c0-5-3-8-9-8 0 5 3 8 9 8z" fill="var(--maiz)" />
    </svg>
  )
}

export default function App() {
  const [vista, setVista] = useState<Vista>(vistaDe(location.hash))
  const [op, setOp] = useState<Opciones | null>(null)
  const [res, setRes] = useState<Resumen | null>(null)
  const [mod, setMod] = useState<M | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [aviso, setAviso] = useState<{ texto: string; id: number } | null>(null)

  // navegación por #lotes, #clima o cualquier sección del análisis
  useEffect(() => {
    const cambiar = () => {
      const v = vistaDe(location.hash)
      setVista(v)
      const id = location.hash.slice(1)
      requestAnimationFrame(() => {
        const el = v === 'analisis' && id ? document.getElementById(id) : null
        if (el) el.scrollIntoView()
        else window.scrollTo(0, 0)
      })
    }
    addEventListener('hashchange', cambiar)
    return () => removeEventListener('hashchange', cambiar)
  }, [])

  // datos generales; se vuelven a pedir cuando cambian los lotes
  useEffect(() => {
    const ctl = new AbortController()
    Promise.all([api.opciones(ctl.signal), api.resumen(ctl.signal), mod ? Promise.resolve(mod) : api.modelos(ctl.signal)])
      .then(([o, r, m]) => { setOp(o); setRes(r); setMod(m); setError(null) })
      .catch(e => { if (e.name !== 'AbortError') setError(String(e.message ?? e)) })
    return () => ctl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  const onCambio = useCallback((texto: string) => {
    setVersion(v => v + 1)
    setAviso({ texto, id: Date.now() })
  }, [])

  const irA = (v: string) => { location.hash = v }

  const enlace = (v: Vista, hash: string, texto: string) => (
    <li><a href={hash} aria-current={vista === v ? 'page' : undefined}>{texto}</a></li>
  )

  return (
    <>
      <div className="envoltura">
        <header className="barra-sup">
          <a className="marca" href="#inicio"><Hoja />AgroAndes</a>
          <nav aria-label="Principal"><ul>
            {enlace('analisis', '#inicio', 'Análisis')}
            {enlace('lotes', '#lotes', 'Lotes')}
            {enlace('clima', '#clima', 'Clima')}
          </ul></nav>
        </header>

        {error && !op ? (
          <main><div className="aviso" role="alert">
            <h2>No se pudo conectar con el servidor</h2>
            <p>La página necesita el backend de AgroAndes encendido. Ábrelo con <code>uvicorn app.main:app</code> desde la carpeta <code>backend</code> y recarga.</p>
            <p className="peq">Detalle: {error}</p>
          </div></main>
        ) : vista === 'clima' ? (
          <Clima />
        ) : !op || !res || !mod ? (
          <main><p className="cargando">Cargando datos de AgroAndes…</p></main>
        ) : vista === 'lotes' ? (
          <Lotes opciones={op} version={version} onCambio={onCambio} />
        ) : (
          <Analisis op={op} res={res} mod={mod} version={version} irA={irA} />
        )}

        <footer className="pie">
          <span>AgroAndes · Caso 2 AgroData · Productividad agrícola en Santander</span>
          <span>Yohiner, Carlos Manuel y Manuel · 2026</span>
        </footer>
      </div>
      {aviso && <div className="toast" role="status" key={aviso.id}>✓ {aviso.texto}</div>}
      <Tooltip />
    </>
  )
}
