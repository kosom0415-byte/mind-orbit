import { useEffect, useRef, useState } from "react";

type Viewport = {
  width: number;
  height: number;
};

export function useViewport(initialWidth = 1200, initialHeight = 800) {
  const [viewport, setViewport] = useState<Viewport>({ width: initialWidth, height: initialHeight });
  const viewportRef = useRef<Viewport>(viewport);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  return { viewport, setViewport, viewportRef };
}
