import React from "react";
import {
  render as rtlRender,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import { I18nProvider } from "./i18n/i18n";

// Re-export everything from @testing-library/react so test files only
// need to change their import path, not their code.
export * from "@testing-library/react";

function AllProviders({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

function render(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  return rtlRender(ui, { wrapper: AllProviders, ...options });
}

export { render };
