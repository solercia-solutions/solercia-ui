/**
 * Selection policy for `sol-chip-group` (11-f PR2).
 *
 * The policy is a Strategy behind an interface so the group component and
 * its template NEVER branch on `multiple()` directly (Open/Closed): adding a
 * new selection policy later means adding a new `SolChipSelectionStrategy`
 * object, not touching `chip-group.component.ts`'s template or handlers.
 */
export interface SolChipSelectionStrategy {
  /** ARIA role assigned to every `sol-chip` under this policy. */
  readonly chipRole: 'radio' | 'checkbox';

  /**
   * ARIA role assigned to the group container.
   * - `radiogroup` for single-select: chips behave like a set of mutually
   *   exclusive radio buttons — the W3C ARIA APG "Radio Group" pattern.
   * - `group` for multi-select: chips behave like an independent set of
   *   checkboxes. The APG "Checkbox" pattern recommends a labeled `group`
   *   container (or a native `fieldset`), NOT `listbox`/`aria-multiselectable`
   *   — a listbox's roving-tabindex convention auto-selects the option on
   *   arrow navigation, which this component intentionally does NOT do (see
   *   the keyboard handling note in `chip-group.component.ts`): arrows only
   *   move focus, Enter/Space/click perform the actual (de)selection.
   */
  readonly groupRole: 'radiogroup' | 'group';

  isSelected(current: readonly string[], value: string): boolean;

  /** Returns the NEXT selection state after `value` is activated (click/Enter/Space). */
  select(current: readonly string[], value: string, allowDeselect: boolean): string[];
}

export const SINGLE_SELECT_STRATEGY: SolChipSelectionStrategy = {
  chipRole: 'radio',
  groupRole: 'radiogroup',
  isSelected: (current, value) => current[0] === value,
  select: (current, value, allowDeselect) => {
    if (current[0] === value) {
      return allowDeselect ? [] : current.slice();
    }
    return [value];
  },
};

export const MULTIPLE_SELECT_STRATEGY: SolChipSelectionStrategy = {
  chipRole: 'checkbox',
  groupRole: 'group',
  isSelected: (current, value) => current.includes(value),
  // Checkboxes are always independently toggleable — `allowDeselect` is a
  // single-select-only concept (whether the last chip can be cleared).
  select: (current, value, _allowDeselect) =>
    current.includes(value) ? current.filter(v => v !== value) : [...current, value],
};
