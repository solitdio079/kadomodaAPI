import { HttpError } from '../middleware/http.js';

type Category = { id: number; parentId: number | null };
export function descendantIds(categories: Category[], id: number) {
  const ids = new Set([id]);
  const pending = [id];
  while (pending.length) {
    const parent = pending.pop();
    for (const node of categories) if (node.parentId === parent && !ids.has(node.id)) { ids.add(node.id); pending.push(node.id); }
  }
  return [...ids];
}
export function validateParent(categories: Category[], parentId?: number | null, editingId?: number) {
  if (parentId == null) return;
  const map = new Map(categories.map(c => [c.id, c.parentId]));
  if (!map.has(parentId)) throw new HttpError(400, 'INVALID_CATEGORY_PARENT', 'Geçerli bir üst kategori seçin.');
  const seen = new Set<number>();
  let current: number | null = parentId;
  while (current != null) {
    if (current === editingId || seen.has(current)) throw new HttpError(400, 'CATEGORY_CYCLE', 'Bir kategori kendisinin veya alt kategorisinin altına taşınamaz.');
    seen.add(current); current = map.get(current) ?? null;
  }
}
