import type { Block, GridState } from "../shared";

import type { Camera, ViewportSize, WorldBounds, WorldPoint } from "./camera";
import { worldToScreen } from "./camera";

export const CELL_SIZE = 18;
export const CELL_GAP = 1;
export const CELL_PITCH = CELL_SIZE + CELL_GAP;
export const GRID_PADDING = 56;
export const MAX_ZOOM = 8;
export const UNCLAIMED_FILL = "#0f172a";
export const UNCLAIMED_BORDER = "rgba(148, 163, 184, 0.12)";
const GRID_BACKGROUND = "#070b14";
const GRID_LINE_COLOR = "rgba(0, 242, 255, 0.04)";
const HOVER_OUTLINE = "#00f2ff";
const OWN_BLOCK_SHIMMER = "rgba(255, 255, 255, 0.15)";

export interface BlockAnimation {
  blockId: string;
  startTime: number;
  type: "claim" | "steal";
  previousColor?: string | null;
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

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  startTime: number;
  color: string;
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
  floatingTexts: FloatingText[];
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
  floatingTexts,
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
      ? Math.min((now - animation.startTime) / 500, 1)
      : 1;

    if (animationProgress < 1) {
      hasActiveAnimations = true;
      if (animation && (animation.type === "claim" || animation.type === "steal")) {
        drawRipple(ctx, block, animationProgress, camera);
      }
    } else if (animation) {
      animations.delete(block.id);
    }

    drawBlock(ctx, block, {
      hovered: block.id === hoveredBlockId,
      isOwnedByPlayer: block.ownerId !== null && block.ownerId === playerId,
      now,
      animationProgress,
      animationType: animation?.type,
      previousColor: animation?.previousColor,
      camera
    });
  }

  // Render remote cursors after blocks
  const cursorsAnimating = drawRemoteCursors(ctx, remoteCursors, camera, now);
  if (cursorsAnimating) {
    hasActiveAnimations = true;
  }

  // Render floating texts
  const textsAnimating = drawFloatingTexts(ctx, floatingTexts, camera, now);
  if (textsAnimating) {
    hasActiveAnimations = true;
  }

  return hasActiveAnimations;
}

function drawFloatingTexts(
  ctx: CanvasRenderingContext2D,
  texts: FloatingText[],
  camera: Camera,
  now: number
): boolean {
  if (texts.length === 0) return false;

  ctx.save();
  const DURATION = 1200;

  for (let i = texts.length - 1; i >= 0; i--) {
    const text = texts[i];
    const elapsed = now - text.startTime;
    const progress = Math.min(elapsed / DURATION, 1);

    if (progress >= 1) {
      texts.splice(i, 1);
      continue;
    }

    const opacity = 1 - Math.pow(progress, 2);
    const floatY = -30 * progress;
    const screenPos = worldToScreen({ x: text.x, y: text.y }, camera);

    ctx.globalAlpha = opacity;
    ctx.fillStyle = text.color;
    ctx.font = `bold ${Math.max(12, 16 * camera.zoom)}px var(--font-display)`;
    ctx.textAlign = "center";
    ctx.fillText(text.text, screenPos.x, screenPos.y + floatY);
  }

  ctx.restore();
  return texts.length > 0;
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
  animationType?: "claim" | "steal";
  previousColor?: string | null;
  camera: Camera;
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: Block,
  options: DrawBlockOptions
): void {
  const {
    hovered,
    isOwnedByPlayer,
    animationProgress,
    animationType,
    previousColor,
    camera,
    now
  } = options;
  const isAnimating = animationProgress < 1;
  const scale = getAnimationScale(animationProgress);

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
  const radius = Math.max(2, 4 * camera.zoom * scale);

  ctx.save();

  // Block fill with optional steal flash
  let fillColor = getBlockFill(block, hovered);
  if (isAnimating && animationType === "steal" && previousColor) {
    // Flash old color briefly (first 30% of animation)
    const flashProgress = Math.min(animationProgress / 0.3, 1);
    if (flashProgress < 1) {
      fillColor = mixColors(previousColor, fillColor, flashProgress);
    }
  }

  // Glow for claimed blocks
  if (block.ownerColor && camera.zoom > 0.5) {
    const baseGlow = isOwnedByPlayer ? 0.4 : 0.25;
    const pulseGlow = isOwnedByPlayer ? Math.sin(now / 400) * 0.1 : 0;
    const animGlow = isAnimating ? (1 - animationProgress) * 0.5 : 0;
    const strength = baseGlow + pulseGlow + animGlow;

    ctx.shadowColor = withAlpha(block.ownerColor, strength);
    ctx.shadowBlur = 12 * camera.zoom * (isAnimating ? scale : 1);
  }

  ctx.fillStyle = fillColor;
  drawRoundedRectPath(ctx, x, y, drawWidth, drawHeight, radius);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Border / Outline
  if (hovered) {
    ctx.strokeStyle = HOVER_OUTLINE;
    ctx.lineWidth = Math.max(2, camera.zoom * 1.5);
    ctx.shadowColor = withAlpha(HOVER_OUTLINE, 0.8);
    ctx.shadowBlur = 8 * camera.zoom;
  } else if (block.ownerColor) {
    ctx.strokeStyle = withAlpha("#ffffff", 0.1);
    ctx.lineWidth = 1;
  } else {
    ctx.strokeStyle = UNCLAIMED_BORDER;
    ctx.lineWidth = 1;
  }

  drawRoundedRectPath(ctx, x, y, drawWidth, drawHeight, radius);
  ctx.stroke();

  // Shimmer for own territory
  if (isOwnedByPlayer) {
    const shimmerAlpha = 0.1 + Math.sin(now / 400) * 0.05;
    ctx.strokeStyle = withAlpha("#ffffff", shimmerAlpha);
    ctx.lineWidth = Math.max(1, camera.zoom * 0.8);
    const inset = camera.zoom * 1.5;
    drawRoundedRectPath(
      ctx,
      x + inset,
      y + inset,
      Math.max(drawWidth - inset * 2, 0),
      Math.max(drawHeight - inset * 2, 0),
      Math.max(radius - inset, 1)
    );
    ctx.stroke();
  }

  ctx.restore();
}

function drawRipple(
  ctx: CanvasRenderingContext2D,
  block: Block,
  progress: number,
  camera: Camera
): void {
  if (!block.ownerColor) return;

  const screenPosition = worldToScreen(
    { x: (block.x + 0.5) * CELL_PITCH, y: (block.y + 0.5) * CELL_PITCH },
    camera
  );

  const maxRippleSize = CELL_SIZE * 4 * camera.zoom;
  const rippleSize = progress * maxRippleSize;
  const opacity = (1 - progress) * 0.6;

  ctx.save();
  ctx.beginPath();
  ctx.arc(screenPosition.x, screenPosition.y, rippleSize, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(block.ownerColor, opacity);
  ctx.lineWidth = 2 * camera.zoom;
  ctx.stroke();
  ctx.restore();
}

function mixColors(color1: string, color2: string, ratio: number): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  const r = mixChannel(rgb1[0], rgb2[0], ratio);
  const g = mixChannel(rgb1[1], rgb2[1], ratio);
  const b = mixChannel(rgb1[2], rgb2[2], ratio);
  return `rgb(${r}, ${g}, ${b})`;
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
