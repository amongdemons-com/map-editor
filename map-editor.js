const MAP_DRAFT_KEY = 'amongdemons.mapEditor.mapDraft.v1';
const MAP_DRAFT_META_KEY = 'amongdemons.mapEditor.mapDraftMeta.v1';
const MIN_TILE_SIZE = 4;
const MAX_TILE_SIZE = 38;
const DEFAULT_BOUNDS = { min: -50, max: 50 };
const TYPE_COUNT = 11;
const ZONE_START_RADIUS = 24;
const ZONE_ROTATION = 0.045;
const ZONE_TYPE_REMAP = { 4: 5, 5: 4 };
const DEMON_MAP_ASSET_BASE = '../../public/app/images/demons/map/';
const EMPTY_MAP = {
  bounds: { ...DEFAULT_BOUNDS },
  spawn: { x: 0, y: 0 },
  roads: [],
  events: [],
  blocks: [],
  encounters: []
};
const DEFAULT_SHRINE = {
  type: 'forsaken_shrine',
  title: 'Forsaken Shrine',
  description: 'A weathered altar where hunters can anchor their souls.'
};
const DEFAULT_PORTAL = {
  type: 'darkness-portal',
  title: 'Darkness Portal',
  summonCostPerDistance: 2,
  description: 'Spend 2 Souls per map step to teleport here instantly.'
};
const TOOL_KEYS = ['move', 'road', 'block', 'shrine', 'portal', 'erase'];
const ENCOUNTER_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const ENCOUNTER_ROLES = ['melee', 'ranged', 'poisoner', 'aoe', 'juggernaut', 'counter_tank', 'striker', 'healer', 'assassin'];
const ENCOUNTER_POSITIONS = ['front', 'back'];
const BLOCK_COLORS = {
  basalt: '#4d4541',
  'bone-spur': '#6c6253',
  chasm: '#16131a',
  ruin: '#514131'
};
const COLORS = {
  background: '#050705',
  mapFill: '#0b110c',
  mapBorder: '#746242',
  grid: 'rgba(211, 196, 148, 0.12)',
  axis: 'rgba(123, 215, 223, 0.28)',
  road: '#3a3728',
  roadGlow: 'rgba(226, 197, 126, 0.26)',
  hover: 'rgba(255, 255, 255, 0.2)',
  selection: '#f0c968',
  shrine: '#f0c968',
  portal: '#9a79c9',
  encounter: '#d9685f',
  spawn: '#7bd7df'
};
const GAME_BOARD_COLORS = {
  background: '#040a0d',
  selection: '#d7b765',
  shrineGlow: '#e8c76a',
  shrineSoul: '#8de7ff',
  portalGlow: '#80638a',
  pathGlow: '#58c7f0',
  gridLine: '#39423a'
};
const GAME_THEME_COLORS = {
  default: '#FAC51C',
  1: '#D1D5D8',
  2: '#171D24',
  3: '#167246',
  4: '#E25041',
  5: '#C8CED2',
  6: '#C084FC',
  7: '#FFB23F',
  8: '#6E8F45',
  9: '#B8BDC2',
  10: '#8DE7FF',
  11: '#52B7FF'
};
const GAME_DEFAULT_ZONE_PALETTE = {
  ground: ['#131812', '#141913', '#121711'],
  patch: '#20291f',
  moss: '#28381f',
  crack: '#0a0d09',
  road: ['#261f14', '#2d2618'],
  roadEdge: '#0d0a06',
  roadSheen: '#4a3d22',
  stone: ['#302c25', '#39342b', '#28241e'],
  stoneDark: '#18130d',
  stoneLight: '#4a4335',
  prop: '#3b3529',
  fog: '#070806',
  accent: '#e4685e'
};
const GAME_ZONE_COLOR_VARIANTS = {
  5: '#D8D0C4',
  9: '#A9B7C8'
};
const GAME_ZONE_PALETTES = Array.from({ length: TYPE_COUNT + 1 }, (item, typeId) => (
  typeId === 0 ? null : createGameZonePalette(typeId)
));
const RARITY_COLORS = {
  common: '#D1D5D8',
  uncommon: '#41A85F',
  rare: '#2C82C9',
  epic: '#9365B8',
  legendary: '#FAC51C',
  mythic: '#E25041'
};

const state = {
  map: null,
  originalText: '',
  dirty: false,
  tool: 'move',
  tileSize: 8,
  offsetX: 0,
  offsetY: 0,
  canvasWidth: 0,
  canvasHeight: 0,
  pixelRatio: 1,
  hasViewport: false,
  hoverTile: null,
  selected: null,
  pointer: null,
  interactionSnapshot: null,
  interactionChanged: false,
  history: [],
  future: [],
  previewMode: 'game',
  showGrid: true,
  showEncounters: true,
  imageCache: new Map(),
  spacePressed: false
};

const dom = {};

document.addEventListener('DOMContentLoaded', init);

function init() {
  cacheElements();
  bindControls();
  resizeCanvas();
  observeCanvasSize();
  loadInitialMap();
}

function cacheElements() {
  [
    'mapCanvas',
    'mapEditorStatus',
    'loadDraftButton',
    'clearDraftButton',
    'importMapButton',
    'exportMapButton',
    'saveMapButton',
    'previewModeSelect',
    'blockTypeSelect',
    'showGridToggle',
    'showEncountersToggle',
    'undoButton',
    'redoButton',
    'centerMapButton',
    'mapStats',
    'hoverReadout',
    'zoomReadout',
    'selectionEmpty',
    'selectionForm',
    'selectionKind',
    'selectionX',
    'selectionY',
    'eventFields',
    'eventTypeSelect',
    'eventTitle',
    'eventDescription',
    'portalCostField',
    'portalCost',
    'blockFields',
    'selectionBlockType',
    'encounterFields',
    'encounterId',
    'encounterDifficulty',
    'encounterDemon',
    'encounterDifficultyInput',
    'encounterTeamList',
    'addEncounterMemberButton',
    'applySelectionButton',
    'deleteSelectionButton',
    'mapImportFile'
  ].forEach((id) => {
    dom[id] = document.getElementById(id);
  });

  dom.mapStage = dom.mapCanvas?.closest('.map-stage');
  dom.toolButtons = Array.from(document.querySelectorAll('[data-tool]'));
  dom.statValues = Array.from(dom.mapStats?.querySelectorAll('dd') || []);
}

