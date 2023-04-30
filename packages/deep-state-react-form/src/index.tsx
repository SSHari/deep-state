import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  configureStore,
  filterObj,
  mapObj,
  merge,
  noop,
  walkObj,
} from '@deep-state/core';
import type {
  BaseConfigs,
  Dependency,
  StoreSnapshot,
  Updater,
} from '@deep-state/core';
import {
  Field,
  Form,
  hasDefaultProps,
  hasErrorProps,
  hasValueProp,
  type InferForm,
} from './builder';
import { buildComponents, type DeepStateFieldComponent } from './components';
import { DeepStateContext } from './context';
import type {
  BaseComponent,
  BaseFields,
  DeepStateContextValue,
  DeepStateFormProviderProps,
  DeepStateFormProviderRefBase,
  RequireProperty,
} from './types';
import {
  useStableCallback,
  useCancelableCallback,
  DS_CALLBACK_ABORTED,
} from './utils';

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
    const components = buildComponents(formConfig);

    function DeepStateFormProvider<
      GraphTypes extends Record<keyof GraphTypes, keyof FormFieldTypes>,
      FormComponentOverride extends BaseComponent = FormComponent,
    >(
      {
        validateOnChange = false,
        validateOnSubmit = true,
        ...props
      }: DeepStateFormProviderProps<
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
                  ? fieldConfig._defaultProps({
                      update: (updater) => updateRef.current(fieldKey, updater),
                      merge: (update: any) =>
                        updateRef.current(fieldKey, (prev: any) => ({
                          ...prev,
                          ...update,
                        })),
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
          if (!changedKeys.includes('_meta') && !!validateOnChange) {
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
            onSubmit={async (event) => {
              event.preventDefault();
              const formState = contextValue.store.getSnapshot();

              const values = mapObj(valueProps, (valueProp, fieldKey) => {
                return (formState[fieldKey] as any)?.[valueProp];
              });

              if (props.onSubmit) {
                let meta = formState._meta;
                if (!!validateOnSubmit) {
                  try {
                    const validation = await cancelableValidate(
                      values,
                      formState,
                    );

                    // Skip for a no-op
                    if (validation) {
                      contextValue.store.update('_meta', validation);
                      meta = validation;
                    }
                  } catch (error) {
                    if (error === DS_CALLBACK_ABORTED) return;

                    // TODO: Handle errors properly
                    console.error(error);
                  }
                }

                await props.onSubmit(
                  values as any,
                  meta ?? ({ isValid: true } as any),
                  formState as any,
                );
              }
            }}
          >
            {props.children?.({
              Field: components.Field as DeepStateFieldComponent<
                FormFieldTypes,
                GraphTypes
              >,
              Show: components.Show,
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

export {
  useDeepStateStore,
  useDeepStateUpdate,
  useDeepStateReset,
  useDeepState,
  useDeepStateSelector,
} from './context';

export type { InferDeepStateFromProps } from './types';
