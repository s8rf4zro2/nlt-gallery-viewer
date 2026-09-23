import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { detectMoviesDir, detectGamesFromParent } from "../src/main/scanner";

describe("scanner folder detection (portable fixtures)", () => {
  let tempDir: string;
  let nadiaFake: string;
  let genesisFake: string;
  let symphonyFake: string;

  beforeAll(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "nlt-detect-test-"));
    nadiaFake = path.join(tempDir, "Treasure_of_Nadia_PC");
    genesisFake = path.join(tempDir, "The_Genesis_Order_Win");
    symphonyFake = path.join(tempDir, "Symphony_of_the_Serpent");

    // MV format (www/movies)
    mkdirSync(path.join(nadiaFake, "www", "movies"), { recursive: true });
    writeFileSync(path.join(nadiaFake, "www", "movies", "scene1.mp4"), "fake");
    writeFileSync(path.join(nadiaFake, "www", "movies", "scene1-l.mp4"), "fake");

    mkdirSync(path.join(genesisFake, "www", "movies"), { recursive: true });
    writeFileSync(path.join(genesisFake, "www", "movies", "intro.mp4"), "fake");

    // MZ format (movies)
    mkdirSync(path.join(symphonyFake, "movies"), { recursive: true });
    writeFileSync(path.join(symphonyFake, "movies", "opening.mp4"), "fake");
  });

  afterAll(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  test("detects MV directory structure (www/movies)", async () => {
    const res = await detectMoviesDir(nadiaFake);
    expect(res).not.toBeNull();
    expect(res.moviesDir).toContain("www/movies");
    expect(res.count).toBe(2);
  });

  test("detects MZ directory structure (movies)", async () => {
    const res = await detectMoviesDir(symphonyFake);
    expect(res).not.toBeNull();
    expect(res.moviesDir).toContain("movies");
    expect(res.count).toBe(1);
  });

  test("detects games from parent directory fixture", async () => {
    const res = await detectGamesFromParent(tempDir);
    expect(res.nadia).toBeDefined();
    expect(res.genesis).toBeDefined();
    expect(res.symphony).toBeDefined();
    expect(res.nadia.count).toBe(2);
    expect(res.genesis.count).toBe(1);
    expect(res.symphony.count).toBe(1);
  });

  test("returns null for non-existent directory", async () => {
    const res = await detectMoviesDir(path.join(tempDir, "non_existent_folder_xyz"));
    expect(res.moviesDir).toBeNull();
    expect(res.count).toBe(0);
  });
});