function bindControls() {
  dom.toolButtons.forEach((button) => {
    button.addEventListener('click', () => setTool(button.dataset.tool));
  });

  dom.blockTypeSelect?.addEventListener('change', () => setTool('block'));
  dom.previewModeSelect?.addEventListener('change', () => {
    state.previewMode = dom.previewModeSelect.value === 'schematic' ? 'schematic' : 'game';
    render();
  });
  dom.showGridToggle?.addEventListener('change', () => {
    state.showGrid = Boolean(dom.showGridToggle.checked);
    render();
  });
  dom.showEncountersToggle?.addEventListener('change', () => {
    state.showEncounters = Boolean(dom.showEncountersToggle.checked);
    render();
  });

  dom.loadDraftButton?.addEventListener('click', () => loadSavedDraft({ confirmDirty: true }));
  dom.clearDraftButton?.addEventListener('click', clearSavedDraft);
  dom.importMapButton?.addEventListener('click', () => dom.mapImportFile?.click());
  dom.mapImportFile?.addEventListener('change', onImportFile);
  dom.exportMapButton?.addEventListener('click', exportMap);
  dom.saveMapButton?.addEventListener('click', saveMap);
  dom.undoButton?.addEventListener('click', undo);
  dom.redoButton?.addEventListener('click', redo);
  dom.centerMapButton?.addEventListener('click', () => {
    fitMapToCanvas();
    render();
  });

  dom.selectionForm?.addEventListener('submit', onApplySelection);
  dom.deleteSelectionButton?.addEventListener('click', deleteSelection);
  dom.eventTypeSelect?.addEventListener('change', syncEventTypeFields);
  dom.addEncounterMemberButton?.addEventListener('click', addEncounterMemberEditorRow);
  dom.encounterTeamList?.addEventListener('click', onEncounterTeamListClick);
  dom.encounterTeamList?.addEventListener('change', onEncounterTeamListChange);

  dom.mapCanvas?.addEventListener('pointerdown', onCanvasPointerDown);
  dom.mapCanvas?.addEventListener('pointermove', onCanvasPointerMove);
  dom.mapCanvas?.addEventListener('pointerup', onCanvasPointerUp);
  dom.mapCanvas?.addEventListener('pointercancel', onCanvasPointerUp);
  dom.mapCanvas?.addEventListener('pointerleave', onCanvasPointerLeave);
  dom.mapCanvas?.addEventListener('wheel', onCanvasWheel, { passive: false });
  dom.mapCanvas?.addEventListener('contextmenu', (event) => event.preventDefault());

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

function observeCanvasSize() {
  if (!dom.mapStage || typeof ResizeObserver !== 'function') {
    window.addEventListener('resize', resizeCanvas);
    return;
  }

  const observer = new ResizeObserver(resizeCanvas);
  observer.observe(dom.mapStage);
}

function loadInitialMap() {
  if (loadSavedDraft({ confirmDirty: false, silent: true })) {
    setStatus('Loaded saved browser draft. Export when you are ready to write map.json.', 'success');
    return;
  }

  loadMapIntoEditor(cloneMap(EMPTY_MAP), {
    clean: true,
    status: 'Import map.json to begin, or edit the blank draft.'
  });
}

function loadSavedDraft(options = {}) {
  const confirmDirty = options.confirmDirty !== false;
  if (confirmDirty && state.dirty && !window.confirm('Load saved draft and discard unsaved editor changes?')) {
    return false;
  }

  const draft = readSavedDraft();
  if (!draft) {
    if (!options.silent) setStatus('No saved browser draft found. Import map.json to begin.', 'warning');
    return false;
  }

  loadMapIntoEditor(draft.map, {
    clean: true,
    status: `Loaded saved browser draft${draft.savedAt ? ` from ${formatDateTime(draft.savedAt)}` : ''}.`
  });
  return true;
}

function clearSavedDraft() {
  try {
    localStorage.removeItem(MAP_DRAFT_KEY);
    localStorage.removeItem(MAP_DRAFT_META_KEY);
    setStatus('Cleared saved browser draft. Current editor state is unchanged.', 'success');
  } catch (error) {
    console.error(error);
    setStatus('Unable to clear saved draft from this browser.', 'error');
  }
}

function saveMap() {
  if (!state.map) return;

  try {
    const text = mapToText(state.map);
    const savedAt = new Date().toISOString();
    localStorage.setItem(MAP_DRAFT_KEY, text);
    localStorage.setItem(MAP_DRAFT_META_KEY, JSON.stringify({
      savedAt,
      counts: getMapCounts(state.map)
    }));
    state.originalText = text;
    state.dirty = false;
    updateAll();
    setStatus('Saved temporary draft in this browser. Use Export to download map.json.', 'success');
  } catch (error) {
    console.error(error);
    setStatus('Unable to save draft. Browser storage may be full or unavailable.', 'error');
  }
}

function readSavedDraft() {
  try {
    const text = localStorage.getItem(MAP_DRAFT_KEY);
    if (!text) return null;

    const metaText = localStorage.getItem(MAP_DRAFT_META_KEY);
    const meta = metaText ? JSON.parse(metaText) : {};
    return {
      map: normalizeLoadedMap(JSON.parse(text)),
      savedAt: meta.savedAt || ''
    };
  } catch (error) {
    console.error(error);
    setStatus('Saved draft could not be read. Import map.json instead.', 'error');
    return null;
  }
}

function loadMapIntoEditor(map, options = {}) {
  const normalized = normalizeLoadedMap(map);
  state.map = normalized;
  state.originalText = options.clean ? mapToText(normalized) : state.originalText;
  state.dirty = !options.clean;
  state.history = [];
  state.future = [];
  state.selected = null;
  state.hoverTile = null;
  state.hasViewport = false;
  fitMapToCanvas();
  updateAll();
  if (options.status) setStatus(options.status, options.clean ? 'success' : 'info');
}

function exportMap() {
  if (!state.map) return;

  const blob = new Blob([mapToText(state.map)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'map.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus('Exported current map as map.json. Save Draft if you want to keep this browser copy.', 'success');
}

async function onImportFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    const imported = normalizeLoadedMap(JSON.parse(await file.text()));
    const before = state.map ? cloneMap(state.map) : null;
    state.map = imported;
    state.selected = null;
    state.hasViewport = false;
    fitMapToCanvas();
    if (before) pushHistory(before);
    setDirty(true);
    updateAll();
    setStatus(`Imported ${file.name}. Save Draft keeps it in this browser; Export downloads map.json.`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Unable to import JSON.', 'error');
  }
}

function setTool(tool) {
  if (!TOOL_KEYS.includes(tool)) return;
  state.tool = tool;
  dom.toolButtons.forEach((button) => {
    const active = button.dataset.tool === tool;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function onCanvasPointerDown(event) {
  if (!state.map) return;

  event.preventDefault();
  dom.mapCanvas.setPointerCapture?.(event.pointerId);

  const point = getCanvasPoint(event);
  const tile = screenToTile(point);
  state.hoverTile = tile;

  if (isPanIntent(event) || !tile) {
    beginPointer(event, 'pan', point, tile);
    dom.mapStage?.classList.add('is-panning');
    return;
  }

  if (state.tool === 'move') {
    const hit = getSelectableAt(tile);
    if (hit) {
      selectThing(hit);
      beginInteraction();
      beginPointer(event, 'move', point, tile);
      dom.mapStage?.classList.add('is-moving');
    } else {
      clearSelection();
      beginPointer(event, 'pan', point, tile);
      dom.mapStage?.classList.add('is-panning');
    }
    return;
  }

  beginInteraction();
  beginPointer(event, 'paint', point, tile);
  state.pointer.single = state.tool === 'shrine' || state.tool === 'portal';
  applyToolAt(tile);
}

function onCanvasPointerMove(event) {
  const point = getCanvasPoint(event);
  const tile = screenToTile(point);
  const hoverChanged = !positionsEqual(state.hoverTile, tile);
  state.hoverTile = tile;
  if (hoverChanged) {
    updateHoverReadout();
  }

  const pointer = state.pointer;
  if (!pointer || pointer.id !== event.pointerId) {
    if (hoverChanged) render();
    return;
  }

  if (pointer.mode === 'pan') {
    state.offsetX += point.x - pointer.lastPoint.x;
    state.offsetY += point.y - pointer.lastPoint.y;
    pointer.lastPoint = point;
    render();
    return;
  }

  if (pointer.mode === 'move') {
    if (tile && !positionsEqual(pointer.lastTile, tile)) {
      pointer.lastTile = tile;
      moveSelectedTo(tile);
    }
    if (hoverChanged) render();
    return;
  }

  if (pointer.mode === 'paint' && !pointer.single && tile && !positionsEqual(pointer.lastTile, tile)) {
    pointer.lastTile = tile;
    applyToolAt(tile);
    return;
  }

  if (hoverChanged) render();
}

function onCanvasPointerUp(event) {
  const pointer = state.pointer;
  if (!pointer || pointer.id !== event.pointerId) return;

  dom.mapCanvas.releasePointerCapture?.(event.pointerId);
  state.pointer = null;
  dom.mapStage?.classList.remove('is-panning', 'is-moving');
  finishInteraction();
}

function onCanvasPointerLeave() {
  if (state.pointer) return;
  state.hoverTile = null;
  updateHoverReadout();
  render();
}

function onCanvasWheel(event) {
  if (!state.map) return;
  event.preventDefault();

  const point = getCanvasPoint(event);
  const gridX = (point.x - state.offsetX) / state.tileSize;
  const gridY = (point.y - state.offsetY) / state.tileSize;
  const factor = event.deltaY < 0 ? 1.12 : 0.88;
  const nextSize = clamp(state.tileSize * factor, MIN_TILE_SIZE, MAX_TILE_SIZE);

  state.tileSize = nextSize;
  state.offsetX = point.x - gridX * nextSize;
  state.offsetY = point.y - gridY * nextSize;
  updateZoomReadout();
  render();
}

function onKeyDown(event) {
  if (event.key === ' ') {
    state.spacePressed = true;
  }

  const target = event.target;
  const isTyping = target instanceof HTMLElement
    && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

  if (event.ctrlKey || event.metaKey) {
    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    } else if (key === 'y') {
      event.preventDefault();
      redo();
    } else if (key === 's') {
      event.preventDefault();
      void saveMap();
    }
    return;
  }

  if (isTyping) return;

  if (/^[1-6]$/.test(event.key)) {
    setTool(TOOL_KEYS[Number(event.key) - 1]);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    deleteSelection();
  }
}

function onKeyUp(event) {
  if (event.key === ' ') {
    state.spacePressed = false;
  }
}

function beginPointer(event, mode, point, tile) {
  state.pointer = {
    id: event.pointerId,
    mode,
    lastPoint: point,
    lastTile: tile,
    single: false
  };
}

function isPanIntent(event) {
  return event.button === 1 || event.button === 2 || state.spacePressed;
}

function beginInteraction() {
  if (!state.map || state.interactionSnapshot) return;
  state.interactionSnapshot = cloneMap(state.map);
  state.interactionChanged = false;
}

function markInteractionChanged() {
  state.interactionChanged = true;
  setDirty(true);
}

function finishInteraction() {
  if (state.interactionSnapshot && state.interactionChanged) {
    pushHistory(state.interactionSnapshot);
  }
  state.interactionSnapshot = null;
  state.interactionChanged = false;
  updateHistoryButtons();
}

function applyToolAt(tile) {
  if (!state.map || !tile) return false;

  let changed = false;
  if (state.tool === 'road') {
    changed = paintRoad(tile);
  } else if (state.tool === 'block') {
    changed = paintBlock(tile);
  } else if (state.tool === 'shrine') {
    changed = paintEvent(tile, DEFAULT_SHRINE);
  } else if (state.tool === 'portal') {
    changed = paintEvent(tile, DEFAULT_PORTAL);
  } else if (state.tool === 'erase') {
    changed = eraseAt(tile);
  }

  if (changed) {
    markInteractionChanged();
    updateAll();
  }

  return changed;
}

function paintRoad(tile) {
  const roadIndex = findRoadIndexAt(tile);
  const removedBlock = removeBlockAt(tile);
  if (roadIndex >= 0) {
    state.selected = { kind: 'road', index: roadIndex };
    return removedBlock;
  }

  state.map.roads.push({ ...tile });
  state.selected = { kind: 'road', index: state.map.roads.length - 1 };
  return true;
}

function paintBlock(tile) {
  const type = dom.blockTypeSelect?.value || 'basalt';
  const removedRoad = removeRoadAt(tile);
  const removedEvent = removeEventAt(tile);

  const index = findBlockIndexAt(tile);
  if (index >= 0) {
    state.selected = { kind: 'block', index };
    if (state.map.blocks[index].type === type) return removedRoad || removedEvent;
    state.map.blocks[index] = { ...state.map.blocks[index], type };
    return true;
  }

  state.map.blocks.push({ ...tile, type });
  state.selected = { kind: 'block', index: state.map.blocks.length - 1 };
  return true;
}

function paintEvent(tile, template) {
  const removedBlock = removeBlockAt(tile);
  const index = findEventIndexAt(tile);
  const nextEvent = { ...template, ...tile };

  if (index >= 0) {
    if (state.map.events[index].type === template.type) {
      state.selected = { kind: 'event', index };
      return removedBlock;
    }
    state.map.events[index] = nextEvent;
    state.selected = { kind: 'event', index };
    return true;
  }

  state.map.events.push(nextEvent);
  state.selected = { kind: 'event', index: state.map.events.length - 1 };
  return true;
}

function eraseAt(tile) {
  const eventIndex = findEventIndexAt(tile);
  if (eventIndex >= 0) {
    state.map.events.splice(eventIndex, 1);
    state.selected = null;
    return true;
  }

  const blockIndex = findBlockIndexAt(tile);
  if (blockIndex >= 0) {
    state.map.blocks.splice(blockIndex, 1);
    state.selected = null;
    return true;
  }

  const roadIndex = findRoadIndexAt(tile);
  if (roadIndex >= 0) {
    state.map.roads.splice(roadIndex, 1);
    state.selected = null;
    return true;
  }

  return false;
}

function moveSelectedTo(tile) {
  if (!state.selected || !state.map || !tile) return false;

  const selection = state.selected;
  const item = getSelectedItem();
  if (!item || positionsEqual(item, tile)) return false;

  let changed = false;
  if (selection.kind === 'event') {
    if (findEventIndexAt(tile, selection.index) >= 0) return false;
    removeBlockAt(tile);
    item.x = tile.x;
    item.y = tile.y;
    changed = true;
  } else if (selection.kind === 'encounter') {
    if (findEncounterIndexAt(tile, selection.index) >= 0) return false;
    removeBlockAt(tile);
    item.x = tile.x;
    item.y = tile.y;
    changed = true;
  } else if (selection.kind === 'spawn') {
    removeBlockAt(tile);
    state.map.spawn = { ...tile };
    changed = true;
  } else if (selection.kind === 'road') {
    if (findRoadIndexAt(tile, selection.index) >= 0) return false;
    removeBlockAt(tile);
    item.x = tile.x;
    item.y = tile.y;
    changed = true;
  } else if (selection.kind === 'block') {
    if (findBlockIndexAt(tile, selection.index) >= 0) return false;
    removeRoadAt(tile);
    item.x = tile.x;
    item.y = tile.y;
    changed = true;
  }

  if (changed) {
    markInteractionChanged();
    updateAll();
  }

  return changed;
}

function onApplySelection(event) {
  event.preventDefault();
  if (!state.map || !state.selected) return;

  const tile = {
    x: Number(dom.selectionX.value),
    y: Number(dom.selectionY.value)
  };

  if (!isIntegerTile(tile) || !isInBounds(tile)) {
    setStatus('Selection coordinates must be whole numbers inside the map bounds.', 'error');
    return;
  }

  performChange(() => applySelectionChanges(tile));
}

function applySelectionChanges(tile) {
  const selection = state.selected;
  const item = getSelectedItem();
  if (!selection || !item) return false;

  if (selection.kind === 'event') {
    if (findEventIndexAt(tile, selection.index) >= 0) {
      setStatus('Another event is already on that tile.', 'error');
      return false;
    }

    removeBlockAt(tile);
    const type = dom.eventTypeSelect.value;
    item.x = tile.x;
    item.y = tile.y;
    item.type = type;
    item.title = dom.eventTitle.value.trim() || (type === 'darkness-portal' ? DEFAULT_PORTAL.title : DEFAULT_SHRINE.title);
    item.description = dom.eventDescription.value.trim();
    if (type === 'darkness-portal') {
      item.summonCostPerDistance = Math.max(0, Math.floor(Number(dom.portalCost.value) || 0));
    } else {
      delete item.summonCostPerDistance;
    }
    return true;
  }

  if (selection.kind === 'block') {
    if (findBlockIndexAt(tile, selection.index) >= 0) {
      setStatus('Another blocked tile is already there.', 'error');
      return false;
    }
    if (findEventIndexAt(tile) >= 0 || findEncounterIndexAt(tile) >= 0) {
      setStatus('Move the event or demon spot before blocking that tile.', 'error');
      return false;
    }

    removeRoadAt(tile);
    item.x = tile.x;
    item.y = tile.y;
    item.type = dom.selectionBlockType.value || item.type || 'basalt';
    return true;
  }

  if (selection.kind === 'road') {
    if (findRoadIndexAt(tile, selection.index) >= 0) {
      setStatus('Another road tile is already there.', 'error');
      return false;
    }

    removeBlockAt(tile);
    item.x = tile.x;
    item.y = tile.y;
    return true;
  }

  if (selection.kind === 'encounter') {
    if (findEncounterIndexAt(tile, selection.index) >= 0) {
      setStatus('Another demon spot is already on that tile.', 'error');
      return false;
    }

    const encounterEdits = readEncounterEditor();
    if (!encounterEdits) return false;

    removeBlockAt(tile);
    item.x = tile.x;
    item.y = tile.y;
    item.difficulty = encounterEdits.difficulty;
    item.team = encounterEdits.team;
    item.keyDemon = encounterEdits.keyDemon;
    return true;
  }

  if (selection.kind === 'spawn') {
    removeBlockAt(tile);
    state.map.spawn = { ...tile };
    return true;
  }

  return false;
}

function deleteSelection() {
  if (!state.map || !state.selected) return;

  if (state.selected.kind === 'encounter' || state.selected.kind === 'spawn') {
    setStatus('Demon spots and spawn can be moved, not deleted from this editor.', 'warning');
    return;
  }

  performChange(() => {
    const selection = state.selected;
    if (selection.kind === 'event') state.map.events.splice(selection.index, 1);
    else if (selection.kind === 'block') state.map.blocks.splice(selection.index, 1);
    else if (selection.kind === 'road') state.map.roads.splice(selection.index, 1);
    else return false;
    state.selected = null;
    return true;
  });
}

function performChange(apply) {
  const before = cloneMap(state.map);
  const changed = apply();
  if (!changed) {
    updateAll();
    return;
  }

  pushHistory(before);
  state.future = [];
  setDirty(true);
  updateAll();
}

function undo() {
  if (!state.history.length) return;
  state.future.push(cloneMap(state.map));
  state.map = state.history.pop();
  state.selected = null;
  refreshDirty();
  updateAll();
}

function redo() {
  if (!state.future.length) return;
  state.history.push(cloneMap(state.map));
  state.map = state.future.pop();
  state.selected = null;
  refreshDirty();
  updateAll();
}

function pushHistory(snapshot) {
  state.history.push(snapshot);
  if (state.history.length > 60) state.history.shift();
  state.future = [];
}

function selectThing(selection) {
  state.selected = selection;
  renderInspector();
  render();
}

function clearSelection() {
  if (!state.selected) return;
  state.selected = null;
  renderInspector();
  render();
}

function getSelectableAt(tile) {
  const eventIndex = findEventIndexAt(tile);
  if (eventIndex >= 0) return { kind: 'event', index: eventIndex };

  if (state.showEncounters) {
    const encounterIndex = findEncounterIndexAt(tile);
    if (encounterIndex >= 0) return { kind: 'encounter', index: encounterIndex };
  }

  if (positionsEqual(state.map.spawn, tile)) return { kind: 'spawn' };

  const blockIndex = findBlockIndexAt(tile);
  if (blockIndex >= 0) return { kind: 'block', index: blockIndex };

  const roadIndex = findRoadIndexAt(tile);
  if (roadIndex >= 0) return { kind: 'road', index: roadIndex };

  return null;
}

function getSelectedItem() {
  const selection = state.selected;
  if (!selection || !state.map) return null;

  if (selection.kind === 'event') return state.map.events[selection.index] || null;
  if (selection.kind === 'encounter') return state.map.encounters[selection.index] || null;
  if (selection.kind === 'block') return state.map.blocks[selection.index] || null;
  if (selection.kind === 'road') return state.map.roads[selection.index] || null;
  if (selection.kind === 'spawn') return state.map.spawn || null;
  return null;
}

function renderInspector() {
  const selection = state.selected;
  const item = getSelectedItem();
  const hasSelection = Boolean(selection && item);

  dom.selectionEmpty?.classList.toggle('d-none', hasSelection);
  dom.selectionForm?.classList.toggle('d-none', !hasSelection);
  if (!hasSelection) return;

  const bounds = getBounds();
  dom.selectionX.min = bounds.min;
  dom.selectionX.max = bounds.max;
  dom.selectionY.min = bounds.min;
  dom.selectionY.max = bounds.max;
  dom.selectionX.value = item.x;
  dom.selectionY.value = item.y;
  dom.selectionKind.textContent = getSelectionLabel(selection, item);

  dom.eventFields.classList.toggle('d-none', selection.kind !== 'event');
  dom.blockFields.classList.toggle('d-none', selection.kind !== 'block');
  dom.encounterFields.classList.toggle('d-none', selection.kind !== 'encounter');
  dom.deleteSelectionButton.disabled = selection.kind === 'encounter' || selection.kind === 'spawn';

  if (selection.kind === 'event') {
    ensureSelectValue(dom.eventTypeSelect, item.type || DEFAULT_SHRINE.type);
    dom.eventTypeSelect.value = item.type || DEFAULT_SHRINE.type;
    dom.eventTitle.value = item.title || '';
    dom.eventDescription.value = item.description || '';
    dom.portalCost.value = Number.isFinite(Number(item.summonCostPerDistance))
      ? Number(item.summonCostPerDistance)
      : DEFAULT_PORTAL.summonCostPerDistance;
    syncEventTypeFields();
  }

  if (selection.kind === 'block') {
    ensureSelectValue(dom.selectionBlockType, item.type || 'basalt');
    dom.selectionBlockType.value = item.type || 'basalt';
  }

  if (selection.kind === 'encounter') {
    dom.encounterId.textContent = item.id || '-';
    dom.encounterDifficulty.textContent = item.difficulty ?? '-';
    dom.encounterDemon.textContent = item.keyDemon?.species || item.team?.[0]?.species || '-';
    dom.encounterDifficultyInput.value = clamp(Math.floor(Number(item.difficulty) || 1), 1, 10);
    renderEncounterTeamEditor(item);
  }
}

function syncEventTypeFields() {
  const isPortal = dom.eventTypeSelect?.value === 'darkness-portal';
  dom.portalCostField?.classList.toggle('d-none', !isPortal);
}

function renderEncounterTeamEditor(encounter) {
  if (!dom.encounterTeamList) return;

  const team = normalizeArray(encounter.team);
  const keyIndex = getEncounterKeyMemberIndex(encounter, team);
  dom.encounterTeamList.innerHTML = team.map((member, index) => renderEncounterMemberEditor(member, index, {
    checked: index === keyIndex,
    open: false
  })).join('');
}

function renderEncounterMemberEditor(member, index, options = {}) {
  const normalized = normalizeEncounterMemberDraft(member, index);
  const label = normalized.species || `Demon ${index + 1}`;
  const summaryMeta = [
    `Type ${normalized.typeId}`,
    formatOptionLabel(normalized.rarity),
    formatOptionLabel(normalized.position)
  ].join(' / ');

  return `
    <details class="encounter-member-card" data-encounter-member data-original-index="${index}" ${options.open ? 'open' : ''}>
      <summary class="encounter-member-summary">
        <span class="encounter-member-summary-title">
          <span>Demon ${index + 1}</span>
          <strong>${escapeHtml(label)}</strong>
        </span>
        <span class="encounter-member-summary-meta">${escapeHtml(summaryMeta)}${options.checked ? ' / Key' : ''}</span>
      </summary>
      <div class="encounter-member-body">
        <div class="encounter-member-head">
          <label class="encounter-member-key">
            <input type="radio" name="encounterKeyDemon" data-field="key" ${options.checked ? 'checked' : ''}>
            <span>Key</span>
          </label>
          <button class="editor-button is-danger" type="button" data-remove-encounter-member>Remove</button>
        </div>
        <div class="encounter-member-grid" aria-label="${escapeAttribute(label)}">
          <label class="editor-field is-wide">
            <span>Instance ID</span>
            <input type="text" data-field="instanceId" value="${escapeAttribute(normalized.instanceId)}">
          </label>
          <label class="editor-field">
            <span>Type ID</span>
            <input type="number" min="1" max="${TYPE_COUNT}" step="1" data-field="typeId" value="${normalized.typeId}">
          </label>
          <label class="editor-field">
            <span>Rarity</span>
            <select data-field="rarity">${renderOptions(ENCOUNTER_RARITIES, normalized.rarity)}</select>
          </label>
          <label class="editor-field is-wide">
            <span>Species</span>
            <input type="text" data-field="species" value="${escapeAttribute(normalized.species)}">
          </label>
          <label class="editor-field">
            <span>Role</span>
            <select data-field="role">${renderOptions(ENCOUNTER_ROLES, normalized.role)}</select>
          </label>
          <label class="editor-field">
            <span>Position</span>
            <select data-field="position">${renderOptions(ENCOUNTER_POSITIONS, normalized.position)}</select>
          </label>
          <label class="editor-field is-wide">
            <span>Image URL</span>
            <input type="text" data-field="imageUrl" value="${escapeAttribute(normalized.imageUrl)}">
          </label>
        </div>
        <label class="encounter-member-flags">
          <input type="checkbox" data-field="elite" ${normalized.elite ? 'checked' : ''}>
          <span>Elite</span>
        </label>
      </div>
    </details>
  `;
}

function renderOptions(values, selectedValue) {
  const selected = String(selectedValue || '');
  const options = values.includes(selected) || !selected ? values : [...values, selected];
  return options.map((value) => (
    `<option value="${escapeAttribute(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(formatOptionLabel(value))}</option>`
  )).join('');
}

function formatOptionLabel(value) {
  return String(value || '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function addEncounterMemberEditorRow() {
  if (!dom.encounterTeamList) return;

  const rows = getEncounterEditorRows();
  const encounter = getSelectedItem();
  const nextIndex = rows.length;
  const member = createDefaultEncounterMember(encounter, nextIndex);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderEncounterMemberEditor(member, nextIndex, {
    checked: rows.length === 0,
    open: true
  });
  const row = wrapper.firstElementChild;
  if (!row) return;
  dom.encounterTeamList.appendChild(row);
}

function onEncounterTeamListClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const removeButton = target?.closest('[data-remove-encounter-member]');
  if (!removeButton) return;

  event.preventDefault();
  const row = removeButton.closest('[data-encounter-member]');
  row?.remove();
  ensureEncounterKeySelection();
}

function onEncounterTeamListChange(event) {
  const target = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement
    ? event.target
    : null;
  if (!target || !target.closest('[data-encounter-member]')) return;

  if (target.dataset.field === 'typeId' || target.dataset.field === 'rarity') {
    updateEncounterMemberImageSuggestion(target.closest('[data-encounter-member]'));
  }
}

function ensureEncounterKeySelection() {
  const rows = getEncounterEditorRows();
  if (!rows.length || rows.some((row) => row.querySelector('[data-field="key"]')?.checked)) return;
  const firstKey = rows[0].querySelector('[data-field="key"]');
  if (firstKey) firstKey.checked = true;
}

function updateEncounterMemberImageSuggestion(row) {
  if (!row) return;
  const imageInput = row.querySelector('[data-field="imageUrl"]');
  if (!(imageInput instanceof HTMLInputElement)) return;

  const current = imageInput.value.trim();
  const generatedPattern = /^\/app\/images\/demons\/\d+\.png$/;
  if (current && !generatedPattern.test(current)) return;

  const typeId = Math.floor(Number(getEncounterRowFieldValue(row, 'typeId')) || 1);
  const rarity = String(getEncounterRowFieldValue(row, 'rarity') || 'common');
  imageInput.value = getDefaultDemonImageUrl(typeId, rarity);
}

function readEncounterEditor() {
  const difficulty = clamp(Math.floor(Number(dom.encounterDifficultyInput?.value) || 1), 1, 10);
  const rows = getEncounterEditorRows();
  if (!rows.length) {
    setStatus('A demon spot needs at least one demon in its team.', 'error');
    return null;
  }

  const encounter = getSelectedItem();
  const team = [];
  let keyIndex = -1;

  for (const [index, row] of rows.entries()) {
    const member = readEncounterMemberRow(row, index, encounter);
    if (!member) return null;
    if (row.querySelector('[data-field="key"]')?.checked) keyIndex = index;
    team.push(member);
  }

  const keyMember = team[keyIndex >= 0 ? keyIndex : 0];
  return {
    difficulty,
    team,
    keyDemon: {
      typeId: keyMember.typeId,
      species: keyMember.species,
      rarity: keyMember.rarity,
      imageUrl: keyMember.imageUrl
    }
  };
}

function readEncounterMemberRow(row, index, encounter) {
  const originalIndex = Number(row.dataset.originalIndex);
  const original = Number.isInteger(originalIndex) && originalIndex >= 0
    ? normalizeArray(encounter?.team)[originalIndex] || {}
    : {};
  const typeId = Math.floor(Number(getEncounterRowFieldValue(row, 'typeId')) || 0);

  if (!Number.isInteger(typeId) || typeId < 1 || typeId > TYPE_COUNT) {
    setStatus(`Demon ${index + 1} needs a type ID between 1 and ${TYPE_COUNT}.`, 'error');
    return null;
  }

  const rarity = normalizeChoice(getEncounterRowFieldValue(row, 'rarity'), ENCOUNTER_RARITIES, 'common');
  const species = String(getEncounterRowFieldValue(row, 'species') || '').trim() || `Demon ${typeId}`;
  const role = normalizeRole(getEncounterRowFieldValue(row, 'role'));
  const position = normalizeChoice(getEncounterRowFieldValue(row, 'position'), ENCOUNTER_POSITIONS, 'front');
  const imageUrl = String(getEncounterRowFieldValue(row, 'imageUrl') || '').trim() || getDefaultDemonImageUrl(typeId, rarity);
  const instanceId = String(getEncounterRowFieldValue(row, 'instanceId') || '').trim()
    || `${encounter?.id || 'encounter'}-m${index + 1}`;
  const elite = Boolean(row.querySelector('[data-field="elite"]')?.checked);

  const member = {
    ...original,
    instanceId,
    typeId,
    species,
    role,
    rarity,
    position,
    imageUrl
  };

  if (elite) member.elite = true;
  else delete member.elite;

  return member;
}

function getEncounterEditorRows() {
  return Array.from(dom.encounterTeamList?.querySelectorAll('[data-encounter-member]') || []);
}

function getEncounterRowFieldValue(row, field) {
  const input = row.querySelector(`[data-field="${field}"]`);
  if (!input) return '';
  if (input instanceof HTMLInputElement && input.type === 'checkbox') return input.checked;
  return input.value;
}

function normalizeChoice(value, values, fallback) {
  const normalized = String(value || '').trim();
  return values.includes(normalized) ? normalized : fallback;
}

function normalizeRole(value) {
  return String(value || '').trim() || 'melee';
}

function normalizeEncounterMemberDraft(member, index) {
  const typeId = clamp(Math.floor(Number(member?.typeId) || 1), 1, TYPE_COUNT);
  const rarity = normalizeChoice(member?.rarity, ENCOUNTER_RARITIES, 'common');
  return {
    instanceId: String(member?.instanceId || ''),
    typeId,
    species: String(member?.species || `Demon ${typeId}`),
    role: normalizeRole(member?.role),
    rarity,
    position: normalizeChoice(member?.position, ENCOUNTER_POSITIONS, 'front'),
    imageUrl: String(member?.imageUrl || getDefaultDemonImageUrl(typeId, rarity)),
    elite: Boolean(member?.elite)
  };
}

function createDefaultEncounterMember(encounter, index) {
  const base = encounter?.keyDemon || normalizeArray(encounter?.team)[0] || {};
  const typeId = clamp(Math.floor(Number(base.typeId) || 1), 1, TYPE_COUNT);
  const rarity = normalizeChoice(base.rarity, ENCOUNTER_RARITIES, 'common');
  return {
    instanceId: `${encounter?.id || 'encounter'}-m${index + 1}`,
    typeId,
    species: base.species || `Demon ${typeId}`,
    role: 'melee',
    rarity,
    position: index === 0 ? 'front' : 'back',
    imageUrl: base.imageUrl || getDefaultDemonImageUrl(typeId, rarity),
    elite: index === 0
  };
}

function getEncounterKeyMemberIndex(encounter, team) {
  const key = encounter?.keyDemon;
  if (!team.length) return -1;
  if (!key) return 0;

  const exactIndex = team.findIndex((member) => (
    Number(member?.typeId) === Number(key.typeId)
    && String(member?.rarity || '') === String(key.rarity || '')
    && String(member?.species || '') === String(key.species || '')
  ));
  if (exactIndex >= 0) return exactIndex;

  const eliteIndex = team.findIndex((member) => member?.elite);
  return eliteIndex >= 0 ? eliteIndex : 0;
}

function getDefaultDemonImageUrl(typeId, rarity) {
  const rarityIndex = Math.max(0, ENCOUNTER_RARITIES.indexOf(rarity));
  const assetId = (clamp(Math.floor(Number(typeId) || 1), 1, TYPE_COUNT) - 1) * ENCOUNTER_RARITIES.length + rarityIndex + 1;
  return `/app/images/demons/${assetId}.png`;
}

function getSelectionLabel(selection, item) {
  if (selection.kind === 'event') {
    return item.type === 'darkness-portal' ? 'Teleport' : 'Shrine';
  }
  if (selection.kind === 'encounter') return 'Demon Spot';
  if (selection.kind === 'block') return `Block: ${item.type || 'basalt'}`;
  if (selection.kind === 'road') return 'Road';
  if (selection.kind === 'spawn') return 'Spawn';
  return 'Selection';
}

function updateAll() {
  renderInspector();
  updateStats();
  updateHistoryButtons();
  updateSaveButton();
  updateHoverReadout();
  updateZoomReadout();
  render();
}

function updateStats() {
  if (!state.map || dom.statValues.length < 5) return;
  const shrines = state.map.events.filter((event) => event.type === 'forsaken_shrine').length;
  const portals = state.map.events.filter((event) => event.type === 'darkness-portal').length;
  const values = [
    state.map.roads.length,
    state.map.blocks.length,
    shrines,
    portals,
    state.map.encounters.length
  ];
  values.forEach((value, index) => {
    dom.statValues[index].textContent = formatNumber(value);
  });
}

function updateHistoryButtons() {
  if (dom.undoButton) dom.undoButton.disabled = !state.history.length;
  if (dom.redoButton) dom.redoButton.disabled = !state.future.length;
}

function updateSaveButton() {
  if (dom.saveMapButton) {
    dom.saveMapButton.disabled = !state.map || !state.dirty;
  }
}

function updateHoverReadout() {
  if (!dom.hoverReadout) return;
  dom.hoverReadout.textContent = state.hoverTile
    ? `Area ${state.hoverTile.x}, ${state.hoverTile.y}`
    : 'Area -, -';
}

function updateZoomReadout() {
  if (!dom.zoomReadout || !state.map) return;
  const count = getWorldTileCount();
  const fitSize = Math.min(state.canvasWidth / count, state.canvasHeight / count);
  const zoom = fitSize > 0 ? Math.round((state.tileSize / fitSize) * 100) : 100;
  dom.zoomReadout.textContent = `${zoom}%`;
}

function setDirty(value) {
  state.dirty = Boolean(value);
  updateSaveButton();
}

function refreshDirty() {
  state.dirty = Boolean(state.map && mapToText(state.map) !== state.originalText);
  updateSaveButton();
}

function setBusy(busy) {
  [
    dom.loadDraftButton,
    dom.clearDraftButton,
    dom.importMapButton,
    dom.exportMapButton,
    dom.saveMapButton,
    dom.applySelectionButton,
    dom.deleteSelectionButton
  ].forEach((button) => {
    if (button) button.disabled = Boolean(busy);
  });
  if (!busy) updateAll();
}

function setStatus(message, type = 'info') {
  if (!dom.mapEditorStatus) return;
  dom.mapEditorStatus.textContent = message;
  dom.mapEditorStatus.classList.toggle('is-error', type === 'error');
  dom.mapEditorStatus.classList.toggle('is-success', type === 'success');
  dom.mapEditorStatus.classList.toggle('is-warning', type === 'warning');
}

function resizeCanvas() {
  if (!dom.mapCanvas) return;
  const rect = dom.mapCanvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  if (
    dom.mapCanvas.width !== Math.floor(width * pixelRatio)
    || dom.mapCanvas.height !== Math.floor(height * pixelRatio)
  ) {
    dom.mapCanvas.width = Math.floor(width * pixelRatio);
    dom.mapCanvas.height = Math.floor(height * pixelRatio);
  }

  state.canvasWidth = width;
  state.canvasHeight = height;
  state.pixelRatio = pixelRatio;
  if (state.map && !state.hasViewport) {
    fitMapToCanvas();
  }
  render();
}

function fitMapToCanvas() {
  if (!state.map || !state.canvasWidth || !state.canvasHeight) return;
  const count = getWorldTileCount();
  const margin = state.canvasWidth < 700 ? 18 : 34;
  const nextSize = clamp(
    Math.min((state.canvasWidth - margin * 2) / count, (state.canvasHeight - margin * 2) / count),
    MIN_TILE_SIZE,
    MAX_TILE_SIZE
  );

  state.tileSize = nextSize;
  state.offsetX = Math.round((state.canvasWidth - count * nextSize) / 2);
  state.offsetY = Math.round((state.canvasHeight - count * nextSize) / 2);
  state.hasViewport = true;
  updateZoomReadout();
}

function render() {
  const canvas = dom.mapCanvas;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const ratio = state.pixelRatio || 1;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

  if (!state.map) return;

  const bounds = getBounds();
  const count = getWorldTileCount();
  const mapX = state.offsetX;
  const mapY = state.offsetY;
  const mapSize = count * state.tileSize;

  ctx.save();
  ctx.beginPath();
  ctx.rect(mapX, mapY, mapSize, mapSize);
  ctx.clip();

  if (state.previewMode === 'game') {
    renderGamePreview(ctx, bounds, count, mapX, mapY, mapSize);
  } else {
    renderSchematicPreview(ctx, bounds, count, mapX, mapY, mapSize);
  }

  ctx.restore();
  ctx.strokeStyle = state.previewMode === 'game' ? 'rgba(232, 199, 106, 0.38)' : COLORS.mapBorder;
  ctx.lineWidth = state.previewMode === 'game' ? 1.5 : 2;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);
}

function renderSchematicPreview(ctx, bounds, count, mapX, mapY, mapSize) {
  ctx.fillStyle = COLORS.mapFill;
  ctx.fillRect(mapX, mapY, mapSize, mapSize);
  if (state.showGrid) drawGrid(ctx, bounds, count);
  drawAxis(ctx, bounds);
  drawRoads(ctx);
  drawBlocks(ctx);
  drawEvents(ctx);
  if (state.showEncounters) drawEncounters(ctx);
  drawSpawn(ctx);
  drawHover(ctx);
  drawSelection(ctx);
}

function renderGamePreview(ctx, bounds, count, mapX, mapY, mapSize) {
  ctx.fillStyle = GAME_BOARD_COLORS.background;
  ctx.fillRect(mapX, mapY, mapSize, mapSize);
  drawGameTerrain(ctx);
  if (state.showGrid) drawGameGrid(ctx, bounds, count);
  drawGameRoads(ctx);
  drawGameBlocks(ctx);
  drawGameEventAuras(ctx);
  drawGameEvents(ctx);
  if (state.showEncounters) drawGameEncounters(ctx);
  drawGameSpawn(ctx);
  drawGameHover(ctx);
  drawGameSelection(ctx);
}

function drawGrid(ctx, bounds, count) {
  if (state.tileSize < 6) return;

  ctx.beginPath();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;

  for (let index = 0; index <= count; index += 1) {
    const position = Math.round(state.offsetX + index * state.tileSize) + 0.5;
    ctx.moveTo(position, state.offsetY);
    ctx.lineTo(position, state.offsetY + count * state.tileSize);
  }

  for (let index = 0; index <= count; index += 1) {
    const position = Math.round(state.offsetY + index * state.tileSize) + 0.5;
    ctx.moveTo(state.offsetX, position);
    ctx.lineTo(state.offsetX + count * state.tileSize, position);
  }

  ctx.stroke();
}

function drawAxis(ctx, bounds) {
  if (0 < bounds.min || 0 > bounds.max) return;

  const zero = 0 - bounds.min;
  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const x = state.offsetX + zero * state.tileSize + state.tileSize / 2;
  ctx.moveTo(x, state.offsetY);
  ctx.lineTo(x, state.offsetY + getWorldTileCount() * state.tileSize);
  const y = state.offsetY + zero * state.tileSize + state.tileSize / 2;
  ctx.moveTo(state.offsetX, y);
  ctx.lineTo(state.offsetX + getWorldTileCount() * state.tileSize, y);
  ctx.stroke();
}

function drawRoads(ctx) {
  ctx.fillStyle = COLORS.roadGlow;
  state.map.roads.forEach((tile) => drawTileInset(ctx, tile, Math.max(0, state.tileSize * 0.12)));
  ctx.fillStyle = COLORS.road;
  state.map.roads.forEach((tile) => drawTileInset(ctx, tile, Math.max(1, state.tileSize * 0.26)));
}

function drawBlocks(ctx) {
  state.map.blocks.forEach((tile) => {
    ctx.fillStyle = BLOCK_COLORS[tile.type] || BLOCK_COLORS.basalt;
    drawTileInset(ctx, tile, Math.max(1, state.tileSize * 0.08));
  });
}

function drawEvents(ctx) {
  state.map.events.forEach((event) => {
    if (event.type === 'darkness-portal') {
      drawMarker(ctx, event, COLORS.portal, 'portal');
    } else {
      drawMarker(ctx, event, COLORS.shrine, 'diamond');
    }
  });
}

function drawEncounters(ctx) {
  state.map.encounters.forEach((encounter) => {
    drawMarker(ctx, encounter, COLORS.encounter, 'spot');
  });
}

function drawSpawn(ctx) {
  drawMarker(ctx, state.map.spawn, COLORS.spawn, 'spawn');
}

function drawHover(ctx) {
  if (!state.hoverTile) return;
  const rect = tileRect(state.hoverTile);
  ctx.fillStyle = COLORS.hover;
  ctx.fillRect(rect.x, rect.y, state.tileSize, state.tileSize);
}

function drawSelection(ctx) {
  const item = getSelectedItem();
  if (!item) return;
  const rect = tileRect(item);
  ctx.strokeStyle = COLORS.selection;
  ctx.lineWidth = Math.max(2, Math.min(4, state.tileSize * 0.18));
  ctx.strokeRect(rect.x + 1, rect.y + 1, state.tileSize - 2, state.tileSize - 2);
}

function drawTileInset(ctx, tile, inset) {
  if (!isTileVisible(tile)) return;
  const rect = tileRect(tile);
  const size = Math.max(1, state.tileSize - inset * 2);
  ctx.fillRect(rect.x + inset, rect.y + inset, size, size);
}

function drawMarker(ctx, tile, color, shape) {
  if (!isTileVisible(tile)) return;

  const rect = tileRect(tile);
  const centerX = rect.x + state.tileSize / 2;
  const centerY = rect.y + state.tileSize / 2;
  const radius = Math.max(2.5, Math.min(12, state.tileSize * 0.42));

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, radius * 0.18);

  if (shape === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX + radius, centerY);
    ctx.lineTo(centerX, centerY + radius);
    ctx.lineTo(centerX - radius, centerY);
    ctx.closePath();
    ctx.fill();
  } else if (shape === 'portal') {
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#d6bcff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.72, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape === 'spawn') {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(2, radius * 0.58), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawGameTerrain(ctx) {
  const sets = getMapTileSets();

  forVisibleTiles((x, y) => {
    drawGameGroundTile(ctx, x, y, sets);
  }, 1);

  drawGameMacroShading(ctx);
}

function drawGameGroundTile(ctx, x, y, sets) {
  const tile = { x, y };
  const rect = tileRect(tile);
  const size = state.tileSize;
  const zone = zoneTypeIdForTile(x, y);
  const palette = zonePaletteForTile(x, y);
  const variant = Math.floor(hashTile(x, y, 0) * palette.ground.length) % palette.ground.length;

  ctx.fillStyle = palette.ground[variant];
  ctx.fillRect(rect.x - 0.2, rect.y - 0.2, size + 0.4, size + 0.4);

  if (size >= 5) {
    drawEllipse(ctx, rect.x + size * hashTile(x, y, 11), rect.y + size * hashTile(x, y, 12), size * 0.34, size * 0.24, palette.patch, 0.08);
  }

  if (size >= 8) {
    ctx.save();
    ctx.strokeStyle = palette.crack;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = Math.max(0.7, size * 0.045);
    ctx.beginPath();
    const vertical = hashTile(x, y, 13) < 0.5;
    const start = vertical
      ? { x: rect.x + size * hashTile(x, y, 14), y: rect.y - 1 }
      : { x: rect.x - 1, y: rect.y + size * hashTile(x, y, 14) };
    ctx.moveTo(start.x, start.y);
    for (let step = 1; step <= 3; step += 1) {
      const t = step / 3;
      const jitter = (hashTile(x, y, 14 + step) - 0.5) * size * 0.32;
      ctx.lineTo(
        vertical ? start.x + jitter : rect.x + t * (size + 2),
        vertical ? rect.y + t * (size + 2) : start.y + jitter
      );
    }
    ctx.stroke();
    ctx.restore();
  }

  if (size >= 11 && !sets.roads.has(getTileKey(tile)) && !sets.blocks.has(getTileKey(tile)) && hashTile(x, y, 7) < 0.05) {
    const cx = rect.x + size * (0.35 + hashTile(x, y, 8) * 0.3);
    const cy = rect.y + size * (0.38 + hashTile(x, y, 9) * 0.25);
    drawEllipse(ctx, cx + size * 0.02, cy + size * 0.03, size * 0.08, size * 0.04, '#000000', 0.18);
    drawEllipse(ctx, cx, cy, size * 0.055, size * 0.045, palette.prop, 0.85);
  }
}

function drawGameMacroShading(ctx) {
  if (state.tileSize < 6) return;

  const range = getVisibleTileRange(5);
  const cell = 5;
  const startX = Math.floor(range.minX / cell) * cell;
  const startY = Math.floor(range.minY / cell) * cell;

  for (let y = startY; y <= range.maxY; y += cell) {
    for (let x = startX; x <= range.maxX; x += cell) {
      const rect = tileRect({ x, y });
      const cx = rect.x + hashTile(x, y, 21) * cell * state.tileSize;
      const cy = rect.y + hashTile(x, y, 22) * cell * state.tileSize;
      const radius = state.tileSize * (2 + hashTile(x, y, 23) * 2.4);
      const dark = hashTile(x, y, 24) < 0.55;
      drawEllipse(ctx, cx, cy, radius, radius * (0.7 + hashTile(x, y, 25) * 0.35), dark ? '#000000' : '#8fa08a', dark ? 0.045 : 0.025);
    }
  }
}

function drawGameGrid(ctx, bounds, count) {
  if (state.tileSize < 7) return;

  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = GAME_BOARD_COLORS.gridLine;
  ctx.globalAlpha = 0.12;
  ctx.lineWidth = 1;

  for (let index = 0; index <= count; index += 1) {
    const x = Math.round(state.offsetX + index * state.tileSize) + 0.5;
    ctx.moveTo(x, state.offsetY);
    ctx.lineTo(x, state.offsetY + count * state.tileSize);
  }

  for (let index = 0; index <= count; index += 1) {
    const y = Math.round(state.offsetY + index * state.tileSize) + 0.5;
    ctx.moveTo(state.offsetX, y);
    ctx.lineTo(state.offsetX + count * state.tileSize, y);
  }

  ctx.stroke();

  if (0 >= bounds.min && 0 <= bounds.max) {
    const zero = 0 - bounds.min;
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#6fd6bd';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const x = state.offsetX + zero * state.tileSize + state.tileSize / 2;
    const y = state.offsetY + zero * state.tileSize + state.tileSize / 2;
    ctx.moveTo(x, state.offsetY);
    ctx.lineTo(x, state.offsetY + count * state.tileSize);
    ctx.moveTo(state.offsetX, y);
    ctx.lineTo(state.offsetX + count * state.tileSize, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawGameRoads(ctx) {
  const roadKeys = getMapTileSets().roads;

  state.map.roads.forEach((tile) => {
    if (isTileVisible(tile)) drawGameRoadTile(ctx, tile, roadKeys);
  });
}

function drawGameRoadTile(ctx, tile, roadKeys) {
  const rect = tileRect(tile);
  const size = state.tileSize;
  const palette = zonePaletteForTile(tile.x, tile.y);
  const mask =
    (roadKeys.has(getTileKey({ x: tile.x, y: tile.y - 1 })) ? 1 : 0) |
    (roadKeys.has(getTileKey({ x: tile.x + 1, y: tile.y })) ? 2 : 0) |
    (roadKeys.has(getTileKey({ x: tile.x, y: tile.y + 1 })) ? 4 : 0) |
    (roadKeys.has(getTileKey({ x: tile.x - 1, y: tile.y })) ? 8 : 0);
  const width = clamp(size * 0.42, Math.min(3, size), size * 0.62);
  const inset = (size - width) / 2;
  const half = size / 2;
  const dirt = palette.road[Math.floor(hashTile(tile.x, tile.y, 6) * palette.road.length) % palette.road.length];
  const segments = [[rect.x + inset, rect.y + inset, width, width]];

  if (mask & 1) segments.push([rect.x + inset, rect.y, width, half]);
  if (mask & 2) segments.push([rect.x + half, rect.y + inset, half, width]);
  if (mask & 4) segments.push([rect.x + inset, rect.y + half, width, half]);
  if (mask & 8) segments.push([rect.x, rect.y + inset, half, width]);

  ctx.save();
  ctx.fillStyle = palette.roadEdge;
  ctx.globalAlpha = 0.55;
  segments.forEach(([x, y, w, h]) => ctx.fillRect(x - size * 0.04, y - size * 0.04, w + size * 0.08, h + size * 0.08));

  ctx.globalAlpha = 0.96;
  ctx.fillStyle = dirt;
  segments.forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));

  if (size >= 9) {
    const center = tileCenterScreen(tile);
    drawEllipse(ctx, center.x, center.y, size * 0.11, size * 0.1, palette.roadSheen, 0.16);
    if (mask & 1) drawEllipse(ctx, center.x, center.y - size * 0.25, size * 0.09, size * 0.08, palette.roadSheen, 0.12);
    if (mask & 2) drawEllipse(ctx, center.x + size * 0.25, center.y, size * 0.09, size * 0.08, palette.roadSheen, 0.12);
    if (mask & 4) drawEllipse(ctx, center.x, center.y + size * 0.25, size * 0.09, size * 0.08, palette.roadSheen, 0.12);
    if (mask & 8) drawEllipse(ctx, center.x - size * 0.25, center.y, size * 0.09, size * 0.08, palette.roadSheen, 0.12);
  }

  if (size >= 13) {
    ctx.fillStyle = palette.stone[Math.floor(hashTile(tile.x, tile.y, 16) * palette.stone.length) % palette.stone.length];
    for (let index = 0; index < 2; index += 1) {
      const cx = rect.x + size * (0.32 + hashTile(tile.x, tile.y, 17 + index) * 0.36);
      const cy = rect.y + size * (0.32 + hashTile(tile.x, tile.y, 19 + index) * 0.36);
      drawEllipse(ctx, cx, cy, size * 0.045, size * 0.032, ctx.fillStyle, 0.58);
    }
  }

  ctx.restore();
}

function drawGameBlocks(ctx) {
  state.map.blocks.forEach((tile) => {
    if (isTileVisible(tile)) drawGameBlock(ctx, tile);
  });
}

function drawGameBlock(ctx, tile) {
  const zone = zoneTypeIdForTile(tile.x, tile.y);
  const type = tile.type || 'basalt';

  if (zone === 3) {
    drawGamePuddleBlock(ctx, tile, {
      border: '#06110a',
      body: '#17331d',
      deep: '#0b1a0e',
      glow: '#4e8a48'
    });
    return;
  }

  if (zone === 4) {
    drawGamePuddleBlock(ctx, tile, {
      border: '#150705',
      body: '#3a1710',
      deep: '#1d0b07',
      glow: '#e25041'
    });
    return;
  }

  if (zone === 8) {
    drawGameLeafBlock(ctx, tile);
    return;
  }

  if (type === 'chasm') drawGameChasmBlock(ctx, tile);
  else if (type === 'bone-spur') drawGameBoneBlock(ctx, tile);
  else if (type === 'ruin') drawGameRuinBlock(ctx, tile);
  else drawGameStoneBlock(ctx, tile);
}

function drawGameStoneBlock(ctx, tile) {
  const rect = tileRect(tile);
  const size = state.tileSize;
  const palette = zonePaletteForTile(tile.x, tile.y);

  drawEllipse(ctx, rect.x + size * 0.54, rect.y + size * 0.62, size * 0.32, size * 0.2, '#000000', 0.34);
  for (let index = 0; index < 3; index += 1) {
    const cx = rect.x + size * (0.33 + hashTile(tile.x, tile.y, 31 + index) * 0.36);
    const cy = rect.y + size * (0.35 + hashTile(tile.x, tile.y, 36 + index) * 0.3);
    const radius = size * (0.15 + hashTile(tile.x, tile.y, 41 + index) * 0.13);
    drawEllipse(ctx, cx + radius * 0.12, cy + radius * 0.2, radius * 1.1, radius * 0.78, '#000000', 0.22);
    drawEllipse(ctx, cx, cy, radius, radius * 0.78, palette.stone[index % palette.stone.length], 0.95);
    drawEllipse(ctx, cx - radius * 0.2, cy - radius * 0.2, radius * 0.36, radius * 0.18, palette.stoneLight, 0.26);
  }
}

function drawGameBoneBlock(ctx, tile) {
  const rect = tileRect(tile);
  const size = state.tileSize;
  drawEllipse(ctx, rect.x + size * 0.52, rect.y + size * 0.68, size * 0.34, size * 0.13, '#000000', 0.35);
  ctx.save();
  ctx.strokeStyle = '#c8c0a8';
  ctx.lineWidth = Math.max(1, size * 0.1);
  ctx.lineCap = 'round';
  for (let index = 0; index < 3; index += 1) {
    const baseX = rect.x + size * (0.3 + index * 0.2);
    const baseY = rect.y + size * 0.7;
    const tipX = baseX + (hashTile(tile.x, tile.y, 51 + index) - 0.5) * size * 0.16;
    const tipY = rect.y + size * (0.2 + hashTile(tile.x, tile.y, 54 + index) * 0.2);
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    drawCircle(ctx, tipX, tipY, Math.max(1.2, size * 0.055), '#efe8cf', 0.85);
  }
  ctx.restore();
}

function drawGameChasmBlock(ctx, tile) {
  const rect = tileRect(tile);
  const size = state.tileSize;
  const center = tileCenterScreen(tile);
  drawEllipse(ctx, center.x, center.y + size * 0.08, size * 0.38, size * 0.3, '#020303', 0.92);
  drawEllipse(ctx, center.x - size * 0.05, center.y - size * 0.02, size * 0.28, size * 0.2, '#0d1015', 0.92);
  drawEllipse(ctx, rect.x + size * 0.32, rect.y + size * 0.3, size * 0.08, size * 0.03, '#39423a', 0.2);
}

function drawGameRuinBlock(ctx, tile) {
  const rect = tileRect(tile);
  const size = state.tileSize;
  const palette = zonePaletteForTile(tile.x, tile.y);
  drawEllipse(ctx, rect.x + size * 0.52, rect.y + size * 0.7, size * 0.34, size * 0.13, '#000000', 0.32);
  ctx.save();
  ctx.fillStyle = palette.stoneDark;
  const brickHeight = Math.max(1.5, size * 0.16);
  for (let index = 0; index < 3; index += 1) {
    const x = rect.x + size * (0.2 + index * 0.2);
    const y = rect.y + size * (0.35 + (index % 2) * 0.16);
    ctx.fillRect(x, y, size * 0.25, brickHeight);
    ctx.strokeStyle = '#070909';
    ctx.lineWidth = Math.max(0.5, size * 0.025);
    ctx.strokeRect(x, y, size * 0.25, brickHeight);
  }
  ctx.restore();
}

function drawGamePuddleBlock(ctx, tile, colors) {
  const center = tileCenterScreen(tile);
  const size = state.tileSize;
  const radius = size * 0.42;

  ctx.save();
  ctx.beginPath();
  traceScreenBlob(ctx, center.x, center.y, radius, tile.x, tile.y);
  ctx.fillStyle = colors.border;
  ctx.globalAlpha = 0.95;
  ctx.fill();

  ctx.beginPath();
  traceScreenBlob(ctx, center.x, center.y, radius * 0.86, tile.x + 3, tile.y - 7);
  ctx.fillStyle = colors.body;
  ctx.globalAlpha = 0.9;
  ctx.fill();

  if (size >= 9) {
    drawEllipse(ctx, center.x - size * 0.08, center.y, size * 0.18, size * 0.08, colors.deep, 0.45);
    drawCircle(ctx, center.x + size * 0.16, center.y - size * 0.1, Math.max(1, size * 0.04), colors.glow, 0.52);
    drawCircle(ctx, center.x - size * 0.18, center.y + size * 0.12, Math.max(0.8, size * 0.03), colors.glow, 0.38);
  }

  ctx.restore();
}

function drawGameLeafBlock(ctx, tile) {
  const center = tileCenterScreen(tile);
  const size = state.tileSize;

  drawEllipse(ctx, center.x + size * 0.06, center.y + size * 0.08, size * 0.38, size * 0.28, '#000000', 0.28);
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * Math.PI * 2 + hashTile(tile.x, tile.y, 60 + index) * 0.55;
    const length = size * (0.32 + hashTile(tile.x, tile.y, 70 + index) * 0.22);
    const width = size * (0.08 + hashTile(tile.x, tile.y, 80 + index) * 0.04);
    const ox = center.x + Math.cos(angle) * size * 0.08;
    const oy = center.y + Math.sin(angle) * size * 0.08;
    drawLeaf(ctx, ox, oy, angle, length, width, index % 3 === 0 ? '#35501f' : index % 2 === 0 ? '#1f3214' : '#14200d', 0.86);
  }
}

function drawGameEventAuras(ctx) {
  state.map.events.forEach((event) => {
    if (!isTileVisible(event)) return;
    const center = tileCenterScreen(event);
    if (event.type === 'darkness-portal') {
      drawCircle(ctx, center.x, center.y, getGameMarkerRadius(1.45), GAME_BOARD_COLORS.portalGlow, 0.16);
      drawCircle(ctx, center.x, center.y, getGameMarkerRadius(0.9), GAME_BOARD_COLORS.portalGlow, 0.12);
    } else if (event.type === 'forsaken_shrine') {
      drawCircle(ctx, center.x, center.y - state.tileSize * 0.05, getGameMarkerRadius(1.25), GAME_BOARD_COLORS.shrineSoul, 0.1);
      drawCircle(ctx, center.x, center.y - state.tileSize * 0.45, getGameMarkerRadius(0.42), GAME_BOARD_COLORS.shrineSoul, 0.16);
    }
  });
}

function drawGameEvents(ctx) {
  state.map.events.forEach((event) => {
    if (!isTileVisible(event)) return;
    if (event.type === 'darkness-portal') drawGamePortalMarker(ctx, event);
    else if (event.type === 'forsaken_shrine') drawGameShrineMarker(ctx, event);
  });
}

function drawGamePortalMarker(ctx, event) {
  const center = tileCenterScreen(event);
  const radius = getGameMarkerRadius(0.76);

  drawEllipse(ctx, center.x, center.y + radius * 0.9, radius * 1.15, radius * 0.38, '#000000', 0.38);
  drawCircle(ctx, center.x, center.y, radius, '#0d0812', 0.95);

  ctx.save();
  ctx.strokeStyle = GAME_BOARD_COLORS.portalGlow;
  ctx.lineWidth = Math.max(1.2, radius * 0.14);
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.62;
  for (let index = 0; index < 3; index += 1) {
    const start = (index / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius * (0.64 - index * 0.1), start, start + Math.PI * 0.9);
    ctx.stroke();
  }
  ctx.restore();

  drawCircle(ctx, center.x, center.y, Math.max(1.5, radius * 0.16), '#d9c8ea', 0.9);
}

function drawGameShrineMarker(ctx, event) {
  const center = tileCenterScreen(event);
  const scale = getGameMarkerScale();
  const soul = GAME_BOARD_COLORS.shrineSoul;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.scale(scale, scale);

  drawLocalEllipse(ctx, 1, 16, 17, 6, '#000000', 0.4);
  drawLocalPolygon(ctx, [-14, 13, 14, 13, 11, 18, -11, 18], '#161a19', '#070909', 1.4, 0.96);
  drawLocalPolygon(ctx, [-8, 13, -9, -10, -4, -17, 3, -19, 8, -12, 9, 5, 7, 13], '#1d2323', '#0a0d0d', 1.6, 0.97);
  drawLocalPolygon(ctx, [-7.5, 10, -8.5, -9, -4, -16, -2, -16, -3.5, 10], '#394547', null, 0, 0.4);

  ctx.strokeStyle = '#0a0d0d';
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(3, -18);
  ctx.lineTo(1, -8);
  ctx.lineTo(3.5, 2);
  ctx.stroke();

  drawLocalCircle(ctx, 0, -3, 8, soul, 0.12);
  ctx.strokeStyle = soul;
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(0, 3);
  ctx.moveTo(-4, -6.5);
  ctx.lineTo(4, -6.5);
  ctx.moveTo(-3.5, 0);
  ctx.lineTo(3.5, 0);
  ctx.stroke();

  drawLocalCircle(ctx, 0, -21, 5.5, soul, 0.18);
  drawLocalEllipse(ctx, 0, -21, 2.4, 3.4, soul, 0.72);
  drawLocalEllipse(ctx, 0, -21.8, 1.1, 1.8, '#eafcff', 0.9);
  ctx.restore();
}

function drawGameEncounters(ctx) {
  state.map.encounters.forEach((encounter) => {
    if (isTileVisible(encounter)) drawGameEncounterMarker(ctx, encounter);
  });
}

function drawGameEncounterMarker(ctx, encounter) {
  const center = tileCenterScreen(encounter);
  const radius = getGameMarkerRadius(0.86);
  const ringColor = rarityColor(encounter.keyDemon?.rarity);
  const image = getEncounterImage(encounter);

  ctx.save();
  drawEllipse(ctx, center.x, center.y + radius * 1.05, radius * 0.95, radius * 0.22, '#000000', 0.35);
  drawCircle(ctx, center.x, center.y, radius * 1.2, ringColor, state.selected?.kind === 'encounter' && getSelectedItem() === encounter ? 0.2 : 0.09);
  drawCircle(ctx, center.x, center.y, radius * 1.06, '#080c0e', 0.92);

  ctx.strokeStyle = '#0a0705';
  ctx.lineWidth = Math.max(1, radius * 0.12);
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 1.1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = ringColor;
  ctx.globalAlpha = 0.78;
  ctx.lineWidth = Math.max(1.1, radius * 0.1);
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 1.02, 0, Math.PI * 2);
  ctx.stroke();

  if (image) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius * 0.95, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, center.x - radius, center.y - radius, radius * 2, radius * 2);
    ctx.restore();
  } else {
    drawCircle(ctx, center.x, center.y, radius * 0.92, ringColor, 0.24);
  }

  ctx.restore();
}

