import { publishedPackages } from "../../lib/home-content";
import { ProjectStats } from "../project-stats";

export function OpenSourceSection() {
  return (
    <section className="home-open-source" aria-labelledby="open-source-title">
      <div className="home-open-source-intro">
        <p className="home-kicker">MIT licensed, package by package</p>
        <h2 id="open-source-title">Accessible behavior, clear boundaries.</h2>
        <p>Add only what you need. Every package has one focused job.</p>
        <ProjectStats className="home-project-stats" />
      </div>
      <ol className="home-package-list">
        {publishedPackages.map((packageItem, index) => (
          <li key={packageItem.name}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <a href={packageItem.href}>@generative-a11y/{packageItem.name}</a>
            <p>{packageItem.role}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
