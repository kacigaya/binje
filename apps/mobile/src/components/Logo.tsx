import Feather from '@expo/vector-icons/Feather'; import { StyleSheet,Text,View } from 'react-native'; import { colors,fonts } from '../theme';
export function Logo({size=22}:{size?:number}){return <View style={s.row}><Feather name="film" size={size+2} color={colors.accent}/><Text style={[s.text,{fontSize:size}]}>b<Text style={s.bang}>!</Text>nje</Text></View>}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:8},text:{color:colors.text,fontFamily:fonts.heading,letterSpacing:-0.5},bang:{color:colors.accent}});
