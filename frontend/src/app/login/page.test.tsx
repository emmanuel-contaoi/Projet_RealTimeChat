import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";

import { authService } from "@/services/api";

import ConnexionPage from "./page";

const mockPush = jest.fn();
const mockRouter: AppRouterInstance = {
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn(),
  push: mockPush,
  refresh: jest.fn(),
  replace: jest.fn(),
};

describe("ConnexionPage", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockPush.mockReset();
  });

  it("submits the credentials and redirects on success", async () => {
    const loginSpy = jest.spyOn(authService, "login").mockResolvedValueOnce({});

    render(
      <AppRouterContext.Provider value={mockRouter}>
        <ConnexionPage />
      </AppRouterContext.Provider>
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "manu@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith("manu@example.com", "secret123");
    });
    expect(mockPush).toHaveBeenCalledWith("/conversations");
  });

  it("shows the api error message when login fails", async () => {
    jest.spyOn(authService, "login").mockRejectedValueOnce({
      response: {
        data: "Email ou mot de passe invalide",
      },
    });

    render(
      <AppRouterContext.Provider value={mockRouter}>
        <ConnexionPage />
      </AppRouterContext.Provider>
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "manu@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe"), {
      target: { value: "bad-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(
      await screen.findByText("Email ou mot de passe invalide")
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows the fallback error when login fails without a response body", async () => {
    jest.spyOn(authService, "login").mockRejectedValueOnce({
      response: { data: "" },
    });

    render(
      <AppRouterContext.Provider value={mockRouter}>
        <ConnexionPage />
      </AppRouterContext.Provider>
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "manu@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe"), {
      target: { value: "bad-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByText("Identifiants invalides")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
