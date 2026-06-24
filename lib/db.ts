import Dexie, { type Table } from "dexie";

type Annotation = {
  id: string;
  target: {
    x: number;
    y: number;
  };
  instruction: string;
};

type SavedProject = {
  id: string;
  imageBlob: Blob;
  imageName: string;
  width: number;
  height: number;
  annotations: Annotation[];
  updatedAt: string;
};

type SaveInput = {
  image: {
    blob: Blob;
    name: string;
    width: number;
    height: number;
  };
  annotations: Annotation[];
};

class KokoOshiteDb extends Dexie {
  projects!: Table<SavedProject, string>;

  constructor() {
    super("koko-oshite-local");
    this.version(1).stores({
      projects: "id, updatedAt",
    });
  }
}

const db = typeof window === "undefined" ? null : new KokoOshiteDb();
const LAST_PROJECT_ID = "last-project";
const LAST_PROJECT_KEY = "koko-oshite:last-project-id";

export async function saveProject(input: SaveInput) {
  if (!db) return;
  localStorage.setItem(LAST_PROJECT_KEY, LAST_PROJECT_ID);
  await db.projects.put({
    id: LAST_PROJECT_ID,
    imageBlob: input.image.blob,
    imageName: input.image.name,
    width: input.image.width,
    height: input.image.height,
    annotations: input.annotations,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadSavedProject() {
  if (!db) return null;
  const id = localStorage.getItem(LAST_PROJECT_KEY) ?? LAST_PROJECT_ID;
  return (await db.projects.get(id)) ?? null;
}

export async function clearSavedProject() {
  if (!db) return;
  localStorage.removeItem(LAST_PROJECT_KEY);
  await db.projects.delete(LAST_PROJECT_ID);
}
