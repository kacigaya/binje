import { DropdownMenuItem, ExposedDropdownMenu, ExposedDropdownMenuBox, Text, TextField, useNativeState } from '@expo/ui/jetpack-compose';
import { menuAnchor, fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useState } from 'react';
import type { NativePickerProps } from './NativePicker.types';
export function NativePicker<T extends string | number>({ label, value, options, onChange, disabled = false }: NativePickerProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const selectedLabel = options.find(option => option.value === value)?.label ?? '';
  const text = useNativeState(selectedLabel);
  useEffect(() => { text.set(selectedLabel); }, [text, selectedLabel]);
  return <ExposedDropdownMenuBox expanded={expanded && !disabled} onExpandedChange={disabled ? undefined : setExpanded}>
    <TextField value={text} readOnly enabled={!disabled} modifiers={[menuAnchor(), fillMaxWidth()]}>
      <TextField.Label><Text>{label}</Text></TextField.Label>
    </TextField>
    <ExposedDropdownMenu expanded={expanded && !disabled} onDismissRequest={() => setExpanded(false)}>
      {options.map(option => <DropdownMenuItem key={option.value} enabled={!disabled} onClick={() => { setExpanded(false); onChange(option.value); }}>
        <DropdownMenuItem.Text><Text>{option.label}</Text></DropdownMenuItem.Text>
      </DropdownMenuItem>)}
    </ExposedDropdownMenu>
  </ExposedDropdownMenuBox>;
}
