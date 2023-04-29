import {
  createContext,
  useContext,
  useDebugValue,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { StoreSnapshot } from '@deep-state/core';
import type {
  BaseFields,
  DeepStateContextValue,
  DeepStateSelector,
} from './types';
import { useStableCallback } from './utils';

export const DeepStateContext =
  createContext<DeepStateContextValue<BaseFields> | null>(null);

export function useDeepStateStore<Fields extends BaseFields>() {
  const context = useContext(DeepStateContext) as DeepStateContextValue<Fields>;

  if (!context) {
    throw new Error(
      'Make sure useDeepStateStore is being used within a DeepStateProvider',
    );
  }

  return context;
}

export function useDeepStateUpdate<Fields extends BaseFields>() {
  const context = useDeepStateStore<Fields>();
  useDebugValue(context.store.update);
  return context.store.update;
}

export function useDeepStateReset<Fields extends BaseFields>() {
  const context = useDeepStateStore<Fields>();
  useDebugValue(context.store.reset);
  return context.store.reset;
}

type UseDeepStateStoreOptions<Selector extends DeepStateSelector> = {
  selector: Selector;
};

export function useDeepState<Selector extends DeepStateSelector>({
  selector,
}: UseDeepStateStoreOptions<Selector>) {
  const { store, config } = useDeepStateStore();
  const data = useSyncExternalStore(store.subscribe, () =>
    selector(store.getSnapshot()),
  ) as ReturnType<Selector>;
  useDebugValue(data);
  return { data, config };
}

export function useDeepStateSelector<Fields extends BaseFields>(
  ...selectors: Array<DeepStateSelector>
) {
  const cachedResult = useRef<Array<any>>([]);

  function selector(snapshot: StoreSnapshot<Fields>) {
    const nextResult = selectors.map((selector) => selector(snapshot));

    if (
      nextResult.some((result, index) => result !== cachedResult.current[index])
    ) {
      cachedResult.current = nextResult;
    }

    return cachedResult.current;
  }

  return useStableCallback(selector);
}
