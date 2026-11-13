import type { ReactNode } from "react";
export type LibrarySpec = {
  name: string;
  specification: Record<string, string>;
};
export function LibraryExample({
  name,
  title,
  description,
  children,
  specs,
}: {
  name: string;
  title?: string;
  description: string;
  children: ReactNode;
  specs: readonly LibrarySpec[];
}) {
  const component = specs.find((item) => item.name === name);
  if (!component) throw new Error(`Missing specification: ${name}`);
  return (
    <section className="ds-experience-example" id={name}>
      <header>
        <div>
          <p className="ds-eyebrow">{name}</p>
          <h2>{title ?? name.replace(/([a-z])([A-Z])/g, "$1 $2")}</h2>
          <p>{description}</p>
        </div>
        <a href={`#${name}`} aria-label={`Permalink to ${name}`}>
          Permalink
        </a>
      </header>
      <div className="ds-experience-preview">{children}</div>
      <details className="ds-experience-spec">
        <summary>Specification · 15 parts</summary>
        <dl>
          {Object.entries(component.specification).map(([part, copy]) => (
            <div key={part}>
              <dt>
                {part
                  .replace(/([a-z])([A-Z])/g, "$1 $2")
                  .replace(/^./, (s) => s.toUpperCase())}
              </dt>
              <dd>{copy}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
export function ModuleIntro({
  layer,
  title,
  description,
  specs,
}: {
  layer: number;
  title: string;
  description: string;
  specs: readonly LibrarySpec[];
}) {
  return (
    <>
      <div className="ds-page-heading">
        <p className="ds-eyebrow">Layer {layer} · EASM One</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="ds-experience-intro">
        <p>
          <strong>Working examples.</strong> These controls use local example
          content. Their actions update this page; connection to application
          data and permissions belongs to the consuming product.
        </p>
        <nav aria-label={`${title} examples`}>
          {specs.map((item) => (
            <a key={item.name} href={`#${item.name}`}>
              {item.name
                .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
                .replace(/([a-z])([A-Z])/g, "$1 $2")}
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}
