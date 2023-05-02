import type { InferForm, Form } from './builder';
import { useDeepState, useDeepStateSelector } from './context';
import type { DeepStateSelector, DependencyData } from './types';

export type DeepStateFieldComponent<
  FormFieldTypes extends InferForm<Form<any>> = InferForm<Form<any>>,
  GraphTypes extends Record<keyof GraphTypes, keyof FormFieldTypes> = Record<
    string,
    keyof FormFieldTypes
  >,
> = <FieldKey extends keyof GraphTypes>(props: {
  field: FieldKey;
  children?: (
    props: FormFieldTypes[GraphTypes[FieldKey]]['props'],
  ) => React.ReactElement<any, any> | null;
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

export type DeepStateWatchComponent<
  FormFieldTypes extends InferForm<Form<any>> = InferForm<Form<any>>,
  GraphTypes extends Record<keyof GraphTypes, keyof FormFieldTypes> = Record<
    string,
    keyof FormFieldTypes
  >,
> = <DependencyKeys extends Array<keyof GraphTypes | '_meta'>>(props: {
  keys: DependencyKeys;
  children: (
    data: DependencyData<FormFieldTypes, GraphTypes, DependencyKeys>,
  ) => React.ReactElement<any, any> | null;
}) => React.ReactElement<any, any> | null;

export const buildComponents = <Config extends Form<Record<string, any>>>(
  formConfig: Config,
) => {
  const validateKeys = (
    type: 'Field' | 'Show' | 'Watch',
    keys: Array<string>,
    keyToTypeMap: Record<string, string>,
  ) => {
    for (const key of keys) {
      if (key === '_meta') continue;

      if (!keyToTypeMap[key]) {
        throw new Error(
          `To use the ${type} component, the field key \`${key}\` must be set in the <FormProvider> fields prop.`,
        );
      }
    }
  };

  const useWatchFields = <Keys extends Array<string | number | symbol>>(
    keys: Keys,
  ) => {
    const selector = useDeepStateSelector(
      ...keys.map<DeepStateSelector>((key) => {
        return (state) => state[key as keyof typeof state];
      }),
    );

    const { data, config } = useDeepState({ selector });

    type DataMap = DependencyData<
      InferForm<Form<any>>,
      Record<string, keyof InferForm<Form<any>>>,
      Keys
    >;

    const dataMap = keys.reduce<DataMap>(
      (acc, key, index) => ({ ...acc, [key]: data[index] }),
      {} as DataMap,
    );

    return { dataMap, config };
  };

  const DeepStateField: DeepStateFieldComponent = ({ field, children }) => {
    const { dataMap, config } = useWatchFields([field]);
    validateKeys('Field', [field], config.keyToTypeMap);

    const fieldType = config.keyToTypeMap[field];
    const fieldData = dataMap[field as keyof typeof dataMap];

    if (typeof children === 'function') return children(fieldData);

    const Component = formConfig._fields[fieldType]._component;
    return <Component {...fieldData} />;
  };

  const DeepStateShow: DeepStateShowComponent = ({ children, keys, when }) => {
    const { dataMap, config } = useWatchFields(keys);
    validateKeys('Show', keys, config.keyToTypeMap);
    return when(dataMap) ? children : null;
  };

  const DeepStateWatch: DeepStateWatchComponent = ({ children, keys }) => {
    const { dataMap, config } = useWatchFields(keys);
    validateKeys('Watch', keys, config.keyToTypeMap);
    return children(dataMap);
  };

  return { Field: DeepStateField, Show: DeepStateShow, Watch: DeepStateWatch };
};
