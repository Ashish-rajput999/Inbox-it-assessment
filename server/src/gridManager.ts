import type { Block, GridState } from "shared";

const GRID_COLUMNS = 40;
const GRID_ROWS = 25;

export function createInitialGrid(): GridState {
  const blocks: Block[] = [];

  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLUMNS; x += 1) {
      blocks.push({
        id: `block-${y}-${x}`,
        x,
        y,
        ownerId: null,
        ownerColor: null,
        claimedAt: null
      });
    }
  }

  return {
    columns: GRID_COLUMNS,
    rows: GRID_ROWS,
    blocks
  };
}
