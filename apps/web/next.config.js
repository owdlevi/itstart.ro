import { withWorkflow } from "workflow/next";

/** @type {import('next').NextConfig} */
const nextConfig = {};

// Enables the "use workflow" / "use step" directives for src/workflows/.
export default withWorkflow(nextConfig);
