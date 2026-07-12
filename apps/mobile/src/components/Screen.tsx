import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from './BackButton';
import { colors, spacing, typography } from '../theme';
export function Screen({children,scroll=true,title,right,back=false,overlay}:{children:ReactNode;scroll?:boolean;title?:string;right?:ReactNode;back?:boolean;overlay?:ReactNode}) { const content=<>{title?<View style={s.header}><View style={s.titleRow}>{back?<BackButton floating={false}/>:null}<Text accessibilityRole="header" style={s.title}>{title}</Text></View>{right}</View>:null}{children}</>; return <SafeAreaView edges={['top']} style={s.safe}>{scroll?<ScrollView style={s.fill} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{content}</ScrollView>:<View style={[s.fill,s.content]}>{content}</View>}{overlay}</SafeAreaView> }
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},fill:{flex:1},content:{flexGrow:1,paddingBottom:spacing.xl},header:{paddingHorizontal:spacing.md,paddingTop:spacing.md,paddingBottom:spacing.sm,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},titleRow:{flexDirection:'row',alignItems:'center',gap:12,flex:1},title:{...typography.title,color:colors.text,flexShrink:1}});