function drawGameSpawn(ctx) {
  if (!state.map?.spawn || !isTileVisible(state.map.spawn)) return;
  const center = tileCenterScreen(state.map.spawn);
  const radius = getGameMarkerRadius(0.84);

  drawCircle(ctx, center.x, center.y, radius * 1.28, GAME_BOARD_COLORS.selection, 0.1);
  drawEllipse(ctx, center.x, center.y + radius * 1.05, radius, radius * 0.28, '#000000', 0.36);
  drawCircle(ctx, center.x, center.y, radius, '#071214', 0.95);

  ctx.save();
  ctx.strokeStyle = GAME_BOARD_COLORS.selection;
  ctx.lineWidth = Math.max(1.4, radius * 0.12);
  ctx.globalAlpha = 0.96;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 1.02, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#6fd6bd';
  ctx.beginPath();
  ctx.moveTo(center.x, center.y - radius * 0.62);
  ctx.lineTo(center.x + radius * 0.58, center.y + radius * 0.36);
  ctx.lineTo(center.x, center.y + radius * 0.12);
  ctx.lineTo(center.x - radius * 0.58, center.y + radius * 0.36);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGameHover(ctx) {
  if (!state.hoverTile) return;
  const center = tileCenterScreen(state.hoverTile);
  const radius = clamp(state.tileSize * 0.42, 3, 21);
  ctx.save();
  ctx.strokeStyle = GAME_BOARD_COLORS.pathGlow;
  ctx.fillStyle = GAME_BOARD_COLORS.pathGlow;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1.2, state.tileSize * 0.07);
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGameSelection(ctx) {
  const item = getSelectedItem();
  if (!item) return;

  const center = tileCenterScreen(item);
  const radius = clamp(state.tileSize * 0.58, 4, 25);
  ctx.save();
  ctx.strokeStyle = GAME_BOARD_COLORS.selection;
  ctx.lineWidth = Math.max(1.6, Math.min(4, state.tileSize * 0.18));
  ctx.globalAlpha = 0.96;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 1.18, 0, Math.PI * 2);
  ctx.fillStyle = GAME_BOARD_COLORS.selection;
  ctx.fill();
  ctx.restore();
}

