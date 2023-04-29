import '@testing-library/jest-dom';
import { Logger } from './test.utils';

// Reset defaults
afterEach(() => {
  Logger.resetLogging();
});
