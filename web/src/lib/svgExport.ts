// Rasterize a live <svg> to a PNG download. The SVG is styled by external CSS
// (design tokens), which does NOT travel with a serialized clone — so we walk
// the tree and inline the computed presentation styles first. This keeps the
// export faithful in both light and dark themes.

const STYLE_PROPS = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray',
  'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size',
  'font-weight', 'letter-spacing', 'text-anchor',
]

function inlineStyles(src: Element, clone: Element): void {
  const cs = getComputedStyle(src)
  let s = clone.getAttribute('style') ?? ''
  for (const p of STYLE_PROPS) {
    const v = cs.getPropertyValue(p)
    if (v && v !== 'none' && v !== 'normal') s += `${p}:${v};`
  }
  clone.setAttribute('style', s)
  const sc = src.children, cc = clone.children
  for (let i = 0; i < sc.length && i < cc.length; i++) inlineStyles(sc[i], cc[i])
}

export function exportSvgToPng(svg: SVGSVGElement, filename: string, bg: string, scale = 2): Promise<void> {
  return new Promise((resolve, reject) => {
    const vb = svg.viewBox.baseVal
    const w = vb && vb.width ? vb.width : svg.clientWidth
    const h = vb && vb.height ? vb.height : svg.clientHeight

    const clone = svg.cloneNode(true) as SVGSVGElement
    inlineStyles(svg, clone)
    clone.setAttribute('width', String(w))
    clone.setAttribute('height', String(h))
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

    const xml = new XMLSerializer().serializeToString(clone)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas unavailable'))
      ctx.fillStyle = bg || '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Export failed'))
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        resolve()
      }, 'image/png')
    }
    img.onerror = () => reject(new Error('Render failed'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  })
}
