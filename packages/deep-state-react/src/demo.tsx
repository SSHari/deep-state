import React from 'react';
import ReactDOM from 'react-dom/client';
import { type InferDeepStateFromProps, Builder } from './index';
import './demo.css';

function TextField(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    requiredPropTest: string;
  },
) {
  return <input {...props} />;
}

function NumberField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

function FormWrapper() {
  return <>HI</>;
}

const { Form, buildProps, useFormRef } = Builder.form({
  // form: { wrapper: FormWrapper },
  fields: {
    text: Builder.field(TextField)
      .valueProp('value')
      .defaultProps((update) => ({
        requiredPropTest: '',
        onChange: (event) =>
          update((prev) => ({ ...prev, value: event.target.value })),
      })),
    number: Builder.field(NumberField)
      .valueProp('value')
      .defaultProps((update) => ({
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
    fieldA: {
      type: 'text',
      props: { name: '' },
      dependencies: (build) => [
        build({ keys: ['fieldA'], cond: true, effects: {} }),
      ],
    },
    fieldB: {
      type: 'number',
      props: { max: 2 },
      dependencies: (build) => [
        build({
          keys: ['fieldA', 'fieldB'],
          cond: (props) => props.fieldA.name === '',
          effects: (props) => ({ max: props.fieldA.max }),
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
      onSubmit={console.log}
      ref={formRef}
      fields={{
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
        fieldB: { type: 'number', props: { value: 100, type: 'number' } },
        fieldC: { type: 'button', props: { children: 'My Button' } },
      }}
    >
      {({ Field }) => (
        <>
          <Field field="fieldA" />
          <Field field="fieldB" />
          <Field field="fieldC" />
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
