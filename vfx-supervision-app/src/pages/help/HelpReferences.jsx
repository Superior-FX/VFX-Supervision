import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./HelpReferences.css";

const modules = import.meta.glob("../../../references/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

function stripFrontmatter(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n/, "");
}

function titleFromMarkdown(content, fallback) {
  const match = content.split("\n").find((line) => line.trim().startsWith("# "));
  if (match) return match.trim().slice(2).trim();
  return fallback;
}

function titleCaseFromFilename(path) {
  const base = path.split("/").pop().replace(/\.md$/, "");
  return base.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const FILES = Object.entries(modules)
  .map(([path, raw]) => {
    const content = stripFrontmatter(raw);
    return {
      path,
      content,
      title: titleFromMarkdown(content, titleCaseFromFilename(path)),
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title));

export default function HelpReferences() {
  const [activePath, setActivePath] = useState(FILES[0]?.path);

  const active = useMemo(() => FILES.find((f) => f.path === activePath), [activePath]);

  return (
    <div className="references">
      <div className="card references-list">
        {FILES.map((file) => (
          <div
            key={file.path}
            className={`references-list-item${file.path === activePath ? " active" : ""}`}
            onClick={() => setActivePath(file.path)}
          >
            {file.title}
          </div>
        ))}
      </div>

      <div className="card references-content">
        {active ? (
          <div className="md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{active.content}</ReactMarkdown>
          </div>
        ) : (
          <span className="label">No reference files found.</span>
        )}
      </div>
    </div>
  );
}
