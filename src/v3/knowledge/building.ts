/**
 * Building patterns and structure templates
 */

import { Vec3 } from 'vec3';

export interface BlockPlacement {
  offset: Vec3;
  block: string;  // 'material' means use the specified material, otherwise specific block
}

export interface StructureTemplate {
  name: string;
  description: string;
  blocks: BlockPlacement[];
  materialsNeeded: (material: string) => Record<string, number>;
}

/**
 * Generate positions for a simple house
 */
export function generateHousePositions(
  width: number,
  depth: number,
  height: number,
  material: string
): BlockPlacement[] {
  const blocks: BlockPlacement[] = [];

  // Floor
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      blocks.push({ offset: new Vec3(x, 0, z), block: material });
    }
  }

  // Walls
  for (let y = 1; y <= height; y++) {
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        // Only place on edges (walls)
        const isEdge = x === 0 || x === width - 1 || z === 0 || z === depth - 1;
        // Leave door opening (front center, y=1 and y=2)
        const isDoor = z === 0 && x === Math.floor(width / 2) && y <= 2;

        if (isEdge && !isDoor) {
          blocks.push({ offset: new Vec3(x, y, z), block: material });
        }
      }
    }
  }

  // Roof (flat for simplicity)
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      blocks.push({ offset: new Vec3(x, height + 1, z), block: material });
    }
  }

  return blocks;
}

/**
 * Generate positions for a wall
 */
export function generateWallPositions(
  length: number,
  height: number,
  material: string,
  direction: 'x' | 'z' = 'x'
): BlockPlacement[] {
  const blocks: BlockPlacement[] = [];

  for (let i = 0; i < length; i++) {
    for (let y = 0; y < height; y++) {
      const offset = direction === 'x'
        ? new Vec3(i, y, 0)
        : new Vec3(0, y, i);
      blocks.push({ offset, block: material });
    }
  }

  return blocks;
}

/**
 * Generate positions for a floor/platform
 */
export function generateFloorPositions(
  width: number,
  depth: number,
  material: string
): BlockPlacement[] {
  const blocks: BlockPlacement[] = [];

  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      blocks.push({ offset: new Vec3(x, 0, z), block: material });
    }
  }

  return blocks;
}

/**
 * Generate positions for a tower
 */
export function generateTowerPositions(
  height: number,
  material: string
): BlockPlacement[] {
  const blocks: BlockPlacement[] = [];

  for (let y = 0; y < height; y++) {
    blocks.push({ offset: new Vec3(0, y, 0), block: material });
  }

  return blocks;
}

/**
 * Generate positions for a bridge
 */
export function generateBridgePositions(
  length: number,
  width: number,
  material: string,
  direction: 'x' | 'z' = 'x'
): BlockPlacement[] {
  const blocks: BlockPlacement[] = [];

  for (let i = 0; i < length; i++) {
    for (let w = 0; w < width; w++) {
      const offset = direction === 'x'
        ? new Vec3(i, 0, w)
        : new Vec3(w, 0, i);
      blocks.push({ offset, block: material });
    }
  }

  // Railings
  for (let i = 0; i < length; i++) {
    const left = direction === 'x'
      ? new Vec3(i, 1, 0)
      : new Vec3(0, 1, i);
    const right = direction === 'x'
      ? new Vec3(i, 1, width - 1)
      : new Vec3(width - 1, 1, i);
    blocks.push({ offset: left, block: material });
    blocks.push({ offset: right, block: material });
  }

  return blocks;
}

/**
 * Generate positions for stairs going up
 */
export function generateStairsPositions(
  height: number,
  material: string,
  direction: 'x' | 'z' = 'x'
): BlockPlacement[] {
  const blocks: BlockPlacement[] = [];

  for (let i = 0; i < height; i++) {
    const offset = direction === 'x'
      ? new Vec3(i, i, 0)
      : new Vec3(0, i, i);
    blocks.push({ offset, block: material });
  }

  return blocks;
}

/**
 * Generate a simple frame (outline of a rectangular prism)
 */
export function generateFramePositions(
  width: number,
  height: number,
  depth: number,
  material: string
): BlockPlacement[] {
  const blocks: BlockPlacement[] = [];

  // Vertical edges (4 corners)
  for (let y = 0; y < height; y++) {
    blocks.push({ offset: new Vec3(0, y, 0), block: material });
    blocks.push({ offset: new Vec3(width - 1, y, 0), block: material });
    blocks.push({ offset: new Vec3(0, y, depth - 1), block: material });
    blocks.push({ offset: new Vec3(width - 1, y, depth - 1), block: material });
  }

  // Horizontal edges - bottom
  for (let x = 1; x < width - 1; x++) {
    blocks.push({ offset: new Vec3(x, 0, 0), block: material });
    blocks.push({ offset: new Vec3(x, 0, depth - 1), block: material });
  }
  for (let z = 1; z < depth - 1; z++) {
    blocks.push({ offset: new Vec3(0, 0, z), block: material });
    blocks.push({ offset: new Vec3(width - 1, 0, z), block: material });
  }

  // Horizontal edges - top
  for (let x = 1; x < width - 1; x++) {
    blocks.push({ offset: new Vec3(x, height - 1, 0), block: material });
    blocks.push({ offset: new Vec3(x, height - 1, depth - 1), block: material });
  }
  for (let z = 1; z < depth - 1; z++) {
    blocks.push({ offset: new Vec3(0, height - 1, z), block: material });
    blocks.push({ offset: new Vec3(width - 1, height - 1, z), block: material });
  }

  return blocks;
}

/**
 * Calculate materials needed for a list of block placements
 */
export function calculateMaterialsNeeded(blocks: BlockPlacement[]): Record<string, number> {
  const materials: Record<string, number> = {};

  for (const block of blocks) {
    materials[block.block] = (materials[block.block] || 0) + 1;
  }

  return materials;
}

/**
 * Sort blocks for optimal building order (bottom to top, then by distance)
 */
export function sortBlocksForBuilding(blocks: BlockPlacement[], botPosition: Vec3): BlockPlacement[] {
  return [...blocks].sort((a, b) => {
    // First by Y (build from bottom up)
    if (a.offset.y !== b.offset.y) {
      return a.offset.y - b.offset.y;
    }
    // Then by distance to bot
    const distA = a.offset.distanceTo(botPosition);
    const distB = b.offset.distanceTo(botPosition);
    return distA - distB;
  });
}
