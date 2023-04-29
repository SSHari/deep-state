import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Builder } from './index';

/**
 * Components
 */
const Input: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { label?: string }
> = ({ label, ...props }) => (
  <label>
    {label}
    <input {...props} />
  </label>
);

const Button: React.FC<React.HTMLAttributes<HTMLButtonElement>> = (props) => (
  <button {...props} />
);

const { Form } = Builder.form({
  fields: {
    input: Builder.field(Input)
      .valueProp('value')
      .defaultProps(({ merge }) => ({
        value: '',
        onChange: (event) => merge({ value: event.target.value }),
      })),
    button: Builder.field(Button),
  },
});

const customRender = (ui: React.ReactElement, options?: RenderOptions) => {
  const user = userEvent.setup();
  return { ...render(ui, options), user };
};

const noop = () => {};

class Logger {
  private static log = console.log;
  private static warn = console.warn;
  private static error = console.error;

  static suppressLogging() {
    console.log = noop;
    console.warn = noop;
    console.error = noop;
  }

  static resetLogging() {
    console.log = this.log;
    console.warn = this.warn;
    console.error = this.error;
  }
}

export * from '@testing-library/react';
export { customRender as render, Form, Logger };
