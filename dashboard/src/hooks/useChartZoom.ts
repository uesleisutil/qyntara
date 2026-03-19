import { useState, useCallback, useRef } from 'react';

export interface ZoomState {
  scale: number;
  translateX: number;
  translateY: number;
  minScale: number;
  maxScale: number;
}

export interface ZoomControls {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  setZoom: (scale: number) => void;
  pan: (deltaX: number, deltaY: number) => void;
}

export interface UseChartZoomOptions {
  minScale?: number;
  maxScale?: number;
  zoomStep?: number;
  enableWheel?: boolean;
  enablePinch?: boolean;
  enablePan?: boolean;
  maintainAspectRatio?: boolean;
}

export interface UseChartZoomReturn {
  zoomState: ZoomState;
  controls: ZoomControls;
  handlers: {
    onWheel: (e: React.WheelEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  transform: string;
}

export const useChartZoom = (options: UseChartZoomOptions = {}): UseChartZoomReturn => {
  const {
    minScale = 1,
    maxScale = 10,
    zoomStep = 0.2,
    enableWheel = true,
    enablePinch = true,
    enablePan = true,
    maintainAspectRatio = true
  } = options;

  const [zoomState, setZoomState] = useState<ZoomState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
    minScale,
    maxScale
  });

  const isPanning = useRef(false);
  const lastPosition = useRef({ x: 0, y: 0 });
  const touchDistance = useRef(0);

  const clampScale = useCallback((scale: number): number => {
    return Math.max(minScale, Math.min(maxScale, scale));
  }, [minScale, maxScale]);

  const zoomIn = useCallback(() => {
    setZoomState((prev) => ({
      ...prev,
      scale: clampScale(prev.scale + zoomStep)
    }));
  }, [clampScale, zoomStep]);

  const zoomOut = useCallback(() => {
    setZoomState((prev) => ({
      ...prev,
      scale: clampScale(prev.scale - zoomStep)
    }));
  }, [clampScale, zoomStep]);

  const reset = useCallback(() => {
    setZoomState({
      scale: 1,
      translateX: 0,
      translateY: 0,
      minScale,
      maxScale
    });
  }, [minScale, maxScale]);

  const setZoom = useCallback((scale: number) => {
    setZoomState((prev) => ({
      ...prev,
      scale: clampScale(scale)
    }));
  }, [clampScale]);

  const pan = useCallback((deltaX: number, deltaY: number) => {
    if (!enablePan) return;

    setZoomState((prev) => ({
      ...prev,
      translateX: prev.translateX + deltaX,
      translateY: maintainAspectRatio ? prev.translateY : prev.translateY + deltaY
    }));
  }, [enablePan, maintainAspectRatio]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!enableWheel) return;

    e.preventDefault();
    const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
    setZoomState((prev) => ({
      ...prev,
      scale: clampScale(prev.scale + delta)
    }));
  }, [enableWheel, zoomStep, clampScale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enablePan || e.button !== 0) return;

    isPanning.current = true;
    lastPosition.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, [enablePan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;

    const deltaX = e.clientX - lastPosition.current.x;
    const deltaY = e.clientY - lastPosition.current.y;
    
    pan(deltaX, deltaY);
    lastPosition.current = { x: e.clientX, y: e.clientY };
  }, [pan]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enablePinch) return;

    if (e.touches.length === 2) {
      touchDistance.current = getTouchDistance(e.touches);
    } else if (e.touches.length === 1 && enablePan) {
      isPanning.current = true;
      lastPosition.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
  }, [enablePinch, enablePan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && enablePinch) {
      const newDistance = getTouchDistance(e.touches);
      if (touchDistance.current > 0) {
        const scaleDelta = (newDistance - touchDistance.current) / 100;
        setZoomState((prev) => ({
          ...prev,
          scale: clampScale(prev.scale + scaleDelta)
        }));
      }
      touchDistance.current = newDistance;
    } else if (e.touches.length === 1 && isPanning.current && enablePan) {
      const deltaX = e.touches[0].clientX - lastPosition.current.x;
      const deltaY = e.touches[0].clientY - lastPosition.current.y;
      
      pan(deltaX, deltaY);
      lastPosition.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
  }, [enablePinch, enablePan, clampScale, pan]);

  const handleTouchEnd = useCallback(() => {
    isPanning.current = false;
    touchDistance.current = 0;
  }, []);

  const transform = `scale(${zoomState.scale}) translate(${zoomState.translateX}px, ${zoomState.translateY}px)`;

  return {
    zoomState,
    controls: {
      zoomIn,
      zoomOut,
      reset,
      setZoom,
      pan
    },
    handlers: {
      onWheel: handleWheel,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    },
    transform
  };
};

export default useChartZoom;
