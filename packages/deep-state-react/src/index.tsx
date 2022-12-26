import {
  createContext,
  forwardRef,
  useContext,
  useDebugValue,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { configureStore } from 'deep-state-core';
import {
  BaseConfigs,
  ConfigureStoreOptions,
  RecursivePartial,
  Store,
  StoreSnapshot,
  TypeCollection,
} from 'deep-state-core';

type DeepStateProviderProps<Configs extends BaseConfigs> =
  React.PropsWithChildren<{
    keys: Configs;
    onChange(
      data: StoreSnapshot<Configs>,
      changedKeys: (keyof StoreSnapshot<Configs>)[],
    ): void;
  }>;

const DeepStateContext = createContext<Store<BaseConfigs> | undefined>(
  undefined,
);

export function BuildDeepState<Collection extends TypeCollection>(
  options: ConfigureStoreOptions<Collection>,
) {
  const createStore = configureStore(options);

  function DeepStateProvider<
    GraphTypes extends { [GraphKey in keyof GraphTypes]: keyof Collection },
  >(
    props: {
      // Have to add `ref` to the type because of the `forwardRef` override
      // `forwardRef` doesn't respect the type of the props in this complex type
      ref: React.ForwardedRef<{
        update: Store<BaseConfigs>['update'];
        reset: Store<BaseConfigs>['reset'];
      }>;
      children: React.ReactNode;
      onChange: (
        data: {
          [GraphKey in keyof GraphTypes]: Collection[GraphTypes[GraphKey]];
        },
        changedKeys: (keyof GraphTypes)[],
      ) => void;
      keys: {
        [GraphKey in keyof GraphTypes]: {
          type: GraphTypes[GraphKey];
          data?: Collection[GraphTypes[GraphKey]];
          dependencies?: <
            Build extends {
              <DependencyKeys extends Array<keyof GraphTypes>>(dependency: {
                keys: DependencyKeys;
                cond:
                  | true
                  | ((data: {
                      [DependencyKey in DependencyKeys[number]]: Collection[GraphTypes[DependencyKey]];
                    }) => boolean);
                effects:
                  | RecursivePartial<Collection[GraphTypes[GraphKey]]>
                  | ((data: {
                      [DependencyKey in DependencyKeys[number]]: Collection[GraphTypes[DependencyKey]];
                    }) => RecursivePartial<Collection[GraphTypes[GraphKey]]>);
              }): typeof dependency;
            },
          >(
            build: Build,
          ) => Array<{
            keys: Array<keyof GraphTypes>;
            cond: true | ((data: any) => boolean);
            effects: Record<string, any> | ((data: any) => Record<string, any>);
          }>;
        };
      };
    },
    ref: React.ForwardedRef<{
      update: Store<BaseConfigs>['update'];
      reset: Store<BaseConfigs>['reset'];
    }>,
  ) {
    const [store] = useState(() => createStore({ keys: props.keys as any }));

    const onChangeRef = useRef(buildOnChangeWrapper(store.getSnapshot()));
    useEffect(
      () => onChangeRef.current.updateOnChange(props.onChange as any),
      [props.onChange],
    );

    useEffect(() => {
      return store.subscribe(() => {
        onChangeRef.current.onChange(store.getSnapshot());
      });
    }, [store]);

    useImperativeHandle(
      ref,
      () => ({ reset: store.reset, update: store.update }),
      [store.reset, store.update],
    );

    return (
      <DeepStateContext.Provider value={store as Store<BaseConfigs>}>
        {props.children}
      </DeepStateContext.Provider>
    );
  }

  function buildProps<
    GraphTypes extends { [GraphKey in keyof GraphTypes]: keyof Collection },
  >(props: {
    onChange: (
      data: {
        [GraphKey in keyof GraphTypes]: Collection[GraphTypes[GraphKey]];
      },
      changedKeys: (keyof GraphTypes)[],
    ) => void;
    keys: {
      [GraphKey in keyof GraphTypes]: {
        type: GraphTypes[GraphKey];
        data?: Collection[GraphTypes[GraphKey]];
        dependencies?: <
          Build extends {
            <DependencyKeys extends Array<keyof GraphTypes>>(dependency: {
              keys: DependencyKeys;
              cond:
                | true
                | ((data: {
                    [DependencyKey in DependencyKeys[number]]: Collection[GraphTypes[DependencyKey]];
                  }) => boolean);
              effects:
                | RecursivePartial<Collection[GraphTypes[GraphKey]]>
                | ((data: {
                    [DependencyKey in DependencyKeys[number]]: Collection[GraphTypes[DependencyKey]];
                  }) => RecursivePartial<Collection[GraphTypes[GraphKey]]>);
            }): typeof dependency;
          },
        >(
          build: Build,
        ) => Array<{
          keys: Array<keyof GraphTypes>;
          cond: true | ((data: any) => boolean);
          effects: Record<string, any> | ((data: any) => Record<string, any>);
        }>;
      };
    };
  }) {
    return props;
  }

  function useDeepStateProviderRef<
    Configs extends BaseConfigs = BaseConfigs,
  >(): React.MutableRefObject<{
    update: Store<Configs>['update'];
    reset: Store<Configs>['reset'];
  } | null> {
    return useRef(null);
  }

  return {
    DeepStateProvider: forwardRef(
      DeepStateProvider as any,
    ) as typeof DeepStateProvider,
    buildProps,
    useDeepStateProviderRef,
  };
}

function buildOnChangeWrapper(initialData: StoreSnapshot<BaseConfigs>) {
  let onChange: DeepStateProviderProps<BaseConfigs>['onChange'];
  let lastData = initialData;

  return {
    onChange(data: StoreSnapshot<BaseConfigs>) {
      const changedKeys = [];
      for (const [key, value] of Object.entries(data)) {
        if (lastData[key] !== value) changedKeys.push(key);
      }

      lastData = data;
      onChange(data, changedKeys);
    },
    updateOnChange(
      newOnChange: DeepStateProviderProps<BaseConfigs>['onChange'],
    ) {
      onChange = newOnChange;
    },
  };
}

type UseDeepStateStoreOptions<Configs extends BaseConfigs> = {
  selector: (snapshot: StoreSnapshot<Configs>) => any;
};

function useDeepStateStore<Configs extends BaseConfigs>() {
  const context = useContext(DeepStateContext) as Store<Configs>;
  if (context === undefined) {
    throw new Error(
      'Make sure useDeepStateStore is being used within a DeepStateProvider',
    );
  }
  return context;
}

export function useDeepStateUpdate<Configs extends BaseConfigs>() {
  const context = useDeepStateStore<Configs>();
  useDebugValue(context.update);
  return context.update;
}

export function useDeepStateReset<Configs extends BaseConfigs>() {
  const context = useDeepStateStore<Configs>();
  useDebugValue(context.reset);
  return context.reset;
}

export function useDeepState<Configs extends BaseConfigs>({
  selector = (state) => state,
}: UseDeepStateStoreOptions<Configs>) {
  const context = useDeepStateStore<Configs>();
  const selectedValue = useSyncExternalStore(context.subscribe, () =>
    selector(context.getSnapshot()),
  );
  useDebugValue(selectedValue);
  return selectedValue;
}

export type InferDeepStateFromProps<
  Props extends DeepStateProviderProps<BaseConfigs>,
> = Props['keys'];
