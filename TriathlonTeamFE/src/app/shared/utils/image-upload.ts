export interface ImageValidationOptions {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
}

export function validateImageFile(file: File, options?: ImageValidationOptions): string | null {
  const maxSizeBytes = options?.maxSizeBytes ?? 10 * 1024 * 1024; // 10MB
  const allowedMimeTypes = options?.allowedMimeTypes ?? [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];

  if (!allowedMimeTypes.includes(file.type)) {
    return 'Format invalid. Format permis: JPEG, PNG, GIF, WEBP.';
  }

  if (file.size > maxSizeBytes) {
    return 'Imaginea este prea mare. Dimensiunea maximă: 10MB.';
  }

  return null;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onabort = () => reject(new Error('File read aborted'));
    reader.onload = () => resolve(String(reader.result ?? ''));

    reader.readAsDataURL(file);
  });
}


