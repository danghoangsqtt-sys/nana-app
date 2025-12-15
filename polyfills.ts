import 'react-native-get-random-values';
import { Buffer } from 'buffer';

// Polyfill Buffer
global.Buffer = Buffer;

// Polyfill TextEncoder / TextDecoder
if (typeof global.TextEncoder === 'undefined') {
    const { TextEncoder, TextDecoder } = require('text-encoding');
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
}

// Polyfill process.env if needed (optional, but good for safety)
if (typeof process === 'undefined') {
    global.process = require('process');
} else {
    const bProcess = require('process');
    for (var p in bProcess) {
        if (!(p in process)) {
            (process as any)[p] = bProcess[p];
        }
    }
}