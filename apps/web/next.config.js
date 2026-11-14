import createNextIntlPlugin from "next-intl/plugin";
import { withWorkflow } from "workflow/next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {};

// withWorkflow enables the "use workflow" / "use step" directives for src/workflows/.
export default withWorkflow(withNextIntl(nextConfig));
