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
  type ComponentProps,
} from 'react';
import {
  configureStore,
  filterObj,
  mapObj,
  merge,
  noop,
} from 'deep-state-core';
import type {
  BaseConfigs,
  RecursivePartial,
  Store,
  StoreSnapshot,
  Updater,
} from 'deep-state-core';
import {
  Field,
  Form,
  hasDefaultProps,
  hasValueProp,
  type InferForm,
} from './builder';
import type {
  BaseComponent,
  RemoveDefaultPropsFromRequired,
  RequireProperty,
} from './utils';

type BaseFields = {
  [Key: string]: Omit<BaseConfigs[string], 'data'> & {
    props?: BaseConfigs[string]['data'];
  };
};

type DeepStateContextValue<Fields extends BaseFields> = {
  store: Store<Fields>;
  config: { keyToTypeMap: Record<string, string> };
};

type DeepStateFormProviderProps<
  FormFieldTypes extends InferForm<Form<any>> = InferForm<Form<any>>,
  GraphTypes extends Record<keyof GraphTypes, keyof FormFieldTypes> = Record<
    string,
    keyof FormFieldTypes
  >,
  FormComponent extends BaseComponent = typeof DefaultFormWrapper,
> = {
  form?: {
    wrapper?: FormComponent;
    props?: Omit<
      ComponentProps<FormComponent>,
      'children' | 'onChange' | 'onSubmit'
    >;
  };
  ref?: DeepStateFormProviderRef<DeepStateFormProviderProps['fields']>;
  children?: (config: {
    Field: React.FC<{ field: keyof GraphTypes }>;
  }) => React.ReactNode;
  onChange?: (
    values: {
      [GraphKey in keyof GraphTypes as FormFieldTypes[GraphTypes[GraphKey]] extends {
        valueProp: any;
      }
        ? GraphKey
        : never]: FormFieldTypes[GraphTypes[GraphKey]]['props'][FormFieldTypes[GraphTypes[GraphKey]]['valueProp']];
    },
    props: {
      [GraphKey in keyof GraphTypes]: FormFieldTypes[GraphTypes[GraphKey]]['props'];
    },
    changedKeys: (keyof {
      [GraphKey in keyof GraphTypes as FormFieldTypes[GraphTypes[GraphKey]] extends {
        valueProp: any;
      }
        ? GraphKey
        : never]: void;
    })[],
  ) => void;
  onSubmit?: (
    values: {
      [GraphKey in keyof GraphTypes as FormFieldTypes[GraphTypes[GraphKey]] extends {
        valueProp: any;
      }
        ? GraphKey
        : never]: FormFieldTypes[GraphTypes[GraphKey]]['props'][FormFieldTypes[GraphTypes[GraphKey]]['valueProp']];
    },
    props: {
      [GraphKey in keyof GraphTypes]: FormFieldTypes[GraphTypes[GraphKey]]['props'];
    },
  ) => void;
  fields: {
    [GraphKey in keyof GraphTypes]: {
      type: GraphTypes[GraphKey];
      props?: RemoveDefaultPropsFromRequired<
        ComponentProps<FormFieldTypes[GraphTypes[GraphKey]]['component']>,
        FormFieldTypes[GraphTypes[GraphKey]]['defaultProps']
      >;
      dependencies?: <
        Build extends <
          DependencyKeys extends Array<keyof GraphTypes>,
        >(dependency: {
          keys: DependencyKeys;
          cond?: (props: {
            [DependencyKey in DependencyKeys[number]]: ComponentProps<
              FormFieldTypes[GraphTypes[DependencyKey]]['component']
            >;
          }) => boolean;
          effects:
            | RecursivePartial<
                ComponentProps<
                  FormFieldTypes[GraphTypes[GraphKey]]['component']
                >
              >
            | ((props: {
                [DependencyKey in DependencyKeys[number]]: ComponentProps<
                  FormFieldTypes[GraphTypes[DependencyKey]]['component']
                >;
              }) => RecursivePartial<
                ComponentProps<
                  FormFieldTypes[GraphTypes[GraphKey]]['component']
                >
              >);
        }) => typeof dependency,
      >(
        build: Build,
      ) => Array<{
        keys: Array<keyof GraphTypes>;
        cond?: (data: any) => boolean;
        effects: Record<string, any> | ((data: any) => Record<string, any>);
      }>;
    };
  };
};

type DeepStateFormProviderRef<Fields extends BaseFields> = React.ForwardedRef<{
  update: Store<Fields>['update'];
  reset: Store<Fields>['reset'];
}>;

const DeepStateContext =
  createContext<DeepStateContextValue<BaseFields> | null>(null);

function DefaultFormWrapper(props: React.FormHTMLAttributes<HTMLFormElement>) {
  return <form {...props} />;
}

