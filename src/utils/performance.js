// Performance monitoring and optimization utilities
import React, { useCallback, useMemo, useRef, useEffect, useTransition, useDeferredValue } from 'react'

// Performance metrics tracking
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map()
    this.observers = new Map()
    this.renderCounts = new Map()
  }

  // Start timing a performance metric
  startTiming(name) {
    this.metrics.set(name, {
      startTime: performance.now(),
      endTime: null,
      duration: null
    })
  }

  // End timing a performance metric
  endTiming(name) {
    const metric = this.metrics.get(name)
    if (metric) {
      metric.endTime = performance.now()
      metric.duration = metric.endTime - metric.startTime
      
      // Log slow operations
      if (metric.duration > 100) {
        console.warn(`Slow operation detected: ${name} took ${metric.duration.toFixed(2)}ms`)
      }
    }
  }

  // Track component render count
  trackRender(componentName) {
    const current = this.renderCounts.get(componentName) || 0
    this.renderCounts.set(componentName, current + 1)
    
    // Warn about excessive renders
    if (current > 10) {
      console.warn(`Component ${componentName} has rendered ${current + 1} times`)
    }
  }

  // Get performance metrics
  getMetrics() {
    return Array.from(this.metrics.entries()).map(([name, data]) => ({
      name,
      duration: data.duration,
      startTime: data.startTime,
      endTime: data.endTime
    }))
  }

  // Get render counts
  getRenderCounts() {
    return Object.fromEntries(this.renderCounts)
  }

  // Clear metrics
  clearMetrics() {
    this.metrics.clear()
    this.renderCounts.clear()
  }

  // Monitor component render performance
  monitorComponentRender(componentName, renderFn) {
    return (...args) => {
      this.trackRender(componentName)
      this.startTiming(`render-${componentName}`)
      const result = renderFn(...args)
      this.endTiming(`render-${componentName}`)
      return result
    }
  }

  // Monitor async operations
  async monitorAsync(name, asyncFn) {
    this.startTiming(name)
    try {
      const result = await asyncFn()
      this.endTiming(name)
      return result
    } catch (error) {
      this.endTiming(name)
      throw error
    }
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

// Modern React performance optimization hooks
export const usePerformanceOptimization = () => {
  const startRender = useCallback((componentName) => {
    performanceMonitor.startTiming(`render-${componentName}`)
  }, [])

  const endRender = useCallback((componentName) => {
    performanceMonitor.endTiming(`render-${componentName}`)
  }, [])

  const trackRender = useCallback((componentName) => {
    performanceMonitor.trackRender(componentName)
  }, [])

  return { startRender, endRender, trackRender }
}

// Context selector hook for preventing unnecessary re-renders
export const useContextSelector = (context, selector) => {
  const contextValue = React.useContext(context)
  const selectorRef = useRef(selector)
  const selectedValueRef = useRef()

  // Update selector ref if it changed
  if (selectorRef.current !== selector) {
    selectorRef.current = selector
  }

  // Calculate selected value
  const selectedValue = useMemo(() => {
    const newSelectedValue = selectorRef.current(contextValue)
    
    // Only update if the selected value actually changed
    if (selectedValueRef.current === undefined || 
        !Object.is(selectedValueRef.current, newSelectedValue)) {
      selectedValueRef.current = newSelectedValue
    }
    
    return selectedValueRef.current
  }, [contextValue])

  return selectedValue
}

// useCallback factory for creating stable callbacks
export const useCallbackFactory = (factory) => {
  const factoryRef = useRef(factory)
  const callbacksRef = useRef(new Map())

  // Update factory ref if it changed
  if (factoryRef.current !== factory) {
    factoryRef.current = factory
  }

  return useCallback((key, ...args) => {
    if (!callbacksRef.current.has(key)) {
      callbacksRef.current.set(key, factoryRef.current(key))
    }
    return callbacksRef.current.get(key)(...args)
  }, [])
}

// useMemo factory for creating stable memoized values
export const useMemoFactory = (factory) => {
  const factoryRef = useRef(factory)
  const memoizedRef = useRef(new Map())

  // Update factory ref if it changed
  if (factoryRef.current !== factory) {
    factoryRef.current = factory
  }

  return useCallback((key, ...args) => {
    if (!memoizedRef.current.has(key)) {
      memoizedRef.current.set(key, factoryRef.current(key))
    }
    return memoizedRef.current.get(key)(...args)
  }, [])
}

// Hook for managing transitions with performance tracking
export const useOptimizedTransition = () => {
  const [isPending, startTransition] = useTransition()
  
  const optimizedStartTransition = useCallback((callback) => {
    performanceMonitor.startTiming('transition')
    startTransition(() => {
      callback()
      performanceMonitor.endTiming('transition')
    })
  }, [startTransition])

  return [isPending, optimizedStartTransition]
}

// Hook for deferred values with performance tracking
export const useOptimizedDeferredValue = (value) => {
  const deferredValue = useDeferredValue(value)
  
  useEffect(() => {
    if (deferredValue !== value) {
      performanceMonitor.startTiming('deferred-value-update')
      performanceMonitor.endTiming('deferred-value-update')
    }
  }, [deferredValue, value])

  return deferredValue
}

// Bundle size optimization utilities
export const bundleOptimizations = {
  // Lazy load components with error boundaries
  lazyLoad: (importFn, fallback = null) => {
    const LazyComponent = React.lazy(importFn)
    
    return React.memo((props) => (
      <React.Suspense fallback={fallback || <div>Loading...</div>}>
        <LazyComponent {...props} />
      </React.Suspense>
    ))
  },

  // Preload critical components
  preloadComponent: (importFn) => {
    const componentPromise = importFn()
    return componentPromise
  },

  // Code splitting utilities with error boundaries
  createAsyncComponent: (importFn, fallback = null) => {
    const LazyComponent = React.lazy(importFn)
    
    return React.memo((props) => (
      <React.Suspense fallback={fallback || <div>Loading...</div>}>
        <LazyComponent {...props} />
      </React.Suspense>
    ))
  }
}

// Memory optimization utilities with modern patterns
export const memoryOptimizations = {
  // Debounce function to prevent excessive calls
  debounce: (func, wait) => {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  },

  // Throttle function to limit execution frequency
  throttle: (func, limit) => {
    let inThrottle
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  },

  // Memoize expensive calculations with LRU cache
  memoize: (fn, maxSize = 100) => {
    const cache = new Map()
    
    return (...args) => {
      const key = JSON.stringify(args)
      
      if (cache.has(key)) {
        // Move to end (most recently used)
        const value = cache.get(key)
        cache.delete(key)
        cache.set(key, value)
        return value
      }
      
      const result = fn(...args)
      
      // Remove oldest if cache is full
      if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value
        cache.delete(firstKey)
      }
      
      cache.set(key, result)
      return result
    }
  },

  // WeakMap-based memoization for object keys
  memoizeWeak: (fn) => {
    const cache = new WeakMap()
    
    return (obj, ...args) => {
      if (!cache.has(obj)) {
        cache.set(obj, fn(obj, ...args))
      }
      return cache.get(obj)
    }
  }
}

