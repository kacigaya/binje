import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TVFocusGuideView, useTVEventHandler, View } from 'react-native';
import { getHome, getMediaDetails } from '../../api/media';
import { Button } from '../../components/Button';
import { TVBackdrop, TVMeta, TVOverview, TVPoster, TVProgress, TVRow, TVTitle } from '../../components/TVMedia';
import { TVPressable } from '../../components/TVPressable';
import { HeroSkeleton, RowSkeleton } from '../../components/Skeletons';
import { ErrorState } from '../../components/States';
import { usePlayHistory } from '../../hooks/usePlayHistory';
import { useIsInWatchlist, useWatchlistToggle } from '../../hooks/useWatchlistToggle';
import { useLocale } from '../../providers/LocaleProvider';
import { formatPlaybackTimings, type PlayHistoryItem } from '../../storage/playHistory';
import { colors, fonts, tvCardFocusStyle } from '../../theme';
import type { MobileFeaturedItem, MobileMediaSummary } from '../../types/api';

export function nextFeaturedOnRight(eventType:string,eventKeyAction:number|undefined,lastButtonFocused:boolean,index:number,count:number){return eventType==='right'&&eventKeyAction!==0&&lastButtonFocused&&count>0?(index+1)%count:index;}
function HeroWatchlist({item,onFocus,onBlur}:{item:MobileFeaturedItem;onFocus:()=>void;onBlur:()=>void}){const {t}=useLocale();const saved=useIsInWatchlist({type:item.mediaType,id:item.id});const {setSaved,pending}=useWatchlistToggle();return <TVPressable accessibilityRole="button" accessibilityLabel={saved?t('removeFromWatchlist'):t('addToWatchlist')} accessibilityState={{selected:saved,busy:pending}} disabled={pending} onFocus={onFocus} onBlur={onBlur} onPress={()=>void setSaved({type:item.mediaType,id:item.id,title:item.title,poster_path:item.posterUrl,backdrop_path:item.backdropUrl,date:item.date,vote_average:item.rating},!saved)} style={s.watchlist}><Feather name={saved?'check':'plus'} size={20} color={colors.text}/></TVPressable>}
function historySummary(item:PlayHistoryItem):MobileMediaSummary{return {id:item.id,mediaType:item.type,title:item.title,overview:'',posterUrl:item.poster_path,backdropUrl:item.backdrop_path,date:item.date,rating:item.vote_average}}
const ROWS=['history','trendingMovies','trendingTV'] as const;type RowKey=typeof ROWS[number];
export default function TVHomeScreen(){
 const {locale,t}=useLocale();const q=useQuery({queryKey:['home',locale],queryFn:({signal})=>getHome(locale,signal)});const history=usePlayHistory();const [index,setIndex]=useState(0);const [preview,setPreview]=useState<MobileMediaSummary|null>(null);const [browsing,setBrowsing]=useState(false);const [activeRow,setActiveRow]=useState<RowKey|null>(null);const lastButton=useRef(false);const arrived=useRef(false);const previewTimer=useRef<ReturnType<typeof setTimeout>|null>(null);const rows=useRef<ScrollView>(null);const rowOffsets=useRef<Record<string,number>>({});
 const previewDetails=useQuery({queryKey:['details',preview?.mediaType,preview?.id,locale],queryFn:({signal})=>getMediaDetails(preview?.mediaType??'movie',preview?.id??0,locale,signal),enabled:browsing&&!!preview&&!preview.overview});
 const featured=q.data?.featured??[];const hero=featured[featured.length?index%featured.length:0];
 useFocusEffect(useCallback(()=>()=>{lastButton.current=false},[]));
 // Focus moves on key-down but remote events arrive on key-up, so skip the key-up of the press that focused the last button.
 useTVEventHandler(event=>{if(event.eventType==='focus'||event.eventType==='blur'||event.eventKeyAction===0)return;if(arrived.current){arrived.current=false;return}setIndex(value=>nextFeaturedOnRight(event.eventType,event.eventKeyAction,lastButton.current,value,featured.length))});
 useEffect(()=>()=>{if(previewTimer.current)clearTimeout(previewTimer.current)},[]);
 function focusItem(item:MobileMediaSummary){setBrowsing(true);if(previewTimer.current)clearTimeout(previewTimer.current);previewTimer.current=setTimeout(()=>setPreview(item),150)}
 function restoreHero(){if(previewTimer.current)clearTimeout(previewTimer.current);setBrowsing(false);setActiveRow(null);setPreview(null);rows.current?.scrollTo({y:0,animated:false})}
 // Rows above the focused row stay mounted for Up navigation but are hidden so they do not show under the preview.
 function focusRow(key:RowKey){setBrowsing(true);setActiveRow(key);rows.current?.scrollTo({y:rowOffsets.current[key]??0,animated:false})}
 if(q.isLoading)return <View style={s.fill}><HeroSkeleton/><RowSkeleton/></View>;
 if(!q.data)return <View style={s.fill}><ErrorState body={t('errorBody')} onRetry={()=>void q.refetch()}/></View>;
 const above=(key:RowKey)=>browsing&&activeRow!==null&&ROWS.indexOf(key)<ROWS.indexOf(activeRow);
 const shown=browsing?(previewDetails.data??preview??hero):hero;
 return <View style={s.fill}><TVBackdrop url={shown?.backdropUrl}/>{browsing&&shown?<View pointerEvents="none" style={s.preview}><TVTitle compact item={shown}/><TVMeta item={shown}/><TVOverview text={shown.overview}/></View>:null}<ScrollView ref={rows} showsVerticalScrollIndicator={false} style={browsing?s.browsing:{flex:1}} contentContainerStyle={s.content} removeClippedSubviews={false}>
 {hero?<TVFocusGuideView autoFocus trapFocusRight onFocusEnter={restoreHero} style={s.hero}><Text style={s.overline}>{t('trendingWeek').toLocaleUpperCase(locale)}</Text><TVTitle item={hero}/><TVMeta item={hero}/><TVOverview text={hero.overview}/><View style={s.actions}><Button hasTVPreferredFocus label={t('watchNow')} icon={<Ionicons name="play" size={20} color={colors.text}/>} onPress={()=>router.push(`/watch/${hero.mediaType}/${hero.id}` as never)}/><Button secondary label={t('details')} icon={<Feather name="info" size={20} color={colors.text}/>} onPress={()=>router.push(`/${hero.mediaType}/${hero.id}` as never)}/><HeroWatchlist item={hero} onFocus={()=>{lastButton.current=true;arrived.current=true}} onBlur={()=>{lastButton.current=false;arrived.current=false}}/><View style={s.pager}>{featured.map((item,i)=><View key={`${item.mediaType}-${item.id}`} style={[s.dot,i===index%featured.length&&s.currentDot]}/>)}</View></View></TVFocusGuideView>:null}
 {history.items.length?<View style={above('history')&&s.hidden} onLayout={event=>{rowOffsets.current.history=event.nativeEvent.layout.y}}><TVRow title={t('continueWatching')} onFocusEnter={()=>focusRow('history')}>{history.items.map(item=><TVPressable key={`${item.type}-${item.id}`} accessibilityRole="button" accessibilityLabel={`${item.title}${item.type==='tv'?` S${item.season??1}:E${item.episode??1}`:''}${formatPlaybackTimings(item)?`, ${formatPlaybackTimings(item)}`:''}`} focusStyle={tvCardFocusStyle} onFocus={()=>focusItem(historySummary(item))} onPress={()=>router.push(`/watch/${item.type}/${item.id}${item.type==='tv'?`?season=${item.season??1}&episode=${item.episode??1}`:''}` as never)} style={s.land}>{item.backdrop_path||item.poster_path?<Image source={item.backdrop_path??item.poster_path} alt="" style={StyleSheet.absoluteFill} contentFit="cover"/>:null}<LinearGradient colors={['transparent','rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill}/><Text numberOfLines={1} style={s.landTitle}>{item.title}{item.type==='tv'?` · S${item.season??1}:E${item.episode??1}`:''}</Text><TVProgress progress={item.progress}/></TVPressable>)}</TVRow></View>:null}
 {(['trendingMovies','trendingTV'] as const).map(key=><View key={key} style={above(key)&&s.hidden} onLayout={event=>{rowOffsets.current[key]=event.nativeEvent.layout.y}}><TVRow title={t(key)} onFocusEnter={()=>focusRow(key)}>{q.data[key].map(item=><TVPoster key={item.id} item={item} onFocus={()=>focusItem(item)}/>)}</TVRow></View>)}
 </ScrollView></View>
}
const s=StyleSheet.create({fill:{flex:1,backgroundColor:colors.background},content:{paddingBottom:32},hero:{paddingLeft:32,paddingTop:92,height:380},overline:{fontFamily:fonts.bodySemiBold,fontSize:12,letterSpacing:1.4,color:colors.accentText,marginBottom:10},actions:{flexDirection:'row',alignItems:'center',gap:12,marginTop:22},watchlist:{width:44,height:44,borderRadius:10,backgroundColor:'rgba(255,255,255,0.12)',alignItems:'center',justifyContent:'center'},pager:{flexDirection:'row',gap:6,marginLeft:14},dot:{width:6,height:6,borderRadius:3,backgroundColor:'rgba(255,255,255,0.3)'},currentDot:{width:20,backgroundColor:colors.text},preview:{position:'absolute',top:44,left:32,right:24},browsing:{position:'absolute',top:242,bottom:0,left:0,right:0},hidden:{opacity:0},land:{width:200,height:113,borderRadius:10,overflow:'hidden',backgroundColor:colors.surfaceAlt},landTitle:{position:'absolute',left:10,right:10,bottom:12,color:colors.text,fontFamily:fonts.bodySemiBold,fontSize:13}});