function getEncounterImage(encounter) {
  const src = getEncounterMapImageSrc(encounter);
  if (!src) return null;

  const cached = state.imageCache.get(src);
  if (cached?.status === 'loaded') return cached.image;
  if (cached) return null;

  const image = new Image();
  const entry = { status: 'loading', image };
  state.imageCache.set(src, entry);
  image.onload = () => {
    entry.status = 'loaded';
    render();
  };
  image.onerror = () => {
    entry.status = 'error';
  };
  image.src = src;
  return null;
}

function getEncounterMapImageSrc(encounter) {
  const rawUrl = encounter?.keyDemon?.imageUrl || encounter?.team?.[0]?.imageUrl || '';
  const match = String(rawUrl).match(/\/demons\/(?:map\/)?(\d+)\.(?:png|webp|jpe?g)$/i);
  if (match) return `${DEMON_MAP_ASSET_BASE}${match[1]}.webp`;
  if (String(rawUrl).startsWith('/app/')) return `../../public${rawUrl}`;
  return rawUrl || '';
}

function getMapTileSets() {
  return {
    roads: new Set(normalizeArray(state.map?.roads).map(getTileKey)),
    blocks: new Set(normalizeArray(state.map?.blocks).map(getTileKey))
  };
}

function getVisibleTileRange(padding = 0) {
  const bounds = getBounds();
  const pad = Math.max(0, Math.floor(padding));
  const minX = Math.floor((0 - state.offsetX) / state.tileSize) + bounds.min - pad;
  const maxX = Math.ceil((state.canvasWidth - state.offsetX) / state.tileSize) + bounds.min + pad;
  const minY = Math.floor((0 - state.offsetY) / state.tileSize) + bounds.min - pad;
  const maxY = Math.ceil((state.canvasHeight - state.offsetY) / state.tileSize) + bounds.min + pad;

  return {
    minX: clamp(minX, bounds.min, bounds.max),
    maxX: clamp(maxX, bounds.min, bounds.max),
    minY: clamp(minY, bounds.min, bounds.max),
    maxY: clamp(maxY, bounds.min, bounds.max)
  };
}

