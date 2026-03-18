import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";

import Home from "./page";

describe("Home page", () => {
  it("renders the main hero content and navigation links", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /Ton hub de jeu, simple et instantan./i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connexion" })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(screen.getByRole("link", { name: "Inscription" })).toHaveAttribute(
      "href",
      "/register"
    );
  });

  it("shows the three feature cards", () => {
    render(<Home />);

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName.toLowerCase() === "p" &&
          element.textContent === "Temps réel"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Canaux")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName.toLowerCase() === "p" &&
          element.textContent === "Rôles"
      )
    ).toBeInTheDocument();
  });
});
