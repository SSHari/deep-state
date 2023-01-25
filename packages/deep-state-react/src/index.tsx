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
  walkObj,
} from 'deep-state-core';
import type {
  BaseConfigs,
  Dependency,
  RecursivePartial,
  Store,
  StoreSnapshot,
  Updater,
} from 'deep-state-core';
import {
  Field,
  Form,
  hasDefaultProps,
  hasErrorProps,
  hasValueProp,
  type InferForm,
} from './builder';
import {
  useStableCallback,
  useCancelableCallback,
  DS_CALLBACK_ABORTED,
  type BaseComponent,
  type RemoveDefaultPropsFromRequired,
  type RequireProperty,
  type MaybePromise,
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

type FormMetaData<Keys extends Array<any>> =
  | { isValid: true }
  | { isValid: false; errors: Record<Keys[number], string> };

type FormDependencyMetaData<DependencyKeys extends Array<any>> = {
  [DependencyKey in DependencyKeys[number] as DependencyKey extends '_meta'
    ? DependencyKey
    : never]: FormMetaData<DependencyKeys>;
};

type FormFieldPropCollection<
  FormFieldTypes extends Record<string, any>,
  GraphTypes extends Record<string, any>,
  DependencyKeys extends Array<any>,
> = {
  [DependencyKey in DependencyKeys[number] as DependencyKey extends keyof GraphTypes
    ? DependencyKey
    : never]: DependencyKey extends keyof GraphTypes
    ? FormFieldTypes[GraphTypes[DependencyKey]]['props']
    : never;
};

type DependencyData<
  FormFieldTypes extends Record<string, any>,
  GraphTypes extends Record<string, any>,
  DependencyKeys extends Array<any>,
> = FormDependencyMetaData<DependencyKeys> &
  FormFieldPropCollection<FormFieldTypes, GraphTypes, DependencyKeys>;

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
  ref?: React.ForwardedRef<DeepStateFormProviderRefBase<any>>;
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
  validate?: (
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
  ) => MaybePromise<
    | { isValid: true }
    | {
        isValid: false;
        errors: {
          [GraphKey in keyof GraphTypes as FormFieldTypes[GraphTypes[GraphKey]] extends {
            valueProp: any;
          }
            ? GraphKey
            : never]?: string;
        };
      }
  >;
  fields: {
    [GraphKey in keyof GraphTypes]: {
      type: GraphTypes[GraphKey];
      props?: RemoveDefaultPropsFromRequired<
        FormFieldTypes[GraphTypes[GraphKey]]['props'],
        FormFieldTypes[GraphTypes[GraphKey]]['defaultProps']
      >;
      dependencies?: <
        Build extends <
          DependencyKeys extends Array<keyof GraphTypes | '_meta'>,
        >(dependency: {
          keys: DependencyKeys;
          cond?: (
            data: DependencyData<FormFieldTypes, GraphTypes, DependencyKeys>,
          ) => boolean;
          effects:
            | RecursivePartial<FormFieldTypes[GraphTypes[GraphKey]]['props']>
            | ((
                data: DependencyData<
                  FormFieldTypes,
                  GraphTypes,
                  DependencyKeys
                >,
              ) => RecursivePartial<
                FormFieldTypes[GraphTypes[GraphKey]]['props']
              >);
        }) => typeof dependency,
      >(
        build: Build,
      ) => Array<Dependency>;
    };
  };
};

type DeepStateFormProviderRefBase<
  Fields extends DeepStateFormProviderProps['fields'],
> = {
  update: <Key extends keyof Fields>(
    key: Key,
    props: Updater<NonNullable<Fields[Key]['props']>>,
  ) => void;
  merge: <Key extends keyof Fields>(
    key: Key,
    props: NonNullable<Fields[Key]['props']>,
  ) => void;
  reset: (
    configs: Fields,
    options?: { data?: boolean; dependencies?: boolean },
  ) => void;
};

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
      ref: React.ForwardedRef<DeepStateFormProviderRefBase<any>>,
    ) {
      if ('_meta' in props.fields) {
        throw new Error('The _meta key is reserved. Use a different name');
      }

      const updateRef =
        useRef<(key: string | '_meta', updater: Updater<any>) => void>(noop);

      const [contextValue] = useState(() => {
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

            let dependencies: NonNullable<typeof field.dependencies> =
              field.dependencies ?? (() => []);

            if (hasErrorProps(fieldConfig)) {
              const errorDependency: Dependency = {
                keys: ['_meta'],
                cond: (data) =>
                  !data._meta.isValid && !!data._meta.errors[fieldKey],
                effects: (data) =>
                  fieldConfig._errorProps({
                    error: data._meta.errors[fieldKey],
                  }),
              };

              const definedDependencies = dependencies;
              dependencies = (build) => [
                ...definedDependencies(build),
                build(errorDependency),
              ];
            }

            return {
              type: field.type,
              data: merge(defaultProps, field.props),
              dependencies,
            };
          },
        );

        const store = createStore({
          keys: {
            ...keys,
            _meta: {
              type: '__meta__',
              data: { isValid: true },
            } as (typeof keys)[string],
          } as typeof keys,
        });
        const keyToTypeMap = mapObj(props.fields, ({ type }) => type);

        updateRef.current = store.update;

        return {
          store,
          config: { keyToTypeMap },
        } as DeepStateContextValue<BaseConfigs>;
      });

      const fieldsWithValues = filterObj(props.fields, ({ type }) =>
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

      const lastStoreDataRef = useRef(contextValue.store.getSnapshot());
      const stableOnChange = useStableCallback(props.onChange) as NonNullable<
        DeepStateFormProviderProps['onChange']
      >;

      const cancelableValidate = useCancelableCallback(
        props.validate,
      ) as NonNullable<DeepStateFormProviderProps['validate']>;

      useEffect(() => {
        return contextValue.store.subscribe(async () => {
          const data: StoreSnapshot<BaseConfigs> =
            contextValue.store.getSnapshot();

          const changedKeys: Array<string> = [];

          walkObj(data, (value, key) => {
            if (lastStoreDataRef.current[key] !== value) {
              changedKeys.push(key);
            }
          });

          lastStoreDataRef.current = data;

          const values = mapObj(valueProps, (valueProp, fieldKey) => {
            return data[fieldKey]?.[valueProp as string];
          });

          stableOnChange(values, data, changedKeys);

          // Skip validation for changes triggered
          // by a previous validation run
          if (!changedKeys.includes('_meta')) {
            try {
              const validation = await cancelableValidate(values, data);

              // Skip for a no-op
              if (!validation) return;

              contextValue.store.update('_meta', validation);
            } catch (error) {
              if (error === DS_CALLBACK_ABORTED) return;

              // TODO: Handle errors properly
              console.error(error);
            }
          }
        });
      }, [contextValue.store, stableOnChange, cancelableValidate]);

      useImperativeHandle(
        ref,
        () => ({
          reset: (configs, options) => {
            const fields = mapObj(
              configs,
              ({ props, dependencies }: Record<string, any>) => ({
                data: props,
                dependencies,
              }),
            );

            contextValue.store.reset(
              { ...fields, _meta: { data: { isValid: true } } },
              options,
            );
          },
          update: (key, data) => contextValue.store.update(key as string, data),
          merge: (key, data) =>
            contextValue.store.update(
              key as string,
              (prev: Record<string, any>) => ({ ...prev, ...data }),
            ),
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
      Fields extends DeepStateFormProviderProps['fields'],
    >(): React.MutableRefObject<DeepStateFormProviderRefBase<Fields> | null> {
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
