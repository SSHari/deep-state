import { assertType, expectTypeOf } from 'vitest';
import { Form } from './test.utils';
import { Builder } from './index';

describe('Form', () => {
  it('should set the default form props to React.FormHTMLAttributes<HTMLFormElement>', () => {
    assertType(
      Builder.form({
        fields: {},
      }).Form(
        // Testing props by setting an HTML form prop
        { form: { props: { onSubmitCapture: () => {} } }, fields: {} },
        null,
      ),
    );
  });

  it("should respect the form props of the component passed to the builder's form property", () => {
    assertType(
      Builder.form({
        form: { wrapper: (_props: { customProp: string }) => null },
        fields: {},
      }).Form(
        // Default form props are no longer allowed
        // @ts-expect-error
        { form: { props: { onSubmitCapture: () => {} } }, fields: {} },
        null,
      ),
    );

    assertType(
      Builder.form({
        form: { wrapper: (_props: { customProp: string }) => null },
        fields: {},
      }).Form({ form: { props: { customProp: '' } }, fields: {} }, null),
    );
  });

  it("should respect the form props of the component passed to the Form's form property", () => {
    assertType(
      Builder.form({
        form: { wrapper: (_props: { customProp: string }) => null },
        fields: {},
      }).Form(
        {
          form: {
            wrapper: (_props: { formProp: string }) => null,
            // Default form props are no longer allowed
            // @ts-expect-error
            props: { onSubmitCapture: () => {} },
          },
          fields: {},
        },
        null,
      ),
    );

    assertType(
      Builder.form({
        form: { wrapper: (_props: { customProp: string }) => null },
        fields: {},
      }).Form(
        {
          form: {
            wrapper: (_props: { formProp: string }) => null,
            // Form props defined in the builder's form property are no longer allowed
            // @ts-expect-error
            props: { customProp: '' },
          },
          fields: {},
        },
        null,
      ),
    );

    assertType(
      Builder.form({
        form: { wrapper: (_props: { customProp: string }) => null },
        fields: {},
      }).Form(
        {
          form: {
            wrapper: (_props: { formProp: string }) => null,
            props: { formProp: '' },
          },
          fields: {},
        },
        null,
      ),
    );
  });

  it('should restrict field types to those defined in the Form', () => {
    assertType(
      Form(
        {
          fields: {
            // @ts-expect-error
            fieldA: { type: 'fake-field-type' },
            fieldB: { type: 'input' },
          },
        },
        null,
      ),
    );
  });

  it('should restrict dependencies to keys in the `fields` object and the `_meta` key', () => {
    assertType(
      Form(
        {
          fields: {
            fieldA: {
              type: 'input',
              dependencies: (build) => [
                // @ts-expect-error
                build({ keys: ['fake-field-type'], effects: {} }),
                build({ keys: ['fieldA', '_meta'], effects: {} }),
              ],
            },
          },
        },
        null,
      ),
    );
  });

  it('should return the correct data in the `cond` for the `keys` listed in the dependency', () => {
    assertType(
      Builder.form({
        fields: {
          A: Builder.field((_: { propA: string }) => null).valueProp('propA'),
          B: Builder.field((_: { propB: number }) => null),
        },
      }).Form(
        {
          fields: {
            fieldA: {
              type: 'A',
              dependencies: (build) => [
                build({
                  keys: ['fieldA', '_meta'],
                  cond: (data) => {
                    expectTypeOf(data).toEqualTypeOf<{
                      fieldA: { propA: string };
                      _meta:
                        | { isValid: true }
                        | { isValid: false; errors: { fieldA?: string } };
                    }>();

                    return true;
                  },
                  effects: {},
                }),
              ],
            },
            fieldB: {
              type: 'B',
              dependencies: (build) => [
                build({
                  keys: ['fieldA', 'fieldB'],
                  cond: (data) => {
                    expectTypeOf(data).toEqualTypeOf<{
                      fieldA: { propA: string };
                      fieldB: { propB: number };
                    }>();

                    return true;
                  },
                  effects: {},
                }),
              ],
            },
          },
        },
        null,
      ),
    );
  });

  it('should return the correct data for the _meta key listed in a dependency', () => {
    assertType(
      Builder.form({
        fields: {
          A: Builder.field((_: { propA: string }) => null).valueProp('propA'),
          B: Builder.field((_: { propB: number }) => null),
        },
      }).Form(
        {
          fields: {
            fieldA: {
              type: 'A',
              dependencies: (build) => [
                build({
                  keys: ['_meta'],
                  cond: (data) => {
                    if (!data._meta.isValid) {
                      expectTypeOf(data._meta.errors).toEqualTypeOf<{
                        fieldA?: string;
                      }>();
                    }

                    return true;
                  },
                  effects: {},
                }),
              ],
            },
          },
        },
        null,
      ),
    );
  });

  it("should restrict dependency effects to the field's props", () => {
    assertType(
      Builder.form({
        fields: {
          A: Builder.field((_: { propA: string }) => null),
          B: Builder.field((_: { propB: number }) => null),
        },
      }).Form(
        {
          fields: {
            fieldA: {
              type: 'A',
              dependencies: (build) => {
                assertType(build({ keys: ['fieldA'], effects: { propA: '' } }));
                // @ts-expect-error
                assertType(build({ keys: ['fieldA'], effects: { propB: 1 } }));
                return [];
              },
            },
            fieldB: {
              type: 'B',
              dependencies: (build) => {
                assertType(
                  build({ keys: ['fieldA'], effects: () => ({ propB: 1 }) }),
                );
                assertType(
                  // @ts-expect-error
                  build({ keys: ['fieldA'], effects: () => ({ propA: '' }) }),
                );
                return [];
              },
            },
          },
        },
        null,
      ),
    );
  });

  it("should preserve required props in a field's props object", () => {
    assertType(
      Builder.form({
        fields: {
          test: Builder.field((_props: { propA: string }) => null),
        },
      }).Form(
        // @ts-expect-error
        { fields: { test: { type: 'test', props: {} } } },
        null,
      ),
    );
  });

  it('should mark required props as optional if listed in the default props', () => {
    assertType(
      Builder.form({
        fields: {
          test: Builder.field((_props: { propA: string }) => null).defaultProps(
            { propA: '' },
          ),
        },
      }).Form({ fields: { test: { type: 'test', props: {} } } }, null),
    );

    assertType(
      Builder.form({
        fields: {
          test: Builder.field((_props: { propA: string }) => null).defaultProps(
            () => ({ propA: '' }),
          ),
        },
      }).Form({ fields: { test: { type: 'test', props: {} } } }, null),
    );
  });

  it('should preserve the types of default props', () => {
    const checked: boolean = true;

    assertType(
      Builder.form({
        fields: {
          checkbox: Builder.field(
            (_props: React.InputHTMLAttributes<HTMLInputElement>) => null,
          ).defaultProps(() => ({ checked: false })),
        },
      }).Form(
        { fields: { test: { type: 'checkbox', props: { checked } } } },
        null,
      ),
    );
  });

  it('should only let you choose defined props for default props, error props, and value prop', () => {
    assertType(
      Builder.form({
        fields: {
          checkbox: Builder.field(
            (_props: React.InputHTMLAttributes<HTMLInputElement>) => null,
          )
            .defaultProps(() => ({ checked: false }))
            .defaultProps({ checked: false })
            .errorProps(() => ({ checked: false }))
            .valueProp('checked'),
        },
      }),
    );

    assertType(
      Builder.form({
        fields: {
          checkbox: Builder.field(
            (_props: React.InputHTMLAttributes<HTMLInputElement>) => null,
          )
            // @ts-expect-error
            .defaultProps(() => ({ random: false }))
            // @ts-expect-error
            .defaultProps({ random: false })
            // @ts-expect-error
            .errorProps(() => ({ random: false }))
            // @ts-expect-error
            .valueProp('random'),
        },
      }),
    );
  });
});

