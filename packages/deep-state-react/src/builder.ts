import type { ComponentProps } from 'react';
import type { RecursivePartial, Updater } from '@deep-state/core';
import type { BaseComponent, RequireProperty } from './utils';

type WithUpdater<T> = (updater: Updater<T>) => void;

type DefaultPropsBuilder<
  Component extends BaseComponent,
  Props = ComponentProps<Component>,
> =
  | RecursivePartial<Props>
  | ((update: WithUpdater<Props>) => RecursivePartial<Props>);

type ErrorPropsBuilder<Component extends BaseComponent> = (fieldMeta: {
  error: string;
}) => RecursivePartial<ComponentProps<Component>>;

export class Field<Component extends BaseComponent> {
  _component: Component;
  _valueProp?: keyof ComponentProps<Component>;
  _defaultProps?: DefaultPropsBuilder<Component>;
  _errorProps?: ErrorPropsBuilder<Component>;

  constructor(component: Component) {
    this._component = component;
  }

  valueProp = <PropName extends keyof ComponentProps<Component>>(
    propName: PropName,
  ) => {
    return Object.assign(this, { _valueProp: propName });
  };

  defaultProps = <DefaultProps extends DefaultPropsBuilder<Component>>(
    defaultProps: DefaultProps,
  ) => {
    return Object.assign(this, { _defaultProps: defaultProps });
  };

  errorProps = <ErrorProps extends ErrorPropsBuilder<Component>>(
    errorProps: ErrorProps,
  ) => {
    return Object.assign(this, { _errorProps: errorProps });
  };
}

export class Form<Fields extends Record<string, any>> {
  _fields: Fields;

  constructor(fields: Fields) {
    this._fields = fields;
  }
}

export const hasDefaultProps = (
  field: any,
): field is RequireProperty<Field<BaseComponent>, '_defaultProps'> =>
  !!field._defaultProps;

export const hasErrorProps = (
  field: any,
): field is RequireProperty<Field<BaseComponent>, '_errorProps'> =>
  !!field._errorProps;

export const hasValueProp = (
  field: any,
): field is RequireProperty<Field<BaseComponent>, '_valueProp'> =>
  !!field._valueProp;

type InferFormFieldComponent<Field> = Field extends { _component: any }
  ? Field['_component']
  : never;

type InferFormFieldValueProp<Field> = Field extends { _valueProp: any }
  ? Field['_valueProp']
  : never;

type InferFormFieldDefaultProps<Field> = Field extends {
  _defaultProps: (...args: any) => any;
}
  ? ReturnType<Field['_defaultProps']>
  : Field extends { _defaultProps: any }
  ? Field['_defaultProps']
  : never;

type InferFormRaw<Form> = {
  [FieldKey in keyof Form]: {
    component: InferFormFieldComponent<Form[FieldKey]>;
    valueProp: InferFormFieldValueProp<Form[FieldKey]>;
    defaultProps: InferFormFieldDefaultProps<Form[FieldKey]>;
    props: ComponentProps<InferFormFieldComponent<Form[FieldKey]>>;
  };
};

export type InferForm<
  F extends Form<any>,
  RawForm = InferFormRaw<F['_fields']>,
> = {
  [FieldKey in keyof RawForm]: {
    [FieldProperty in keyof RawForm[FieldKey] as RawForm[FieldKey][FieldProperty] extends never
      ? never
      : FieldProperty]: RawForm[FieldKey][FieldProperty];
  };
};
