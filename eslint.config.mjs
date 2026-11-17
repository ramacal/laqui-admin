import nextVitals from "eslint-config-next/core-web-vitals";

const config = [{ ignores: ["src/generated/**"] }, ...nextVitals];

export default config;
