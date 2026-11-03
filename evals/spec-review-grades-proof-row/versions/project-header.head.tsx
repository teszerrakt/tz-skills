import { archiveProject } from '../api/projects'

export function ProjectHeader({ id, name }: { id: string; name: string }) {
  return (
    <header className="project-header">
      <h1>{name}</h1>
      <button type="button" onClick={() => archiveProject(id)}>
        Archive
      </button>
    </header>
  )
}
