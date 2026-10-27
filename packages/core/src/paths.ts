export const CORDANTRY_DIR = ".cordantry";

export function companyRoot(companyId: string): string {
  return `${CORDANTRY_DIR}/companies/${companyId}`;
}

export function departmentMemoryPath(companyId: string, departmentId: string): string {
  return `${companyRoot(companyId)}/departments/${departmentId}/Memory.md`;
}

export function taskWorkspacePath(taskId: string): string {
  return `${CORDANTRY_DIR}/workspaces/${taskId}`;
}
