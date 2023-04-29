import type { InferForm, Form } from './builder';
import { useDeepState, useDeepStateSelector } from './context';
import type { DeepStateSelector, DependencyData } from './types';

export type DeepStateFieldComponent<
  FormFieldTypes extends InferForm<Form<any>> = InferForm<Form<any>>,
  GraphTypes extends Record<keyof GraphTypes, keyof FormFieldTypes> = Record<
    string,
    keyof FormFieldTypes
  >,
> = <FieldKeys extends keyof GraphTypes = keyof GraphTypes>(props: {
  field: FieldKeys;
}) => React.ReactElement<any, any> | null;

export type DeepStateShowComponent<
  FormFieldTypes extends InferForm<Form<any>> = InferForm<Form<any>>,
  GraphTypes extends Record<keyof GraphTypes, keyof FormFieldTypes> = Record<
    string,
    keyof FormFieldTypes
  >,
> = <DependencyKeys extends Array<keyof GraphTypes | '_meta'>>(props: {
  children: React.ReactElement<any, any> | null;
  keys: DependencyKeys;
  when: (
    data: DependencyData<FormFieldTypes, GraphTypes, DependencyKeys>,
  ) => boolean;
}) => React.ReactElement<any, any> | null;

export const buildComponents = <Config extends Form<Record<string, any>>>(
  formConfig: Config,
) => {
  const DeepStateField: DeepStateFieldComponent = ({ field }) => {
    const {
      data: props,
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

    // TODO: Fix the type for Fields/BaseConfigs
    // StoreSnapshot is wrong
    return <Component {...(props as any)} />;
  };

  const DeepStateShow: DeepStateShowComponent = ({ children, keys, when }) => {
    const selector = useDeepStateSelector(
      ...keys.map<DeepStateSelector>((key) => {
        return (state) => state[key as keyof typeof state];
      }),
    );

    const {
      data,
      config: { keyToTypeMap },
    } = useDeepState({ selector });

    for (const key of keys) {
      if (key === '_meta') continue;

      if (!keyToTypeMap[key]) {
        throw new Error(
          `To use the Show component. the Field key ${key} must be set in the <FormProvider> fields prop.`,
        );
      }
    }

    const dataMap = keys.reduce<
      DependencyData<Record<string, any>, Record<string, any>, Array<any>>
    >((acc, key, index) => ({ ...acc, [key]: data[index] }), {});

    return when(dataMap) ? children : null;
  };

  return { Field: DeepStateField, Show: DeepStateShow };
};
