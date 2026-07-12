import type { ReactNode } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
export function Screen({children,scroll=true,title,right}:{children:ReactNode;scroll?:boolean;title?:string;right?:ReactNode}) { const content=<>{title?<View style={s.header}><Text accessibilityRole="header" style={s.title}>{title}</Text>{right}</View>:null}{children}</>; return <SafeAreaView style={s.safe}>{scroll?<ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{content}</ScrollView>:<View style={s.content}>{content}</View>}</SafeAreaView> }
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},content:{flexGrow:1,paddingBottom:spacing.xl},header:{paddingHorizontal:spacing.md,paddingTop:spacing.md,paddingBottom:spacing.sm,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{...typography.title,color:colors.text}});
