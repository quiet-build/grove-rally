import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: { cors: true },
  build: { rolldownOptions: {
    input: { main: "index.html", component: "src/component.tsx" },
    output: { entryFileNames: chunk => chunk.name === "component" ? "component.js" : "assets/[name]-[hash].js" },
  } },
});
