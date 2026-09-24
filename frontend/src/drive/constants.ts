export const ROAD_HALF = 4.3; // asphalt half width (two 3.6 m lanes + edge)
export const LANE_OFFSET = 1.8;
export const WORLD_HALF = 1000; // detailed terrain spans [-1000, 1000]
export const DRIVE_LIMIT = 880; // soft wall for the player
export const WATER_LEVEL = 0;
export const LAKE = { x: -45, z: 655, r: 112 };

/** True only inside the lake basin (the rest of the valley has no water). */
export function inLakeBasin(x: number, z: number, margin = 1.35) {
  return (x - LAKE.x) ** 2 + (z - LAKE.z) ** 2 < (LAKE.r * margin) ** 2;
}
