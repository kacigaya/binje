import { useState, type Ref } from 'react';
import { Platform, Pressable, type PressableProps, type View } from 'react-native';
import { tvFocusStyle } from '../theme';

type Props = PressableProps & { ref?: Ref<View> };

/** Preserve native phone props while sharing the remote focus ring. */
export function TVPressable(props: Props) {
  return Platform.isTV ? <FocusablePressable {...props} /> : <Pressable {...props} />;
}

function FocusablePressable({ style, onFocus, onBlur, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  return <Pressable {...props}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={state => [typeof style === 'function' ? style(state) : style, focused && tvFocusStyle]}
  />;
}