function forVisibleTiles(callback, padding = 0) {
  const range = getVisibleTileRange(padding);
  for (let y = range.minY; y <= range.maxY; y += 1) {
    for (let x = range.minX; x <= range.maxX; x += 1) {
      callback(x, y);
    }
  }
}

function tileCenterScreen(tile) {
  const rect = tileRect(tile);
  return {
    x: rect.x + state.tileSize / 2,
    y: rect.y + state.tileSize / 2
  };
}

function getGameMarkerRadius(multiplier = 1) {
  return clamp(state.tileSize * 0.72 * multiplier, 3.8 * multiplier, 22 * multiplier);
}

function getGameMarkerScale() {
  return clamp(state.tileSize / 42, 0.24, 0.82);
}

function drawCircle(ctx, x, y, radius, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEllipse(ctx, x, y, radiusX, radiusY, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, radiusX), Math.max(0, radiusY), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLocalCircle(ctx, x, y, radius, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLocalEllipse(ctx, x, y, radiusX, radiusY, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLocalPolygon(ctx, points, fill, stroke = null, strokeWidth = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) {
    ctx.lineTo(points[index], points[index + 1]);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function traceScreenBlob(ctx, cx, cy, radius, seedX, seedY) {
  const lobes = 14;
  const points = [];
  for (let index = 0; index < lobes; index += 1) {
    const angle = (index / lobes) * Math.PI * 2;
    const n1 = Math.sin(angle * 2 + hashTile(seedX, seedY, 91) * Math.PI * 2) * 0.1;
    const n2 = Math.sin(angle * 5 + hashTile(seedX, seedY, 92) * Math.PI * 2) * 0.08;
    const r = radius * (1 + n1 + n2);
    points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r * 0.88 });
  }

  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = midpoint(points[points.length - 1], points[0]);
  ctx.moveTo(start.x, start.y);
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const mid = midpoint(point, next);
    ctx.quadraticCurveTo(point.x, point.y, mid.x, mid.y);
  });
  ctx.closePath();
}