// Network optimization utilities
export const networkOptimizations = {
  // Batch API calls with modern Promise patterns
  batchRequests: (requests, batchSize = 5) => {
    const batches = []
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize))
    }
    return batches
  },

  // Cache API responses with TTL and size limits
  createApiCache: (ttl = 5 * 60 * 1000, maxSize = 100) => { // 5 minutes default TTL
    const cache = new Map()
    
    return {
      get: (key) => {
        const item = cache.get(key)
        if (item && Date.now() - item.timestamp < ttl) {
          // Move to end (most recently used)
          cache.delete(key)
          cache.set(key, item)
          return item.data
        }
        cache.delete(key)
        return null
      },
      set: (key, data) => {
        // Remove oldest if cache is full
        if (cache.size >= maxSize) {
          const firstKey = cache.keys().next().value
          cache.delete(firstKey)
        }
        
        cache.set(key, {
          data,
          timestamp: Date.now()
        })
      },
      clear: () => cache.clear(),
      size: () => cache.size
    }
  },

  // Request deduplication
  createRequestDeduplicator: () => {
    const pendingRequests = new Map()
    
    return async (key, requestFn) => {
      if (pendingRequests.has(key)) {
        return pendingRequests.get(key)
      }
      
      const promise = requestFn().finally(() => {
        pendingRequests.delete(key)
      })
      
      pendingRequests.set(key, promise)
      return promise
    }
  }
}

