import React from "react";
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourcesRss } from "./SourcesRss";

describe("SourcesRss", () => {
  test("renderiza el componente de fuentes RSS", () => {
    render(<SourcesRss />);

    expect(screen.getByRole("heading", { name: /Fuentes RSS/i })).toBeInTheDocument();
    expect(screen.getByText(/Administra los origenes y canales de noticias/i)).toBeInTheDocument();
  });
});