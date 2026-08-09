"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { buildSandboxHref } from "./home-data";
import styles from "./home-gallery.module.css";

export function ConceptPrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const href = buildSandboxHref(prompt);
    if (!href) {
      setError("请输入一个你想看见的数学概念。");
      return;
    }
    setError("");
    router.push(href);
  };

  return (
    <section className={styles.promptSection} aria-labelledby="prompt-title">
      <span className={styles.monoLabel}>CREATE / FROM AN IDEA</span>
      <h2 id="prompt-title">你想看见什么？</h2>
      <form className={styles.promptForm} onSubmit={submit} noValidate>
        <label className={styles.promptLabel} htmlFor="math-concept">
          描述一个数学概念
        </label>
        <div className={styles.promptRow}>
          <input
            id="math-concept"
            className={styles.promptInput}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="例如：导数的几何意义"
            aria-describedby={error ? "prompt-error" : undefined}
            aria-invalid={Boolean(error)}
          />
          <button className={styles.promptSubmit} type="submit">
            在 Sandbox 中继续 →
          </button>
        </div>
        {error && <p id="prompt-error" className={styles.promptError}>{error}</p>}
      </form>
    </section>
  );
}
