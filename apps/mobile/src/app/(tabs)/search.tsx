import { Platform } from 'react-native';
import SearchScreen from '../../features/search/SearchScreen';
import TVSearchScreen from '../../features/search/TVSearchScreen';
export default Platform.isTV ? TVSearchScreen : SearchScreen;
