import './polyfills'; // MUST BE THE FIRST IMPORT
import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';
import App from './App';

// Suppress warnings for a cleaner development experience
// 1. 'Expo AV' is deprecated in SDK 52, but we use it for stable PCM playback until expo-audio matures.
// 2. 'NativeEventEmitter' warning is due to react-native-live-audio-stream interacting with newer RN versions.
LogBox.ignoreLogs([
    'Expo AV has been deprecated',
    'new NativeEventEmitter',
    'Unknown warning type',
    'Possible Unhandled Promise Rejection'
]);

registerRootComponent(App);