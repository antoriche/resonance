import { NextResponse } from "next/server";
import { getTranscriptionsPaginated } from "@/lib/server/db/operations";
import { createLogger } from "@/lib/server/logger";

export const dynamic = "force-dynamic";

const logger = createLogger("API");

export async function GET(request: Request) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const cursor = searchParams.get("cursor") || undefined;
    const direction = (searchParams.get("direction") || "next") as
      | "next"
      | "prev";
    const dateParam = searchParams.get("date");
    const fileIdParam = searchParams.get("fileId");

    // Validate parameters
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid limit parameter. Must be a positive integer.",
        },
        { status: 400 },
      );
    }

    if (direction !== "next" && direction !== "prev") {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid direction parameter. Must be "next" or "prev".',
        },
        { status: 400 },
      );
    }

    // Parse and validate date filter
    let recordingDate: Date | undefined;
    if (dateParam) {
      recordingDate = new Date(dateParam);
      if (isNaN(recordingDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid date parameter. Use ISO 8601 format (e.g., 2026-01-01T19:00:00Z).",
          },
          { status: 400 },
        );
      }
    }

    // Fetch paginated transcriptions
    const result = await getTranscriptionsPaginated({
      limit,
      cursor,
      direction,
      filters: {
        fileId: fileIdParam || undefined,
        recordingDate,
      },
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: {
        count: result.items.length,
        nextCursor: result.nextCursor,
        prevCursor: result.prevCursor,
        limit,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error fetching transcriptions");

    // Handle invalid cursor specifically
    if (error instanceof Error && error.message === "Invalid cursor format") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid cursor format",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch transcriptions",
      },
      { status: 500 },
    );
  }
}
