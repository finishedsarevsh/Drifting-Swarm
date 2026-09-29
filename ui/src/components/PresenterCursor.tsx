import { useEffect, useRef } from 'react'
import gsap from 'gsap'

interface PresenterCursorProps {
  active: boolean
}

/**
 * Linear interpolation
 */
const lerp = (a: number, b: number, n: number) => (1 - n) * a + n * b

/**
 * Map number x from range [a, b] to [c, d]
 */
const map = (x: number, a: number, b: number, c: number, d: number) =>
  ((x - a) * (d - c)) / (b - a) + c

/**
 * Gets cursor position
 */
const getCursorPos = (ev: MouseEvent) => ({
  x: ev.clientX,
  y: ev.clientY,
})

export function PresenterCursor({ active }: PresenterCursorProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const innerRef = useRef<SVGCircleElement>(null)
  const feTurbulenceRef = useRef<SVGFETurbulenceElement>(null)

  useEffect(() => {
    if (!active) return

    const el = svgRef.current
    const inner = innerRef.current
    const feTurbulence = feTurbulenceRef.current || document.querySelector('#cursor-filter > feTurbulence') as SVGFETurbulenceElement | null

    if (!el || !inner || !feTurbulence) return

    let cursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const onMouseMove = (ev: MouseEvent) => {
      cursor = getCursorPos(ev)
    }
    window.addEventListener('mousemove', onMouseMove)

    // Configuration & State matching user specification
    const filterId = '#cursor-filter'
    const radiusOnEnter = 30
    const opacityOnEnter = 1
    const defaultRadius = parseFloat(inner.getAttribute('r') || '20')

    const renderedStyles = {
      tx: { previous: 0, current: 0, amt: 0.15 },
      ty: { previous: 0, current: 0, amt: 0.15 },
      radius: { previous: defaultRadius, current: defaultRadius, amt: 0.15 },
      opacity: { previous: 1, current: 1, amt: 0.15 },
    }

    const primitiveValues = { turbulence: 0 }
    const turbulenceValues = { from: 0.15, to: 0.25 }
    let filterTimeline: gsap.core.Timeline | null = null

    const createFilterTimeline = () => {
      if (filterTimeline) {
        filterTimeline.kill()
      }

      filterTimeline = gsap.timeline({
        paused: true,
        onStart: () => {
          feTurbulence.setAttribute('seed', Math.round(gsap.utils.random(1, 20)).toString())
          inner.style.filter = `url(${filterId})`
          renderedStyles.opacity.current = 1
        },
        onUpdate: () => {
          feTurbulence.setAttribute('baseFrequency', primitiveValues.turbulence.toString())
          renderedStyles.opacity.current = renderedStyles.opacity.previous = map(
            primitiveValues.turbulence,
            turbulenceValues.from,
            turbulenceValues.to,
            1,
            0
          )
        },
        onComplete: () => {
          inner.style.filter = 'none'
          renderedStyles.radius.current = renderedStyles.radius.previous = defaultRadius
        },
      }).to(primitiveValues, {
        duration: 2,
        ease: 'none',
        startAt: { turbulence: turbulenceValues.from },
        turbulence: turbulenceValues.to,
      })
    }

    createFilterTimeline()

    // Hide initially until mouse movement
    el.style.opacity = '0'

    const bounds = el.getBoundingClientRect()
    const halfWidth = bounds.width > 0 ? bounds.width / 2 : 40
    const halfHeight = bounds.height > 0 ? bounds.height / 2 : 40

    const enter = () => {
      renderedStyles.radius.current = radiusOnEnter
      renderedStyles.opacity.current = opacityOnEnter
      createFilterTimeline()
      filterTimeline?.restart()
    }

    const leave = () => {
      inner.style.filter = 'none'
      filterTimeline?.kill()
      renderedStyles.radius.current = defaultRadius
      renderedStyles.opacity.current = 1
    }

    let rafId = 0
    let running = true

    const render = () => {
      if (!running) return

      renderedStyles.tx.current = cursor.x - halfWidth
      renderedStyles.ty.current = cursor.y - halfHeight

      renderedStyles.tx.previous = lerp(
        renderedStyles.tx.previous,
        renderedStyles.tx.current,
        renderedStyles.tx.amt
      )
      renderedStyles.ty.previous = lerp(
        renderedStyles.ty.previous,
        renderedStyles.ty.current,
        renderedStyles.ty.amt
      )
      renderedStyles.radius.previous = lerp(
        renderedStyles.radius.previous,
        renderedStyles.radius.current,
        renderedStyles.radius.amt
      )
      renderedStyles.opacity.previous = lerp(
        renderedStyles.opacity.previous,
        renderedStyles.opacity.current,
        renderedStyles.opacity.amt
      )

      el.style.transform = `translateX(${renderedStyles.tx.previous}px) translateY(${renderedStyles.ty.previous}px)`
      inner.setAttribute('r', renderedStyles.radius.previous.toString())
      el.style.opacity = renderedStyles.opacity.previous.toString()

      rafId = requestAnimationFrame(render)
    }

    const onInitialMouseMove = () => {
      renderedStyles.tx.previous = renderedStyles.tx.current = cursor.x - halfWidth
      renderedStyles.ty.previous = renderedStyles.ty.current = cursor.y - halfHeight
      el.style.opacity = '1'
      rafId = requestAnimationFrame(render)
      window.removeEventListener('mousemove', onInitialMouseMove)
    }
    window.addEventListener('mousemove', onInitialMouseMove)

    // Interactive element hover listeners (delegated for dynamic elements)
    const triggerSelector =
      'a, button, [role="button"], input, select, textarea, .card, .card-elevated, .card-glass, .metric-card'
    let currentTrigger: Element | null = null

    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as Element | null)?.closest?.(triggerSelector)
      if (target && target !== currentTrigger) {
        currentTrigger = target
        enter()
      }
    }

    const handleMouseOut = (e: MouseEvent) => {
      if (currentTrigger) {
        const related = (e.relatedTarget as Element | null)?.closest?.(triggerSelector)
        if (related !== currentTrigger) {
          currentTrigger = null
          leave()
        }
      }
    }

    document.addEventListener('mouseover', handleMouseOver)
    document.addEventListener('mouseout', handleMouseOut)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousemove', onInitialMouseMove)
      document.removeEventListener('mouseover', handleMouseOver)
      document.removeEventListener('mouseout', handleMouseOut)
      if (filterTimeline) {
        filterTimeline.kill()
      }
    }
  }, [active])

  if (!active) return null

  return (
    <>
      {/* SVG Turbulence Filter Element */}
      <svg
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          pointerEvents: 'none',
          zIndex: -1,
          opacity: 0,
        }}
        aria-hidden="true"
      >
        <defs>
          <filter id="cursor-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence
              ref={feTurbulenceRef}
              type="fractalNoise"
              baseFrequency="0.15"
              numOctaves={1}
              result="warp"
            />
            <feDisplacementMap
              xChannelSelector="R"
              yChannelSelector="G"
              scale={40}
              in="SourceGraphic"
              in2="warp"
            />
          </filter>
        </defs>
      </svg>

      {/* Custom Filled Circle SVG Cursor */}
      <svg
        ref={svgRef}
        className="cursor"
        width={80}
        height={80}
        viewBox="0 0 80 80"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          display: 'block',
          pointerEvents: 'none',
          zIndex: 10000,
        }}
      >
        <circle
          ref={innerRef}
          className="cursor__inner"
          cx={40}
          cy={40}
          r={20}
        />
      </svg>
    </>
  )
}
