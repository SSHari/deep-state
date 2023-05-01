import type { ComponentProps } from 'react';
import type {
  BaseConfigs,
  Dependency,
  RecursivePartial,
  Store,
  StoreSnapshot,
  Updater,
} from '@deep-state/core';
import type { Form, InferForm } from './builder';
import type {
  DeepStateFieldComponent,
  DeepStateShowComponent,
  DeepStateWatchComponent,
} from './components';

export type BaseComponentReturn = React.ReactElement<any, any> | null;

export type BaseComponent = (props: any) => BaseComponentReturn;

export type RemoveDefaultPropsFromRequired<ComponentProps, DefaultProps> = Omit<
  ComponentProps,
  keyof DefaultProps
> & {
  [Key in keyof DefaultProps]?: Key extends keyof ComponentProps
    ? ComponentProps[Key]
    : never;
};

export type RequireProperty<T, U extends keyof T> = Omit<T, U> &
  Required<Pick<T, U>>;

export type MaybePromise<T> = T | Promise<T>;

export type BaseFields = {
  [Key: string]: Omit<BaseConfigs[string], 'data'> & {
    props?: BaseConfigs[string]['data'];
  };
};

export type DeepStateContextValue<Fields extends BaseFields> = {
  store: Store<Fields>;
  config: { keyToTypeMap: Record<string, string> };
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

export type DependencyData<
  FormFieldTypes extends InferForm<Form<any>> = InferForm<Form<any>>,
  GraphTypes extends Record<keyof GraphTypes, keyof FormFieldTypes> = Record<
    string,
    keyof FormFieldTypes
  >,
  DependencyKeys extends Array<string | number | symbol> = Array<
    string | number | symbol
  >,
> = FormFieldPropCollection<FormFieldTypes, GraphTypes, DependencyKeys> & {
  [DependencyKey in DependencyKeys[number] as DependencyKey extends '_meta'
    ? DependencyKey
    : never]:
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
      };
};

export type DeepStateFormProviderProps<
  FormFieldTypes extends InferForm<Form<any>> = InferForm<Form<any>>,
  GraphTypes extends Record<keyof GraphTypes, keyof FormFieldTypes> = Record<
    string,
    keyof FormFieldTypes
  >,
  FormComponent extends BaseComponent = React.FC<
    React.FormHTMLAttributes<HTMLFormElement>
  >,
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
    Field: DeepStateFieldComponent<FormFieldTypes, GraphTypes>;
    Show: DeepStateShowComponent<FormFieldTypes, GraphTypes>;
    Watch: DeepStateWatchComponent<FormFieldTypes, GraphTypes>;
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
    meta:
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
        },
    props: {
      [GraphKey in keyof GraphTypes]: FormFieldTypes[GraphTypes[GraphKey]]['props'];
    },
  ) => MaybePromise<void>;
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
  validateOnChange?: boolean;
  validateOnSubmit?: boolean;
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

export type DeepStateFormProviderRefBase<
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

export type DeepStateSelector<Fields extends BaseFields = BaseFields> = (
  snapshot: StoreSnapshot<Fields>,
) => any;

export type InferDeepStateFromProps<Props extends { fields: any }> =
  Props['fields'];
