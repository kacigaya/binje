import { Image } from 'expo-image'; import mark from '../../assets/images/mark.svg'; import { StyleSheet,Text,View } from 'react-native'; import { colors,fonts } from '../theme';
// Match the web Wordmark: 0.70em cap height, 0.292em descender, ink gaps 0.11em after b and ~0.085em before n.
// Side bearings are 0.044em for b and ~0.071em for n; the triangle needs a tighter right gap.
const MARK_RATIO=100/348;
export function Logo({size=22}:{size?:number}){const h=size*0.7;return <View style={s.row} accessible accessibilityRole="text" accessibilityLabel="b!nje"><Text style={[s.text,{fontSize:size,letterSpacing:0}]}>b</Text><Image source={mark} alt="" style={{width:h*MARK_RATIO,height:h,marginBottom:size*0.292,marginLeft:size*0.066,marginRight:size*0.015}}/><Text style={[s.text,{fontSize:size}]}>nje</Text></View>}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'flex-end'},text:{color:colors.text,fontFamily:fonts.heading,letterSpacing:-0.5,includeFontPadding:false}});