export const Builder = {
  form: <
    Fields extends Record<string, any>,
    FormComponent extends BaseComponent = typeof DefaultFormWrapper,
  >(config: {
    form?: { wrapper?: FormComponent };
    fields: Fields;
  }) => {
    const formConfig = new Form(config.fields);
    type FormFieldTypes = InferForm<typeof formConfig>;

    const createStore = configureStore<Fields>();

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

      const Component = formConfig._fields[fieldType]._component;

      return <Component {...props} />;
    }

    function DeepStateFormProvider<
      GraphTypes extends Record<keyof GraphTypes, keyof FormFieldTypes>,
      FormComponentOverride extends BaseComponent = FormComponent,
    >(
      props: DeepStateFormProviderProps<
        FormFieldTypes,
        GraphTypes,
        FormComponentOverride
      >,
      ref: DeepStateFormProviderRef<
        DeepStateFormProviderProps<
          FormFieldTypes,
          GraphTypes,
          FormComponentOverride
        >['fields']
      >,
    ) {
      const updateRef =
        useRef<(key: string, updater: Updater<any>) => void>(noop);

      const [contextValue] = useState<DeepStateContextValue<BaseFields>>(() => {
        const keys = mapObj(
          props.fields,
          (field: BaseFields[string], fieldKey) => {
            const fieldConfig = formConfig._fields[field.type];
            let defaultProps: Record<string, any> = {};

            if (hasDefaultProps(fieldConfig)) {
              defaultProps =
                typeof fieldConfig._defaultProps === 'function'
                  ? fieldConfig._defaultProps((updater) => {
                      return updateRef.current(fieldKey, updater);
                    })
                  : fieldConfig._defaultProps;
            }

            return {
              type: field.type,
              data: merge({}, defaultProps, field.props),
              dependencies: field.dependencies,
            };
          },
        );

        const store = createStore({ keys });
        const keyToTypeMap = mapObj(
          props.fields,
          ({ type }: BaseFields[string]) => type,
        );

        updateRef.current = store.update;

        return {
          store,
          config: { keyToTypeMap },
        };
      });

      const fieldsWithValues = filterObj(
        props.fields,
        ({ type }: BaseFields[string]) =>
          hasValueProp(formConfig._fields[type]),
      );

      const valueProps = mapObj(fieldsWithValues, ({ type }) => {
        return (
          formConfig._fields[type] as RequireProperty<
            Field<BaseComponent>,
            '_valueProp'
          >
        )._valueProp;
      });

      const onChangeRef = useRef(
        buildOnChangeWrapper({
          initialData: contextValue.store.getSnapshot(),
          valueProps,
        }),
      );

      useEffect(
        () =>
          onChangeRef.current.updateOnChange(
            props.onChange as DeepStateFormProviderProps['onChange'],
          ),
        [props.onChange],
      );

      useEffect(() => {
        // Don't subscribe to changes if there's no handler
        if (!onChangeRef.current.isSet) return;

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

      const FormWrapper =
        props.form?.wrapper ?? config.form?.wrapper ?? DefaultFormWrapper;

      return (
        <DeepStateContext.Provider value={contextValue}>
          <FormWrapper
            {...props.form?.props}
            onSubmit={(event) => {
              event.preventDefault();
              const formState = contextValue.store.getSnapshot();

              const values = mapObj(valueProps, (valueProp, fieldKey) => {
                return (formState[fieldKey] as any)?.[valueProp];
              });

              props.onSubmit?.(values as any, formState as any);
            }}
          >
            {props.children?.({
              Field: DeepStateField as React.FC<{ field: keyof GraphTypes }>,
            })}
          </FormWrapper>
        </DeepStateContext.Provider>
      );
    }

    function buildProps<
      GraphTypes extends Record<keyof GraphTypes, keyof FormFieldTypes>,
      FormComponentOverride extends BaseComponent = FormComponent,
    >(
      props: DeepStateFormProviderProps<
        FormFieldTypes,
        GraphTypes,
        FormComponentOverride
      >,
    ) {
      return props;
    }

    function useDeepStateFormProviderRef<
      Fields extends BaseFields,
    >(): React.MutableRefObject<{
      update: Store<Fields>['update'];
      reset: Store<Fields>['reset'];
    } | null> {
      return useRef(null);
    }

    return {
      Form: forwardRef(DeepStateFormProvider) as typeof DeepStateFormProvider,
      buildProps,
      useFormRef: useDeepStateFormProviderRef,
    };
  },
  field: <Component extends BaseComponent>(component: Component) =>
    new Field(component),
};

type BuildOnChangeWrapperOptions = {
  initialData: StoreSnapshot<BaseConfigs>;
  valueProps: Record<string, any>;
};

function buildOnChangeWrapper({
  initialData,
  valueProps,
}: BuildOnChangeWrapperOptions) {
  let onChange: DeepStateFormProviderProps['onChange'];
  let lastData = initialData;
  let isSet = !!onChange;

  return {
    onChange(data: StoreSnapshot<BaseConfigs>) {
      const changedKeys = [];
      for (const [key, value] of Object.entries(data)) {
        if (lastData[key] !== value) changedKeys.push(key);
      }

      lastData = data;

      const values = mapObj(valueProps, (valueProp, fieldKey) => {
        return (data[fieldKey] as any)?.[valueProp];
      });

      onChange?.(values, data, changedKeys);
    },
    updateOnChange(newOnChange: DeepStateFormProviderProps['onChange']) {
      onChange = newOnChange;
      isSet = !!onChange;
    },
    get isSet() {
      return isSet;
    },
  };
}

type UseDeepStateStoreOptions<Fields extends BaseFields> = {
  selector: (snapshot: StoreSnapshot<Fields>) => any;
};

function useDeepStateStore<Fields extends BaseFields>() {
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

export function useDeepState<Fields extends BaseFields>({
  selector = (state) => state,
}: UseDeepStateStoreOptions<Fields>) {
  const { store, config } = useDeepStateStore<Fields>();
  const selectedValue = useSyncExternalStore(store.subscribe, () =>
    selector(store.getSnapshot()),
  );
  useDebugValue(selectedValue);
  return { props: selectedValue, config };
}

export type InferDeepStateFromProps<Props extends { fields: any }> =
  Props['fields'];
