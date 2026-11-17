import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { n0, n2 } from './formato'

/** Mide el ancho disponible para que los SVG se dibujen a escala real. */
function useAncho<T extends HTMLElement>(minimo = 280) {
  const ref = useRef<T>(null)
  const [ancho, setAncho] = useState(520)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(minimo, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [minimo])
  return [ref, ancho] as const
}

/** Etiqueta flotante: cualquier elemento con data-tip la muestra al pasar el ratón o tocarlo. */
export function Tooltip() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const tip = ref.current!
    const mover = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest?.('[data-tip]')
      if (!t) { tip.style.opacity = '0'; return }
      tip.textContent = t.getAttribute('data-tip')
      tip.style.opacity = '1'
      const w = tip.offsetWidth, h = tip.offsetHeight
      tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, e.clientX + 14)) + 'px'
      tip.style.top = (e.clientY - h - 12 < 8 ? e.clientY + 18 : e.clientY - h - 12) + 'px'
    }
    const ocultar = () => { tip.style.opacity = '0' }
    document.addEventListener('pointermove', mover)
    document.addEventListener('pointerdown', mover)
    addEventListener('scroll', ocultar, { passive: true })
    return () => {
      document.removeEventListener('pointermove', mover)
      document.removeEventListener('pointerdown', mover)
      removeEventListener('scroll', ocultar)
    }
  }, [])
  return <div id="tip" ref={ref} role="tooltip" />
}

export interface Barra { nombre: string; valor: number | null; lotes?: number; resaltar?: boolean }

/** Barras horizontales con valor al final y una línea de referencia opcional. */
export function Barras({ datos, dominio, formato, unidad, referencia, anchoEtiqueta = 120 }: {
  datos: Barra[]; dominio: number; formato: (n: number | null) => string; unidad: string
  referencia?: number | null; anchoEtiqueta?: number
}) {
  if (!datos.length) return <p className="vacio">No hay lotes con este filtro.</p>
  const cols = { gridTemplateColumns: `minmax(80px, ${anchoEtiqueta}px) minmax(0, 1fr) 44px` }
  return (
    <div className="barras">
      {datos.map(d => {
        const w = d.valor === null ? 0 : Math.max(0, Math.min(100, (d.valor / dominio) * 100))
        const tip = d.valor === null ? `${d.nombre}: sin datos`
          : `${d.nombre}: ${formato(d.valor)} ${unidad}${d.lotes !== undefined ? ` · ${n0(d.lotes)} lotes` : ''}`
        return (
          <div className="fila-barra" style={cols} key={d.nombre} data-tip={tip}>
            <span className="eti">{d.nombre}</span>
            <div className="pista">
              <div className={d.resaltar ? 'barra resaltada' : 'barra'} style={{ width: `${w}%` }} />
              {referencia != null && <i className="ref" style={{ left: `${Math.min(100, (referencia / dominio) * 100)}%` }} />}
            </div>
            <span className="val">{formato(d.valor)}</span>
          </div>
        )
      })}
      <div className="eje" style={{ marginLeft: `calc(${anchoEtiqueta}px + 10px)` }}>
        <span>0</span><span>{n0(dominio)}</span>
      </div>
    </div>
  )
}

export interface Punto { etiqueta: string; detalle: string; valor: number | null; lotes: number }

