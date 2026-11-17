import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ErrorApi } from './api'

/** Ventana de confirmación para acciones que no se pueden deshacer. */
export default function Confirmar({ abierto, titulo, children, boton, accion, onCerrar, onHecho }: {
  abierto: boolean; titulo: string; children: ReactNode; boton: string
  accion: () => Promise<unknown>; onCerrar: () => void; onHecho: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current!
    if (abierto) { setError(null); if (!d.open) d.showModal() } else if (d.open) d.close()
  }, [abierto])

  async function confirmar() {
    setTrabajando(true)
    try { await accion(); onHecho() }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudo completar la acción. Intenta de nuevo.') }
    finally { setTrabajando(false) }
  }

  return (
    <dialog ref={ref} className="modal pequeno" onCancel={e => { e.preventDefault(); onCerrar() }} aria-labelledby="t-confirmar">
      {abierto && (
        <div className="confirmar">
          <h2 id="t-confirmar">{titulo}</h2>
          {children}
          {error && <p className="error" role="alert">{error}</p>}
          <footer className="modal-pie">
            <button type="button" onClick={onCerrar}>Cancelar</button>
            <button type="button" className="peligro-lleno" onClick={confirmar} disabled={trabajando}>{trabajando ? 'Un momento…' : boton}</button>
          </footer>
        </div>
      )}
    </dialog>
  )
}
