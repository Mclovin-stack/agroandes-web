import { useEffect, useRef, useState } from 'react'
import { api, ErrorApi } from './api'

/** Ventana para iniciar sesión como administrador. `motivo` explica por qué se pide (editar, borrar…). */
export default function Ingreso({ abierto, motivo, onCerrar, onIngreso }: {
  abierto: boolean; motivo: string | null; onCerrar: () => void; onIngreso: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const [clave, setClave] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const d = ref.current!
    if (abierto) {
      setClave(''); setError(null); setVer(false)
      if (!d.open) d.showModal()
      requestAnimationFrame(() => campo.current?.focus())
    } else if (d.open) d.close()
  }, [abierto])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!clave) { setError('Escribe la contraseña.'); return }
    setEnviando(true)
    try {
      await api.ingresar(clave)
      onIngreso()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo iniciar sesión. Intenta de nuevo.')
      campo.current?.select()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <dialog ref={ref} className="modal pequeno" onCancel={e => { e.preventDefault(); onCerrar() }} aria-labelledby="t-ingreso">
      <form className="confirmar" onSubmit={enviar} noValidate>
        <div className="modal-cab">
          <h2 id="t-ingreso">Acceso de administrador</h2>
          <button type="button" className="cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        <p>{motivo ?? 'Inicia sesión para editar, borrar o restaurar lotes.'}</p>
        <label className="campo" htmlFor="claveAdmin">Contraseña
          <span className="clave-fila">
            <input id="claveAdmin" ref={campo} type={ver ? 'text' : 'password'} autoComplete="current-password"
              value={clave} onChange={e => { setClave(e.target.value); setError(null) }}
              aria-invalid={!!error || undefined} aria-describedby={error ? 'e-clave' : undefined} />
            <button type="button" className="mini" onClick={() => setVer(v => !v)} aria-pressed={ver}>{ver ? 'Ocultar' : 'Mostrar'}</button>
          </span>
          {error && <span className="campo-error" id="e-clave" role="alert">{error}</span>}
        </label>
        <p className="peq">La sesión dura 8 horas o hasta que cierres esta pestaña.</p>
        <footer className="modal-pie">
          <button type="button" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="primario" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        </footer>
      </form>
    </dialog>
  )
}
