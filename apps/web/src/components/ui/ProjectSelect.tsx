import type { Project } from "../../types/project";

type ProjectSelectProps = {
  id?: string;
  label?: string;
  placeholder?: string;
  value: string;
  projects: Project[];
  disabled?: boolean;
  onChange: (projectId: string) => void;
};

export function ProjectSelect({
  id = "project-select",
  label = "Projeto",
  placeholder = "Selecione um projeto...",
  value,
  projects,
  disabled = false,
  onChange,
}: ProjectSelectProps) {
  return (
    <div className="flex flex-col">
      <label
        htmlFor={id}
        className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
      >
        {label}
      </label>

      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-800 outline-none transition-all focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      >
        <option value="">{placeholder}</option>

        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
}
