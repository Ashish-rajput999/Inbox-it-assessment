import {
  memo,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from "react";
import type { GridState } from "shared";

import {
  clampCamera,
  clampZoom,
  fitCameraToBounds,
  screenToWorld,
  type Camera,
  type ViewportSize,
  type WorldPoint
} from "../canvas/camera";
import {
  drawGridScene,
  getBlockAtWorldPoint,
  getGridWorldBounds,
  GRID_PADDING,
  MAX_ZOOM,
  type BlockAnimation
} from "../canvas/renderGrid";
import { useGameStore } from "../store/gameStore";

const CLICK_DRAG_THRESHOLD = 6;
const canvasStyle: CSSProperties = {
  display: "block",
  width: "100vw",
  height: "100vh",
  touchAction: "none"
};

interface GridCanvasProps {
  onClaimBlock: (blockId: string) => void;
}

interface PointerDragState {
  isPointerDown: boolean;
  isDragging: boolean;
  pointerId: number | null;
  startScreenPoint: WorldPoint | null;
  lastScreenPoint: WorldPoint | null;
}

const INITIAL_POINTER_STATE: PointerDragState = {
  isPointerDown: false,
  isDragging: false,
  pointerId: null,
  startScreenPoint: null,
  lastScreenPoint: null
};

function GridCanvas({ onClaimBlock }: GridCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const viewportRef = useRef<ViewportSize>({ width: 0, height: 0 });
  const minimumZoomRef = useRef(1);
  const gridRef = useRef<GridState | null>(useGameStore.getState().grid);
  const playerIdRef = useRef<string | null>(
    useGameStore.getState().player?.id ?? null
  );
  const hoveredBlockIdRef = useRef<string | null>(null);
  const animationsRef = useRef<Map<string, BlockAnimation>>(new Map());
  const dirtyRef = useRef(true);
  const frameRef = useRef<number | null>(null);
  const pointerStateRef = useRef<PointerDragState>(INITIAL_POINTER_STATE);
  const hasFittedCameraRef = useRef(false);
  const dprRef = useRef(1);

  const syncCanvasSize = useMemo(
    () => () => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      const dpr = window.devicePixelRatio || 1;

      viewportRef.current = viewport;
      dprRef.current = dpr;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const context = contextRef.current ?? canvas.getContext("2d");

      if (!context) {
        return;
      }

      contextRef.current = context;
      context.setTransform(1, 0, 0, 1, 0, 0);

      const grid = gridRef.current;

      if (!grid) {
        dirtyRef.current = true;
        scheduleRender();
        return;
      }

      const fitCamera = fitCameraToBounds(
        getGridWorldBounds(grid),
        viewport,
        {
          padding: GRID_PADDING,
          maxZoom: MAX_ZOOM
        }
      );

      minimumZoomRef.current = fitCamera.zoom;

      cameraRef.current = hasFittedCameraRef.current
        ? clampCamera(
            {
              ...cameraRef.current,
              zoom: clampZoom(
                cameraRef.current.zoom,
                minimumZoomRef.current,
                MAX_ZOOM
              )
            },
            getGridWorldBounds(grid),
            viewport,
            GRID_PADDING
          )
        : fitCamera;

      hasFittedCameraRef.current = true;
      dirtyRef.current = true;
      scheduleRender();
    },
    []
  );

  const scheduleRender = useMemo(
    () => () => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame((now) => {
        frameRef.current = null;
        renderFrame(now);
      });
    },
    []
  );

  const renderFrame = useMemo(
    () => (now: number) => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      const viewport = viewportRef.current;

      if (!canvas || !context || viewport.width === 0 || viewport.height === 0) {
        return;
      }

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);

      const grid = gridRef.current;

      if (!grid) {
        context.fillStyle = "#0a0f1d";
        context.fillRect(0, 0, viewport.width, viewport.height);
        dirtyRef.current = false;
        return;
      }

      // Frames are only scheduled while dirty or animating, which avoids
      // burning GPU on a continuous idle render loop.
      dirtyRef.current = false;

      const hasActiveAnimations = drawGridScene({
        camera: cameraRef.current,
        ctx: context,
        grid,
        hoveredBlockId: hoveredBlockIdRef.current,
        now,
        playerId: playerIdRef.current,
        animations: animationsRef.current,
        viewport
      });

      if (hasActiveAnimations) {
        dirtyRef.current = true;
      }

      if (dirtyRef.current) {
        scheduleRender();
      }
    },
    [scheduleRender]
  );

  useEffect(() => {
    syncCanvasSize();

    const handleResize = () => {
      syncCanvasSize();
    };

    window.addEventListener("resize", handleResize);

    const unsubscribe = useGameStore.subscribe((state, previousState) => {
      if (state.player?.id !== previousState.player?.id) {
        playerIdRef.current = state.player?.id ?? null;
        dirtyRef.current = true;
      }

      if (state.grid !== previousState.grid) {
        handleGridChange(state.grid, previousState.grid);
      }

      if (dirtyRef.current) {
        scheduleRender();
      }
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      unsubscribe();

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [scheduleRender, syncCanvasSize]);

  const handleGridChange = (nextGrid: GridState | null, previousGrid: GridState | null) => {
    gridRef.current = nextGrid;

    if (!nextGrid) {
      hasFittedCameraRef.current = false;
      hoveredBlockIdRef.current = null;
      animationsRef.current.clear();
      dirtyRef.current = true;
      updateCursor();
      return;
    }

    if (
      !previousGrid ||
      previousGrid.columns !== nextGrid.columns ||
      previousGrid.rows !== nextGrid.rows
    ) {
      const fitCamera = fitCameraToBounds(
        getGridWorldBounds(nextGrid),
        viewportRef.current,
        {
          padding: GRID_PADDING,
          maxZoom: MAX_ZOOM
        }
      );

      minimumZoomRef.current = fitCamera.zoom;
      cameraRef.current = fitCamera;
      hasFittedCameraRef.current = true;
    } else {
      for (let index = 0; index < nextGrid.blocks.length; index += 1) {
        if (nextGrid.blocks[index] !== previousGrid.blocks[index]) {
          animationsRef.current.set(nextGrid.blocks[index].id, {
            blockId: nextGrid.blocks[index].id,
            startTime: performance.now()
          });
        }
      }
    }

    dirtyRef.current = true;
    updateHoverFromPoint(pointerStateRef.current.lastScreenPoint);
  };

  const updateCursor = () => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    if (!gridRef.current) {
      canvas.style.cursor = "default";
      return;
    }

    if (pointerStateRef.current.isDragging || pointerStateRef.current.isPointerDown) {
      canvas.style.cursor = "grabbing";
      return;
    }

    canvas.style.cursor = hoveredBlockIdRef.current ? "pointer" : "grab";
  };

  const updateHoverFromPoint = (screenPoint: WorldPoint | null): void => {
    const grid = gridRef.current;

    if (!grid || !screenPoint) {
      if (hoveredBlockIdRef.current !== null) {
        hoveredBlockIdRef.current = null;
        dirtyRef.current = true;
        scheduleRender();
      }

      updateCursor();
      return;
    }

    const block = getBlockAtWorldPoint(
      grid,
      screenToWorld(screenPoint, cameraRef.current)
    );
    const nextHoveredBlockId = block?.id ?? null;

    if (hoveredBlockIdRef.current !== nextHoveredBlockId) {
      hoveredBlockIdRef.current = nextHoveredBlockId;
      dirtyRef.current = true;
      scheduleRender();
    }

    updateCursor();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStateRef.current = {
      isPointerDown: true,
      isDragging: false,
      pointerId: event.pointerId,
      startScreenPoint: { x: event.clientX, y: event.clientY },
      lastScreenPoint: { x: event.clientX, y: event.clientY }
    };
    updateHoverFromPoint({ x: event.clientX, y: event.clientY });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const screenPoint = { x: event.clientX, y: event.clientY };
    const pointerState = pointerStateRef.current;

    pointerState.lastScreenPoint = screenPoint;

    if (
      !pointerState.isPointerDown ||
      pointerState.pointerId !== event.pointerId ||
      !pointerState.startScreenPoint
    ) {
      updateHoverFromPoint(screenPoint);
      return;
    }

    const distance = getDistance(pointerState.startScreenPoint, screenPoint);

    if (distance > CLICK_DRAG_THRESHOLD) {
      pointerState.isDragging = true;
    }

    if (pointerState.isDragging && pointerState.lastScreenPoint) {
      const previousPoint = pointerState.lastScreenPoint;
      const deltaX = screenPoint.x - previousPoint.x;
      const deltaY = screenPoint.y - previousPoint.y;
      const grid = gridRef.current;

      if (grid) {
        cameraRef.current = clampCamera(
          {
            ...cameraRef.current,
            x: cameraRef.current.x + deltaX,
            y: cameraRef.current.y + deltaY
          },
          getGridWorldBounds(grid),
          viewportRef.current,
          GRID_PADDING
        );
        dirtyRef.current = true;
        scheduleRender();
      }
    }

    pointerState.lastScreenPoint = screenPoint;
    updateHoverFromPoint(screenPoint);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pointerState = pointerStateRef.current;
    const screenPoint = { x: event.clientX, y: event.clientY };

    if (
      pointerState.pointerId === event.pointerId &&
      pointerState.startScreenPoint &&
      !pointerState.isDragging
    ) {
      const grid = gridRef.current;

      if (grid) {
        const block = getBlockAtWorldPoint(
          grid,
          screenToWorld(screenPoint, cameraRef.current)
        );

        if (block) {
          onClaimBlock(block.id);
        }
      }
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    pointerStateRef.current = {
      ...INITIAL_POINTER_STATE,
      lastScreenPoint: screenPoint
    };
    updateHoverFromPoint(screenPoint);
  };

  const handlePointerLeave = () => {
    if (pointerStateRef.current.isPointerDown) {
      return;
    }

    updateHoverFromPoint(null);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    pointerStateRef.current = INITIAL_POINTER_STATE;
    updateHoverFromPoint(null);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    const grid = gridRef.current;

    if (!grid) {
      return;
    }

    event.preventDefault();

    const cursor = { x: event.clientX, y: event.clientY };
    const worldPointBeforeZoom = screenToWorld(cursor, cameraRef.current);
    const zoomFactor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.003 : 0.0015));
    const nextZoom = clampZoom(
      cameraRef.current.zoom * zoomFactor,
      minimumZoomRef.current,
      MAX_ZOOM
    );

    cameraRef.current = clampCamera(
      {
        x: cursor.x - worldPointBeforeZoom.x * nextZoom,
        y: cursor.y - worldPointBeforeZoom.y * nextZoom,
        zoom: nextZoom
      },
      getGridWorldBounds(grid),
      viewportRef.current,
      GRID_PADDING
    );
    dirtyRef.current = true;
    scheduleRender();
    updateHoverFromPoint(cursor);
  };

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    />
  );
}

function getDistance(from: WorldPoint, to: WorldPoint): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export default memo(GridCanvas);
