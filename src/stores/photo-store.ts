import { create } from 'zustand';
import type { Photo } from '@/types';

type PhotoStore = {
  photos: Photo[];
  setPhotos: (photos: Photo[]) => void;
  upsertPhoto: (photo: Photo) => void;
  removePhoto: (id: string) => void;
  reset: () => void;
};

export const usePhotoStore = create<PhotoStore>((set) => ({
  photos: [],
  setPhotos: (photos) => set({ photos }),
  upsertPhoto: (photo) =>
    set((s) => {
      const idx = s.photos.findIndex((p) => p.id === photo.id);
      if (idx === -1) return { photos: [photo, ...s.photos] };
      const next = [...s.photos];
      next[idx] = photo;
      return { photos: next };
    }),
  removePhoto: (id) => set((s) => ({ photos: s.photos.filter((p) => p.id !== id) })),
  reset: () => set({ photos: [] }),
}));
