import { queryClient } from "@/app/providers";
import {
  useQuery,
  useInfiniteQuery,
  queryOptions,
} from "@tanstack/react-query";
import type {
  TranscriptionListItem,
  GetTranscriptionsParams,
  PaginationInfo,
} from "@/types/api";
import axios from "axios";

export interface TranscriptionsResponse {
  success: boolean;
  data: TranscriptionListItem[];
  pagination: PaginationInfo;
}

async function getTranscriptions_(
  params?: GetTranscriptionsParams,
): Promise<TranscriptionsResponse> {
  const { data } = await axios.get<TranscriptionsResponse>(
    "/api/transcriptions",
    {
      params: {
        ...(params?.limit && { limit: params.limit }),
        ...(params?.cursor && { cursor: params.cursor }),
        ...(params?.direction && { direction: params.direction }),
        ...(params?.date && { date: params.date }),
        ...(params?.fileId && { fileId: params.fileId }),
      },
    },
  );

  // Parse date strings to Date objects
  return {
    ...data,
    data: data.data.map((item: any) => ({
      ...item,
      recordingTimestamp: new Date(item.recordingTimestamp),
    })),
  };
}

export const getTranscriptions = async (params?: GetTranscriptionsParams) =>
  queryClient.fetchQuery({
    queryKey: ["transcriptions", params],
    queryFn: () => getTranscriptions_(params),
  });

export function useTranscriptions(params?: GetTranscriptionsParams) {
  return useQuery({
    queryKey: ["transcriptions", params],
    queryFn: () =>
      getTranscriptions_({
        ...params,
      }),
  });
}

export function useInfiniteTranscriptions(
  params?: Omit<GetTranscriptionsParams, "cursor">,
) {
  return useInfiniteQuery<
    TranscriptionsResponse,
    Error,
    { pages: TranscriptionsResponse[]; pageParams: (string | undefined)[] },
    (string | Omit<GetTranscriptionsParams, "cursor"> | undefined)[],
    string | undefined
  >({
    queryKey: ["transcriptions", "infinite", params],
    queryFn: ({ pageParam }) =>
      getTranscriptions_({
        ...params,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });
}
