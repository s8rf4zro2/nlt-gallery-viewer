/**
 * Game folder configuration and setup modal controller.
 */

const SUPPORTED_GAMES = ['nadia', 'genesis', 'symphony'];

export class FoldersModalController {
  constructor({ dom, onScanComplete, onFolderChange }) {
    this.dom = dom;
    this.onScanComplete = onScanComplete;
    this.onFolderChange = onFolderChange;

    this.isOpen = false;
    this.forceSetup = false;
    this.scanning = false;

    this.selected = {
      nadia: { gameDir: '', moviesDir: '', count: 0, valid: false },
      genesis: { gameDir: '', moviesDir: '', count: 0, valid: false },
      symphony: { gameDir: '', moviesDir: '', count: 0, valid: false },
    };
  }

  getElements() {
    return {
      modal: document.getElementById('modalFolders'),
      btnFolders: document.getElementById('btnFolders'),
      btnEmptyFolders: document.getElementById('btnEmptyFolders'),
      btnClose: document.getElementById('btnFoldersClose'),
      btnCancel: document.getElementById('btnFoldersCancel'),
      btnSave: document.getElementById('btnFoldersSave'),
      btnAutoDetect: document.getElementById('btnAutoDetect'),
      pathNadia: document.getElementById('pathNadia'),
      statusNadia: document.getElementById('statusNadia'),
      btnBrowseNadia: document.getElementById('btnBrowseNadia'),
      pathGenesis: document.getElementById('pathGenesis'),
      statusGenesis: document.getElementById('statusGenesis'),
      btnBrowseGenesis: document.getElementById('btnBrowseGenesis'),
      pathSymphony: document.getElementById('pathSymphony'),
      statusSymphony: document.getElementById('statusSymphony'),
      btnBrowseSymphony: document.getElementById('btnBrowseSymphony'),
      scanProgress: document.getElementById('scanProgress'),
      scanStatus: document.getElementById('scanStatus'),
    };
  }

  async init() {
    const el = this.getElements();

    el.btnFolders?.addEventListener('click', () => this.open({ forceSetup: false }));
    el.btnEmptyFolders?.addEventListener('click', () => this.open({ forceSetup: false }));
    el.btnClose?.addEventListener('click', () => this.close());
    el.btnCancel?.addEventListener('click', () => this.close());
    el.modal?.addEventListener('click', (e) => {
      if (e.target.dataset.closeFolders && !this.forceSetup && !this.scanning) {
        this.close();
      }
    });

    const browseMap = [
      { btn: el.btnBrowseNadia, key: 'nadia' },
      { btn: el.btnBrowseGenesis, key: 'genesis' },
      { btn: el.btnBrowseSymphony, key: 'symphony' },
    ];
    for (const { btn, key } of browseMap) {
      btn?.addEventListener('click', () => this.browseGame(key));
    }

    el.btnAutoDetect?.addEventListener('click', () => this.browseAutoDetect());
    el.btnSave?.addEventListener('click', () => this.saveAndScan());

    await this.loadConfig();
  }

  async loadConfig() {
    if (!window.nlt?.games?.getConfig) return;
    try {
      const config = await window.nlt.games.getConfig();
      for (const key of SUPPORTED_GAMES) {
        const item = config.games?.[key];
        if (item) {
          this.selected[key] = {
            gameDir: item.gameDir || '',
            moviesDir: item.moviesDir || '',
            count: item.count || 0,
            valid: Boolean(item.valid),
          };
        }
      }
      this.updateUI();
    } catch (err) {
      console.warn('[nlt] failed to load games config:', err);
    }
  }

  hasValidGames() {
    return Object.values(this.selected).some((g) => g.valid && g.moviesDir);
  }

