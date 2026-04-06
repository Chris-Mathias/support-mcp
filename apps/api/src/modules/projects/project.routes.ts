import type { FastifyInstance } from "fastify";
import { createProjectSchema } from "./project.schemas.js";
import { ProjectService } from "./project.service.js";

const projectService = new ProjectService();

export async function projectRoutes(app: FastifyInstance) {
  app.post("/projects", async (request, reply) => {
    const parsed = createProjectSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Payload inválido",
        issues: parsed.error.flatten(),
      });
    }

    const project = await projectService.create(parsed.data);

    return reply.status(201).send(project);
  });

  app.get("/projects", async () => {
    return projectService.list();
  });

  app.get("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await projectService.getById(id);

    if (!project) {
      return reply.status(404).send({
        message: "Projeto não encontrado",
      });
    }

    return project;
  });
}
