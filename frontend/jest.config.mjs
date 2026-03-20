import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  clearMocks: true,
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

const jestConfig = createJestConfig(customJestConfig);

// On donne un nom à la fonction (makeConfig) avant de l'exporter
const makeConfig = async () => {
  const config = await jestConfig();
  return {
    ...config,
    transformIgnorePatterns: [
      "/node_modules/(?!(next-intl|use-intl)/)",
    ],
  };
};

export default makeConfig;