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

export interface CameraMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FitCameraOptions {
  margins: CameraMargins;
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
  const { margins, maxZoom } = options;
  const availableWidth = Math.max(viewport.width - margins.left - margins.right, 1);
  const availableHeight = Math.max(viewport.height - margins.top - margins.bottom, 1);

  const fitZoom = Math.min(
    availableWidth / bounds.width,
    availableHeight / bounds.height,
    maxZoom
  );

  return clampCamera(
    {
      x: margins.left + (availableWidth - bounds.width * fitZoom) / 2,
      y: margins.top + (availableHeight - bounds.height * fitZoom) / 2,
      zoom: fitZoom
    },
    bounds,
    viewport,
    margins
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
  margins: CameraMargins
): Camera {
  const availableWidth = Math.max(viewport.width - margins.left - margins.right, 1);
  const availableHeight = Math.max(viewport.height - margins.top - margins.bottom, 1);
  const scaledWidth = bounds.width * camera.zoom;
  const scaledHeight = bounds.height * camera.zoom;

  const nextX =
    scaledWidth <= availableWidth
      ? margins.left + (availableWidth - scaledWidth) / 2
      : clamp(
          camera.x,
          viewport.width - margins.right - scaledWidth,
          margins.left
        );

  const nextY =
    scaledHeight <= availableHeight
      ? margins.top + (availableHeight - scaledHeight) / 2
      : clamp(
          camera.y,
          viewport.height - margins.bottom - scaledHeight,
          margins.top
        );

  return { ...camera, x: nextX, y: nextY };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
