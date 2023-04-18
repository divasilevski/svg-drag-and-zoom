// -- Types --
interface Props {
  isRotatable?: boolean
}

interface Point {
  x: number
  y: number
}

interface MatrixProps {
  one: Point
  two: Point
  newOne: Point
  newTwo: Point
}

function isSvgElement(el?: Element): el is SVGSVGElement {
  return !!el && el.nodeName === 'svg'
}

// -- Element Helpers --

function setTouchMove(onTouchMove: (event: TouchEvent) => void) {
  const onTouchEnd = (event: TouchEvent) => {
    event.preventDefault()

    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('touchend', onTouchEnd)
  }

  document.addEventListener('touchmove', onTouchMove)
  document.addEventListener('touchend', onTouchEnd)
}

function addGroupElement(parent: SVGSVGElement): SVGGElement {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')

  group.insertAdjacentHTML('afterbegin', parent.innerHTML)
  parent.innerHTML = ''
  parent.appendChild(group)

  return group
}

function getCurrentMatrix(el: SVGGElement): DOMMatrix {
  const parent = el.parentNode as SVGSVGElement
  const childMatrix = el.getScreenCTM()!
  return parent.getScreenCTM()?.inverse().multiply(childMatrix)!
}

function updateMatrix(el: SVGGElement, matrix: DOMMatrix) {
  el.setAttribute('transform', matrix.toString())
}

// -- Transform Maths --
function getTouchCoords(touch: TouchList[0]) {
  return { x: touch?.pageX || 0, y: touch?.pageY || 0 }
}

function getDistance(pointOne: Point, pointTwo: Point) {
  return Math.hypot(pointOne.x - pointTwo.x, pointOne.y - pointTwo.y)
}

function getZoomMatrix({ one, two, newOne, newTwo }: MatrixProps) {
  const d = getDistance(newOne, newTwo) / getDistance(one, two)

  const cx = (newOne.x + newTwo.x) / 2
  const cy = (newOne.y + newTwo.y) / 2

  const tx = cx - d * ((one.x + two.x) / 2)
  const ty = cy - d * ((one.y + two.y) / 2)

  return new DOMMatrix([d, 0, 0, d, tx, ty])
}

function getMatrix({ one, two, newOne, newTwo }: MatrixProps) {
  const d = getDistance(newOne, newTwo) / getDistance(one, two)

  const cx = (newOne.x + newTwo.x) / 2
  const cy = (newOne.y + newTwo.y) / 2

  const atan = Math.atan2(two.y - one.y, two.x - one.x)
  const newAtan = Math.atan2(newTwo.y - newOne.y, newTwo.x - newOne.x)
  const c = Math.cos(newAtan - atan)
  const s = Math.sin(newAtan - atan)

  const tx = cx - d * ((one.x + two.x) / 2) * c + d * ((one.y + two.y) / 2) * s
  const ty = cy - d * ((one.y + two.y) / 2) * c - d * ((one.x + two.x) / 2) * s

  return new DOMMatrix([d * c, d * s, -d * s, d * c, tx, ty])
}

// -- Hook --

export default function ({ isRotatable }: Props = {}) {
  const svgRef = ref<Element>()
  const groupRef = ref<SVGGElement>()
  const matrix = ref<DOMMatrix>()

  const onSingleTouch = (event: TouchEvent) => {
    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault()
    }

    setTouchMove(onTouchMove)
  }

  const onDoubleTouch = (event: TouchEvent) => {
    const initialState = {
      touchOne: getTouchCoords(event.touches[0]),
      touchTwo: getTouchCoords(event.touches[1]),
      matrix: getCurrentMatrix(groupRef.value!),
    }

    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault()

      const matrixParams = {
        one: initialState.touchOne,
        two: initialState.touchTwo,
        newOne: getTouchCoords(event.touches[0]),
        newTwo: getTouchCoords(event.touches[1]),
      }

      const newMatrix = isRotatable
        ? getMatrix(matrixParams)
        : getZoomMatrix(matrixParams)

      matrix.value = newMatrix.multiply(initialState.matrix)
    }

    setTouchMove(onTouchMove)
  }

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 1) onSingleTouch(event)
    if (event.touches.length === 2) onDoubleTouch(event)
  }

  const addListeners = (el: SVGSVGElement) => {
    el.addEventListener('touchstart', onTouchStart, { passive: true })
  }

  const removeListeners = (el: SVGSVGElement) => {
    el.removeEventListener('touchstart', onTouchStart)
  }

  watchEffect(() => {
    if (groupRef.value && matrix.value) {
      updateMatrix(groupRef.value, matrix.value)
    }
  })

  const angle = computed(() => {
    if (matrix.value) {
      const { a, b } = matrix.value
      return Math.atan2(b, a) * (180 / Math.PI)
    }
    return 0
  })

  const scale = computed(() => {
    if (matrix.value) {
      const { a, c } = matrix.value
      return Math.sqrt(a * a + c * c)
    }
    return 0
  })

  onMounted(() => {
    if (isSvgElement(svgRef.value)) {
      groupRef.value = addGroupElement(svgRef.value)
      addListeners(svgRef.value)
    } else {
      console.warn('Please connect svgRef correctly')
    }
  })

  onBeforeUnmount(() => {
    if (isSvgElement(svgRef.value)) {
      removeListeners(svgRef.value)
    }
  })

  return { svgRef, angle, scale }
}