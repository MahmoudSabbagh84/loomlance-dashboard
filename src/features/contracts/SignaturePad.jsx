import { useRef } from 'react'
import { Button } from '@/components/ui/Button'

// A minimal draw-your-signature canvas. Emits the PNG data URL via onChange on each stroke end;
// Clear resets to ''. No external dependency; pointer events cover mouse + touch.
export function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)

  const ctx = () => canvasRef.current?.getContext('2d') ?? null
  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const start = (e) => {
    const c = ctx()
    if (!c) return
    drawing.current = true
    c.lineWidth = 2
    c.lineCap = 'round'
    c.strokeStyle = '#0f172a'
    const { x, y } = pos(e)
    c.beginPath()
    c.moveTo(x, y)
  }
  const move = (e) => {
    if (!drawing.current) return
    const c = ctx()
    if (!c) return
    const { x, y } = pos(e)
    c.lineTo(x, y)
    c.stroke()
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    onChange(canvasRef.current?.toDataURL('image/png') ?? '')
  }
  const clear = () => {
    const c = ctx()
    if (c && canvasRef.current) c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    onChange('')
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        aria-label="Signature pad"
        width={480}
        height={160}
        className="w-full touch-none rounded-md border border-border bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="mt-1 flex justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={clear}>
          Clear
        </Button>
      </div>
    </div>
  )
}
