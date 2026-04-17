// Map system - Defines geometry for the "FRACTURE" map
// Industrial facility with two bomb sites (ALPHA and BETA)

export const MAP_BOUNDS = {
  minX: -40, maxX: 40,
  minZ: -40, maxZ: 40
};

// Spawn points
export const SPAWNS = {
  attacker: [
    { x: 0, z: -36, angle: 0 },
    { x: -4, z: -36, angle: 0 },
    { x: 4, z: -36, angle: 0 },
    { x: -8, z: -34, angle: 0 },
    { x: 8, z: -34, angle: 0 },
  ],
  defender: [
    { x: -22, z: 10, angle: Math.PI * 0.5 },
    { x: 22, z: 10, angle: -Math.PI * 0.5 },
    { x: 0, z: 20, angle: Math.PI },
    { x: -4, z: 22, angle: Math.PI },
    { x: 4, z: 22, angle: Math.PI },
  ]
};

// Bomb site definitions (flat areas where bomb can be planted)
export const BOMB_SITES = {
  alpha: {
    id: 'alpha', label: 'ALPHA',
    center: { x: -24, z: 18 },
    radius: 4.5,
    color: 0xff5e3a
  },
  beta: {
    id: 'beta', label: 'BETA',
    center: { x: 24, z: 18 },
    radius: 4.5,
    color: 0x00b4d8
  }
};

// Bot waypoint network for navigation
// Each node has id, position, and connections
export const WAYPOINTS = [
  // Attacker spawn area
  { id: 0, x: 0,   z: -34, team: 'attacker' },
  { id: 1, x: -8,  z: -28, team: 'both' },
  { id: 2, x: 8,   z: -28, team: 'both' },

  // Mid corridor
  { id: 3, x: 0,   z: -20, team: 'both' },
  { id: 4, x: -14, z: -18, team: 'both' },
  { id: 5, x: 14,  z: -18, team: 'both' },

  // Long A approach
  { id: 6, x: -28, z: -14, team: 'both' },
  { id: 7, x: -32, z: -4,  team: 'both' },
  { id: 8, x: -32, z: 6,   team: 'both' },
  { id: 9, x: -28, z: 14,  team: 'both' },
  { id: 10, x: -24, z: 18, team: 'both', isSite: 'alpha' },

  // Long B approach
  { id: 11, x: 28,  z: -14, team: 'both' },
  { id: 12, x: 32,  z: -4,  team: 'both' },
  { id: 13, x: 32,  z: 6,   team: 'both' },
  { id: 14, x: 28,  z: 14,  team: 'both' },
  { id: 15, x: 24,  z: 18,  team: 'both', isSite: 'beta' },

  // Mid to site connectors
  { id: 16, x: -12, z: -4,  team: 'both' },
  { id: 17, x: -14, z: 8,   team: 'both' },
  { id: 18, x: -18, z: 16,  team: 'both' },

  { id: 19, x: 12,  z: -4,  team: 'both' },
  { id: 20, x: 14,  z: 8,   team: 'both' },
  { id: 21, x: 18,  z: 16,  team: 'both' },

  // Defender positions (rotate between)
  { id: 22, x: -20, z: 6,   team: 'defender' },
  { id: 23, x: 20,  z: 6,   team: 'defender' },
  { id: 24, x: 0,   z: 14,  team: 'defender' },
  { id: 25, x: -10, z: 20,  team: 'defender' },
  { id: 26, x: 10,  z: 20,  team: 'defender' },
];

// Connections between waypoints (bidirectional)
export const WAYPOINT_EDGES = [
  [0,1],[0,2],[0,3],
  [1,4],[1,6],
  [2,5],[2,11],
  [3,4],[3,5],[3,16],[3,19],
  [4,6],[4,16],
  [5,11],[5,19],
  [6,7],[7,8],[8,9],[9,10],
  [10,18],[10,25],
  [11,12],[12,13],[13,14],[14,15],
  [15,21],[15,26],
  [16,17],[17,18],[18,10],
  [19,20],[20,21],[21,15],
  [22,17],[22,9],[22,24],
  [23,20],[23,14],[23,24],
  [24,25],[24,26],[24,17],[24,20],
  [25,10],[26,15],
];

