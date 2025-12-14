import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import { EyeState, Emotion } from '../types';

interface MouthProps {
  eyeState: EyeState;
  emotion: Emotion;
  volume: number;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

const Mouth: React.FC<MouthProps> = ({ eyeState, emotion, volume }) => {
  const d = useSharedValue("M 10 15 Q 25 15 40 15");

  useEffect(() => {
    // Animation Loop
    const interval = setInterval(() => {
        let nextPath = "M 10 15 Q 25 15 40 15";

        if (eyeState === EyeState.SPEAKING) {
            // Random speaking movement
            const open = 15 + Math.random() * 20;
            nextPath = `M 10 15 Q 25 ${open} 40 15`;
        } else {
            // Emotions
            if (emotion === Emotion.HAPPY) nextPath = "M 10 10 Q 25 30 40 10";
            else if (emotion === Emotion.SAD) nextPath = "M 10 25 Q 25 10 40 25";
            else if (emotion === Emotion.SURPRISED) nextPath = "M 20 10 Q 35 10 35 25 Q 35 40 20 40 Q 5 40 5 25 Q 5 10 20 10"; // O shape
            else nextPath = "M 10 15 Q 25 15 40 15"; // Neutral
        }

        d.value = withTiming(nextPath, { duration: 100, easing: Easing.linear });

    }, 100);

    return () => clearInterval(interval);
  }, [eyeState, emotion]);

  const animatedProps = useAnimatedProps(() => ({
    d: d.value
  }));

  return (
    <View className="items-center justify-center h-16 mt-4">
        <Svg height="60" width="50" viewBox="0 0 50 60">
            <AnimatedPath
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                fill="transparent"
                animatedProps={animatedProps}
            />
        </Svg>
    </View>
  );
};

export default Mouth;