import { Image } from 'expo-image'; import mark from '../../assets/images/mark.svg'; import { StyleSheet,Text,View } from 'react-native'; import { colors,fonts } from '../theme';
// Space Grotesk metrics (per em): cap height 0.70, descender 0.292, "b" right
// side bearing 0.044, "n" left ~0.071 visible. The glyph replaces the "!", sized to cap
// height, lifted onto the baseline, with ink gaps of 0.11em after the "b" and
// ~0.085em before the "n" (the triangle tip reads more open). Same drawing and spacing as the web Wordmark.
const MARK_RATIO=100/348;
export function Logo({size=22}:{size?:number}){const h=size*0.7;return <View style={s.row} accessible accessibilityRole="text" accessibilityLabel="b!nje"><Text style={[s.text,{fontSize:size,letterSpacing:0}]}>b</Text><Image source={mark} alt="" style={{width:h*MARK_RATIO,height:h,marginBottom:size*0.292,marginLeft:size*0.066,marginRight:size*0.015}}/><Text style={[s.text,{fontSize:size}]}>nje</Text></View>}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'flex-end'},text:{color:colors.text,fontFamily:fonts.heading,letterSpacing:-0.5,includeFontPadding:false}});
