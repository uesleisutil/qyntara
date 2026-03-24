import React, { Suspense, useEffect, useState, useRef } from 'react';
import { SkeletonChart } from '../feedback/SkeletonChart';

interface LazyTabProps {
  children: React.ReactNode;
  isActive: boolean;
  tabName: string;
  preload?: boolean;
  unloadAfter?: number; // Time in milliseconds to unload inactive tab (default 10 minutes)
}

export const LazyTab: React.FC<LazyTabProps> = ({
  children,
  isActive,
  tabName,
  preload = false,
  unloadAfter = 10 * 60 * 1000, // 10 minutes
}) => {
  const [shouldLoad, setShouldLoad] = useState(isActive || preload);
  const [hasLoaded, setHasLoaded] = useState(false);
  const inactiveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive) {
      setShouldLoad(true);
      setHasLoaded(true);
      
      // Clear any existing unload timer
      if (inactiveTimerRef.current) {
        clearTimeout(inactiveTimerRef.current);
        inactiveTimerRef.current = null;
      }
    } else if (hasLoaded && unloadAfter > 0) {
      // Start timer to unload inactive tab after specified time
      inactiveTimerRef.current = setTimeout(() => {
        console.log(`Unloading inactive tab: ${tabName}`);
        setShouldLoad(false);
      }, unloadAfter);
    }

    return () => {
      if (inactiveTimerRef.current) {
        clearTimeout(inactiveTimerRef.current);
      }
    };
  }, [isActive, hasLoaded, tabName, unloadAfter]);

  // Preload effect
  useEffect(() => {
    if (preload && !hasLoaded) {
      const preloadTimer = setTimeout(() => {
        console.log(`Preloading tab: ${tabName}`);
        setShouldLoad(true);
      }, 1000); // Delay preload by 1 second

      return () => clearTimeout(preloadTimer);
    }
  }, [preload, hasLoaded, tabName]);

  if (!shouldLoad) {
    return null;
  }

  return (
    <div style={{ display: isActive ? 'block' : 'none' }}>
      <Suspense
        fallback={
          <div style={{ padding: '2rem' }}>
            <SkeletonChart height="400px" showTitle={true} showLegend={true} />
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  );
};
