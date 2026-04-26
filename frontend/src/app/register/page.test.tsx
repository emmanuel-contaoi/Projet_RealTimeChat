import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";

import { authService } from "@/services/api";

import InscriptionPage from "./page";

const mockPush = jest.fn();
const mockRouter: AppRouterInstance = {
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn(),
  push: mockPush,
  refresh: jest.fn(),
  replace: jest.fn(),
};

describe("InscriptionPage", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockPush.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("submits the registration form and redirects on success", async () => {
    const registerSpy = jest
      .spyOn(authService, "register")
      .mockResolvedValueOnce({});

    render(
      <AppRouterContext.Provider value={mockRouter}>
        <InscriptionPage />
      </AppRouterContext.Provider>
    );

    fireEvent.change(screen.getByLabelText("Nom"), {
      target: { value: "Dupont" },
    });
    fireEvent.change(screen.getByLabelText("Prénom"), {
      target: { value: "Manu" },
    });
    fireEvent.change(screen.getByLabelText("Mail *"), {
      target: { value: "manu@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Pseudo"), {
      target: { value: "manu" },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe *"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith(
        "manu@example.com",
        "secret123",
        "Manu",
        "Dupont",
        "manu"
      );
    });
    expect(mockPush).toHaveBeenCalledWith("/conversations");
  });

  it("passes undefined for optional fields when they are empty", async () => {
    const registerSpy = jest
      .spyOn(authService, "register")
      .mockResolvedValueOnce({});

    render(
      <AppRouterContext.Provider value={mockRouter}>
        <InscriptionPage />
      </AppRouterContext.Provider>
    );

    fireEvent.change(screen.getByLabelText("Mail *"), {
      target: { value: "manu@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe *"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith(
        "manu@example.com",
        "secret123",
        undefined,
        undefined,
        undefined
      );
    });
  });

  it("shows a fallback error message when registration fails without a string payload", async () => {
    jest.spyOn(authService, "register").mockRejectedValueOnce({
      response: {
        data: { error: "invalid" },
      },
    });

    render(
      <AppRouterContext.Provider value={mockRouter}>
        <InscriptionPage />
      </AppRouterContext.Provider>
    );

    fireEvent.change(screen.getByLabelText("Mail *"), {
      target: { value: "manu@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe *"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(
      await screen.findByText("Erreur lors de l'inscription")
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows the string error when registration fails with a string payload", async () => {
    jest.spyOn(authService, "register").mockRejectedValueOnce({
      response: {
        data: "Email déjà utilisé",
      },
    });

    render(
      <AppRouterContext.Provider value={mockRouter}>
        <InscriptionPage />
      </AppRouterContext.Provider>
    );

    fireEvent.change(screen.getByLabelText("Mail *"), {
      target: { value: "manu@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe *"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(
      await screen.findByText("Email déjà utilisé")
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
