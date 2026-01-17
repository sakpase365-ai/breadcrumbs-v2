import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to generate signed URLs for private storage buckets
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @param expiresIn - URL expiry time in seconds (default: 1 hour)
 */
export function useSignedUrl(
  bucket: string,
  path: string | null | undefined,
  expiresIn: number = 3600
) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path) {
      setSignedUrl(null);
      return;
    }

    // Extract just the file path if it's a full URL
    const filePath = extractFilePath(path, bucket);
    if (!filePath) {
      setSignedUrl(null);
      return;
    }

    const generateSignedUrl = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error: signError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, expiresIn);

        if (signError) throw signError;
        setSignedUrl(data.signedUrl);
      } catch (err) {
        console.error("Error generating signed URL:", err);
        setError(err instanceof Error ? err : new Error("Failed to generate signed URL"));
        setSignedUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    generateSignedUrl();
  }, [bucket, path, expiresIn]);

  return { signedUrl, isLoading, error };
}

/**
 * Extract the file path from a full URL or return the path if it's already just a path
 */
function extractFilePath(pathOrUrl: string, bucket: string): string | null {
  // If it's already just a path (no http), return as-is
  if (!pathOrUrl.startsWith("http")) {
    return pathOrUrl;
  }

  // Try to extract path from Supabase storage URL
  // Format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
  const regex = new RegExp(`/storage/v1/object/(?:public|sign)?/${bucket}/(.+)$`);
  const match = pathOrUrl.match(regex);
  
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }

  // Fallback: try to get the path after the bucket name
  const bucketIndex = pathOrUrl.indexOf(`/${bucket}/`);
  if (bucketIndex !== -1) {
    return pathOrUrl.substring(bucketIndex + bucket.length + 2);
  }

  return null;
}