  updateUI() {
    const el = this.getElements();

    const fields = [
      { key: 'nadia', pathEl: el.pathNadia, statusEl: el.statusNadia },
      { key: 'genesis', pathEl: el.pathGenesis, statusEl: el.statusGenesis },
      { key: 'symphony', pathEl: el.pathSymphony, statusEl: el.statusSymphony },
    ];

    for (const { key, pathEl, statusEl } of fields) {
      const g = this.selected[key];
      if (!g) continue;
      if (pathEl) pathEl.value = g.gameDir || g.moviesDir || '';
      if (statusEl) {
        if (g.valid) {
          statusEl.textContent = `✓ ${g.count.toLocaleString()} movies found`;
          statusEl.className = 'folder-status is-valid';
        } else if (g.gameDir || g.moviesDir) {
          statusEl.textContent = '⚠️ No movies found in folder';
          statusEl.className = 'folder-status is-invalid';
        } else {
          statusEl.textContent = 'Not configured';
          statusEl.className = 'folder-status';
        }
      }
    }

    // Save button enabled if at least one valid game
    if (el.btnSave) {
      el.btnSave.disabled = !this.hasValidGames() || this.scanning;
    }

    // Cancel / Close buttons disabled if force setup and no valid games
    if (el.btnClose) el.btnClose.hidden = this.forceSetup && !this.hasValidGames();
    if (el.btnCancel) el.btnCancel.hidden = this.forceSetup && !this.hasValidGames();
  }

  async browseGame(gameKey) {
    if (!window.nlt?.dialog?.selectFolder || !window.nlt?.games?.detect) return;
    const current = this.selected[gameKey]?.gameDir || undefined;
    const folder = await window.nlt.dialog.selectFolder(current);
    if (!folder) return;

    const detected = await window.nlt.games.detect(folder);
    if (detected?.single && detected.single.count > 0) {
      this.selected[gameKey] = {
        gameDir: detected.single.gameDir,
        moviesDir: detected.single.moviesDir,
        count: detected.single.count,
        valid: true,
      };
      this.updateUI();
      await this.saveAndScan();
    } else {
      this.selected[gameKey] = {
        gameDir: folder,
        moviesDir: '',
        count: 0,
        valid: false,
      };
      this.updateUI();
    }
  }

  async browseAutoDetect() {
    if (!window.nlt?.dialog?.selectFolder || !window.nlt?.games?.detect) return;
    const folder = await window.nlt.dialog.selectFolder();
    if (!folder) return;

    const detected = await window.nlt.games.detect(folder);
    let foundAny = false;

    if (detected?.parent) {
      for (const key of SUPPORTED_GAMES) {
        if (detected.parent[key]) {
          this.selected[key] = {
            gameDir: detected.parent[key].gameDir,
            moviesDir: detected.parent[key].moviesDir,
            count: detected.parent[key].count,
            valid: true,
          };
          foundAny = true;
        }
      }
    }

    // If single game was selected instead of parent
    if (!foundAny && detected?.single && detected.single.count > 0) {
      const lower = folder.toLowerCase();
      const targetKey = (lower.includes('symphony') || lower.includes('serpent'))
        ? 'symphony'
        : lower.includes('genesis')
          ? 'genesis'
          : 'nadia';
      this.selected[targetKey] = {
        gameDir: detected.single.gameDir,
        moviesDir: detected.single.moviesDir,
        count: detected.single.count,
        valid: true,
      };
      foundAny = true;
    }

    this.updateUI();
    if (foundAny) {
      await this.saveAndScan();
    }
  }

  async saveAndScan() {
    if (!window.nlt?.games?.saveAndScan || this.scanning) return;
    this.scanning = true;

    const el = this.getElements();
    if (el.scanProgress) el.scanProgress.hidden = false;
    if (el.scanStatus) el.scanStatus.textContent = 'Scanning movie files & dialogue…';
    if (el.btnSave) el.btnSave.disabled = true;

    try {
      const configToSave = {};
      for (const [key, val] of Object.entries(this.selected)) {
        if (val.valid && val.moviesDir) {
          configToSave[key] = {
            gameDir: val.gameDir,
            moviesDir: val.moviesDir,
          };
        }
      }

      await window.nlt.games.saveAndScan(configToSave);
      if (this.onScanComplete) await this.onScanComplete();
      this.close();
    } catch (err) {
      if (el.scanStatus) el.scanStatus.textContent = `Scan failed: ${err.message || err}`;
    } finally {
      this.scanning = false;
      if (el.scanProgress) el.scanProgress.hidden = true;
      if (el.btnSave) el.btnSave.disabled = !this.hasValidGames();
    }
  }

  open({ forceSetup = false } = {}) {
    this.forceSetup = forceSetup;
    this.isOpen = true;
    const el = this.getElements();
    if (el.modal) el.modal.hidden = false;
    this.updateUI();
  }

  close() {
    if (this.forceSetup && !this.hasValidGames()) return;
    this.isOpen = false;
    const el = this.getElements();
    if (el.modal) el.modal.hidden = true;
  }
}
