import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot =
  process.env.UPLOADS_DIR ?? path.resolve(__dirname, "../../../../uploads");

export function getUploadsRoot() {
  return uploadsRoot;
}

export async function ensureProjectUploadDir(projectId: string) {
  const dir = path.join(uploadsRoot, projectId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function buildStoredFilePath(projectId: string, fileName: string) {
  return path.join(uploadsRoot, projectId, fileName);
}

export async function saveFileToDisk(filePath: string, buffer: Buffer) {
  await writeFile(filePath, buffer);
}

export async function deleteFileFromDisk(filePath: string) {
  await unlink(filePath);
}
