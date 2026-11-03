import { useState, type Ref } from 'react';
import { Platform, Pressable, type PressableProps, type View, type StyleProp, type ViewStyle } from 'react-native';
import { tvFocusStyle } from '../theme';

type Props = PressableProps & { ref?: Ref<View>; focusStyle?: StyleProp<ViewStyle> };

/** Preserve native phone props while sharing the remote focus ring. */
export function TVPressable(props: Props) {
  const { focusStyle, ...nativeProps } = props;
  return Platform.isTV ? <FocusablePressable {...nativeProps} focusStyle={focusStyle} /> : <Pressable {...nativeProps} />;
}

function FocusablePressable({ style, onFocus, onBlur, focusStyle = tvFocusStyle, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  return <Pressable {...props}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={state => [typeof style === 'function' ? style(state) : style, focused && focusStyle]}
  />;
}
