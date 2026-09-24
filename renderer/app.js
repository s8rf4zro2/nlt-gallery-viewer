'use strict';

import { GAMES } from './modules/constants.js';
import { getDom } from './modules/dom.js';
import { countScenes, groupEntries, normalizeEntry } from './modules/grouping.js';
import {
  renderCharacterOptions,
  renderCharacterRibbon,
  renderPrefixOptions,
  renderSceneOptions,
} from './modules/facets.js';
import { filterEntries, formatStatusText } from './modules/filter.js';
import { revealPath } from './modules/format.js';
import { HoverPreview } from './modules/hover-preview.js';
import { handleGridKeyDown } from './modules/keyboard.js';
import { MediaLoader } from './modules/media-loader.js';
import { TilePool } from './modules/tile-pool.js';
import { VirtualGrid } from './modules/virtual-grid.js';
import { FoldersModalController } from './modules/folders-modal.js';
import { scenePlayer as ScenePlayer } from './player/player-controller.js';

const state = {
  game: GAMES[0].id,
  indexes: new Map(),
  allScenes: new Map(),
  ratingScenes: new Map(),
  loadError: null,
  movies: [],
  scenes: [],
  cursor: 0,
  modalIndex: -1,
  query: '',
  rating: 'nsfw',
  prefix: '',
  character: '',
  scene: '',
};

const dom = getDom();

let mediaLoader = null;
const tilePool = new TilePool({
  onVideoError: (node) => mediaLoader?.handleVideoError(node),
});
mediaLoader = new MediaLoader(tilePool);

const grid = new VirtualGrid({
  dom,
  tilePool,
  mediaLoader,
  getScenes: () => state.scenes,
  getCursor: () => state.cursor,
});

const hoverPreview = new HoverPreview({
  isModalOpen: () => state.modalIndex >= 0,
});

const foldersModal = new FoldersModalController({
  dom,
  onScanComplete: async () => {
    await reloadAll();
  },
});

function setStatus(text) {
  dom.status.textContent = text;
}

function isModalOpen() {
  return state.modalIndex >= 0;
}

async function readIndex(gameId) {
  const entry = GAMES.find((g) => g.id === gameId);
  if (!entry) throw new Error(`unknown game: ${gameId}`);
  const data = await window.nlt.cache.readJson(entry.index);
  if (!data) throw new Error(`Index not found for ${entry.label}. Configure game folders in Setup or run scanner.`);
  return data;
}

function applyFilters({ resetScroll = true } = {}) {
  const all = state.indexes.get(state.game) ?? [];
  let allScenes = state.allScenes.get(state.game);
  if (!allScenes) {
    allScenes = groupEntries(all);
    state.allScenes.set(state.game, allScenes);
  }

  const ratingKey = `${state.game}:${state.rating}`;
  let ratingScenes = state.ratingScenes?.get(ratingKey);
  if (!ratingScenes) {
    const moviesForRating = filterEntries({ all, rating: state.rating });
    ratingScenes = groupEntries(moviesForRating);
    if (!state.ratingScenes) state.ratingScenes = new Map();
    state.ratingScenes.set(ratingKey, ratingScenes);
  }

  if (dom.rating) dom.rating.value = state.rating;

  state.prefix = renderPrefixOptions(dom.prefix, ratingScenes, state.prefix);
  state.character = renderCharacterOptions(dom.character, ratingScenes, state.character, {
    activePrefix: state.prefix,
  });
  state.scene = renderSceneOptions(dom.scene, ratingScenes, state.scene, {
    activePrefix: state.prefix,
    activeCharacter: state.character,
  });

  if (dom.characterRibbon) {
    renderCharacterRibbon(dom.characterRibbon, ratingScenes, state.character, (selectedChar) => {
      state.character = selectedChar;
      if (dom.character) dom.character.value = selectedChar;
      applyFilters();
      showState();
    }, {
      activePrefix: state.prefix,
    });
  }

  dom.rating?.classList.toggle('is-active', state.rating !== 'nsfw');
  dom.prefix?.classList.toggle('is-active', Boolean(state.prefix));
  dom.character?.classList.toggle('is-active', Boolean(state.character));
  dom.scene?.classList.toggle('is-active', Boolean(state.scene));

  const hasActiveFilter = Boolean(state.prefix || state.character || state.scene || state.query.trim() || state.rating !== 'nsfw');
  if (dom.btnClearFilters) {
    dom.btnClearFilters.hidden = !hasActiveFilter;
  }

  state.movies = filterEntries({
    all,
    query: state.query,
    prefix: state.prefix,
    character: state.character,
    scene: state.scene,
    rating: state.rating,
  });

  state.scenes = groupEntries(state.movies);
  state.cursor = state.scenes.length ? Math.min(state.cursor, state.scenes.length - 1) : 0;
  if (resetScroll) dom.viewport.scrollTop = 0;

  grid.clear();

  const totalScenes = ratingScenes.length;
  const shownScenes = state.scenes.length;
  dom.resultCount.textContent =
    shownScenes === totalScenes
      ? `${totalScenes.toLocaleString()} scenes`
      : `${shownScenes.toLocaleString()} scenes of ${totalScenes.toLocaleString()}`;

  grid.layout();
  grid.renderWindow();
  updateStatus();
}

