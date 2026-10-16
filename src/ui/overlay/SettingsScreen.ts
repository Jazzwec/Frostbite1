// ⚙ sheet: export the save as a code, import one back, or start a new winter. No browser dialogs.
import { currentExportCode, importSave, newWinter } from '../../game/runtime';
import { h } from './dom';
import type { Screen } from './Shell';

export function settingsScreen(close: () => void): Screen {
  // Export
  const exportBox = h('textarea', { readonly: true, 'aria-label': 'Save code' });
  const exportNote = h('div', { class: 'note' });
  const showCode = (): void => {
    exportBox.value = currentExportCode();
    exportNote.textContent = '';
  };
  const copy = async (): Promise<void> => {
    showCode();
    try {
      await navigator.clipboard.writeText(exportBox.value);
      exportNote.textContent = 'Copied. Keep it somewhere safe, like a note to yourself.';
      exportNote.className = 'note good';
    } catch {
      exportBox.focus();
      exportBox.select();
      exportNote.textContent = 'Selected: copy it from the box.';
      exportNote.className = 'note';
    }
  };

  // Import
  const importBox = h('textarea', { placeholder: 'Paste a save code here', 'aria-label': 'Code to load' });
  const importNote = h('div', { class: 'note' });
  const load = (): void => {
    if (importSave(importBox.value)) close();
    else {
      importNote.textContent = "That code didn't work. Check it was copied in full.";
      importNote.className = 'note bad';
    }
  };

  // New winter, with an inline confirmation.
  const confirmRow = h('div', { class: 'row-buttons' });
  const askNewWinter = (): void => {
    confirmRow.replaceChildren(
      h('p', {}, 'Start over? This wipes the city.'),
      h('button', { class: 'btn primary', onclick: () => (newWinter(), close()) }, 'Yes, start over'),
      h('button', { class: 'btn', onclick: resetConfirm }, 'No'),
    );
  };
  const resetConfirm = (): void => {
    confirmRow.replaceChildren(h('button', { class: 'btn', onclick: askNewWinter }, 'New winter…'));
  };
  resetConfirm();

  const el = h(
    'section',
    {},
    h('h1', {}, 'Settings'),
    h('h2', {}, 'Back up your city'),
    h('p', {}, 'Safari can clear saved games. Copy this code somewhere safe to bring the city back later.'),
    exportBox,
    h('div', { class: 'row-buttons' }, h('button', { class: 'btn primary', onclick: copy }, 'Copy code')),
    exportNote,
    h('h2', {}, 'Load a city'),
    importBox,
    h('div', { class: 'row-buttons' }, h('button', { class: 'btn', onclick: load }, 'Load')),
    importNote,
    h('h2', {}, 'Start again'),
    confirmRow,
  );
  showCode();
  return { el, refresh: () => {} };
}

/** Placeholder for tabs whose screens come in later steps. */
export function comingSoon(title: string): () => Screen {
  return () => ({
    el: h('section', {}, h('h1', {}, title), h('p', {}, 'Coming in the next step.')),
    refresh: () => {},
  });
}
