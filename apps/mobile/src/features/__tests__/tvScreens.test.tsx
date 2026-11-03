import type { ComponentProps } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler, Platform, TVFocusGuideView, type HWEvent } from 'react-native';
import { router } from 'expo-router';
import TVHomeScreen, { nextFeaturedOnRight } from '../home/TVHomeScreen';
import TVSearchScreen, { accentVariants, keyboardInput } from '../search/TVSearchScreen';
import TVDetailsScreen, { resumeLabel } from '../details/TVDetailsScreen';
import { en as mockEn } from '../../i18n/en';
import type { TranslationKey } from '../../i18n';
import type { PlayHistoryItem } from '../../storage/playHistory';
import type { MobileHomeResponse, MobileMediaDetails } from '../../types/api';
import { searchMedia } from '../../api/media';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockRemoteHandler: ((event: HWEvent) => void) | undefined;
jest.mock('react-native/Libraries/Components/TV/useTVEventHandler', () => ({ __esModule: true, default: (handler: (event: HWEvent) => void) => { mockRemoteHandler = handler; } }));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: jest.fn() }));
jest.mock('../../providers/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: keyof typeof mockEn) => mockEn[key] }) }));
let mockHistory:PlayHistoryItem[]=[];
jest.mock('../../hooks/usePlayHistory', () => ({ usePlayHistory: () => ({ items: mockHistory }) }));
jest.mock('../../hooks/useWatchlistToggle', () => ({ useIsInWatchlist: () => false, useWatchlistToggle: () => ({ setSaved: jest.fn(), pending: false }) }));
jest.mock('../../api/media', () => ({ ...jest.requireActual('../../api/media'), searchMedia: jest.fn() }));

const mockRequestFocus=jest.fn();
jest.mock('../../components/TVPressable',()=>{
 const {TVPressable}=jest.requireActual<typeof import('../../components/TVPressable')>('../../components/TVPressable');
 return {TVPressable:({ref,...props}:ComponentProps<typeof TVPressable>)=><TVPressable {...props} ref={node=>{if(node)Object.assign(node,{requestTVFocus:mockRequestFocus});if(typeof ref==='function')ref(node);else if(ref)ref.current=node}}/>};
});
const originalTV=Object.getOwnPropertyDescriptor(Platform,'isTV');
beforeEach(()=>{Object.defineProperty(Platform,'isTV',{value:true,writable:true,configurable:true});jest.useFakeTimers();jest.clearAllMocks();mockHistory=[]});
afterEach(()=>{jest.useRealTimers();if(originalTV)Object.defineProperty(Platform,'isTV',originalTV)});
const t=(key:TranslationKey)=>mockEn[key];
function client(){return new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity,staleTime:Infinity}}})}
function renderSearch(){return render(<QueryClientProvider client={client()}><TVSearchScreen/></QueryClientProvider>,{createNodeMock:()=>({requestTVFocus:jest.fn()})})}
const history:PlayHistoryItem={type:'tv',id:1,title:'Show',poster_path:null,backdrop_path:null,date:'2026',vote_average:7,watchedAt:1,season:1,episode:3,positionSeconds:120,durationSeconds:1200};

