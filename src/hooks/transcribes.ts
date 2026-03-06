import { queryClient } from "@/app/providers";
import { useQuery, queryOptions } from "@tanstack/react-query";
import axios from "axios";

export interface Transcribe {
  id: string;
  audio_file: string;
  text: string;
  timestamp: string;
  duration: number;
}

export interface TranscribesResponse {
  results: Transcribe[];
  next?: string;
}

export interface GetTranscribesParams {
  token?: string;
  limit?: number;
}

async function getTranscribes_(
  params?: GetTranscribesParams,
): Promise<TranscribesResponse> {
  const { data } = await axios.get<TranscribesResponse>("/api/transcribes", {
    params: {
      ...(params?.token && { token: params.token }),
      ...(params?.limit && { limit: params.limit }),
    },
  });

  return data;
}

export const getTranscribes = async (params?: GetTranscribesParams) =>
  queryClient.fetchQuery({
    queryKey: ["transcribes", params],
    queryFn: () => getTranscribes_(params),
  });

export function useTranscribes(params?: GetTranscribesParams) {
  return useQuery({
    queryKey: ["transcribes", params],
    queryFn: () => getTranscribes_(params),
  });
}
