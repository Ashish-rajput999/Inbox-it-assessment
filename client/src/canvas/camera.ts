/**
 * Camera system invariant:
 * All camera coordinates (x, y) and zoom levels operate in CSS pixels.
 * devicePixelRatio (DPR) is applied ONLY via ctx.setTransform() in the render loop.
 * This ensures that input handling (clientX/Y) and fit math are independent of display density.
 */

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

  // Scale to fill the available non-HUD space
  const fitZoom = Math.min(
    availableWidth / bounds.width,
    availableHeight / bounds.height,
    maxZoom
  );

  // Center of the available area in screen coordinates
  const screenCenterX = margins.left + availableWidth / 2;
  const screenCenterY = margins.top + availableHeight / 2;

  // Midpoint of the grid in world coordinates
  const worldCenterX = bounds.width / 2;
  const worldCenterY = bounds.height / 2;

  // camera.x = screenPos - worldPos * zoom
  const x = screenCenterX - worldCenterX * fitZoom;
  const y = screenCenterY - worldCenterY * fitZoom;

  return { x, y, zoom: fitZoom };
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

  const fitZoom = Math.min(
    availableWidth / bounds.width,
    availableHeight / bounds.height
  );

  // If zoomed out to or past fit level, keep the grid centered in the available area
  if (camera.zoom <= fitZoom * 1.01) {
    const screenCenterX = margins.left + availableWidth / 2;
    const screenCenterY = margins.top + availableHeight / 2;
    return {
      ...camera,
      x: screenCenterX - (bounds.width / 2) * camera.zoom,
      y: screenCenterY - (bounds.height / 2) * camera.zoom
    };
  }

  // When zoomed in, clamp so the grid edges don't leave the available viewport area
  // screenLeft = worldX * zoom + camera.x >= margins.left => camera.x >= margins.left
  // screenRight = worldWidth * zoom + camera.x <= viewport.width - margins.right
  const minX = viewport.width - margins.right - bounds.width * camera.zoom;
  const maxX = margins.left;
  const minY = viewport.height - margins.bottom - bounds.height * camera.zoom;
  const maxY = margins.top;

  const clampedX = minX < maxX ? Math.max(minX, Math.min(camera.x, maxX)) : (minX + maxX) / 2;
  const clampedY = minY < maxY ? Math.max(minY, Math.min(camera.y, maxY)) : (minY + maxY) / 2;

  return { ...camera, x: clampedX, y: clampedY };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