describe('Form Components', () => {
  it('should restrict the Field component to keys in the `fields` object', () => {
    assertType(
      Form(
        {
          fields: { fieldA: { type: 'input' } },
          children: ({ Field }) => {
            return [
              // @ts-expect-error
              Field({ field: 'fake-field-type' }),
              Field({ field: 'fieldA' }),
            ];
          },
        },
        null,
      ),
    );
  });

  it('should restrict the props of the Field component to the type of the associated field', () => {
    assertType(
      Builder.form({
        fields: {
          input: Builder.field((_props: { customProp: boolean }) => null),
        },
      }).Form(
        {
          fields: { fieldA: { type: 'input' } },
          children: ({ Field }) =>
            Field({
              field: 'fieldA',
              children: (props) => {
                expectTypeOf(props).toEqualTypeOf<{ customProp: boolean }>();
                return null;
              },
            }),
        },
        null,
      ),
    );
  });

  it('should restrict the Show component to keys in the `fields` object', () => {
    assertType(
      Form(
        {
          fields: { fieldA: { type: 'input' } },
          children: ({ Show }) => {
            return [
              Show({
                // @ts-expect-error
                keys: ['fake-field-type'],
                when: () => true,
                children: null,
              }),
              Show({ keys: ['fieldA'], when: () => true, children: null }),
            ];
          },
        },
        null,
      ),
    );
  });

  it('should restrict the Show component `when` data to keys in the `keys` array', () => {
    assertType(
      Form(
        {
          fields: { fieldA: { type: 'input' } },
          children: ({ Show }) => {
            return [
              // @ts-expect-error
              Show({ keys: [], when: (data) => !data.fieldA, children: null }),
              Show({
                keys: ['fieldA'],
                when: (data) => {
                  expectTypeOf(data.fieldA).toEqualTypeOf<
                    React.InputHTMLAttributes<HTMLInputElement> & {
                      label?: string;
                    }
                  >();

                  return true;
                },
                children: null,
              }),
            ];
          },
        },
        null,
      ),
    );
  });

  it('should return all fields in the _meta errors object for the Show component `when` data', () => {
    assertType(
      Form(
        {
          fields: { fieldA: { type: 'input' } },
          children: ({ Show }) => {
            return [
              Show({
                keys: ['_meta'],
                when: (data) => {
                  if (data._meta.isValid) {
                    expectTypeOf(data._meta).toEqualTypeOf<{ isValid: true }>();
                  } else {
                    expectTypeOf(data._meta).toEqualTypeOf<{
                      isValid: false;
                      errors: { fieldA?: string };
                    }>();
                  }

                  return true;
                },
                children: null,
              }),
            ];
          },
        },
        null,
      ),
    );
  });

  it('should restrict the Watch component to keys in the `fields` object', () => {
    assertType(
      Form(
        {
          fields: { fieldA: { type: 'input' } },
          children: ({ Watch }) => {
            return [
              Watch({
                // @ts-expect-error
                keys: ['fake-field-type'],
                children: () => null,
              }),
              Watch({ keys: ['fieldA'], children: () => null }),
            ];
          },
        },
        null,
      ),
    );
  });

  it('should restrict the Watch component `children` data to keys in the `keys` array', () => {
    assertType(
      Form(
        {
          fields: { fieldA: { type: 'input' } },
          children: ({ Watch }) => {
            return [
              Watch({
                keys: [],
                children: (data) => {
                  // @ts-expect-error
                  assert(data.fieldA);
                  return null;
                },
              }),
              Watch({
                keys: ['fieldA', '_meta'],
                children: (data) => {
                  expectTypeOf(data.fieldA).toEqualTypeOf<
                    React.InputHTMLAttributes<HTMLInputElement> & {
                      label?: string;
                    }
                  >();

                  expectTypeOf(data._meta).toEqualTypeOf<
                    | { isValid: true }
                    | { isValid: false; errors: { fieldA?: string } }
                  >();

                  return null;
                },
              }),
            ];
          },
        },
        null,
      ),
    );
  });

  it('should return all fields in the _meta errors object for the Watch component `children` data', () => {
    assertType(
      Form(
        {
          fields: { fieldA: { type: 'input' } },
          children: ({ Watch }) => {
            return [
              Watch({
                keys: ['_meta'],
                children: (data) => {
                  if (data._meta.isValid) {
                    expectTypeOf(data._meta).toEqualTypeOf<{ isValid: true }>();
                  } else {
                    expectTypeOf(data._meta).toEqualTypeOf<{
                      isValid: false;
                      errors: { fieldA?: string };
                    }>();
                  }

                  return null;
                },
              }),
            ];
          },
        },
        null,
      ),
    );
  });
});

