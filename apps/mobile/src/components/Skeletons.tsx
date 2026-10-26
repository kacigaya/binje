import { StyleSheet,View } from 'react-native'; import { colors,radius,spacing } from '../theme';
const CARD_WIDTH=132;
function PosterBox({width=CARD_WIDTH}:{width?:number}){return <View style={{gap:spacing.sm}}><View style={[s.box,{width,height:width*1.5,borderRadius:radius.md}]}/><View style={[s.box,{width:width*0.8,height:12,borderRadius:4}]}/></View>}
export function RowSkeleton(){return <View style={s.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><View style={[s.box,{width:160,height:20,borderRadius:4,marginBottom:spacing.md}]}/><View style={{flexDirection:'row',gap:12}}>{[0,1,2].map(i=><PosterBox key={i}/>)}</View></View>}
export function GridSkeleton({count=6}:{count?:number}){return <View style={s.grid} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{Array.from({length:count},(_,i)=><View key={i} style={s.cell}><PosterBox width={150}/></View>)}</View>}
export function HeroSkeleton(){return <View style={[s.box,{height:480,borderRadius:0}]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/>}
const s=StyleSheet.create({box:{backgroundColor:colors.surfaceAlt},row:{paddingHorizontal:spacing.md,marginTop:spacing.lg},grid:{flexDirection:'row',flexWrap:'wrap',padding:8},cell:{width:'50%',alignItems:'center',marginBottom:20}});
