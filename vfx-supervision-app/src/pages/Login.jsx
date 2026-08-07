import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./Login.css";

const PROJECTS = [
  { name: "Project Nightfall — S2", meta: "142 shots · day 34/60", wrapped: false },
  { name: "Ironclad Reshoots", meta: "wrapped", wrapped: true },
];

const ROLES = ["On-set", "Post", "Coordinator", "Artist"];

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState("On-set");
  const [, setStoredRole] = useLocalStorageState("vfx-supe-role", "On-set");

  const enter = () => {
    setStoredRole(role);
    navigate(role === "Artist" ? "/upload" : "/dashboard");
  };

  return (
    <div className="login-page">
      <div className="card login-panel">
        <div className="login-brand">
          <div className="login-brand-mark" />
          <span className="login-brand-name">VFX SUPE</span>
        </div>

        <div className="login-heading">Welcome back</div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enter();
          }}
        >
          <div className="login-field">
            <label>Email</label>
            <input type="email" placeholder="you@studio.com" />
          </div>
          <div className="login-field" style={{ marginTop: 12, marginBottom: 18 }}>
            <label>Password</label>
            <input type="password" placeholder="••••••••" />
          </div>
          <button type="submit" className="btn btn-primary">
            Sign in
          </button>
        </form>

        <span className="label login-projects-label">Recent projects</span>
        <div className="login-projects">
          {PROJECTS.map((project) => (
            <div className="card login-project-card" key={project.name} onClick={enter}>
              <span className="login-project-name">{project.name}</span>
              <span className={`login-project-meta mono${project.wrapped ? " wrapped" : ""}`}>
                {project.meta}
              </span>
            </div>
          ))}
        </div>

        <span className="label login-role-label">Continue as</span>
        <div className="login-roles">
          {ROLES.map((r) => (
            <div
              key={r}
              className={`pill login-role${role === r ? " pill-accent" : ""}`}
              onClick={() => setRole(r)}
            >
              {r}
            </div>
          ))}
        </div>
        {role === "Artist" && (
          <span className="login-role-hint">Artists only see the Artist Portal section.</span>
        )}
      </div>
    </div>
  );
}