function drawLeaf(ctx, ox, oy, angle, length, width, color, alpha) {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const tipX = ox + ca * length;
  const tipY = oy + sa * length;
  const midX = ox + ca * length * 0.5;
  const midY = oy + sa * length * 0.5;
  const px = -sa * width;
  const py = ca * width;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.quadraticCurveTo(midX + px, midY + py, tipX, tipY);
  ctx.quadraticCurveTo(midX - px, midY - py, ox, oy);
  ctx.fill();
  ctx.restore();
}

function getCanvasPoint(event) {
  const rect = dom.mapCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function screenToTile(point) {
  if (!state.map) return null;
  const bounds = getBounds();
  const gridX = Math.floor((point.x - state.offsetX) / state.tileSize);
  const gridY = Math.floor((point.y - state.offsetY) / state.tileSize);
  const tile = {
    x: bounds.min + gridX,
    y: bounds.min + gridY
  };

  return isInBounds(tile) ? tile : null;
}

function tileRect(tile) {
  const bounds = getBounds();
  return {
    x: state.offsetX + (tile.x - bounds.min) * state.tileSize,
    y: state.offsetY + (tile.y - bounds.min) * state.tileSize
  };
}

function isTileVisible(tile) {
  const rect = tileRect(tile);
  return rect.x + state.tileSize >= 0
    && rect.y + state.tileSize >= 0
    && rect.x <= state.canvasWidth
    && rect.y <= state.canvasHeight;
}

function findRoadIndexAt(tile, exceptIndex = -1) {
  return state.map.roads.findIndex((road, index) => index !== exceptIndex && positionsEqual(road, tile));
}

function findBlockIndexAt(tile, exceptIndex = -1) {
  return state.map.blocks.findIndex((block, index) => index !== exceptIndex && positionsEqual(block, tile));
}

function findEventIndexAt(tile, exceptIndex = -1) {
  return state.map.events.findIndex((event, index) => index !== exceptIndex && positionsEqual(event, tile));
}

function findEncounterIndexAt(tile, exceptIndex = -1) {
  return state.map.encounters.findIndex((encounter, index) => index !== exceptIndex && positionsEqual(encounter, tile));
}

function removeRoadAt(tile) {
  const index = findRoadIndexAt(tile);
  if (index < 0) return false;
  state.map.roads.splice(index, 1);
  return true;
}

function removeBlockAt(tile) {
  const index = findBlockIndexAt(tile);
  if (index < 0) return false;
  state.map.blocks.splice(index, 1);
  return true;
}

function removeEventAt(tile) {
  const index = findEventIndexAt(tile);
  if (index < 0) return false;
  state.map.events.splice(index, 1);
  return true;
}

function normalizeLoadedMap(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    throw new Error('Map JSON must be an object.');
  }

  const bounds = normalizeBounds(map.bounds || DEFAULT_BOUNDS);
  const blockSource = Array.isArray(map.blocks) ? map.blocks : map.blockedTiles;
  const { blockedTiles, ...mapBase } = map;
  const normalized = {
    ...mapBase,
    bounds,
    spawn: normalizePoint(map.spawn || { x: 0, y: 0 }, bounds),
    roads: normalizeArray(map.roads).map((tile) => normalizePoint(tile, bounds)),
    events: normalizeArray(map.events).map((event) => ({
      ...event,
      ...normalizePoint(event, bounds),
      type: String(event?.type || DEFAULT_SHRINE.type)
    })),
    blocks: normalizeArray(blockSource).map((block) => ({
      ...block,
      ...normalizePoint(block, bounds),
      type: String(block?.type || 'basalt')
    })),
    encounters: normalizeArray(map.encounters).map((encounter) => ({
      ...encounter,
      ...normalizePoint(encounter, bounds)
    }))
  };

  return normalized;
}

