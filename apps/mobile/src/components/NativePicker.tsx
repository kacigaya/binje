import { Column, Picker, Text } from '@expo/ui';
import type { NativePickerProps } from './NativePicker.types';
export function NativePicker<T extends string | number>({ label, value, options, onChange, disabled = false }: NativePickerProps<T>) {
  return <Column><Text>{label}</Text><Picker selectedValue={value} onValueChange={onChange} enabled={!disabled}>
    {options.map(option => <Picker.Item key={option.value} value={option.value} label={option.label} />)}
  </Picker></Column>;
}
