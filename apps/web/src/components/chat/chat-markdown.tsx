import type { Components } from "react-markdown";

export const chatMarkdownComponents: Components = {
  h1: ({ node, ...props }) => (
    <h1
      className="mt-3 text-xl font-bold tracking-tight text-slate-950 dark:text-slate-50"
      {...props}
    />
  ),
  h2: ({ node, ...props }) => (
    <h2
      className="mt-4 border-l-4 border-indigo-500 pl-3 text-lg font-bold text-slate-900 dark:border-indigo-400 dark:text-slate-100"
      {...props}
    />
  ),
  h3: ({ node, ...props }) => (
    <h3
      className="mt-3 text-base font-semibold text-indigo-700 dark:text-indigo-300"
      {...props}
    />
  ),
  p: ({ node, ...props }) => (
    <p
      className="leading-relaxed text-slate-700 dark:text-slate-300"
      {...props}
    />
  ),
  ul: ({ node, ...props }) => (
    <ul
      className="ml-6 list-disc space-y-1 marker:text-indigo-500 dark:marker:text-indigo-400"
      {...props}
    />
  ),
  ol: ({ node, ...props }) => (
    <ol
      className="ml-6 list-decimal space-y-1 marker:font-semibold marker:text-indigo-600 dark:marker:text-indigo-400"
      {...props}
    />
  ),
  li: ({ node, ...props }) => (
    <li className="pl-1 text-slate-700 dark:text-slate-300" {...props} />
  ),
  strong: ({ node, ...props }) => (
    <strong
      className="font-semibold text-slate-950 dark:text-white"
      {...props}
    />
  ),
  a: ({ node, ...props }) => (
    <a
      className="font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-4 transition-colors hover:text-indigo-700 hover:decoration-indigo-500 dark:text-indigo-300 dark:decoration-indigo-700 dark:hover:text-indigo-200"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  code: ({ node, ...props }) => (
    <code
      className="px-1.5 py-0.5 font-mono text-xs font-medium text-rose-600 dark:text-rose-500"
      {...props}
    />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote
      className="my-3 border-l-4 border-amber-400 bg-amber-50/70 px-4 py-2 italic text-slate-700 dark:border-amber-500 dark:bg-amber-950/20 dark:text-slate-300"
      {...props}
    />
  ),
  hr: ({ node, ...props }) => (
    <hr className="my-4 border-slate-200 dark:border-slate-700" {...props} />
  ),
};