// Build adjacency for pathfinding
export function buildWaypointGraph() {
  const graph = {};
  WAYPOINTS.forEach(w => { graph[w.id] = []; });
  WAYPOINT_EDGES.forEach(([a, b]) => {
    graph[a].push(b);
    graph[b].push(a);
  });
  return graph;
}

// Simple BFS pathfinding between waypoints
export function findPath(startId, endId, graph) {
  if (startId === endId) return [startId];
  const visited = new Set([startId]);
  const queue = [[startId, [startId]]];
  while (queue.length) {
    const [node, path] = queue.shift();
    for (const neighbor of (graph[node] || [])) {
      if (!visited.has(neighbor)) {
        const newPath = [...path, neighbor];
        if (neighbor === endId) return newPath;
        visited.add(neighbor);
        queue.push([neighbor, newPath]);
      }
    }
  }
  return null;
}

// Find nearest waypoint to a world position
export function nearestWaypoint(x, z) {
  let best = null, bestDist = Infinity;
  for (const w of WAYPOINTS) {
    const d = Math.hypot(w.x - x, w.z - z);
    if (d < bestDist) { bestDist = d; best = w; }
  }
  return best;
}

// Map geometry definition for rendering and collision
// Returns array of box definitions: {x, y, z, w, h, d, color, type}
export function getMapGeometry() {
  const WALL_H = 4.5;
  const FLOOR_Y = 0;
  const walls = [];

  // Helper
  const wall = (x, z, w, d, h = WALL_H, color = 0x3a3f4c, type = 'wall') => ({
    x, y: h / 2, z, w, h, d, color, type
  });
  const floor = (x, z, w, d, color = 0x252830, type = 'floor') => ({
    x, y: 0.1, z, w, h: 0.2, d, color, type
  });
  const cover = (x, z, w, d, h = 1.0, color = 0x4a5060) => ({
    x, y: h / 2, z, w, h, d, color, type: 'cover'
  });

  return [
    // === FLOOR (large base) ===
    floor(0, 0, 82, 82, 0x1e2128),
    // Site alpha floor marker
    floor(-24, 18, 10, 10, 0x2a1a10),
    // Site beta floor marker
    floor(24, 18, 10, 10, 0x0a1a2a),

    // === OUTER WALLS ===
    wall(0, -41, 82, 2, WALL_H, 0x282c36),       // south wall
    wall(0, 41, 82, 2, WALL_H, 0x282c36),         // north wall
    wall(-41, 0, 2, 82, WALL_H, 0x282c36),        // west wall
    wall(41, 0, 2, 82, WALL_H, 0x282c36),         // east wall

    // === ATTACKER SPAWN BARRIERS ===
    wall(-16, -32, 2, 8, 3.0, 0x2a3040),
    wall(16, -32, 2, 8, 3.0, 0x2a3040),

    // === MID WALL (divides map vertically) ===
    wall(-6, -10, 10, 1.5, WALL_H, 0x30353f),
    wall(6, -10, 10, 1.5, WALL_H, 0x30353f),
    // Mid opening exists between -1 to 1

    // === A SIDE WALLS ===
    // Outer A hall west wall
    wall(-36, -6, 2, 20, WALL_H, 0x2a2e38),
    // A hall inner wall (splits mid from A hall)
    wall(-22, -8, 2, 16, WALL_H, 0x2e3240),
    // A site back wall
    wall(-30, 22, 16, 2, WALL_H, 0x2a2e38),
    // A site side wall
    wall(-18, 16, 2, 14, WALL_H, 0x2e3240),
    // Short A connector
    wall(-10, 4, 12, 1.5, WALL_H * 0.7, 0x32363f),
    wall(-10, 12, 8, 1.5, WALL_H * 0.7, 0x32363f),

    // === B SIDE WALLS ===
    wall(36, -6, 2, 20, WALL_H, 0x2a2e38),
    wall(22, -8, 2, 16, WALL_H, 0x2e3240),
    wall(30, 22, 16, 2, WALL_H, 0x2a2e38),
    wall(18, 16, 2, 14, WALL_H, 0x2e3240),
    wall(10, 4, 12, 1.5, WALL_H * 0.7, 0x32363f),
    wall(10, 12, 8, 1.5, WALL_H * 0.7, 0x32363f),

    // === COVER OBJECTS ===
    // Mid cover
    cover(-4, -6, 1.5, 3.5, 1.2, 0x404550),
    cover(4, -6, 1.5, 3.5, 1.2, 0x404550),
    cover(0, -16, 4, 1.5, 1.1, 0x3a3e4a),

    // A site cover
    cover(-26, 16, 3, 1.5, 1.0, 0x4a4030),
    cover(-20, 20, 1.5, 3, 1.2, 0x4a4030),
    cover(-28, 12, 1.5, 4, 0.9, 0x4a4030),

    // B site cover
    cover(26, 16, 3, 1.5, 1.0, 0x304040),
    cover(20, 20, 1.5, 3, 1.2, 0x304040),
    cover(28, 12, 1.5, 4, 0.9, 0x304040),

    // A long cover
    cover(-30, -2, 1.5, 4, 1.1, 0x383c48),
    cover(-30, -12, 1.5, 4, 1.1, 0x383c48),

    // B long cover
    cover(30, -2, 1.5, 4, 1.1, 0x383c48),
    cover(30, -12, 1.5, 4, 1.1, 0x383c48),

    // Mid boxes
    cover(-8, -20, 2, 2, 1.3, 0x3e4250),
    cover(8, -20, 2, 2, 1.3, 0x3e4250),

    // Connector props
    cover(-14, 0, 2, 2, 1.0, 0x444858),
    cover(14, 0, 2, 2, 1.0, 0x444858),
    cover(-14, 8, 2, 2, 1.0, 0x444858),
    cover(14, 8, 2, 2, 1.0, 0x444858),

    // Ceiling (invisible collider-only option - skip for perf)
    // Instead add ceiling details as decoration
  ];
}

