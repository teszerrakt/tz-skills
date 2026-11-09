import { expect, test } from 'bun:test'
import { exportedComponents } from './components.ts'

test('only exported names that start with a capital letter count, types left out', () => {
  const source = `export function Combobox() {}
export const ComboboxItem = () => null
export const comboboxVariants = cva('')
export function useCombobox() {}
function Inner() {}
export { Inner as ComboboxInner, type ComboboxProps, helper }`
  expect(exportedComponents(source)).toEqual(['Combobox', 'ComboboxItem', 'ComboboxInner'])
})
