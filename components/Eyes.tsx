import React, { useEffect } from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing
} from 'react-native-reanimated';
import { EyeState, Emotion } from '../types';

interface EyesProps {
  state: EyeState;
  emotion: Emotion;
  volume: number;
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const Eyes: React.FC<EyesProps> = ({ state, emotion, volume }) => {
  const leftEyeHeight = useSharedValue(60);
  const rightEyeHeight = useSharedValue(60);
  const pupilX = useSharedValue(0);
  const pupilY = useSharedValue(0);
  const pupilScale = useSharedValue(1);

  // --- LOGIC: Calculate Target Shape based on State/Emotion ---
  useEffect(() => {
    let targetHeight = 150; // Idle (Wide)
    let targetScale = 1;

    // 1. Height Logic
    if (state === EyeState.THINKING) targetHeight = 110;
    else if (state === EyeState.LISTENING) targetHeight = 170;
    else if (state === EyeState.SPEAKING) targetHeight = 150;

    // Emotion Overrides
    if (emotion === Emotion.HAPPY) targetHeight = 60;
    if (emotion === Emotion.EXCITED) targetHeight = 22;
    if (emotion === Emotion.SURPRISED) targetHeight = 190;
    if (emotion === Emotion.SAD) targetHeight = 130;

    // 2. Pupil Logic
    if (state === EyeState.LISTENING) {
      // Simple volume reactivity (damped)
      targetScale = 1.1 + Math.min(volume / 60, 0.3);
    } else if (state === EyeState.THINKING) {
      targetScale = 0.8;
    }

    // Apply Animations with softer springs
    const springConfig = { damping: 18, stiffness: 100, mass: 1 };

    leftEyeHeight.value = withSpring(targetHeight, springConfig);
    rightEyeHeight.value = withSpring(targetHeight, springConfig);
    pupilScale.value = withSpring(targetScale, springConfig);

  }, [state, emotion, volume]);

  // --- LOGIC: Blinking & Random Movement ---
  useEffect(() => {
    // Blink Loop
    const blinkInterval = setInterval(() => {
      if (state === EyeState.THINKING || emotion === Emotion.EXCITED) return;

      // Blink animation sequence
      leftEyeHeight.value = withSequence(
        withTiming(4, { duration: 60 }),
        withSpring(150, { damping: 18, stiffness: 100 })
      );
      rightEyeHeight.value = withSequence(
        withTiming(4, { duration: 60 }),
        withSpring(150, { damping: 18, stiffness: 100 })
      );
    }, 4000 + Math.random() * 3000);

    // Gaze Loop
    const gazeInterval = setInterval(() => {
      if (state === EyeState.SPEAKING || state === EyeState.THINKING) return;

      const isCenter = Math.random() > 0.4;
      const x = isCenter ? 0 : (Math.random() - 0.5) * 30;
      const y = isCenter ? 0 : (Math.random() - 0.5) * 15;

      pupilX.value = withSpring(x, { damping: 20, stiffness: 80 });
      pupilY.value = withSpring(y, { damping: 20, stiffness: 80 });
    }, 2500);

    return () => {
      clearInterval(blinkInterval);
      clearInterval(gazeInterval);
    };
  }, [state, emotion]);

  // Specific Animation for Thinking (Scanning)
  useEffect(() => {
    if (state === EyeState.THINKING) {
      pupilX.value = withRepeat(withSequence(
        withTiming(15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(-15, { duration: 600, easing: Easing.inOut(Easing.ease) })
      ), -1, true);
      pupilY.value = withSpring(-20);
    } else {
      // Reset gaze when stopped thinking
      pupilX.value = withSpring(0);
      pupilY.value = withSpring(0);
    }
  }, [state]);

  const leftEyeProps = useAnimatedProps(() => ({
    height: leftEyeHeight.value,
    y: 100 - (leftEyeHeight.value / 2),
    rx: leftEyeHeight.value < 20 ? 10 : 60
  }));

  const rightEyeProps = useAnimatedProps(() => ({
    height: rightEyeHeight.value,
    y: 100 - (rightEyeHeight.value / 2),
    rx: rightEyeHeight.value < 20 ? 10 : 60
  }));

  const pupilProps = useAnimatedProps(() => ({
    cx: 64 + pupilX.value,
    cy: 100 + pupilY.value,
    r: 25 * pupilScale.value
  }));

  const highlightProps = useAnimatedProps(() => ({
    cx: 74 + pupilX.value,
    cy: 90 + pupilY.value
  }));

  // Render Single Eye via SVG
  const EyeRender = ({ animatedProps }: { animatedProps: any }) => (
    <View className="w-32 h-48 justify-center items-center">
      <Svg height="100%" width="100%" viewBox="0 0 128 200">
        <Defs>
          <RadialGradient id="grad" cx="50%" cy="50%" rx="50%" ry="50%" fx="35%" fy="35%">
            <Stop offset="0%" stopColor="#555" stopOpacity="1" />
            <Stop offset="100%" stopColor="#000" stopOpacity="1" />
          </RadialGradient>
        </Defs>

        {/* Sclera/Eyelid Container */}
        <AnimatedRect
          x="0"
          width="128"
          fill="#f1f5f9"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="2"
          animatedProps={animatedProps}
        />

        {/* Pupil */}
        <AnimatedCircle
          fill="url(#grad)"
          animatedProps={pupilProps}
        />

        {/* Highlights */}
        <AnimatedCircle
          r={8} fill="white" opacity={0.9}
          animatedProps={highlightProps}
        />
      </Svg>
    </View>
  );

  return (
    <View className="flex-row gap-4 justify-center items-center h-48">
      <EyeRender animatedProps={leftEyeProps} />
      <EyeRender animatedProps={rightEyeProps} />
    </View>
  );
};

export default Eyes;