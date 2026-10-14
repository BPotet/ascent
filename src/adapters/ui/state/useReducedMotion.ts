import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Vrai quand le joueur a demandé au téléphone de réduire les animations. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      subscription.remove();
    };
  }, []);
  return reduced;
}
