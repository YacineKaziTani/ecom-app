import { api } from "./client";

export interface UploadResult {
  url: string;
  publicId: string;
}

export const uploadApi = {
  image: (file: File, folder: "products" | "categories" | "shops" | "banners" | "brand") => {
    const formData = new FormData();
    formData.append("image", file);
    return api
      .post<UploadResult>(`/upload?folder=${folder}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};