test('formats resume labels from seconds or stored progress and restarts completed items',()=>{
 expect(resumeLabel(history,t)).toBe('Resume S1:E3 · 18 min left');
 expect(resumeLabel({...history,type:'movie'},t)).toBe('Resume · 18 min left');
 expect(resumeLabel({...history,positionSeconds:undefined,progress:.1},t)).toBe('Resume S1:E3 · 18 min left');
 expect(resumeLabel({...history,positionSeconds:1150},t)).toBe('Watch Now');
 expect(resumeLabel({...history,positionSeconds:0},t)).toBe('Watch Now');
 expect(resumeLabel(undefined,t)).toBe('Watch Now');
});
test('Right advances only from the last hero button on key-up, and wraps',()=>{
 expect(nextFeaturedOnRight('right',1,true,0,2)).toBe(1);
 expect(nextFeaturedOnRight('right',1,true,1,2)).toBe(0);
 expect(nextFeaturedOnRight('right',0,true,0,2)).toBe(0);
 expect(nextFeaturedOnRight('right',1,false,0,2)).toBe(0);
 expect(nextFeaturedOnRight('left',1,true,0,2)).toBe(0);
 expect(nextFeaturedOnRight('right',1,true,0,0)).toBe(0);
});
test('hero remote event advances the displayed title and keeps the right focus trap',()=>{
 const first={id:1,mediaType:'movie' as const,title:'First',overview:'One',posterUrl:null,backdropUrl:null,date:'2026',rating:7,logoUrl:null,rottenTomatoesScore:null,contentRating:null};
 const data:MobileHomeResponse={featured:[first,{...first,id:2,title:'Second'}],trendingMovies:[],trendingTV:[]};
 const cache=client();cache.setQueryData(['home','en'],data);
 const view=render(<QueryClientProvider client={cache}><TVHomeScreen/></QueryClientProvider>);
 expect(screen.getByLabelText('Watch Now').props.hasTVPreferredFocus).toBe(true);
 expect(view.UNSAFE_getAllByType(TVFocusGuideView)[0].props.trapFocusRight).toBe(true);
 act(()=>mockRemoteHandler?.({eventType:'right',eventKeyAction:1}));expect(screen.getByText('First')).toBeTruthy();
 fireEvent(screen.getByLabelText('Add to Watchlist'),'focus',{nativeEvent:{}});
 act(()=>mockRemoteHandler?.({eventType:'right',eventKeyAction:0}));expect(screen.getByText('First')).toBeTruthy();
 // The key-up of the press that moved focus onto the last button must not page.
 act(()=>mockRemoteHandler?.({eventType:'right',eventKeyAction:1}));expect(screen.getByText('First')).toBeTruthy();
 act(()=>mockRemoteHandler?.({eventType:'right',eventKeyAction:1}));expect(screen.getByText('Second')).toBeTruthy();
 fireEvent.press(screen.getByLabelText('Details'));expect(router.push).toHaveBeenCalledWith('/movie/2');
 act(()=>mockRemoteHandler?.({eventType:'right',eventKeyAction:1}));expect(screen.getByText('First')).toBeTruthy();
});
test('keyboard inserts letters and space, deletes once, and clears on hold',()=>{
 renderSearch();expect(screen.getByLabelText('a').props.hasTVPreferredFocus).toBe(true);
 fireEvent.press(screen.getByLabelText('a'));fireEvent.press(screen.getByLabelText('Space'));fireEvent.press(screen.getByLabelText('b'));
 expect(screen.getByLabelText('Search: a b')).toBeTruthy();
 fireEvent.press(screen.getByLabelText('Delete'));expect(screen.getByLabelText('Search: a ')).toBeTruthy();
 fireEvent(screen.getByLabelText('Delete'),'pressIn');fireEvent(screen.getByLabelText('Delete'),'longPress');fireEvent.press(screen.getByLabelText('Delete'));
 expect(screen.getByLabelText('Search: ')).toBeTruthy();
 expect(keyboardInput('','delete')).toBe('');
});
test('hold opens accent variants, OK inserts once, and Back closes without input',()=>{
 let back:Parameters<typeof BackHandler.addEventListener>[1]|undefined;
 const listener=jest.spyOn(BackHandler,'addEventListener').mockImplementation((_event,handler)=>{back=handler;return {remove:jest.fn()}});
 renderSearch();fireEvent(screen.getByLabelText('e'),'pressIn');fireEvent(screen.getByLabelText('e'),'longPress');fireEvent.press(screen.getAllByLabelText('e')[0]);
 expect(screen.getByLabelText('é')).toBeTruthy();fireEvent.press(screen.getByLabelText('é'));expect(screen.getByLabelText('Search: é')).toBeTruthy();expect(screen.queryByLabelText('ë')).toBeNull();
 fireEvent(screen.getByLabelText('a'),'pressIn');fireEvent(screen.getByLabelText('a'),'longPress');
 act(()=>{expect(back?.({type:'hardwareBackPress',timeStamp:0})).toBe(true)});
 expect(screen.queryByLabelText('à')).toBeNull();expect(screen.getByLabelText('Search: é')).toBeTruthy();
 expect(Object.keys(accentVariants)).toEqual(['a','c','e','i','o','u','y']);listener.mockRestore();
});
test('search uses the shared debounce and filters results',async()=>{
 jest.mocked(searchMedia).mockResolvedValue({results:[{id:1,media_type:'movie',title:'Movie result',poster_path:null},{id:2,media_type:'tv',name:'TV result',poster_path:null}],page:1,totalPages:1});
 renderSearch();fireEvent.press(screen.getByLabelText('a'));fireEvent.press(screen.getByLabelText('b'));expect(searchMedia).not.toHaveBeenCalled();
 await act(async()=>{await jest.advanceTimersByTimeAsync(300)});
 await act(async()=>{await jest.advanceTimersByTimeAsync(10)});
 expect(searchMedia).toHaveBeenCalledWith('ab',1,'en',expect.anything());
 expect(screen.getByText('Movie result')).toBeTruthy();expect(screen.getByText('TV result')).toBeTruthy();
 fireEvent.press(screen.getByText('Movies'));expect(screen.queryByText('TV result')).toBeNull();expect(screen.getByText('Movie result')).toBeTruthy();
});