// DOM optimization utilities
export const domOptimizations = {
  // Virtual scrolling for large lists with modern patterns
  createVirtualScroll: (itemHeight, containerHeight, items) => {
    const visibleItems = Math.ceil(containerHeight / itemHeight) + 2 // Buffer
    const totalHeight = items.length * itemHeight
    
    return {
      getVisibleRange: (scrollTop) => {
        const startIndex = Math.floor(scrollTop / itemHeight)
        const endIndex = Math.min(startIndex + visibleItems, items.length)
        return { startIndex, endIndex }
      },
      getItemStyle: (index) => ({
        position: 'absolute',
        top: index * itemHeight,
        height: itemHeight,
        width: '100%'
      }),
      totalHeight
    }
  },

  // Intersection observer for lazy loading with modern options
  createIntersectionObserver: (callback, options = {}) => {
    return new IntersectionObserver(callback, {
      rootMargin: '50px',
      threshold: 0.1,
      ...options
    })
  },

  // Resize observer for responsive components
  createResizeObserver: (callback) => {
    return new ResizeObserver(callback)
  }
}

// Performance reporting with modern analytics
export const performanceReporting = {
  // Report performance metrics with detailed analysis
  reportMetrics: () => {
    const metrics = performanceMonitor.getMetrics()
    const renderCounts = performanceMonitor.getRenderCounts()
    const slowOperations = metrics.filter(m => m.duration > 100)
    
    if (slowOperations.length > 0) {
      console.group('Performance Report')
      console.table(slowOperations)
      console.groupEnd()
    }
    
    // Report excessive renders
    const excessiveRenders = Object.entries(renderCounts)
      .filter(([_, count]) => count > 10)
    
    if (excessiveRenders.length > 0) {
      console.group('Excessive Renders')
      console.table(excessiveRenders)
      console.groupEnd()
    }
    
    return { metrics, renderCounts }
  },

  // Report bundle size with modern metrics
  reportBundleSize: () => {
    if (typeof window !== 'undefined' && window.performance) {
      const navigation = window.performance.getEntriesByType('navigation')[0]
      if (navigation) {
        console.log('Page Load Time:', navigation.loadEventEnd - navigation.loadEventStart, 'ms')
        console.log('DOM Content Loaded:', navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart, 'ms')
        console.log('First Contentful Paint:', window.performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime || 'N/A', 'ms')
      }
    }
  },

  // Report memory usage
  reportMemoryUsage: () => {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = performance.memory
      console.log('Memory Usage:', {
        used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)} MB`,
        total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)} MB`,
        limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)} MB`
      })
    }
  }
}

// Modern error boundary for performance monitoring
export class PerformanceErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Performance Error Boundary caught an error:', error, errorInfo)
    performanceMonitor.startTiming('error-recovery')
    performanceMonitor.endTiming('error-recovery')
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong.</div>
    }

    return this.props.children
  }
}

// Export all utilities
export default {
  performanceMonitor,
  bundleOptimizations,
  memoryOptimizations,
  networkOptimizations,
  domOptimizations,
  performanceReporting,
  PerformanceErrorBoundary,
  usePerformanceOptimization,
  useContextSelector,
  useCallbackFactory,
  useMemoFactory,
  useOptimizedTransition,
  useOptimizedDeferredValue
}
