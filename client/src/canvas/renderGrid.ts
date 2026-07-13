import type { Block, GridState } from "shared";

import type { Camera, ViewportSize, WorldBounds, WorldPoint } from "./camera";
import { worldToScreen } from "./camera";

export const CELL_SIZE = 18;
export const CELL_GAP = 1;
export const CELL_PITCH = CELL_SIZE + CELL_GAP;
export const GRID_PADDING = 56;
export const MAX_ZOOM = 8;
export const UNCLAIMED_FILL = "#1a1f2e";
export const UNCLAIMED_BORDER = "rgba(148, 163, 184, 0.18)";
const GRID_BACKGROUND = "#0a0f1d";
const GRID_LINE_COLOR = "rgba(148, 163, 184, 0.08)";
const HOVER_OUTLINE = "rgba(226, 232, 240, 0.92)";
const OWN_BLOCK_GLOW = "rgba(255, 255, 255, 0.2)";

export interface BlockAnimation {
  blockId: string;
  startTime: number;
}

export interface RemoteCursor {
  playerId: string;
  name: string;
  color: string;
  current: WorldPoint;
  target: WorldPoint;
  lastUpdateAt: number;
  isRemoving: boolean;
  removeStartTime?: number;
}

export interface DrawGridSceneOptions {
  camera: Camera;
  ctx: CanvasRenderingContext2D;
  grid: GridState;
  hoveredBlockId: string | null;
  now: number;
  playerId: string | null;
  animations: Map<string, BlockAnimation>;
  remoteCursors: Map<string, RemoteCursor>;
  viewport: ViewportSize;
}

export function getGridWorldBounds(grid: GridState): WorldBounds {
  return {
    width: grid.columns * CELL_PITCH - CELL_GAP,
    height: grid.rows * CELL_PITCH - CELL_GAP
  };
}

export function getBlockAtWorldPoint(
  grid: GridState,
  point: WorldPoint
): Block | null {
  if (point.x < 0 || point.y < 0) {
    return null;
  }

  const column = Math.floor(point.x / CELL_PITCH);
  const row = Math.floor(point.y / CELL_PITCH);

  if (column < 0 || column >= grid.columns || row < 0 || row >= grid.rows) {
    return null;
  }

  const localX = point.x - column * CELL_PITCH;
  const localY = point.y - row * CELL_PITCH;

  if (localX > CELL_SIZE || localY > CELL_SIZE) {
    return null;
  }

  return grid.blocks[row * grid.columns + column] ?? null;
}

export function drawGridScene({
  camera,
  ctx,
  grid,
  hoveredBlockId,
  now,
  playerId,
  animations,
  remoteCursors,
  viewport
}: DrawGridSceneOptions): boolean {
  const bounds = getGridWorldBounds(grid);
  const screenOrigin = worldToScreen({ x: 0, y: 0 }, camera);
  const screenSize = {
    width: bounds.width * camera.zoom,
    height: bounds.height * camera.zoom
  };

  ctx.clearRect(0, 0, viewport.width, viewport.height);
  ctx.fillStyle = GRID_BACKGROUND;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  drawGridBackground(ctx, screenOrigin, screenSize, grid, camera.zoom, viewport);

  let hasActiveAnimations = false;

  for (const block of grid.blocks) {
    const animation = animations.get(block.id);
    const animationProgress = animation
      ? Math.min((now - animation.startTime) / 400, 1)
      : 1;

    if (animationProgress < 1) {
      hasActiveAnimations = true;
    } else if (animation) {
      animations.delete(block.id);
    }

    drawBlock(ctx, block, {
      hovered: block.id === hoveredBlockId,
      isOwnedByPlayer: block.ownerId !== null && block.ownerId === playerId,
      now,
      animationProgress,
      camera
    });
  }

  // Render remote cursors after blocks
  const cursorsAnimating = drawRemoteCursors(ctx, remoteCursors, camera, now);
  if (cursorsAnimating) {
    hasActiveAnimations = true;
  }

  return hasActiveAnimations;
}

function drawRemoteCursors(
  ctx: CanvasRenderingContext2D,
  remoteCursors: Map<string, RemoteCursor>,
  camera: Camera,
  now: number
): boolean {
  let isAnimating = false;

  for (const [playerId, cursor] of remoteCursors.entries()) {
    // Timeout cursors that haven't been updated in 10s
    if (!cursor.isRemoving && now - cursor.lastUpdateAt > 10000) {
      cursor.isRemoving = true;
      cursor.removeStartTime = now;
    }

    // Interpolate position (Lerp factor 0.2 per frame for smooth gliding)
    const dx = cursor.target.x - cursor.current.x;
    const dy = cursor.target.y - cursor.current.y;

    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      cursor.current.x += dx * 0.2;
      cursor.current.y += dy * 0.2;
      isAnimating = true;
    }

    // Handle fade out
    let opacity = 1;
    if (cursor.isRemoving && cursor.removeStartTime) {
      const elapsed = now - cursor.removeStartTime;
      opacity = Math.max(0, 1 - elapsed / 300);
      if (opacity > 0) {
        isAnimating = true;
      } else {
        remoteCursors.delete(playerId);
        continue;
      }
    }

    drawCursor(ctx, cursor, camera, opacity);
  }

  return isAnimating;
}

