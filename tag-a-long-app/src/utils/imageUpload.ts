// Image Upload Utility - Uploads via backend to keep service role key server-side
import apiClient from '../api/client';

const api = apiClient.getInstance();

export const uploadImage = async (
  uri: string,
  userId: string,
  bucketName: string = 'profile-photos'
): Promise<string> => {
  const uriParts = uri.split('.');
  const fileExt = uriParts[uriParts.length - 1].toLowerCase() || 'jpg';
  const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

  const formData = new FormData();
  formData.append('image', {
    uri,
    type: contentType,
    name: `upload.${fileExt}`,
  } as any);
  formData.append('bucket', bucketName);

  const response = await api.post('/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data.data.url;
};

// Kept for API compatibility — no-op since storage cleanup is handled server-side
export const deleteImage = async (
  filePath: string,
  bucketName: string = 'profile-photos'
): Promise<void> => {};
