import { Platform } from 'react-native';
import { render, screen } from '@testing-library/react-native';
jest.mock('expo-router',()=>({useLocalSearchParams:()=>({id:'42'})}));
jest.mock('../home/HomeScreen',()=>({__esModule:true,default:jest.fn(()=>null)}));
jest.mock('../home/TVHomeScreen',()=>({__esModule:true,default:jest.fn(()=>null)}));
jest.mock('../search/SearchScreen',()=>({__esModule:true,default:jest.fn(()=>null)}));
jest.mock('../search/TVSearchScreen',()=>({__esModule:true,default:jest.fn(()=>null)}));
jest.mock('../details/DetailsScreen',()=>({__esModule:true,default:({type,id}:{type:string;id:number})=>{const {Text}=require('react-native');return <Text>phone {type} {id}</Text>}}));
jest.mock('../details/TVDetailsScreen',()=>({__esModule:true,default:({type,id}:{type:string;id:number})=>{const {Text}=require('react-native');return <Text>tv {type} {id}</Text>}}));
const originalTV=Object.getOwnPropertyDescriptor(Platform,'isTV');
afterEach(()=>{if(originalTV)Object.defineProperty(Platform,'isTV',originalTV)});
test.each([false,true])('Home and Search select the correct platform screen: TV=%s',tv=>{
 Object.defineProperty(Platform,'isTV',{value:tv,writable:true,configurable:true});
 jest.isolateModules(()=>{
  const {Platform:isolatedPlatform}:typeof import('react-native')=require('react-native');Object.defineProperty(isolatedPlatform,'isTV',{value:tv,writable:true,configurable:true});
  const home:typeof import('../../app/(tabs)/index')=require('../../app/(tabs)/index');
  const search:typeof import('../../app/(tabs)/search')=require('../../app/(tabs)/search');
  expect(home.default).toBe(require(tv?'../home/TVHomeScreen':'../home/HomeScreen').default);
  expect(search.default).toBe(require(tv?'../search/TVSearchScreen':'../search/SearchScreen').default);
 });
});
test.each([false,true])('Movie and TV details preserve IDs and select platform screens: TV=%s',tv=>{
 Object.defineProperty(Platform,'isTV',{value:tv,writable:true,configurable:true});
 const Movie:typeof import('../../app/movie/[id]')=require('../../app/movie/[id]');
 const Show:typeof import('../../app/tv/[id]')=require('../../app/tv/[id]');
 render(<><Movie.default/><Show.default/></>);
 expect(screen.getByText(`${tv?'tv':'phone'} movie 42`)).toBeTruthy();expect(screen.getByText(`${tv?'tv':'phone'} tv 42`)).toBeTruthy();
});