describe('Form Utilities', () => {
  it('should handle the types for the onChange event correctly', () => {
    assertType(
      Builder.form({
        fields: {
          input: Builder.field((_props: { value: string }) => null).valueProp(
            'value',
          ),
        },
      }).Form(
        {
          fields: { fieldA: { type: 'input' }, fieldB: { type: 'input' } },
          children: () => null,
          onChange: (values, props, changedKeys) => {
            expectTypeOf(values).toEqualTypeOf<{
              fieldA: string;
              fieldB: string;
            }>();

            expectTypeOf(props).toEqualTypeOf<{
              fieldA: { value: string };
              fieldB: { value: string };
            }>();

            expectTypeOf(changedKeys).toEqualTypeOf<
              Array<'fieldA' | 'fieldB'>
            >();

            // @ts-expect-error
            assertType(values.fieldC);

            // @ts-expect-error
            assertType(props.fieldC);

            // @ts-expect-error
            assertType(changedKeys[0] === 'fieldC');
          },
        },
        null,
      ),
    );
  });

  it('should handle the types for the onSubmit event correctly', () => {
    assertType(
      Builder.form({
        fields: {
          input: Builder.field((_props: { value: string }) => null).valueProp(
            'value',
          ),
        },
      }).Form(
        {
          fields: { fieldA: { type: 'input' }, fieldB: { type: 'input' } },
          children: () => null,
          onSubmit: (values, meta, props) => {
            expectTypeOf(values).toEqualTypeOf<{
              fieldA: string;
              fieldB: string;
            }>();

            expectTypeOf(meta).toEqualTypeOf<
              | { isValid: true }
              | { isValid: false; errors: { fieldA?: string; fieldB?: string } }
            >();

            expectTypeOf(props).toEqualTypeOf<{
              fieldA: { value: string };
              fieldB: { value: string };
            }>();

            // @ts-expect-error
            assertType(values.fieldC);

            if (!meta.isValid) {
              // @ts-expect-error
              assertType(meta.errors.fieldC);
            }

            // @ts-expect-error
            assertType(props.fieldC);
          },
        },
        null,
      ),
    );
  });

  it('should handle the types for the validate handler correctly', () => {
    assertType(
      Builder.form({
        fields: {
          input: Builder.field((_props: { value: string }) => null).valueProp(
            'value',
          ),
        },
      }).Form(
        {
          fields: { fieldA: { type: 'input' }, fieldB: { type: 'input' } },
          children: () => null,
          validate: (values, props) => {
            expectTypeOf(values).toEqualTypeOf<{
              fieldA: string;
              fieldB: string;
            }>();

            expectTypeOf(props).toEqualTypeOf<{
              fieldA: { value: string };
              fieldB: { value: string };
            }>();

            // @ts-expect-error
            assertType(values.fieldC);

            // @ts-expect-error
            assertType(props.fieldC);

            return { isValid: true };
          },
        },
        null,
      ),
    );
  });
});
