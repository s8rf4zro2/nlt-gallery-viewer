import { describe, expect, test } from "bun:test";
import { CARD_GAP, CARD_MIN_W, META_H } from "../renderer/modules/constants.js";
import { TilePool } from "../renderer/modules/tile-pool.js";
import { VirtualGrid } from "../renderer/modules/virtual-grid.js";

describe("VirtualGrid responsive layout", () => {
  function createMockGrid({ clientWidth = 1200, clientHeight = 600, scenes = [] } = {}) {
    const viewport = {
      clientWidth,
      clientHeight,
      scrollTop: 0,
      scrollTo: () => {},
    };
    const children = [];
    const sizer = { style: {} };
    const win = {
      style: {},
      children,
      append: (node) => {
        if (!children.includes(node)) children.push(node);
        node.parentNode = win;
      },
      textContent: "",
    };
    const dom = { viewport, sizer, window: win };

    const pool = [];
    const tiles = new Map();
    const tilePool = {
      tiles,
      pool,
      acquire: (index, scene) => {
        const node = pool.pop() ?? {
          __index: index,
          __scene: scene,
          style: {},
          classList: { toggle: () => {}, remove: () => {} },
          setAttribute: () => {},
          remove: () => {
            const idx = children.indexOf(node);
            if (idx >= 0) children.splice(idx, 1);
            node.parentNode = null;
          },
        };
        node.__index = index;
        node.__scene = scene;
        return node;
      },
      release: (node, detachFn) => {
        if (detachFn) detachFn(node);
        node.__scene = null;
        node.__index = -1;
        node.remove?.();
      },
      clear: (detachFn) => {
        for (const node of tiles.values()) {
          tilePool.release(node, detachFn);
          pool.push(node);
        }
        tiles.clear();
        children.length = 0;
      },
    };

    const mediaLoader = {
      detachSource: () => {},
      requestMedia: () => {},
      pump: () => {},
    };

    const grid = new VirtualGrid({
      dom,
      tilePool,
      mediaLoader,
      getScenes: () => scenes,
      getCursor: () => 0,
    });

    return { grid, dom, tilePool, win };
  }

  test("computes responsive column count and card width across viewports", () => {
    const testCases = [
      { width: 1920, expectedCols: 7 },
      { width: 1440, expectedCols: 5 },
      { width: 1280, expectedCols: 5 },
      { width: 1000, expectedCols: 4 },
      { width: 960, expectedCols: 3 },
      { width: 720, expectedCols: 2 },
      { width: 300, expectedCols: 1 },
    ];

    for (const { width, expectedCols } of testCases) {
      const { grid } = createMockGrid({ clientWidth: width });
      grid.layout();

      expect(grid.layoutState.cols).toBe(expectedCols);
      expect(grid.layoutState.cardW).toBeGreaterThanOrEqual(CARD_MIN_W - 1);

      // Verify that all columns fit within viewport width without cut-off
      const { cols, cardW } = grid.layoutState;
      const totalWidth = cols * cardW + (cols - 1) * CARD_GAP;
      expect(Math.abs(totalWidth - width)).toBeLessThan(0.001);
    }
  });

  test("handles zero, negative, or tiny widths safely without NaN or infinite loops", () => {
    const { grid } = createMockGrid({ clientWidth: 0 });
    grid.layout();

    expect(grid.layoutState.cols).toBeGreaterThanOrEqual(1);
    expect(grid.layoutState.cardW).toBeGreaterThanOrEqual(CARD_MIN_W);
    expect(Number.isFinite(grid.layoutState.rowH)).toBe(true);
  });

  test("calculates sizer height to fit all rows without cutting off scenes", () => {
    const scenes = Array.from({ length: 105 }, (_, i) => ({ id: `scene-${i}`, title: `Scene ${i}` }));
    const { grid, dom } = createMockGrid({ clientWidth: 960, scenes });

    grid.layout();
    const { cols, rows, rowH } = grid.layoutState;
    expect(cols).toBe(3);
    expect(rows).toBe(35); // 105 / 3 = 35 rows
    expect(dom.sizer.style.height).toBe(`${35 * rowH}px`);
  });

  test("repositions existing mounted tiles when layout changes", () => {
    const scenes = Array.from({ length: 20 }, (_, i) => ({ id: `scene-${i}`, title: `Scene ${i}` }));
    const { grid, dom, tilePool } = createMockGrid({ clientWidth: 1280, scenes });

    grid.layout();
    grid.renderWindow();

    const mounted = Array.from(tilePool.tiles.values());
    expect(mounted.length).toBeGreaterThan(0);

    const initialCols = grid.layoutState.cols;
    expect(initialCols).toBe(5);

    // Resize viewport to 960 (which yields 3 columns)
    dom.viewport.clientWidth = 960;
    grid.layout();

    expect(grid.layoutState.cols).toBe(3);

    // All mounted tiles should be immediately placed according to new layout
    for (const [index, node] of tilePool.tiles) {
      const expectedCol = index % 3;
      const expectedRow = Math.floor(index / 3);
      const expectedLeft = Math.round(expectedCol * (grid.layoutState.cardW + CARD_GAP));
      expect(node.style.left).toBe(`${expectedLeft}px`);
      expect(node.style.top).toBe(`${expectedRow * grid.layoutState.rowH}px`);
      expect(parseFloat(node.style.width)).toBeGreaterThanOrEqual(CARD_MIN_W);
    }
  });

  test("places tiles inside renderWindow and maintains right boundary containment", () => {
    const scenes = Array.from({ length: 30 }, (_, i) => ({ id: `scene-${i}`, title: `Scene ${i}` }));
    const { grid, dom, tilePool } = createMockGrid({ clientWidth: 1000, scenes });

    grid.layout();
    grid.renderWindow();

    for (const [index, node] of tilePool.tiles) {
      const col = index % grid.layoutState.cols;
      const left = parseFloat(node.style.left);
      const width = parseFloat(node.style.width);
      const right = left + width;

      // Card must not exceed viewport width
      expect(right).toBeLessThanOrEqual(dom.viewport.clientWidth + 0.001);
      expect(left).toBeGreaterThanOrEqual(0);
      // Card height must be explicitly set
      expect(node.style.height).toBe(`${grid.layoutState.cardH}px`);
    }
  });

  test("prunes stale tiles from DOM container on resize to prevent horizontal overflow", () => {
    const scenes = Array.from({ length: 40 }, (_, i) => ({ id: `scene-${i}`, title: `Scene ${i}` }));
    const { grid, dom, win, tilePool } = createMockGrid({ clientWidth: 1280, clientHeight: 600, scenes });

    grid.layout();
    grid.renderWindow();

    const initialTilesCount = win.children.length;
    expect(initialTilesCount).toBeGreaterThan(0);
    expect(win.children.every((n) => n.__index >= 0)).toBe(true);

    // Resize to smaller viewport with fewer columns
    dom.viewport.clientWidth = 960;
    grid.layout();
    grid.renderWindow();

    // No stale, recycled, or unindexed tiles must remain in the DOM window
    expect(win.children.every((n) => n.__index >= 0)).toBe(true);
    for (const node of win.children) {
      const left = parseFloat(node.style.left);
      const width = parseFloat(node.style.width);
      expect(left + width).toBeLessThanOrEqual(dom.viewport.clientWidth + 0.001);
    }
  });

  test("TilePool release detaches node from DOM and resets index and scene", () => {
    const tilePool = new TilePool({ onVideoError: () => {} });
    let removed = false;
    let detached = false;
    const mockNode = {
      __index: 10,
      __scene: { id: "s1" },
      remove: () => {
        removed = true;
      },
    };

    tilePool.release(mockNode as any, () => {
      detached = true;
    });

    expect(detached).toBe(true);
    expect(removed).toBe(true);
    expect(mockNode.__index).toBe(-1);
    expect(mockNode.__scene).toBeNull();
  });
});

