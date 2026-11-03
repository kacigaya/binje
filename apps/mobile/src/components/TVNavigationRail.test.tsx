import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler, Platform, TVFocusGuideView } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { focusRailOnBack, TVNavigationRail } from './TVNavigationRail';
jest.mock('@expo/vector-icons/Feather',()=> 'Feather');

const mockRequestFocus=jest.fn();
jest.mock('./TVPressable',()=>{
 const {TVPressable}=jest.requireActual<typeof import('./TVPressable')>('./TVPressable');
 return {TVPressable:({ref,...props}:ComponentProps<typeof TVPressable>)=><TVPressable {...props} ref={node=>{if(node)Object.assign(node,{requestTVFocus:mockRequestFocus});if(typeof ref==='function')ref(node);else if(ref)ref.current=node}}/>};
});
const originalTV=Object.getOwnPropertyDescriptor(Platform,'isTV');
beforeEach(()=>Object.defineProperty(Platform,'isTV',{value:true,writable:true,configurable:true}));
afterEach(()=>{jest.restoreAllMocks();if(originalTV)Object.defineProperty(Platform,'isTV',originalTV)});
function fixture(){
 const navigation={isFocused:jest.fn(()=>true),emit:jest.fn(()=>({defaultPrevented:false})),navigate:jest.fn()};
 const routes=['index','browse','search','library','settings'].map(name=>({key:name,name}));
 // The rail only reads these navigator fields; native screen descriptors are outside this test.
 const props={state:{routes,index:0},navigation,descriptors:Object.fromEntries(routes.map(route=>[route.key,{options:{title:route.name}}]))} as unknown as BottomTabBarProps;
 return {props,navigation};
}
test('rail expands at its focus boundary, then collapses and removes the scrim',()=>{
 const {props,navigation}=fixture();const view=render(<TVNavigationRail {...props}/>,{createNodeMock:()=>({requestTVFocus:jest.fn()})});
 expect(screen.queryByTestId('rail-scrim')).toBeNull();
 const rail=view.UNSAFE_getByType(TVFocusGuideView);
 fireEvent(rail,'focusEnter',{nativeEvent:{}});
 expect(screen.getByTestId('rail-scrim')).toBeTruthy();expect(screen.getByText('search')).toBeTruthy();expect(screen.getByTestId('tv-rail')).toHaveStyle({width:236});
 fireEvent.press(screen.getByTestId('rail-search'));expect(navigation.navigate).toHaveBeenCalledWith('search',undefined);
 fireEvent(rail,'focusLeave',{nativeEvent:{}});
 expect(screen.queryByTestId('rail-scrim')).toBeNull();expect(screen.getByTestId('tv-rail')).toHaveStyle({width:72});
});
test('Back returns content focus to rail only while the tab navigator is focused',()=>{
 const focus=jest.fn();expect(focusRailOnBack(true,false,focus)).toBe(true);expect(focus).toHaveBeenCalledTimes(1);
 expect(focusRailOnBack(true,true,focus)).toBe(false);expect(focusRailOnBack(false,false,focus)).toBe(false);expect(focus).toHaveBeenCalledTimes(1);
 let back:Parameters<typeof BackHandler.addEventListener>[1]|undefined;
 const remove=jest.fn();jest.spyOn(BackHandler,'addEventListener').mockImplementation((_event,handler)=>{back=handler;return {remove}});
 const {props,navigation}=fixture();const view=render(<TVNavigationRail {...props}/>,{createNodeMock:()=>({requestTVFocus:jest.fn()})});
 act(()=>{expect(back?.({type:'hardwareBackPress',timeStamp:0})).toBe(true)});
 fireEvent(view.UNSAFE_getByType(TVFocusGuideView),'focusEnter',{nativeEvent:{}});
 act(()=>{expect(back?.({type:'hardwareBackPress',timeStamp:0})).toBe(false)});
 fireEvent(view.UNSAFE_getByType(TVFocusGuideView),'focusLeave',{nativeEvent:{}});navigation.isFocused.mockReturnValue(false);
 act(()=>{expect(back?.({type:'hardwareBackPress',timeStamp:0})).toBe(false)});
 view.unmount();expect(remove).toHaveBeenCalledTimes(1);
});
