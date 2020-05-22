module.exports = {
    "roots": [
        "<rootDir>/src",
        "<rootDir>/test/jest-unit",
    ],
    "transform": {
        "^.+\\.tsx?$": "ts-jest"
    },
    testMatch: [
        "**/jest-unit/**/*.jest-test.[jt]s",
        "**/__tests__/**/*.[jt]s?(x)",    // these are out of the box defaults
        "**/?(*.)+(spec|test).[tj]s?(x)"  // these are out of the box defaults
    ],
    "testPathIgnorePatterns": [
        "/node_modules/"
    ]
}
