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
import { configureStore, mapObj, merge, noop } from 'deep-state-core';
import type {
  BaseConfigs,
  RecursivePartial,
  Store,
  StoreSnapshot,
  Updater,
} from 'deep-state-core';

type TypeCollection = {
  [type: string]: (props: any) => JSX.Element;
};

type BaseFields = {
  [Key: string]: Omit<BaseConfigs[string], 'data'> & {
    props?: BaseConfigs[string]['data'];
  };
};

type WithUpdater<T> = (updater: Updater<T>) => void;

type BuildProps<Props> = (update: WithUpdater<Props>) => Props;

type DeepStateFormProviderProps<
  Fields extends BaseFields,
  Configs extends BaseConfigs,
> = React.PropsWithChildren<{
  fields: Fields;
  onChange(
    values: Record<string, any>,
    data: StoreSnapshot<Configs>,
    changedKeys: (keyof StoreSnapshot<Configs>)[],
  ): void;
}>;

type DeepStateFormProviderRef<Configs extends BaseConfigs> =
  React.ForwardedRef<{
    update: Store<Configs>['update'];
    reset: Store<Configs>['reset'];
  }>;

type DeepStateContextValue<Configs extends BaseConfigs> = {
  store: Store<Configs>;
  config: { keyToTypeMap: Record<string, string> };
};

const DeepStateContext =
  createContext<DeepStateContextValue<BaseConfigs> | null>(null);

type InferFieldProps<Field> = Field extends React.FC<infer Props>
  ? Props
  : never;