function updateStatus() {
  const all = state.indexes.get(state.game) ?? [];
  const entry = GAMES.find((g) => g.id === state.game);
  const text = formatStatusText({
    gameLabel: entry?.label ?? state.game,
    allEntries: all,
    filteredEntries: state.movies,
    prefix: state.prefix,
    character: state.character,
    scene: state.scene,
    query: state.query,
    rating: state.rating,
  });
  setStatus(text);
}

function clearAllFilters() {
  state.prefix = '';
  state.character = '';
  state.scene = '';
  state.query = '';
  state.rating = 'nsfw';
  if (dom.rating) dom.rating.value = 'nsfw';
  if (dom.search) dom.search.value = '';
  dom.searchWrap?.classList.remove('has-value');
  applyFilters();
  showState();
}

function setQuery(value) {
  state.query = value;
  dom.search.value = value;
  dom.searchWrap.classList.toggle('has-value', value.length > 0);
  applyFilters();
  showState();
}

function selectGame(gameId) {
  if (gameId === state.game) return;
  if (isModalOpen()) closeModal();
  state.game = gameId;
  state.cursor = 0;
  state.prefix = '';
  state.character = '';
  state.scene = '';
  state.query = '';
  if (dom.search) dom.search.value = '';
  dom.searchWrap?.classList.remove('has-value');

  for (const tab of dom.tabs.querySelectorAll('.tab')) {
    const active = tab.dataset.game === gameId;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  }

  applyFilters();
  showState();
}

function showState() {
  const movies = state.indexes.get(state.game);
  dom.stateLoading.hidden = true;

  if (state.loadError) {
    dom.stateEmpty.hidden = false;
    dom.emptyTitle.textContent = 'Index not available';
    dom.emptyBody.innerHTML = `${state.loadError}<br /><br />Build it with <code>bun run scan</code>, then hit Reload.`;
    return;
  }

  if (movies && movies.length && !state.scenes.length) {
    dom.stateEmpty.hidden = false;
    dom.emptyTitle.textContent = 'No matches';
    dom.emptyBody.textContent = `Nothing in ${GAMES.find((g) => g.id === state.game)?.label} matches the current filter.`;
    return;
  }

  if (movies && movies.length === 0) {
    dom.stateEmpty.hidden = false;
    dom.emptyTitle.textContent = 'Empty index';
    dom.emptyBody.textContent = `${GAMES.find((g) => g.id === state.game)?.label} has no indexed movies.`;
    return;
  }

  dom.stateEmpty.hidden = true;
}

/* ------------------------------------------------------------- data loading */

async function loadGame(gameId, { silent = false } = {}) {
  if (!silent) {
    dom.stateLoading.hidden = false;
    dom.stateEmpty.hidden = true;
  }
  try {
    const raw = await readIndex(gameId);
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.movies) ? raw.movies : [];
    state.indexes.set(gameId, list.map((entry) => normalizeEntry(entry, gameId)));
    if (gameId === state.game) state.loadError = null;
  } catch (err) {
    if (gameId === state.game) state.loadError = `${err.message ?? err}`;
    state.indexes.set(gameId, state.indexes.get(gameId) ?? []);
  }
  const count = state.indexes.get(gameId)?.length ?? 0;
  const badgeMap = {
    nadia: dom.countNadia,
    genesis: dom.countGenesis,
    symphony: dom.countSymphony,
  };
  const badge = badgeMap[gameId];
  if (badge) badge.textContent = count ? count.toLocaleString() : '–';
  return count;
}

async function reloadAll() {
  state.loadError = null;
  state.allScenes.clear();
  state.ratingScenes?.clear();
  dom.stateLoading.hidden = false;
  await Promise.all(GAMES.map((g) => loadGame(g.id, { silent: true })));
  applyFilters();
  showState();
  setStatus(`Index reloaded · ${state.scenes.length.toLocaleString()} scenes in ${GAMES.find((g) => g.id === state.game)?.label}`);
}

function openModal(index) {
  if (index < 0 || index >= state.scenes.length) return;
  state.modalIndex = index;
  state.cursor = index;

  const scene = state.scenes[index];
  dom.modal.hidden = false;
  dom.modalTitle.textContent = scene.title;
  dom.modalVideo.poster = '';

  ScenePlayer.open(scene, { index, total: state.scenes.length });
  grid.paintCursor();
  dom.btnClose.focus({ preventScroll: true });
}

function stepModal(delta) {
  const next = state.modalIndex + delta;
  if (next < 0 || next >= state.scenes.length) return;
  state.modalIndex = next;
  state.cursor = next;
  const scene = state.scenes[next];
  ScenePlayer.open(scene, { index: next, total: state.scenes.length });
  grid.paintCursor();
  grid.scrollCursorIntoView();
  grid.renderNow();
}

