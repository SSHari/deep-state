import React from 'react';
import ReactDOM from 'react-dom/client';
import { type InferDeepStateFromProps, Builder } from '../src/index';
import './index.css';
import { mapObj } from '@deep-state/core';

function TextField({
  error,
  helperText,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  requiredPropTest: string;
  error?: boolean;
  helperText?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        marginBottom: '8px',
      }}
    >
      <input {...props} />
      <span>{error && helperText}</span>
    </div>
  );
}

function NumberField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        marginBottom: '8px',
      }}
    >
      <input {...props} />
    </div>
  );
}

function FormWrapper() {
  return <>HI</>;
}

const { Form, buildProps, useFormRef } = Builder.form({
  // form: { wrapper: FormWrapper },
  fields: {
    text: Builder.field(TextField)
      .valueProp('value')
      .defaultProps(({ merge }) => ({
        requiredPropTest: '',
        onChange: (event) => merge({ value: event.target.value }),
      }))
      .errorProps(({ error }) => ({ error: true, helperText: error })),
    number: Builder.field(NumberField)
      .valueProp('value')
      .defaultProps(({ update }) => ({
        onChange: (event) =>
          update((prev) => ({ ...prev, value: event.target.value })),
      })),
    button: Builder.field(
      (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button {...props} />
      ),
    ),
  },
});

const props = buildProps({
  onChange: console.log,
  onSubmit: console.log,
  fields: {
    randomizer: {
      type: 'button',
      props: {
        type: 'button',
        children: '[RESET] Randomize Data',
      },
    },
    reset: {
      type: 'button',
      props: {
        type: 'button',
        children: '[RESET] Reset Data',
      },
    },
    fieldA: {
      type: 'text',
      props: { value: 'Reset Text' },
      dependencies: (build) => [
        build({
          keys: ['fieldB'],
          cond: (data) => parseInt(data.fieldB.value as string) === 100,
          effects: { value: 'Hi', disabled: true },
        }),
      ],
    },
    fieldB: { type: 'number', props: { value: 800, type: 'number' } },
    fieldC: {
      type: 'button',
      props: { children: 'Reset Button' },
      dependencies: (build) => [
        build({
          keys: ['_meta'],
          effects: (data) => ({ disabled: !data._meta.isValid }),
        }),
      ],
    },
  },
});

function App() {
  const formRef = useFormRef<InferDeepStateFromProps<typeof props>>();

  return (
    <Form
      onChange={(values, props, changedKeys) => {
        console.log(values, props, changedKeys);
      }}
      validateOnSubmit
      validateOnChange
      onSubmit={console.log}
      ref={formRef}
      validate={async (values) => {
        console.log('Validate', values);
        // await new Promise((r) => setTimeout(r, 2000));
        if (values.fieldA !== 'error') return { isValid: true };
        const errors = mapObj(values, (k, j) => 'An error');
        return { isValid: false, errors };
      }}
      fields={{
        reset: {
          type: 'button',
          props: {
            type: 'button',
            children: 'Reset Data',
            onClick: () => {
              formRef.current?.reset(props.fields);
            },
          },
        },
        randomizer: {
          type: 'button',
          props: {
            children: 'Randomize Field A Value',
            type: 'button',
            onClick: () => {
              formRef.current?.merge('fieldA', {
                value: Math.floor(Math.random() * 100),
              });
            },
          },
        },
        fieldA: {
          type: 'text',
          props: { value: 'Text' },
          dependencies: (build) => [
            build({
              keys: ['fieldB'],
              cond: (data) => parseInt(data.fieldB.value as string) === 100,
              effects: { value: 'Hi', disabled: true },
            }),
          ],
        },
        fieldB: { type: 'number', props: { value: 200, type: 'number' } },
        fieldC: {
          type: 'button',
          props: { children: 'My Button' },
          dependencies: (build) => [
            build({
              keys: ['_meta'],
              effects: (data) => ({ disabled: !data._meta.isValid }),
            }),
          ],
        },
        fieldD: {
          type: 'text',
          dependencies: (build) => [
            build({
              keys: ['fieldB'],
              cond: (data) => parseInt(data.fieldB.value as string) === 100,
              effects: { value: 'disable D', disabled: true },
            }),
            build({
              keys: ['_meta'],
              cond: (data) =>
                !data._meta.isValid && data._meta.errors.fieldA === '',
              effects: {},
            }),
          ],
        },
      }}
    >
      {({ Field, Show, Watch }) => (
        <>
          <Field field="randomizer" />
          <Field field="reset" />
          <Field field="fieldA" />
          <Field field="fieldB" />
          <Show
            keys={['fieldA', 'fieldB', '_meta']}
            when={(data) => {
              return data.fieldA.value === 'show' && data.fieldB.value == 300;
            }}
          >
            <Field field="fieldC" />
          </Show>
          <Field field="fieldD">
            {(props) => (
              <div>
                <input {...props} />
                <span>{props.disabled ? 'Disabled!' : props.value}</span>
              </div>
            )}
          </Field>
          <Watch keys={['fieldA', 'fieldB', '_meta']}>
            {(props) => (
              <>
                <div>Watcher!</div>
                <div>{props.fieldA.value}</div>
                <div>{props.fieldB.value}</div>
                <div>Is Valid: {props._meta.isValid.toString()}</div>
              </>
            )}
          </Watch>
        </>
      )}
    </Form>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
