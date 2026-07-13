export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface WorldPoint {
  x: number;
  y: number;
}

export interface WorldBounds {
  width: number;
  height: number;
}

export interface FitCameraOptions {
  padding: number;
  maxZoom: number;
}

export function worldToScreen(
  point: WorldPoint,
  camera: Camera
): WorldPoint {
  return {
    x: point.x * camera.zoom + camera.x,
    y: point.y * camera.zoom + camera.y
  };
}

export function screenToWorld(
  point: WorldPoint,
  camera: Camera
): WorldPoint {
  return {
    x: (point.x - camera.x) / camera.zoom,
    y: (point.y - camera.y) / camera.zoom
  };
}

export function fitCameraToBounds(
  bounds: WorldBounds,
  viewport: ViewportSize,
  options: FitCameraOptions
): Camera {
  const availableWidth = Math.max(viewport.width - options.padding * 2, 1);
  const availableHeight = Math.max(viewport.height - options.padding * 2, 1);
  const fitZoom = Math.min(
    availableWidth / bounds.width,
    availableHeight / bounds.height,
    options.maxZoom
  );

  return clampCamera(
    {
      x: (viewport.width - bounds.width * fitZoom) / 2,
      y: (viewport.height - bounds.height * fitZoom) / 2,
      zoom: fitZoom
    },
    bounds,
    viewport,
    options.padding
  );
}

export function clampZoom(
  zoom: number,
  minimumZoom: number,
  maximumZoom: number
): number {
  return Math.min(Math.max(zoom, minimumZoom), maximumZoom);
}

export function clampCamera(
  camera: Camera,
  bounds: WorldBounds,
  viewport: ViewportSize,
  padding: number
): Camera {
  const scaledWidth = bounds.width * camera.zoom;
  const scaledHeight = bounds.height * camera.zoom;

  const nextX =
    scaledWidth + padding * 2 <= viewport.width
      ? (viewport.width - scaledWidth) / 2
      : clamp(
          camera.x,
          viewport.width - padding - scaledWidth,
          padding
        );

  const nextY =
    scaledHeight + padding * 2 <= viewport.height
      ? (viewport.height - scaledHeight) / 2
      : clamp(
          camera.y,
          viewport.height - padding - scaledHeight,
          padding
        );

  return {
    x: nextX,
    y: nextY,
    zoom: camera.zoom
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