function closeModal() {
  if (state.modalIndex < 0) return;
  ScenePlayer.destroy();
  dom.modalVideo.poster = '';
  state.modalIndex = -1;
  dom.modal.hidden = true;
  dom.viewport.focus({ preventScroll: true });
  grid.scrollCursorIntoView();
  grid.renderNow();
}

function initEvents() {
  dom.tabs.addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (tab) selectGame(tab.dataset.game);
  });

  let searchTimer = null;
  dom.search.addEventListener('input', (event) => {
    const value = event.target.value;
    dom.searchWrap.classList.toggle('has-value', value.length > 0);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setQuery(value), 120);
  });

  dom.search.addEventListener('search', (event) => setQuery(event.target.value));
  dom.searchClear.addEventListener('click', () => {
    setQuery('');
    dom.search.focus();
  });

  const onFacetChange = (key) => (event) => {
    state[key] = event.target.value;
    applyFilters();
    showState();
  };

  dom.rating?.addEventListener('change', onFacetChange('rating'));
  dom.prefix.addEventListener('change', onFacetChange('prefix'));
  dom.character?.addEventListener('change', onFacetChange('character'));
  dom.scene?.addEventListener('change', onFacetChange('scene'));
  dom.btnClearFilters?.addEventListener('click', clearAllFilters);

  dom.reload.addEventListener('click', () => void reloadAll());
  dom.emptyReload.addEventListener('click', () => void reloadAll());

  dom.viewport.addEventListener('scroll', () => {
    grid.scheduleRender();
    hoverPreview.stopCurrent();
  });

  dom.viewport.addEventListener('click', (event) => {
    const node = event.target.closest('.card');
    if (!node) return;
    const index = node.__index;
    if (typeof index === 'number' && index >= 0) openModal(index);
  });

  dom.window.addEventListener('pointerover', (event) => {
    const node = event.target.closest('.card');
    if (!node || node === hoverPreview.hoveredNode) return;
    hoverPreview.stopCurrent();
    if (node.__src) hoverPreview.start(node);
  });

  dom.window.addEventListener('pointerout', (event) => {
    const node = event.target.closest('.card');
    if (!node) return;
    if (event.relatedTarget && node.contains(event.relatedTarget)) return;
    hoverPreview.stop(node);
  });

  dom.modal.addEventListener('click', (event) => {
    if (event.target.dataset.close) closeModal();
  });
  dom.btnBack.addEventListener('click', closeModal);
  dom.btnClose.addEventListener('click', closeModal);
  dom.btnPrev.addEventListener('click', () => stepModal(-1));
  dom.btnNext.addEventListener('click', () => stepModal(1));
  dom.btnQuality.addEventListener('click', () => ScenePlayer.toggleQuality());
  dom.btnReveal.addEventListener('click', () => {
    revealPath(dom.modalVideo.dataset.path);
  });

  document.addEventListener('sceneplayer:stepscene', (event) => {
    if (!isModalOpen()) return;
    stepModal(Number(event.detail?.delta) || 0);
  });

  document.addEventListener('keydown', (event) => {
    handleGridKeyDown(event, {
      isFoldersModalOpen: () => foldersModal.isOpen,
      closeFoldersModal: () => foldersModal.close(),
      isModalOpen,
      closeModal,
      modalVideo: dom.modalVideo,
      query: state.query,
      clearQuery: () => setQuery(''),
      searchEl: dom.search,
      cols: grid.layoutState.cols,
      rowH: grid.layoutState.rowH,
      viewportH: dom.viewport.clientHeight,
      totalScenes: state.scenes.length,
      cursor: state.cursor,
      setCursor: (next) => { state.cursor = next; },
      openModal,
      renderNow: () => grid.renderNow(),
      scrollCursorIntoView: () => grid.scrollCursorIntoView(),
    });
  });

  let resizeRaf = 0;
  const onResize = () => {
    grid.layout();
    grid.renderNow();
  };

  if (typeof ResizeObserver !== 'undefined' && dom.viewport) {
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(dom.viewport);
  }
  window.addEventListener('resize', onResize);
}

async function boot() {
  initEvents();
  await foldersModal.init();

  dom.stateLoading.hidden = false;
  dom.emptyTitle.textContent = 'Loading…';
  dom.emptyBody.textContent = '';

  await Promise.all(GAMES.map((g) => loadGame(g.id, { silent: true })));

  const availableGame = GAMES.find((g) => (state.indexes.get(g.id)?.length ?? 0) > 0);
  state.game = availableGame ? availableGame.id : GAMES[0].id;
  for (const tab of dom.tabs.querySelectorAll('.tab')) {
    const active = tab.dataset.game === state.game;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  }

  applyFilters();
  grid.renderNow();
  showState();
  updateStatus();

  if (!foldersModal.hasValidGames() || !state.scenes.length) {
    if (!foldersModal.hasValidGames()) {
      foldersModal.open({ forceSetup: true });
    }
    setStatus(state.loadError ? 'Index missing — click Folders to configure game paths' : 'No scenes indexed');
  }
}

void boot();
