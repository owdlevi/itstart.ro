import { Container } from "./container";

/** Screen 09's title block and its two columns (the form draws both). */
export function LaunchPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <Container>
      <div className="flex flex-col gap-2 pb-5 pt-7 md:pb-8 md:pt-12">
        <h1 className="text-[32px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[48px]">
          {title}
        </h1>
        <p className="text-[17px] leading-[26px] text-muted">{lead}</p>
      </div>
      {children}
    </Container>
  );
}
