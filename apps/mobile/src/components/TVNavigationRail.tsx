import Feather from '@expo/vector-icons/Feather';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, TVFocusGuideView, View } from 'react-native';
import { Image } from 'expo-image';
import mark from '../../assets/images/mark.svg';
import { Logo } from './Logo';
import { TVPressable } from './TVPressable';
import { colors, fonts, layout } from '../theme';

// The mark SVG viewBox is 100x348; a box with another ratio crops it.
const MARK_RATIO=100/348;
const icons = {index:'home',browse:'grid',search:'search',library:'bookmark',settings:'settings'} as const;
export function focusRailOnBack(navigatorFocused:boolean,railFocused:boolean,focus:()=>void){if(!navigatorFocused||railFocused)return false;focus();return true;}
export function TVNavigationRail({state,descriptors,navigation}:BottomTabBarProps){
 const [expanded,setExpanded]=useState(false);const railFocused=useRef(false);const items=useRef<Record<string,View|null>>({});
 useEffect(()=>{const subscription=BackHandler.addEventListener('hardwareBackPress',()=>focusRailOnBack(navigation.isFocused(),railFocused.current,()=>items.current[state.routes[state.index].key]?.requestTVFocus()));return()=>subscription.remove()},[navigation,state.index,state.routes]);
 return <View pointerEvents="box-none" style={s.overlay}>{expanded?<View testID="rail-scrim" pointerEvents="none" style={s.scrim}/>:null}<TVFocusGuideView testID="tv-rail" autoFocus onFocusEnter={()=>{railFocused.current=true;setExpanded(true)}} onFocusLeave={()=>{railFocused.current=false;setExpanded(false)}} style={[s.rail,{width:expanded?layout.tvRailExpandedWidth:layout.tvRailWidth},expanded&&s.expanded]}><View style={s.brand}>{expanded?<Logo size={30}/>:<Image source={mark} alt="b!nje" contentFit="contain" style={s.mark}/>}</View>{state.routes.map((route,index)=>{const name=route.name as keyof typeof icons;const active=index===state.index;const label=descriptors[route.key].options.title??route.name;return <TVPressable key={route.key} ref={node=>{items.current[route.key]=node}} testID={`rail-${route.name}`} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{selected:active,expanded}} focusStyle={s.focus} onPress={()=>{const event=navigation.emit({type:'tabPress',target:route.key,canPreventDefault:true});if(!active&&!event.defaultPrevented)navigation.navigate(route.name,route.params)}} style={[s.item,expanded?s.wide:s.collapsed,name==='settings'&&s.settings]}>{({focused})=><>{active&&!focused?<View style={s.active}/>:null}<Feather name={icons[name]??'circle'} size={22} color={focused?colors.background:active?colors.text:colors.muted}/>{expanded?<Text style={[s.label,{color:focused?colors.background:active?colors.text:colors.muted}]}>{label}</Text>:null}</>}</TVPressable>})}</TVFocusGuideView></View>
}
const s=StyleSheet.create({overlay:{...StyleSheet.absoluteFill,zIndex:50},scrim:{...StyleSheet.absoluteFill,backgroundColor:'rgba(5,5,6,0.72)'},rail:{position:'absolute',top:0,bottom:0,left:0,paddingTop:28,paddingBottom:24,gap:6,alignItems:'center'},expanded:{backgroundColor:colors.surface},mark:{height:34,width:34*MARK_RATIO},brand:{height:50,marginBottom:6,justifyContent:'flex-start',alignItems:'center'},item:{height:44,borderRadius:12,flexDirection:'row',alignItems:'center',gap:14},collapsed:{width:44,justifyContent:'center'},wide:{width:204,paddingHorizontal:14},settings:{marginTop:'auto'},label:{fontSize:17,fontFamily:fonts.bodyMedium},active:{position:'absolute',left:-14,top:12,width:4,height:20,borderRadius:4,backgroundColor:colors.accent},focus:{backgroundColor:colors.text,transform:[{scale:1.04}]}});