test('row focus debounces the preview and hero focus restores the featured title',()=>{
 const hero={id:1,mediaType:'movie' as const,title:'Hero',overview:'Hero overview',posterUrl:null,backdropUrl:null,date:'2026',rating:7,logoUrl:null,rottenTomatoesScore:null,contentRating:null};
 const poster={...hero,id:2,title:'Preview',overview:'Preview overview'};
 const cache=client();cache.setQueryData(['home','en'],{featured:[hero],trendingMovies:[poster],trendingTV:[]});
 const view=render(<QueryClientProvider client={cache}><TVHomeScreen/></QueryClientProvider>);
 const guides=view.UNSAFE_getAllByType(TVFocusGuideView);
 fireEvent(guides[1],'focusEnter',{nativeEvent:{}});fireEvent(screen.getByLabelText('Preview'),'focus',{nativeEvent:{}});
 act(()=>jest.advanceTimersByTime(149));expect(screen.queryByText('Preview overview')).toBeNull();
 act(()=>jest.advanceTimersByTime(1));expect(screen.getByText('Preview overview')).toBeTruthy();
 fireEvent(guides[0],'focusEnter',{nativeEvent:{}});expect(screen.queryByText('Preview overview')).toBeNull();expect(screen.getByText('Hero')).toBeTruthy();
});
test('series resume action targets the stored episode and the episode row plays the selected episode',()=>{
 mockHistory=[history];const cache=client();
 const details:MobileMediaDetails={id:1,mediaType:'tv',title:'Show',overview:'Overview',posterUrl:null,backdropUrl:null,date:'2026',rating:7,logoUrl:null,tagline:'',genres:[],cast:[],creators:[],runtime:null,contentRating:null,imdbId:null,rottenTomatoesScore:null,related:[],seasons:[{id:1,name:'Season 1',seasonNumber:1,episodeCount:3,overview:'',posterUrl:null,airDate:''}],stream:{mediaType:'tv',tmdbId:1,originalTitle:'Show',year:'2026',imdbId:null}};
 cache.setQueryData(['details','tv',1,'en'],details);cache.setQueryData(['season',1,1,'en'],{showId:1,seasonNumber:1,episodes:[{id:3,name:'Chapter 3',episodeNumber:3,seasonNumber:1,stillUrl:null,airDate:null,runtime:42,rating:7,overview:''}]});
 render(<QueryClientProvider client={cache}><TVDetailsScreen type="tv" id={1}/></QueryClientProvider>);
 expect(screen.getByLabelText('Resume S1:E3 · 18 min left').props.hasTVPreferredFocus).toBe(true);
 fireEvent.press(screen.getByLabelText('Resume S1:E3 · 18 min left'));expect(router.push).toHaveBeenLastCalledWith('/watch/tv/1?season=1&episode=3');
 fireEvent.press(screen.getByLabelText('3. Chapter 3'));expect(router.push).toHaveBeenLastCalledWith('/watch/tv/1?season=1&episode=3');
 expect(screen.queryByLabelText('Back')).toBeNull();
});