export function BuildDeepStateForm<Collection extends TypeCollection>(options: {
  fields: {
    [Type in keyof Collection]: {
      component: Collection[Type];
      valueProp?: keyof InferFieldProps<Collection[Type]>;
      defaultProps?:
        | InferFieldProps<Collection[Type]>
        | BuildProps<InferFieldProps<Collection[Type]>>;
    };
  };
}) {
  // TODO: Remove defaults from the core logic
  // const createStore = configureStore(options);
  const createStore = configureStore({});

  function DeepStateField<FieldProps extends { field: string }>({
    field,
  }: FieldProps) {
    const {
      props,
      config: { keyToTypeMap },
    } = useDeepState({
      selector: (state) => state[field],
    });

    const fieldType = keyToTypeMap[field];
    if (!fieldType) {
      throw new Error(
        `Field key ${field} must be set in the <FormProvider> fields prop.`,
      );
    }

    const Component = options.fields[fieldType].component;

    return <Component {...props} />;
  }

  function DeepStateFormProvider<
    GraphTypes extends { [GraphKey in keyof GraphTypes]: keyof Collection },
  >(
    props: {
      // Have to add `ref` to the type because of the `forwardRef` override
      // `forwardRef` doesn't respect the type of the props in this complex type
      ref?: DeepStateFormProviderRef<BaseConfigs>;
      children: (config: {
        Field: React.FC<{ field: keyof GraphTypes }>;
      }) => React.ReactNode;
      onChange: (
        values: { [GraphKey in keyof GraphTypes]: any },
        propss: {
          [GraphKey in keyof GraphTypes]: InferFieldProps<
            Collection[GraphTypes[GraphKey]]
          >;
        },
        changedKeys: (keyof GraphTypes)[],
      ) => void;
      fields: {
        [GraphKey in keyof GraphTypes]: {
          type: GraphTypes[GraphKey];
          props?: InferFieldProps<Collection[GraphTypes[GraphKey]]>;
          dependencies?: <
            Build extends <
              DependencyKeys extends Array<keyof GraphTypes>,
            >(dependency: {
              keys: DependencyKeys;
              cond:
                | true
                | ((props: {
                    [DependencyKey in DependencyKeys[number]]: InferFieldProps<
                      Collection[GraphTypes[DependencyKey]]
                    >;
                  }) => boolean);
              effects:
                | RecursivePartial<
                    InferFieldProps<Collection[GraphTypes[GraphKey]]>
                  >
                | ((props: {
                    [DependencyKey in DependencyKeys[number]]: InferFieldProps<
                      Collection[GraphTypes[DependencyKey]]
                    >;
                  }) => RecursivePartial<
                    InferFieldProps<Collection[GraphTypes[GraphKey]]>
                  >);
            }) => typeof dependency,
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
    ref: DeepStateFormProviderRef<BaseConfigs>,
  ) {
    const updateRef =
      useRef<(key: string, updater: Updater<any>) => void>(noop);

    const [contextValue] = useState<DeepStateContextValue<BaseConfigs>>(() => {
      const keys = mapObj(
        props.fields,
        (field: BaseFields[string], fieldKey) => {
          let defaultProps: BaseFields[string]['props'] =
            options.fields[field.type]['defaultProps'];

          if (typeof defaultProps === 'function') {
            defaultProps = (defaultProps as BuildProps<{}>)((updater) => {
              return updateRef.current(fieldKey, updater);
            });
          }

          return {
            type: field.type as string,
            data: merge(
              defaultProps,
              field.props,
            ) as BaseConfigs[string]['data'],
            dependencies:
              field.dependencies as BaseConfigs[string]['dependencies'],
          };
        },
      );

      const store = createStore({ keys });
      const keyToTypeMap = mapObj(props.fields, (field: any) => field.type);

      updateRef.current = store.update;

      return {
        store,
        config: { keyToTypeMap },
      };
    });

    const onChangeRef = useRef(
      buildOnChangeWrapper({
        initialData: contextValue.store.getSnapshot(),
        valueProps: mapObj(
          props.fields,
          ({ type }: BaseFields[string]) =>
            (options.fields[type].valueProp ?? '') as string,
        ),
      }),
    );
    useEffect(
      () => onChangeRef.current.updateOnChange(props.onChange as any),
      [props.onChange],
    );

    useEffect(() => {
      return contextValue.store.subscribe(() => {
        onChangeRef.current.onChange(contextValue.store.getSnapshot());
      });
    }, [contextValue.store]);

    useImperativeHandle(
      ref,
      () => ({
        reset: contextValue.store.reset,
        update: contextValue.store.update,
      }),
      [contextValue.store.reset, contextValue.store.update],
    );

    return (
      <DeepStateContext.Provider value={contextValue}>
        {props.children({
          Field: DeepStateField as React.FC<{ field: keyof GraphTypes }>,
        })}
      </DeepStateContext.Provider>
    );
  }

  function buildProps<
    GraphTypes extends { [GraphKey in keyof GraphTypes]: keyof Collection },
  >(
    props: Omit<
      {
        // Have to add `ref` to the type because of the `forwardRef` override
        // `forwardRef` doesn't respect the type of the props in this complex type
        ref?: DeepStateFormProviderRef<BaseConfigs>;
        children: (config: {
          Field: React.FC<{ field: keyof GraphTypes }>;
        }) => React.ReactNode;
        onChange: (
          values: { [GraphKey in keyof GraphTypes]: any },
          propss: {
            [GraphKey in keyof GraphTypes]: InferFieldProps<
              Collection[GraphTypes[GraphKey]]
            >;
          },
          changedKeys: (keyof GraphTypes)[],
        ) => void;
        fields: {
          [GraphKey in keyof GraphTypes]: {
            type: GraphTypes[GraphKey];
            props?: InferFieldProps<Collection[GraphTypes[GraphKey]]>;
            dependencies?: <
              Build extends <
                DependencyKeys extends Array<keyof GraphTypes>,
              >(dependency: {
                keys: DependencyKeys;
                cond:
                  | true
                  | ((props: {
                      [DependencyKey in DependencyKeys[number]]: InferFieldProps<
                        Collection[GraphTypes[DependencyKey]]
                      >;
                    }) => boolean);
                effects:
                  | RecursivePartial<
                      InferFieldProps<Collection[GraphTypes[GraphKey]]>
                    >
                  | ((props: {
                      [DependencyKey in DependencyKeys[number]]: InferFieldProps<
                        Collection[GraphTypes[DependencyKey]]
                      >;
                    }) => RecursivePartial<
                      InferFieldProps<Collection[GraphTypes[GraphKey]]>
                    >);
              }) => typeof dependency,
            >(
              build: Build,
            ) => Array<{
              keys: Array<keyof GraphTypes>;
              cond: true | ((data: any) => boolean);
              effects:
                | Record<string, any>
                | ((data: any) => Record<string, any>);
            }>;
          };
        };
      },
      'children'
    >,
  ) {
    return props;
  }

  function useDeepStateFormProviderRef<
    Configs extends BaseConfigs = BaseConfigs,
  >(): React.MutableRefObject<{
    update: Store<Configs>['update'];
    reset: Store<Configs>['reset'];
  } | null> {
    return useRef(null);
  }

  return {
    FormProvider: forwardRef(
      DeepStateFormProvider as any,
    ) as unknown as typeof DeepStateFormProvider,
    buildProps,
    useFormProviderRef: useDeepStateFormProviderRef,
  };
}

type BuildOnChangeWrapperOptions = {
  initialData: StoreSnapshot<BaseConfigs>;
  valueProps: Record<string, string>;
};

function buildOnChangeWrapper({
  initialData,
  valueProps,
}: BuildOnChangeWrapperOptions) {
  let onChange: DeepStateFormProviderProps<BaseFields, BaseConfigs>['onChange'];
  let lastData = initialData;

  return {
    onChange(data: StoreSnapshot<BaseConfigs>) {
      const changedKeys = [];
      for (const [key, value] of Object.entries(data)) {
        if (lastData[key] !== value) changedKeys.push(key);
      }

      lastData = data;

      const values = mapObj(
        data,
        (fieldData, fieldKey) => fieldData?.[valueProps[fieldKey]] ?? null,
      );

      onChange(values, data, changedKeys);
    },
    updateOnChange(
      newOnChange: DeepStateFormProviderProps<
        BaseFields,
        BaseConfigs
      >['onChange'],
    ) {
      onChange = newOnChange;
    },
  };
}

type UseDeepStateStoreOptions<Configs extends BaseConfigs> = {
  selector: (snapshot: StoreSnapshot<Configs>) => any;
};

function useDeepStateStore<Configs extends BaseConfigs>() {
  const context = useContext(
    DeepStateContext,
  ) as DeepStateContextValue<Configs>;

  if (!context) {
    throw new Error(
      'Make sure useDeepStateStore is being used within a DeepStateProvider',
    );
  }

  return context;
}

export function useDeepStateUpdate<Configs extends BaseConfigs>() {
  const context = useDeepStateStore<Configs>();
  useDebugValue(context.store.update);
  return context.store.update;
}

export function useDeepStateReset<Configs extends BaseConfigs>() {
  const context = useDeepStateStore<Configs>();
  useDebugValue(context.store.reset);
  return context.store.reset;
}

export function useDeepState<Configs extends BaseConfigs>({
  selector = (state) => state,
}: UseDeepStateStoreOptions<Configs>) {
  const { store, config } = useDeepStateStore<Configs>();
  const selectedValue = useSyncExternalStore(store.subscribe, () =>
    selector(store.getSnapshot()),
  );
  useDebugValue(selectedValue);
  return { props: selectedValue, config };
}

export type InferDeepStateFromProps<
  Props extends DeepStateFormProviderProps<BaseFields, BaseConfigs>,
> = Props['fields'];