function drawCursor(
  ctx: CanvasRenderingContext2D,
  cursor: RemoteCursor,
  camera: Camera,
  opacity: number
): void {
  const screenPos = worldToScreen(cursor.current, camera);

  // Cap cursor screen size so it doesn't get comically huge when zoomed in
  const cursorScale = Math.min(camera.zoom, 1.5);
  const pointerSize = 14 * cursorScale;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Draw pointer (smooth triangle)
  ctx.fillStyle = cursor.color;
  ctx.beginPath();
  ctx.moveTo(screenPos.x, screenPos.y);
  ctx.lineTo(screenPos.x + pointerSize, screenPos.y + pointerSize * 0.5);
  ctx.lineTo(screenPos.x + pointerSize * 0.5, screenPos.y + pointerSize);
  ctx.closePath();
  ctx.fill();

  // Draw name pill
  const padding = 6 * cursorScale;
  const fontSize = Math.max(10, 12 * cursorScale);
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  const textMetrics = ctx.measureText(cursor.name);
  const pillWidth = textMetrics.width + padding * 2;
  const pillHeight = fontSize + padding;
  const pillX = screenPos.x + pointerSize * 0.8;
  const pillY = screenPos.y + pointerSize * 0.8;

  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 4 * cursorScale);
  ctx.fill();

  ctx.fillStyle = cursor.color;
  ctx.textBaseline = "top";
  ctx.fillText(cursor.name, pillX + padding, pillY + padding / 2);

  ctx.restore();
}

function drawGridBackground(
  ctx: CanvasRenderingContext2D,
  origin: WorldPoint,
  _size: ViewportSize,
  grid: GridState,
  zoom: number,
  viewport: ViewportSize
): void {
  ctx.save();
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();

  const pitch = CELL_PITCH * zoom;
  const offsetX = (origin.x - CELL_GAP * zoom * 0.5) % pitch;
  const offsetY = (origin.y - CELL_GAP * zoom * 0.5) % pitch;

  for (let x = offsetX; x <= viewport.width; x += pitch) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewport.height);
  }

  for (let y = offsetY; y <= viewport.height; y += pitch) {
    ctx.moveTo(0, y);
    ctx.lineTo(viewport.width, y);
  }

  ctx.stroke();
  ctx.restore();
}

interface DrawBlockOptions {
  hovered: boolean;
  isOwnedByPlayer: boolean;
  now: number;
  animationProgress: number;
  camera: Camera;
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: Block,
  options: DrawBlockOptions
): void {
  const { hovered, isOwnedByPlayer, animationProgress, camera } = options;
  const scale = getAnimationScale(animationProgress);
  const glowStrength = animationProgress < 1 ? 1 - animationProgress : 0;
  const screenPosition = worldToScreen(
    { x: block.x * CELL_PITCH, y: block.y * CELL_PITCH },
    camera
  );
  const width = CELL_SIZE * camera.zoom;
  const height = CELL_SIZE * camera.zoom;
  const centerX = screenPosition.x + width / 2;
  const centerY = screenPosition.y + height / 2;
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const x = centerX - drawWidth / 2;
  const y = centerY - drawHeight / 2;
  const radius = Math.max(3, 5 * camera.zoom * scale);
  const fillColor = getBlockFill(block, hovered);

  ctx.save();

  if (glowStrength > 0 && block.ownerColor) {
    ctx.shadowColor = withAlpha(block.ownerColor, 0.45 * glowStrength);
    ctx.shadowBlur = 22 * camera.zoom * glowStrength;
  }

  ctx.fillStyle = fillColor;
  drawRoundedRectPath(ctx, x, y, drawWidth, drawHeight, radius);
  ctx.fill();

  ctx.shadowBlur = 0;

  if (block.ownerColor) {
    ctx.strokeStyle = hovered
      ? withAlpha("#ffffff", 0.9)
      : withAlpha("#ffffff", 0.08);
    ctx.lineWidth = hovered ? Math.max(1.5, camera.zoom * 1.1) : 1;
  } else {
    ctx.strokeStyle = hovered
      ? withAlpha("#ffffff", 0.9)
      : UNCLAIMED_BORDER;
    ctx.lineWidth = hovered ? Math.max(1.5, camera.zoom) : 1;
  }

  drawRoundedRectPath(ctx, x, y, drawWidth, drawHeight, radius);
  ctx.stroke();

  if (isOwnedByPlayer) {
    ctx.strokeStyle = OWN_BLOCK_GLOW;
    ctx.lineWidth = Math.max(1, camera.zoom * 1.1);
    drawRoundedRectPath(
      ctx,
      x + camera.zoom * 1.2,
      y + camera.zoom * 1.2,
      Math.max(drawWidth - camera.zoom * 2.4, 0),
      Math.max(drawHeight - camera.zoom * 2.4, 0),
      Math.max(radius - camera.zoom, 2)
    );
    ctx.stroke();
  }

  ctx.restore();
}

function getBlockFill(block: Block, hovered: boolean): string {
  if (!block.ownerColor) {
    return hovered ? mixWithWhite(UNCLAIMED_FILL, 0.16) : UNCLAIMED_FILL;
  }

  return hovered ? mixWithWhite(block.ownerColor, 0.18) : block.ownerColor;
}

function getAnimationScale(animationProgress: number): number {
  if (animationProgress >= 1) {
    return 1;
  }

  const pulse = Math.sin(animationProgress * Math.PI);
  const easeOut = 1 - Math.pow(1 - animationProgress, 3);
  return 1 + pulse * 0.16 * (1 - easeOut * 0.35);
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function mixWithWhite(color: string, amount: number): string {
  const [red, green, blue] = hexToRgb(color);

  return `rgb(${mixChannel(red, 255, amount)}, ${mixChannel(
    green,
    255,
    amount
  )}, ${mixChannel(blue, 255, amount)})`;
}

function withAlpha(color: string, alpha: number): string {
  const [red, green, blue] = hexToRgb(color);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function hexToRgb(color: string): [number, number, number] {
  const sanitized = color.replace("#", "");
  const normalized =
    sanitized.length === 3
      ? sanitized
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : sanitized;

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}

function mixChannel(source: number, target: number, amount: number): number {
  return Math.round(source + (target - source) * amount);
}
