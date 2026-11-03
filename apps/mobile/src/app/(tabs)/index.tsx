import { Platform } from 'react-native';
import HomeScreen from '../../features/home/HomeScreen';
import TVHomeScreen from '../../features/home/TVHomeScreen';
export default Platform.isTV ? TVHomeScreen : HomeScreen;
