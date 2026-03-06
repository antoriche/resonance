import { NextResponse } from "next/server";
import { getAllTranscriptions } from "@/lib/db/operations";

export async function GET() {
  try {
    const transcriptions = await getAllTranscriptions();
    
    return NextResponse.json({
      success: true,
      data: transcriptions,
      count: transcriptions.length,
    });
  } catch (error) {
    console.error("[API] Error fetching transcriptions:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch transcriptions",
      },
      { status: 500 }
    );
  }
}
