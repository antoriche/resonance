import { NextResponse } from "next/server";
import { getAllTranscriptions } from "@/lib/db/operations";
import { createLogger } from "@/lib/logger";

const logger = createLogger("API");

export async function GET() {
  try {
    const transcriptions = await getAllTranscriptions();

    return NextResponse.json({
      success: true,
      data: transcriptions,
      count: transcriptions.length,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching transcriptions");

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch transcriptions",
      },
      { status: 500 },
    );
  }
}
