import { render, screen, waitFor, Form, Logger } from '../test.utils';

it('should render an input form element correctly', async () => {
  render(
    <Form fields={{ text: { type: 'input', props: { label: 'Text Field' } } }}>
      {({ Field }) => <Field field="text" />}
    </Form>,
  );

  expect(await screen.findByLabelText(/text field/i)).toMatchInlineSnapshot(
    `
    <input
      value=""
    />
  `,
  );
});

it('should handle the onChange event correctly', async () => {
  const onChange = vi.fn();

  const { user } = render(
    <Form
      onChange={onChange}
      fields={{
        name: { type: 'input', props: { label: 'Name' } },
        email: { type: 'input', props: { type: 'email', label: 'Email' } },
      }}
    >
      {({ Field }) => (
        <>
          <Field field="name" />
          <Field field="email" />
        </>
      )}
    </Form>,
  );

  await user.type(await screen.findByLabelText(/name/i), 'A Name');
  expect(screen.getByLabelText(/name/i)).toHaveValue('A Name');
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      { name: 'A Name', email: '' },
      expect.objectContaining({ _meta: { isValid: true } }),
      ['name'],
    ),
  );

  await user.type(screen.getByLabelText(/email/i), 'An Email');
  expect(screen.getByLabelText(/email/i)).toHaveValue('An Email');
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      { name: 'A Name', email: 'An Email' },
      expect.objectContaining({ _meta: { isValid: true } }),
      ['email'],
    ),
  );
});

it('should handle the onSubmit event correctly', async () => {
  const onSubmit = vi.fn();

  const { user } = render(
    <Form
      onSubmit={onSubmit}
      fields={{
        name: { type: 'input', props: { label: 'Name' } },
        submit: { type: 'button', props: { children: 'Submit' } },
      }}
    >
      {({ Field }) => (
        <>
          <Field field="name" />
          <Field field="submit" />
        </>
      )}
    </Form>,
  );

  await user.type(await screen.findByLabelText(/name/i), 'A Name');
  expect(screen.getByLabelText(/name/i)).toHaveValue('A Name');

  await user.click(screen.getByText(/submit/i));
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      { name: 'A Name' },
      { isValid: true },
      expect.anything(),
    ),
  );
});

describe('Field', () => {
  it('should show the field passed to the `field` prop', async () => {
    render(
      <Form
        fields={{
          name: { type: 'input', props: { label: 'Name' } },
          submit: { type: 'button', props: { children: 'Submit' } },
        }}
      >
        {({ Field }) => <Field field="name" />}
      </Form>,
    );

    expect(await screen.findByLabelText(/name/i)).toBeInTheDocument();
  });

  it('should show the children instead of the default component', async () => {
    render(
      <Form
        fields={{ name: { type: 'input', props: { value: 'Input Element' } } }}
      >
        {({ Field }) => (
          <Field field="name">
            {(props) => <>My Value is: {props.value}</>}
          </Field>
        )}
      </Form>,
    );

    expect(
      await screen.findByText(/my value is: input element/i),
    ).toBeInTheDocument();
  });
});

describe('Show', () => {
  it('should conditionally show elements', async () => {
    const { user } = render(
      <Form
        fields={{
          name: { type: 'input', props: { label: 'Name' } },
          submit: { type: 'button', props: { children: 'Submit' } },
        }}
      >
        {({ Field, Show }) => (
          <>
            <Field field="name" />
            <Show keys={['name']} when={(data) => data.name.value === 'Name'}>
              <Field field="submit" />
            </Show>
          </>
        )}
      </Form>,
    );

    // Submit should be hidden by default
    expect(await screen.findByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.queryByText(/submit/i)).not.toBeInTheDocument();

    // Submit should show up when the condition is true
    await user.type(screen.getByLabelText(/name/i), 'Name');
    expect(await screen.findByText(/submit/i)).toBeInTheDocument();

    // Submit should be hidden when the condition is false
    await user.clear(screen.getByLabelText(/name/i));
    expect(screen.queryByText(/submit/i)).not.toBeInTheDocument();
  });

  it('should conditionally show based on the _meta data', async () => {
    const { user } = render(
      <Form
        validateOnChange
        validate={(data) => {
          if (data.name === 'Name') return { isValid: false, errors: {} };
          return { isValid: true };
        }}
        fields={{
          name: { type: 'input', props: { label: 'Name' } },
          submit: { type: 'button', props: { children: 'Submit' } },
        }}
      >
        {({ Field, Show }) => (
          <>
            <Field field="name" />
            <Show keys={['_meta']} when={(data) => !data._meta.isValid}>
              <Field field="submit" />
            </Show>
          </>
        )}
      </Form>,
    );

    // Submit should be hidden by default
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.queryByText(/submit/i)).not.toBeInTheDocument();

    // Submit should show up when the condition is true
    await user.type(screen.getByLabelText(/name/i), 'Name');
    expect(await screen.findByText(/submit/i)).toBeInTheDocument();

    // Submit should be hidden when the condition is false
    await user.clear(screen.getByLabelText(/name/i));
    expect(screen.queryByText(/submit/i)).not.toBeInTheDocument();
  });

  it("should throw if a key that's not listed in the fields is used", () => {
    Logger.suppressLogging();

    expect(() =>
      render(
        <Form fields={{}}>
          {({ Show }) => (
            // Disabled to test the error state
            // @ts-ignore
            <Show keys={['fake-field']} when={(data) => !data._meta.isValid}>
              <></>
            </Show>
          )}
        </Form>,
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      '"To use the Show component. the Field key fake-field must be set in the <FormProvider> fields prop."',
    );
  });
});
