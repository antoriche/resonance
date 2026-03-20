import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transformIgnorePatterns: ["/node_modules/(?!sql-template-tag)"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
    "node_modules/sql-template-tag/.+\\.js$": "ts-jest",
  },
};

export default config;