function normalizeBounds(bounds) {
  const min = Number(bounds?.min);
  const max = Number(bounds?.max);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error('Map bounds must include integer min and max values.');
  }
  return { min, max };
}

function normalizePoint(value, bounds) {
  const point = {
    x: Number(value?.x),
    y: Number(value?.y)
  };

  if (!Number.isInteger(point.x) || !Number.isInteger(point.y)) {
    throw new Error('Map coordinates must be integers.');
  }

  if (point.x < bounds.min || point.x > bounds.max || point.y < bounds.min || point.y > bounds.max) {
    throw new Error(`Map coordinates must be inside ${bounds.min}..${bounds.max}.`);
  }

  return point;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getBounds() {
  return state.map?.bounds || DEFAULT_BOUNDS;
}

function getWorldTileCount() {
  const bounds = getBounds();
  return bounds.max - bounds.min + 1;
}

function isInBounds(tile) {
  if (!tile) return false;
  const bounds = getBounds();
  return tile.x >= bounds.min && tile.x <= bounds.max && tile.y >= bounds.min && tile.y <= bounds.max;
}

function isIntegerTile(tile) {
  return Number.isInteger(tile?.x) && Number.isInteger(tile?.y);
}

function positionsEqual(a, b) {
  if (!a || !b) return false;
  return Number(a.x) === Number(b.x) && Number(a.y) === Number(b.y);
}

function getTileKey(tile) {
  return `${Number(tile?.x) || 0},${Number(tile?.y) || 0}`;
}

function hashTile(x, y, salt) {
  let hash = Math.imul((x | 0) + 0x9e37, 374761393) ^
    Math.imul((y | 0) + 0x85eb, 668265263) ^
    Math.imul((salt | 0) + 1, 2246822519);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

function createGameZonePalette(typeId) {
  const accent = zoneAccentForType(typeId);
  return {
    ground: GAME_DEFAULT_ZONE_PALETTE.ground.map((color) => mixHex(color, accent, 0.08)),
    patch: mixHex(GAME_DEFAULT_ZONE_PALETTE.patch, accent, 0.14),
    moss: mixHex(GAME_DEFAULT_ZONE_PALETTE.moss, accent, 0.1),
    crack: mixHex(GAME_DEFAULT_ZONE_PALETTE.crack, accent, 0.04),
    road: GAME_DEFAULT_ZONE_PALETTE.road.map((color, index) => mixHex(color, accent, index === 0 ? 0.06 : 0.08)),
    roadEdge: mixHex(GAME_DEFAULT_ZONE_PALETTE.roadEdge, accent, 0.03),
    roadSheen: mixHex(GAME_DEFAULT_ZONE_PALETTE.roadSheen, accent, 0.13),
    stone: GAME_DEFAULT_ZONE_PALETTE.stone.map((color, index) => mixHex(color, accent, index === 1 ? 0.1 : 0.08)),
    stoneDark: mixHex(GAME_DEFAULT_ZONE_PALETTE.stoneDark, accent, 0.04),
    stoneLight: mixHex(GAME_DEFAULT_ZONE_PALETTE.stoneLight, accent, 0.14),
    prop: mixHex(GAME_DEFAULT_ZONE_PALETTE.prop, accent, 0.28),
    fog: mixHex(GAME_DEFAULT_ZONE_PALETTE.fog, accent, 0.03),
    accent
  };
}

function zoneAccentForType(typeId) {
  return GAME_ZONE_COLOR_VARIANTS[typeId] || GAME_THEME_COLORS[typeId] || GAME_THEME_COLORS.default;
}

function neutralZoneRadius(theta) {
  return ZONE_START_RADIUS +
    Math.sin(theta * 3 + 1.7) * 3.4 +
    Math.sin(theta * 5 + 0.6) * 2.1 +
    Math.sin(theta * 9 + 4.1) * 1.2;
}

function zoneBoundaryJitter(radius, theta) {
  return (
    Math.sin(radius * 0.31 + theta * 2) * 0.5 +
    Math.sin(radius * 0.17 - theta * 3 + 2.3) * 0.35 +
    Math.sin(radius * 0.53 + theta * 5 + 4.6) * 0.15
  ) * 0.02;
}

function zoneTypeIdForTile(x, y) {
  const radius = Math.hypot(x, y);
  const angle = Math.atan2(y, x);
  if (radius < neutralZoneRadius(angle)) return 0;
  const normalized = (angle + Math.PI) / (2 * Math.PI);
  const jittered = normalized + ZONE_ROTATION + zoneBoundaryJitter(radius, angle);
  const sector = Math.floor((((jittered % 1) + 1) % 1) * TYPE_COUNT) % TYPE_COUNT;
  return remapZoneTypeId(sector + 1);
}

function remapZoneTypeId(typeId) {
  return ZONE_TYPE_REMAP[typeId] || typeId;
}

function zonePaletteForTile(x, y) {
  return GAME_ZONE_PALETTES[zoneTypeIdForTile(x, y)] || GAME_DEFAULT_ZONE_PALETTE;
}

function rarityColor(rarity) {
  return RARITY_COLORS[String(rarity || '').toLowerCase()] || RARITY_COLORS.common;
}

function mixHex(from, to, amount) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const ratio = clamp(amount, 0, 1);
  return rgbToHex(a.map((channel, index) => Math.round(channel + (b[index] - channel) * ratio)));
}

function hexToRgb(value) {
  const normalized = String(value || '').replace(/^#/, '').trim();
  const parsed = Number.parseInt(normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized, 16);
  if (!Number.isFinite(parsed)) return [255, 255, 255];
  return [
    (parsed >> 16) & 255,
    (parsed >> 8) & 255,
    parsed & 255
  ];
}

function rgbToHex(rgb) {
  return `#${rgb.map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function ensureSelectValue(select, value) {
  if (!select || !value) return;
  if (Array.from(select.options).some((option) => option.value === value)) return;
  const option = document.createElement('option');
  option.value = value;
  option.textContent = value;
  select.appendChild(option);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function mapToText(map) {
  return `${JSON.stringify(map, null, 2)}\n`;
}

function cloneMap(map) {
  return typeof structuredClone === 'function'
    ? structuredClone(map)
    : JSON.parse(JSON.stringify(map));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function getMapCounts(map) {
  return {
    roads: normalizeArray(map?.roads).length,
    blocks: normalizeArray(map?.blocks).length,
    events: normalizeArray(map?.events).length,
    encounters: normalizeArray(map?.encounters).length
  };
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}
