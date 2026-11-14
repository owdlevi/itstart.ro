import { cn } from "@/lib/utils";

/** The page column: max 1120px, 16px sides on phones and 32px from 768px. */
export function Container({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1120px] px-4 md:px-8", className)}
      {...props}
    />
  );
}
