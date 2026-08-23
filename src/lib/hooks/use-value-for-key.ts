import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * Local state that resets to `value` whenever `resetKey` changes.
 * Uses React's supported "adjust state during render" pattern so we don't
 * need an effect (and avoid `react-hooks/set-state-in-effect`).
 */
export function useValueForKey<T>(
  value: T,
  resetKey: string,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(value);
  const [prevKey, setPrevKey] = useState(resetKey);
  if (prevKey !== resetKey) {
    setPrevKey(resetKey);
    setState(value);
  }
  return [state, setState];
}