// Check AABB collision with map geometry
// Returns {hit: bool, normal: {x, z}, penetration: float}
export function checkMapCollision(x, z, radius, geometry) {
  for (const g of geometry) {
    if (g.type === 'floor') continue; // floors handled by gravity
    const hw = g.w / 2 + radius;
    const hd = g.d / 2 + radius;
    const dx = x - g.x;
    const dz = z - g.z;
    if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
      // Push out on nearest axis
      const ox = hw - Math.abs(dx);
      const oz = hd - Math.abs(dz);
      if (ox < oz) {
        return { hit: true, nx: Math.sign(dx), nz: 0, pen: ox };
      } else {
        return { hit: true, nx: 0, nz: Math.sign(dz), pen: oz };
      }
    }
  }
  return { hit: false };
}

// Raycast against geometry for shooting
// Returns {hit, distance, normal, isHead, object}
export function raycastMap(origin, dir, maxDist, geometry) {
  let best = null;
  const ox = origin.x, oy = origin.y, oz = origin.z;
  const dx = dir.x, dy = dir.y, dz = dir.z;

  for (const g of geometry) {
    if (g.type === 'floor') continue;
    // AABB ray-box intersection (slab method)
    const minX = g.x - g.w / 2, maxX = g.x + g.w / 2;
    const minY = g.y - g.h / 2, maxY = g.y + g.h / 2;
    const minZ = g.z - g.d / 2, maxZ = g.z + g.d / 2;

    let tmin = 0, tmax = maxDist;
    const axes = [
      [dx, ox, minX, maxX],
      [dy, oy, minY, maxY],
      [dz, oz, minZ, maxZ],
    ];
    let miss = false;
    for (const [d, o, mn, mx] of axes) {
      if (Math.abs(d) < 1e-10) {
        if (o < mn || o > mx) { miss = true; break; }
      } else {
        let t1 = (mn - o) / d, t2 = (mx - o) / d;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) { miss = true; break; }
      }
    }
    if (!miss && tmin > 0.01 && tmin < (best?.distance ?? Infinity)) {
      best = { hit: true, distance: tmin, object: g };
    }
  }
  return best || { hit: false };
}