/** Línea de rendimiento medio por tramo, con el promedio como referencia. */
export function Linea({ puntos, promedio, descripcion, minLotes = 5, yMax = 12 }: {
  puntos: Punto[]; promedio: number | null; descripcion: string; minLotes?: number; yMax?: number
}) {
  const [ref, W] = useAncho<HTMLDivElement>()
  const H = 240, L = 30, R = 12, T = 12, B = 30
  const pw = W - L - R, ph = H - T - B
  const ok = (p: Punto) => p.valor !== null && p.lotes >= minLotes
  const validos = puntos.filter(ok)
  const x = (i: number) => L + (puntos.length === 1 ? 0 : i / (puntos.length - 1)) * pw
  const y = (v: number) => T + (1 - Math.min(v, yMax) / yMax) * ph
  const paso = Math.max(1, Math.ceil((puntos.length * 58) / pw))

  let d = '', pluma = false
  puntos.forEach((p, i) => {
    if (!ok(p)) { pluma = false; return }
    d += `${pluma ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.valor!).toFixed(1)}`
    pluma = true
  })

  return (
    <div ref={ref}>
      {validos.length < 2 ? <p className="vacio">Hay muy pocos lotes con este filtro para dibujar la línea.</p> : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descripcion}>
          {[0, 3, 6, 9, 12].map(t => (
            <g key={t}>
              <line className="rejilla" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
              <text x={L - 6} y={y(t) + 4} textAnchor="end">{t}</text>
            </g>
          ))}
          {puntos.map((p, i) => i % paso === 0 && (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === puntos.length - 1 ? 'end' : 'middle'}>{p.etiqueta}</text>
          ))}
          {promedio !== null && <line className="linea-prom" x1={L} x2={W - R} y1={y(promedio)} y2={y(promedio)} />}
          <path className="trazo" d={d} />
          {puntos.map((p, i) => ok(p) && (
            <g key={i}>
              <circle className="punto"cx={x(i)} cy={y(p.valor!)} r={4.5} />
              <circle className="zona" cx={x(i)} cy={y(p.valor!)} r={16}
                data-tip={`${p.detalle}: ${n2(p.valor)} ton/ha · ${n0(p.lotes)} lotes`} />
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}

/** Histograma del rendimiento (ton/ha) con la línea del promedio. */
export function Histograma({ tramos, promedio }: { tramos: { desde: number; lotes: number }[]; promedio: number | null }) {
  const [ref, W] = useAncho<HTMLDivElement>()
  const H = 210, L = 34, R = 8, T = 22, B = 26
  const pw = W - L - R, ph = H - T - B
  const n = tramos.length
  const tope = Math.ceil(Math.max(1, ...tramos.map(t => t.lotes)) / 100) * 100
  const bw = pw / n
  const x = (v: number) => L + (v / n) * pw
  const y = (c: number) => T + (1 - c / tope) * ph
  const total = tramos.reduce((s, t) => s + t.lotes, 0)

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Histograma del rendimiento de ${n0(total)} lotes`}>
        {[0, tope / 2, tope].map(t => (
          <g key={t}>
            <line className="rejilla" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text x={L - 6} y={y(t) + 4} textAnchor="end">{n0(t)}</text>
          </g>
        ))}
        {tramos.map((t, i) => {
          const bx = x(i) + 1, w = Math.max(1, bw - 2), top = y(t.lotes), alto = T + ph - top, r = Math.min(4, w / 2, alto)
          return (
            <g key={i}>
              {t.lotes > 0 && <path className="columna"
                d={`M${bx} ${T + ph}V${top + r}Q${bx} ${top} ${bx + r} ${top}H${bx + w - r}Q${bx + w} ${top} ${bx + w} ${top + r}V${T + ph}Z`} />}
              <rect className="zona" x={x(i)} y={T} width={bw} height={ph} data-tip={`${t.desde} a ${t.desde + 1} ton/ha: ${n0(t.lotes)} lotes`} />
            </g>
          )
        })}
        {[0, 5, 10, 15].map(t => <text key={t} x={x(t)} y={H - 8} textAnchor={t === 0 ? 'start' : 'middle'}>{t}</text>)}
        <text x={W - R} y={H - 8} textAnchor="end">ton/ha</text>
        {promedio !== null && (
          <g>
            <line className="linea-prom" x1={x(promedio)} x2={x(promedio)} y1={T - 6} y2={T + ph} />
            <text className="texto-prom" x={x(promedio) + 6} y={T - 8}>promedio {n2(promedio)}</text>
          </g>
        )}
      </svg>
    </div>
  )
}
