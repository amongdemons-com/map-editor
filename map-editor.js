const MAP_DRAFT_KEY = 'amongdemons.mapEditor.mapDraft.v1';
const MAP_DRAFT_META_KEY = 'amongdemons.mapEditor.mapDraftMeta.v1';
const MIN_TILE_SIZE = 4;
const MAX_TILE_SIZE = 38;
const DEFAULT_BOUNDS = { min: -50, max: 50 };
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
  showGrid: true,
  showEncounters: true,
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

    removeBlockAt(tile);
    item.x = tile.x;
    item.y = tile.y;
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
  }
}

function syncEventTypeFields() {
  const isPortal = dom.eventTypeSelect?.value === 'darkness-portal';
  dom.portalCostField?.classList.toggle('d-none', !isPortal);
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
  ctx.fillStyle = COLORS.mapFill;
  ctx.fillRect(mapX, mapY, mapSize, mapSize);
  ctx.beginPath();
  ctx.rect(mapX, mapY, mapSize, mapSize);
  ctx.clip();

  if (state.showGrid) drawGrid(ctx, bounds, count);
  drawAxis(ctx, bounds);
  drawRoads(ctx);
  drawBlocks(ctx);
  drawEvents(ctx);
  if (state.showEncounters) drawEncounters(ctx);
  drawSpawn(ctx);
  drawHover(ctx);
  drawSelection(ctx);

  ctx.restore();
  ctx.strokeStyle = COLORS.mapBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);
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
  const normalized = {
    ...map,
    bounds,
    spawn: normalizePoint(map.spawn || { x: 0, y: 0 }, bounds),
    roads: normalizeArray(map.roads).map((tile) => normalizePoint(tile, bounds)),
    events: normalizeArray(map.events).map((event) => ({
      ...event,
      ...normalizePoint(event, bounds),
      type: String(event?.type || DEFAULT_SHRINE.type)
    })),
    blocks: normalizeArray(map.blocks).map((block) => ({
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

function ensureSelectValue(select, value) {
  if (!select || !value) return;
  if (Array.from(select.options).some((option) => option.value === value)) return;
  const option = document.createElement('option');
  option.value = value;
  option.textContent = value;
  select.appendChild(option);
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
