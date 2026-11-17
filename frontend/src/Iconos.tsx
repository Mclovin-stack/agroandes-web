/** Íconos de clima dibujados en SVG; heredan los colores del tema. */
export function IconoClima({ tipo, dia = true, tam = 40 }: { tipo: string; dia?: boolean; tam?: number }) {
  const sol = dia
    ? <g className="ic-sol"><circle cx="20" cy="18" r="7" />{[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
        <line key={a} x1="20" y1="18" x2={20 + 12 * Math.cos(a * Math.PI / 180)} y2={18 + 12 * Math.sin(a * Math.PI / 180)} className="ic-rayo" />))}</g>
    : <path className="ic-luna" d="M24 8a10 10 0 1 0 8 15 8 8 0 0 1-8-15z" />
  const nube = (x = 0, y = 0) => <path className="ic-nube" transform={`translate(${x} ${y})`} d="M12 34h20a7 7 0 0 0 0-14 9 9 0 0 0-17-2 6 6 0 0 0-3 16z" />
  let contenido
  switch (tipo) {
    case 'sol': contenido = sol; break
    case 'nubes-sol': contenido = <>{sol}{nube(4, 2)}</>; break
    case 'niebla': contenido = <>{nube(0, -4)}{[30, 35].map(y => <line key={y} x1="8" x2="38" y1={y} y2={y} className="ic-niebla" />)}</>; break
    case 'lluvia': contenido = <>{nube(0, -4)}{[14, 22, 30].map(x => <line key={x} x1={x} y1="33" x2={x - 3} y2="39" className="ic-gota" />)}</>; break
    case 'tormenta': contenido = <>{nube(0, -4)}<path className="ic-rayo-t" d="M22 30l-5 7h5l-3 6 8-9h-5l3-4z" /></>; break
    default: contenido = nube()
  }
  return <svg className="icono-clima" width={tam} height={tam} style={{ width: tam, height: tam }} viewBox="0 0 44 44" aria-hidden="true">{contenido}</svg>
}
