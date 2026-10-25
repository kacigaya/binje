import { Picker, Text } from '@expo/ui/swift-ui';
import { disabled as disabledModifier, frame, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import type { NativePickerProps } from './NativePicker.types';
export function NativePicker<T extends string | number>({ label, value, options, onChange, disabled = false }: NativePickerProps<T>) {
  return <Picker label={label} selection={value} onSelectionChange={onChange}
    modifiers={[pickerStyle('menu'), disabledModifier(disabled), frame({ minHeight: 48, maxWidth: Infinity })]}>
    {options.map(option => <Text key={option.value} modifiers={[tag(option.value)]}>{option.label}</Text>)}
  </Picker>;
}
